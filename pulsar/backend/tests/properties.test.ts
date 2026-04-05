/**
 * tests/properties.test.ts
 *
 * Property-Based Tests for Pulsar using fast-check.
 *
 * Tests 10 correctness properties derived from requirements:
 *   P1: Monotonic commitment invariant
 *   P2: Budget ceiling invariant
 *   P3: Cumulative sum invariant
 *   P4: Refund correctness
 *   P5: Settlement finality (single settlement)
 *   P6: Serialization round-trip
 *   P7: Step count lower bound (>= 5)
 *   P8: Signature verifiability
 *   P9: Deterministic step generation
 *   P10: Budget halt (agent stops before exceeding budget)
 *
 * Context: See backend/CONTEXT.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { Keypair } from '@stellar/stellar-sdk'
import {
  serializeCommitmentBytes,
  deserializeCommitmentBytes,
  signCommitment,
  openChannel,
  settleChannel,
} from '../src/channel/manager.js'
import { clearStore, saveChannel, getChannel } from '../src/channel/store.js'
import { generateTaskSteps, STEP_COSTS, totalCostUsdc } from '../src/agent/steps.js'
import { usdcToBaseUnits, baseUnitsToUsdc } from '../src/stellar/config.js'
import type { Channel } from '../src/channel/types.js'
import { v4 as uuidv4 } from 'uuid'

// Mock SSE broadcast so agent tests run without SSE infrastructure
vi.mock('../src/api/sse.js', () => ({ broadcast: vi.fn() }))

// Re-export runAgent with sleep replaced by a no-op for fast property testing
import { runAgent as _runAgent } from '../src/agent/runner.js'

/** No-op sleep for tests — skips artificial delays */
const noopSleep = () => Promise.resolve()

/**
 * Wrapper around runAgent that skips sleep() delays for fast property testing.
 */
function runAgentFast(params: Omit<Parameters<typeof _runAgent>[0], '_sleepFn'>) {
  return _runAgent({ ...params, _sleepFn: noopSleep })
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

// Use a fixed test keypair (no real Stellar network needed)
const TEST_SERVER_KEYPAIR = Keypair.random()
const TEST_USER_KEYPAIR = Keypair.random()

// Override env for tests
process.env.SERVER_SECRET_KEY = TEST_SERVER_KEYPAIR.secret()
process.env.USER_SECRET_KEY = TEST_USER_KEYPAIR.secret()
process.env.SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org'
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org'
process.env.NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
process.env.USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
process.env.USDC_SAC_ADDRESS = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
// Unset CONTRACT_ID so tests use mock contract (no real Soroban calls)
delete process.env.CONTRACT_ID

/** Create a test channel in the store */
function createTestChannel(budgetUsdc: number): Channel {
  const channelId = uuidv4()
  const now = Date.now()
  const channel: Channel = {
    id: channelId,
    contractAddress: `CTEST${channelId.replace(/-/g, '').toUpperCase().slice(0, 51)}`,
    userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    serverPublicKey: TEST_SERVER_KEYPAIR.publicKey(),
    budgetBaseUnits: usdcToBaseUnits(budgetUsdc),
    currentCommitmentAmount: 0n,
    lastCommitmentSig: null,
    lastStepIndex: -1,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  }
  saveChannel(channel)
  return channel
}

beforeEach(() => {
  clearStore()
})

// ─── P6: Serialization Round-Trip ─────────────────────────────────────────────

describe('P6: Commitment serialization round-trip', () => {
  it('deserialize(serialize(c)) === c for all valid commitments', () => {
    fc.assert(
      fc.property(
        fc.uuid(),                          // channelId
        fc.bigUintN(53),                    // amount (safe bigint range)
        fc.nat({ max: 1000 }),              // stepIndex
        (channelId, amount, stepIndex) => {
          const bytes = serializeCommitmentBytes(channelId, amount, stepIndex)
          const decoded = deserializeCommitmentBytes(bytes)

          expect(decoded.channelId).toBe(channelId)
          expect(decoded.amount).toBe(amount)
          expect(decoded.stepIndex).toBe(stepIndex)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('serialized bytes are always 48 bytes', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.bigUintN(53),
        fc.nat({ max: 1000 }),
        (channelId, amount, stepIndex) => {
          const bytes = serializeCommitmentBytes(channelId, amount, stepIndex)
          expect(bytes.length).toBe(48)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Task 6.3: Commitment Round-Trip Property ─────────────────────────────────
// **Validates: Requirements 5.3**

describe('Commitment round-trip: deserialize(serialize(c)) ≡ c', () => {
  /**
   * Property 1: Commitment round-trip
   * For all valid Commitment objects, serializing then deserializing
   * SHALL produce an equivalent Commitment (channelId, amount, stepIndex).
   *
   * Validates: Requirements 5.3
   */
  it('round-trip preserves all Commitment fields for arbitrary valid commitments', () => {
    // Arbitrary valid Commitment generator using fc.record()
    const validCommitment = fc.record({
      channelId: fc.uuid(),
      amount: fc.bigUintN(53),       // non-negative bigint (up to 2^53-1 base units)
      stepIndex: fc.nat({ max: 10_000 }),  // non-negative integer step index
    })

    fc.assert(
      fc.property(validCommitment, ({ channelId, amount, stepIndex }) => {
        // Serialize the commitment fields to canonical bytes
        const bytes = serializeCommitmentBytes(channelId, amount, stepIndex)

        // Deserialize back to commitment fields
        const decoded = deserializeCommitmentBytes(bytes)

        // Round-trip must produce equivalent object
        expect(decoded.channelId).toBe(channelId)
        expect(decoded.amount).toBe(amount)
        expect(decoded.stepIndex).toBe(stepIndex)
      }),
      { numRuns: 100 },
    )
  })
})

// ─── Task 6.4: Commitment Monotonicity Property ───────────────────────────────
// **Validates: Requirements 2.3**

describe('Commitment monotonicity: every new commitment amount >= previous commitment amount', () => {
  /**
   * Property 2: Monotonic commitment
   * For all sequences of increasing amounts within budget,
   * each new commitment amount SHALL be >= the previous commitment amount.
   *
   * Validates: Requirements 2.3
   */
  it('commitment amounts are monotonically non-decreasing across a sequence of steps', () => {
    fc.assert(
      fc.property(
        // Budget between 1 and 100 USDC
        fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
        // Array of individual step increments (each 0.001–0.05 USDC)
        fc.array(
          fc.float({ min: Math.fround(0.001), max: Math.fround(0.05), noNaN: true }),
          { minLength: 2, maxLength: 20 },
        ),
        (budgetUsdc, increments) => {
          const channel = createTestChannel(budgetUsdc)
          let cumulative = 0
          let prevAmount = 0n

          for (const inc of increments) {
            cumulative += inc
            const newAmount = usdcToBaseUnits(cumulative)

            // Stop if we'd exceed budget
            if (newAmount > channel.budgetBaseUnits) break

            const commitment = signCommitment(channel.id, newAmount)

            // Property 2: each new commitment >= previous
            expect(commitment.amount).toBeGreaterThanOrEqual(prevAmount)
            prevAmount = commitment.amount
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('equal commitment amounts are accepted (>= allows equal)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        (budgetUsdc) => {
          const channel = createTestChannel(budgetUsdc)
          const amount = usdcToBaseUnits(budgetUsdc / 2)

          // Sign same amount twice — equal is allowed by >= invariant
          const c1 = signCommitment(channel.id, amount)
          const c2 = signCommitment(channel.id, amount)

          expect(c2.amount).toBeGreaterThanOrEqual(c1.amount)
          expect(c2.amount).toBe(c1.amount)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('throws when new commitment amount < current commitment (monotonic violation)', () => {
    fc.assert(
      fc.property(
        // Budget large enough to have room
        fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true }),
        // First amount: 10–50% of budget
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
        // Reduction: 1–99% of first amount (so second < first)
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }),
        (budgetUsdc, firstFraction, reductionFraction) => {
          const channel = createTestChannel(budgetUsdc)
          const firstAmount = usdcToBaseUnits(budgetUsdc * firstFraction)

          if (firstAmount === 0n || firstAmount > channel.budgetBaseUnits) return

          // Sign the first commitment
          signCommitment(channel.id, firstAmount)

          // Attempt to sign a lower amount — must throw
          const lowerAmount = BigInt(
            Math.floor(Number(firstAmount) * (1 - reductionFraction * 0.99)),
          )

          if (lowerAmount < firstAmount) {
            expect(() => signCommitment(channel.id, lowerAmount)).toThrow()
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── P1: Monotonic Commitment ─────────────────────────────────────────────────

describe('P1: Monotonic commitment invariant', () => {
  it('each new commitment amount >= previous commitment amount', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
        fc.array(
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.1), noNaN: true }),
          { minLength: 2, maxLength: 10 },
        ),
        (budgetUsdc, stepCosts) => {
          const channel = createTestChannel(budgetUsdc)
          let cumulative = 0
          let prevAmount = 0n

          for (const cost of stepCosts) {
            cumulative += cost
            const newAmount = usdcToBaseUnits(cumulative)

            if (newAmount > channel.budgetBaseUnits) break

            const commitment = signCommitment(channel.id, newAmount)
            // P1: monotonic
            expect(commitment.amount).toBeGreaterThanOrEqual(prevAmount)
            prevAmount = commitment.amount
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('throws when new amount < current commitment (monotonic violation)', () => {
    const channel = createTestChannel(10)
    // Sign commitment at 0.05 USDC
    signCommitment(channel.id, usdcToBaseUnits(0.05))
    // Try to sign at 0.03 USDC (less than current) — must throw
    expect(() =>
      signCommitment(channel.id, usdcToBaseUnits(0.03)),
    ).toThrow()
  })
})

// ─── P2: Budget Ceiling ───────────────────────────────────────────────────────

describe('P2: Budget ceiling invariant', () => {
  it('commitment amount never exceeds budget', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }),
        (budgetUsdc, stepCostUsdc) => {
          const channel = createTestChannel(budgetUsdc)
          const stepAmount = usdcToBaseUnits(stepCostUsdc)

          if (stepAmount <= channel.budgetBaseUnits) {
            const commitment = signCommitment(channel.id, stepAmount)
            // P2: never exceeds budget
            expect(commitment.amount).toBeLessThanOrEqual(channel.budgetBaseUnits)
          } else {
            // Must throw when exceeding budget
            expect(() => signCommitment(channel.id, stepAmount)).toThrow()
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── P8: Signature Verifiability ─────────────────────────────────────────────

describe('P8: Signature verifiability', () => {
  it('commitment signed by server is verifiable with server public key', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }),
        (costUsdc) => {
          const channel = createTestChannel(10)
          const amount = usdcToBaseUnits(costUsdc)
          const commitment = signCommitment(channel.id, amount)

          // Reconstruct the bytes that were signed
          const bytes = serializeCommitmentBytes(
            commitment.channelId,
            commitment.amount,
            commitment.stepIndex,
          )

          // Verify signature with server public key
          const isValid = TEST_SERVER_KEYPAIR.verify(bytes, commitment.signature)
          expect(isValid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('signature is invalid with wrong public key', () => {
    const channel = createTestChannel(10)
    const commitment = signCommitment(channel.id, usdcToBaseUnits(0.05))
    const bytes = serializeCommitmentBytes(
      commitment.channelId,
      commitment.amount,
      commitment.stepIndex,
    )
    const wrongKeypair = Keypair.random()
    const isValid = wrongKeypair.verify(bytes, commitment.signature)
    expect(isValid).toBe(false)
  })
})

// ─── P9: Deterministic Step Generation ───────────────────────────────────────

describe('P9: Deterministic task step generation', () => {
  it('same task description always produces same steps', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 100 }),
        (taskDescription) => {
          const steps1 = generateTaskSteps(taskDescription)
          const steps2 = generateTaskSteps(taskDescription)

          expect(steps1.length).toBe(steps2.length)
          for (let i = 0; i < steps1.length; i++) {
            expect(steps1[i].type).toBe(steps2[i].type)
            expect(steps1[i].costUsdc).toBe(steps2[i].costUsdc)
            expect(steps1[i].description).toBe(steps2[i].description)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── Task 8.4: Deterministic Steps Property ──────────────────────────────────
// **Validates: Requirements 3.3**

describe('Deterministic steps: generateTaskSteps(task) always produces the same sequence for the same input', () => {
  /**
   * Property 6: Deterministic task steps
   * FOR ALL valid task descriptions, generateTaskSteps(task) SHALL always
   * produce the same sequence of steps (type, cost, description, index) for
   * the same input. Demo results must be reproducible (Req 3.3).
   *
   * Validates: Requirements 3.3
   */
  it('generateTaskSteps returns identical step sequences on repeated calls with the same input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 200 }),
        (taskDescription) => {
          const steps1 = generateTaskSteps(taskDescription)
          const steps2 = generateTaskSteps(taskDescription)
          const steps3 = generateTaskSteps(taskDescription)

          // Step count must be identical across all calls
          expect(steps1.length).toBe(steps2.length)
          expect(steps1.length).toBe(steps3.length)

          for (let i = 0; i < steps1.length; i++) {
            // Each field must be identical (Property 6: determinism)
            expect(steps2[i].index).toBe(steps1[i].index)
            expect(steps2[i].type).toBe(steps1[i].type)
            expect(steps2[i].costUsdc).toBe(steps1[i].costUsdc)
            expect(steps2[i].cumulativeCostUsdc).toBe(steps1[i].cumulativeCostUsdc)
            expect(steps2[i].description).toBe(steps1[i].description)

            expect(steps3[i].index).toBe(steps1[i].index)
            expect(steps3[i].type).toBe(steps1[i].type)
            expect(steps3[i].costUsdc).toBe(steps1[i].costUsdc)
            expect(steps3[i].cumulativeCostUsdc).toBe(steps1[i].cumulativeCostUsdc)
            expect(steps3[i].description).toBe(steps1[i].description)
          }
        },
      ),
      { numRuns: 300 },
    )
  })

  it('different task descriptions may produce different step sequences', () => {
    fc.assert(
      fc.property(
        // Two distinct task descriptions
        fc.tuple(
          fc.string({ minLength: 3, maxLength: 100 }),
          fc.string({ minLength: 3, maxLength: 100 }),
        ).filter(([a, b]) => a !== b),
        ([taskA, taskB]) => {
          const stepsA = generateTaskSteps(taskA)
          const stepsB = generateTaskSteps(taskB)

          // Each call is still internally deterministic
          expect(generateTaskSteps(taskA)).toEqual(stepsA)
          expect(generateTaskSteps(taskB)).toEqual(stepsB)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('step costs match STEP_COSTS constants (deterministic cost assignment per step type)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 200 }),
        (taskDescription) => {
          const steps = generateTaskSteps(taskDescription)

          for (const step of steps) {
            // Req 3.3: cost per step type is fixed and deterministic
            expect(step.costUsdc).toBe(STEP_COSTS[step.type])
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── P7: Step Count Lower Bound ──────────────────────────────────────────────

describe('P7: Step count lower bound', () => {
  it('every task generates at least 5 steps', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 200 }),
        (taskDescription) => {
          const steps = generateTaskSteps(taskDescription)
          expect(steps.length).toBeGreaterThanOrEqual(5)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── P3: Cumulative Sum Invariant ─────────────────────────────────────────────

describe('P3: Cumulative sum invariant', () => {
  it('final commitment amount equals sum of all step costs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 100 }),
        (taskDescription) => {
          const steps = generateTaskSteps(taskDescription)
          const totalCost = steps.reduce((sum, s) => sum + s.costUsdc, 0)
          const lastStep = steps[steps.length - 1]

          // Cumulative cost of last step should equal total
          expect(lastStep.cumulativeCostUsdc).toBeCloseTo(totalCost, 7)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── P4: Refund Correctness ───────────────────────────────────────────────────

describe('P4: Refund correctness', () => {
  it('refund = budget - finalCommitment, always non-negative', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }),
        (budgetUsdc, costUsdc) => {
          if (costUsdc > budgetUsdc) return // skip invalid case

          const budgetBase = usdcToBaseUnits(budgetUsdc)
          const costBase = usdcToBaseUnits(costUsdc)
          const refundBase = budgetBase - costBase

          // P4: refund is non-negative
          expect(refundBase).toBeGreaterThanOrEqual(0n)

          // P4: refund + cost = budget
          expect(refundBase + costBase).toBe(budgetBase)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── P5: Settlement Finality ──────────────────────────────────────────────────

describe('P5: Settlement finality (single settlement)', () => {
  it('settling a closed channel throws CHANNEL_ALREADY_CLOSED', async () => {
    const channel = createTestChannel(10)
    // Sign a commitment first
    signCommitment(channel.id, usdcToBaseUnits(0.05))

    // First settlement should succeed
    const result = await settleChannel(channel.id)
    expect(result.txHash).toBeTruthy()

    // Second settlement must throw
    await expect(settleChannel(channel.id)).rejects.toThrow()

    // Channel status must be 'closed'
    const closedChannel = getChannel(channel.id)
    expect(closedChannel?.status).toBe('closed')
  })
})

// ─── Task 7.2: Single Settlement Property ────────────────────────────────────
// **Validates: Requirements 4.5**

describe('Single settlement: settleChannel twice on same channel must error on second call', () => {
  /**
   * Property 4: Single settlement
   * For all valid channels, calling settleChannel twice on the same channel
   * SHALL throw an error on the second call.
   * After settlement, channel status SHALL be 'closed'.
   *
   * Validates: Requirements 4.5
   */
  it('second settleChannel call always throws for any budget and commitment amount', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Budget between 0.1 and 50 USDC
        fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true }),
        // Commitment fraction: 0 to 1.0 of budget (0 = no commitment before settle)
        fc.float({ min: Math.fround(0), max: Math.fround(1.0), noNaN: true }),
        async (budgetUsdc, commitFraction) => {
          clearStore()
          const channel = createTestChannel(budgetUsdc)

          // Optionally sign a commitment before settling
          const commitAmount = BigInt(Math.floor(Number(channel.budgetBaseUnits) * commitFraction))
          if (commitAmount > 0n) {
            signCommitment(channel.id, commitAmount)
          }

          // First settlement must succeed
          const result = await settleChannel(channel.id)
          expect(result.txHash).toBeTruthy()

          // Channel status must be 'closed' after first settlement
          const closedChannel = getChannel(channel.id)
          expect(closedChannel?.status).toBe('closed')

          // Second settlement must always throw (Property 4: single settlement)
          await expect(settleChannel(channel.id)).rejects.toThrow()
        },
      ),
      { numRuns: 20 },
    )
  }, 30_000)

  it('channel status is closed after settlement, regardless of commitment history', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Budget between 0.5 and 20 USDC
        fc.float({ min: Math.fround(0.5), max: Math.fround(20), noNaN: true }),
        // Number of commitment steps before settling (0 to 5)
        fc.nat({ max: 5 }),
        async (budgetUsdc, numSteps) => {
          clearStore()
          const channel = createTestChannel(budgetUsdc)

          // Sign multiple commitments (monotonically increasing)
          const stepSize = channel.budgetBaseUnits / BigInt(numSteps + 1)
          for (let i = 1; i <= numSteps; i++) {
            const amount = stepSize * BigInt(i)
            if (amount > 0n && amount <= channel.budgetBaseUnits) {
              signCommitment(channel.id, amount)
            }
          }

          // Settle the channel
          await settleChannel(channel.id)

          // Status must be 'closed' regardless of how many steps were taken
          const settled = getChannel(channel.id)
          expect(settled?.status).toBe('closed')

          // Attempting to settle again must throw
          await expect(settleChannel(channel.id)).rejects.toThrow()
        },
      ),
      { numRuns: 20 },
    )
  }, 30_000)
})

// ─── Task 6.5: Budget Ceiling Property ───────────────────────────────────────
// **Validates: Requirements 2.4**

describe('Budget ceiling: commitment.amount <= channel.budgetBaseUnits always holds', () => {
  /**
   * Property 3: Budget ceiling
   * For all valid commitments, commitment.amount SHALL never exceed channel.budgetBaseUnits.
   * Attempting to sign a commitment that would exceed the budget MUST throw an error.
   *
   * Validates: Requirements 2.4
   */
  it('commitment.amount is always <= channel.budgetBaseUnits for any valid signed commitment', () => {
    fc.assert(
      fc.property(
        // Budget between 0.1 and 50 USDC
        fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true }),
        // Amount fraction: 0.001 to 1.0 of budget (so it stays within budget)
        fc.float({ min: Math.fround(0.001), max: Math.fround(1.0), noNaN: true }),
        (budgetUsdc, fraction) => {
          const channel = createTestChannel(budgetUsdc)
          const amount = BigInt(Math.floor(Number(channel.budgetBaseUnits) * fraction))

          if (amount === 0n) return // skip zero amounts

          const commitment = signCommitment(channel.id, amount)

          // Property 3: commitment.amount must never exceed budget
          expect(commitment.amount).toBeLessThanOrEqual(channel.budgetBaseUnits)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('attempting to sign a commitment exceeding budget always throws an error', () => {
    fc.assert(
      fc.property(
        // Budget between 0.01 and 10 USDC
        fc.float({ min: Math.fround(0.01), max: Math.fround(10), noNaN: true }),
        // Overage: 1 to 100 base units above budget
        fc.nat({ max: 100 }),
        (budgetUsdc, overage) => {
          const channel = createTestChannel(budgetUsdc)
          const overBudgetAmount = channel.budgetBaseUnits + BigInt(overage + 1)

          // Must always throw when exceeding budget (Req 2.4)
          expect(() => signCommitment(channel.id, overBudgetAmount)).toThrow()
        },
      ),
      { numRuns: 300 },
    )
  })

  it('commitment at exactly the budget ceiling is accepted', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(20), noNaN: true }),
        (budgetUsdc) => {
          const channel = createTestChannel(budgetUsdc)

          // Signing exactly at budget ceiling must succeed
          const commitment = signCommitment(channel.id, channel.budgetBaseUnits)

          expect(commitment.amount).toBe(channel.budgetBaseUnits)
          expect(commitment.amount).toBeLessThanOrEqual(channel.budgetBaseUnits)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── Task 8.3: Cumulative Cost Invariant ─────────────────────────────────────
// **Validates: Requirements 2.6, 3.2**

describe('Cumulative cost invariant: finalCommitment.amount === sum(step.cost for all completed steps)', () => {
  /**
   * Property 5: Cumulative cost
   * FOR ALL valid Commitment sequences, the final Commitment amount SHALL equal
   * the sum of all individual step costs accumulated during the session.
   *
   * Validates: Requirements 2.6, 3.2
   */
  it('final commitment amount equals sum of all step costs for arbitrary task descriptions', () => {
    fc.assert(
      fc.property(
        // Arbitrary task description (at least 3 chars to ensure valid step generation)
        fc.string({ minLength: 3, maxLength: 100 }),
        // Budget large enough to cover all steps (max 8 steps × 0.05 USDC = 0.40 USDC, use 1 USDC)
        fc.constant(1.0),
        (taskDescription, budgetUsdc) => {
          const channel = createTestChannel(budgetUsdc)
          const steps = generateTaskSteps(taskDescription)

          // Simulate the runner: sign a commitment for each step's cumulative cost
          let cumulativeCostUsdc = 0
          let lastCommitment: ReturnType<typeof signCommitment> | null = null

          for (const step of steps) {
            cumulativeCostUsdc = Math.round(
              (cumulativeCostUsdc + step.costUsdc) * 10_000_000,
            ) / 10_000_000

            const newAmountBaseUnits = usdcToBaseUnits(cumulativeCostUsdc)
            lastCommitment = signCommitment(channel.id, newAmountBaseUnits)
          }

          // Property 5: final commitment amount must equal sum of all step costs
          const expectedTotalBaseUnits = usdcToBaseUnits(
            steps.reduce((sum, s) => Math.round((sum + s.costUsdc) * 10_000_000) / 10_000_000, 0),
          )

          expect(lastCommitment).not.toBeNull()
          expect(lastCommitment!.amount).toBe(expectedTotalBaseUnits)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('final commitment amount matches last step cumulativeCostUsdc converted to base units', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 100 }),
        (taskDescription) => {
          const channel = createTestChannel(1.0)
          const steps = generateTaskSteps(taskDescription)
          const lastStep = steps[steps.length - 1]

          // Sign commitments for each step
          let cumulativeCostUsdc = 0
          let lastCommitment: ReturnType<typeof signCommitment> | null = null

          for (const step of steps) {
            cumulativeCostUsdc = Math.round(
              (cumulativeCostUsdc + step.costUsdc) * 10_000_000,
            ) / 10_000_000
            lastCommitment = signCommitment(channel.id, usdcToBaseUnits(cumulativeCostUsdc))
          }

          // Req 3.2: final commitment amount must match last step's cumulativeCostUsdc
          expect(lastCommitment!.amount).toBe(usdcToBaseUnits(lastStep.cumulativeCostUsdc))
        },
      ),
      { numRuns: 200 },
    )
  })

  it('each intermediate commitment amount equals cumulative cost up to that step', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 100 }),
        (taskDescription) => {
          const channel = createTestChannel(1.0)
          const steps = generateTaskSteps(taskDescription)

          let cumulativeCostUsdc = 0

          for (const step of steps) {
            cumulativeCostUsdc = Math.round(
              (cumulativeCostUsdc + step.costUsdc) * 10_000_000,
            ) / 10_000_000

            const commitment = signCommitment(channel.id, usdcToBaseUnits(cumulativeCostUsdc))

            // Req 2.6: each commitment amount equals cumulative cost up to this step
            expect(commitment.amount).toBe(usdcToBaseUnits(step.cumulativeCostUsdc))
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── P10: Budget Halt ─────────────────────────────────────────────────────────

describe('P10: Budget halt', () => {
  it('signCommitment throws when amount exceeds budget', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true }),
        (budgetUsdc) => {
          const channel = createTestChannel(budgetUsdc)
          const overBudget = usdcToBaseUnits(budgetUsdc + 0.01)

          expect(() => signCommitment(channel.id, overBudget)).toThrow()

          // Channel should NOT be closed after failed commitment
          const ch = getChannel(channel.id)
          expect(ch?.status).not.toBe('closed')
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Task 8.5: Budget Exhaustion Halts Execution ─────────────────────────────
// **Validates: Requirements 3.5, 2.4**

describe('Budget exhaustion halts execution: agent stops before exceeding budget', () => {
  /**
   * Property 7: Budget halt
   * IF budget < totalCost(allSteps), the Agent_Runner SHALL stop execution
   * before the cumulative cost exceeds the channel budget.
   * The total cost charged MUST NOT exceed the channel budget.
   *
   * Validates: Requirements 3.5, 2.4
   */
  it('runAgent total cost never exceeds channel budget for any task and small budget', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary task description (at least 3 chars)
        fc.string({ minLength: 3, maxLength: 80 }),
        // Small budget: 0.01–0.10 USDC — likely less than totalCost(allSteps)
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.10), noNaN: true }),
        async (taskDescription, budgetUsdc) => {
          clearStore()
          const channel = createTestChannel(budgetUsdc)

          const result = await runAgentFast({ channelId: channel.id, taskDescription })

          // Property 7: total cost charged must never exceed budget (Req 3.5, 2.4)
          expect(result.totalCostUsdc).toBeLessThanOrEqual(budgetUsdc + 1e-7)

          // If budget was exhausted, completedNormally must be false (Req 3.5)
          const steps = generateTaskSteps(taskDescription)
          const fullCost = totalCostUsdc(steps)
          if (fullCost > budgetUsdc) {
            expect(result.completedNormally).toBe(false)
          }

          // Channel must not be in 'open' state after run (it ran or was exhausted)
          const ch = getChannel(channel.id)
          expect(ch?.status).not.toBe('open')
        },
      ),
      { numRuns: 50 },
    )
  }, 60_000)

  it('agent reports last completed step index when budget is exhausted mid-task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 80 }),
        // Budget that covers only 1–3 steps (each step costs 0.01–0.05 USDC)
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.08), noNaN: true }),
        async (taskDescription, budgetUsdc) => {
          clearStore()
          const channel = createTestChannel(budgetUsdc)
          const steps = generateTaskSteps(taskDescription)
          const fullCost = totalCostUsdc(steps)

          // Only test cases where budget is genuinely insufficient
          if (fullCost <= budgetUsdc) return

          const result = await runAgentFast({ channelId: channel.id, taskDescription })

          // Req 3.5: agent stopped before exceeding budget
          expect(result.completedNormally).toBe(false)
          expect(result.totalCostUsdc).toBeLessThanOrEqual(budgetUsdc + 1e-7)

          // totalSteps must be less than the full step count
          expect(result.totalSteps).toBeLessThan(steps.length)

          // remainingBudget must be non-negative (Req 2.4)
          expect(result.remainingBudgetUsdc).toBeGreaterThanOrEqual(-1e-7)
        },
      ),
      { numRuns: 50 },
    )
  }, 60_000)
})
