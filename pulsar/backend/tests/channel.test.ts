/**
 * tests/channel.test.ts
 *
 * Integration tests for Pulsar channel lifecycle.
 *
 * Tests the full flow: open → run agent → settle
 * All Soroban/Horizon calls are mocked — no real testnet needed.
 *
 * Context: See backend/CONTEXT.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Keypair } from '@stellar/stellar-sdk'
import { clearStore, getChannel } from '../src/channel/store.js'
import {
  openChannel,
  signCommitment,
  settleChannel,
  serializeCommitmentBytes,
  deserializeCommitmentBytes,
} from '../src/channel/manager.js'
import { generateTaskSteps } from '../src/agent/steps.js'
import { usdcToBaseUnits, baseUnitsToUsdc } from '../src/stellar/config.js'
import { PulsarError, PulsarErrorCode } from '../src/channel/types.js'

// ─── Setup ────────────────────────────────────────────────────────────────────

const TEST_SERVER_KEYPAIR = Keypair.random()
const TEST_USER_KEYPAIR = Keypair.random()

process.env.SERVER_SECRET_KEY = TEST_SERVER_KEYPAIR.secret()
process.env.USER_SECRET_KEY = TEST_USER_KEYPAIR.secret()
process.env.SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org'
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org'
process.env.NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
process.env.USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
process.env.USDC_SAC_ADDRESS = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
// Disable demo mode so balance checks run (tests mock getUsdcBalance directly)
process.env.DEMO_MODE = 'false'
// Unset CONTRACT_ID so tests use mock contract (no real Soroban calls)
delete process.env.CONTRACT_ID
delete process.env.CONTRACT_WASM_PATH
delete process.env.CONTRACT_WASM_HASH

// Mock getUsdcBalance to return sufficient balance
vi.mock('../src/stellar/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/stellar/config.js')>()
  return {
    ...actual,
    getUsdcBalance: vi.fn().mockResolvedValue('100.0000000'),
    getServerKeypair: () => TEST_SERVER_KEYPAIR,
    getUserKeypair: () => TEST_USER_KEYPAIR,
  }
})

beforeEach(() => {
  clearStore()
})

// ─── Channel Open ─────────────────────────────────────────────────────────────

describe('openChannel', () => {
  it('creates a channel with correct initial state', async () => {
    const result = await openChannel({
      budgetUsdc: 10,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    expect(result.channelId).toBeTruthy()
    expect(result.budgetUsdc).toBe(10)
    expect(result.status).toBe('open')
    expect(result.contractAddress).toBeTruthy()

    const channel = getChannel(result.channelId)
    expect(channel).toBeDefined()
    expect(channel!.currentCommitmentAmount).toBe(0n)
    expect(channel!.lastStepIndex).toBe(-1)
    expect(channel!.status).toBe('open')
  })

  it('throws INSUFFICIENT_USDC_BALANCE when balance is too low', async () => {
    // Re-import to get the mocked version
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('5.0000000')

    let threw = false
    try {
      await openChannel({
        budgetUsdc: 10,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      })
    } catch (err) {
      threw = true
      expect(err).toBeInstanceOf(PulsarError)
      expect((err as PulsarError).code).toBe(PulsarErrorCode.INSUFFICIENT_USDC_BALANCE)
    }
    expect(threw).toBe(true)
  })

  it('throws for invalid budget (zero)', async () => {
    await expect(
      openChannel({
        budgetUsdc: 0,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      }),
    ).rejects.toThrow()
  })
})

// ─── Commitment Signing ───────────────────────────────────────────────────────

describe('signCommitment', () => {
  it('signs commitment with correct amount and step index', async () => {
    const { channelId } = await openChannel({
      budgetUsdc: 10,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    const commitment = signCommitment(channelId, usdcToBaseUnits(0.05))

    expect(commitment.channelId).toBe(channelId)
    expect(commitment.amount).toBe(usdcToBaseUnits(0.05))
    expect(commitment.stepIndex).toBe(0)
    expect(commitment.signature).toBeInstanceOf(Uint8Array)
    expect(commitment.signature.length).toBe(64) // ed25519 signature
  })

  it('increments step index on each commitment', async () => {
    const { channelId } = await openChannel({
      budgetUsdc: 10,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    const c1 = signCommitment(channelId, usdcToBaseUnits(0.05))
    const c2 = signCommitment(channelId, usdcToBaseUnits(0.10))
    const c3 = signCommitment(channelId, usdcToBaseUnits(0.15))

    expect(c1.stepIndex).toBe(0)
    expect(c2.stepIndex).toBe(1)
    expect(c3.stepIndex).toBe(2)
  })

  it('updates channel currentCommitmentAmount', async () => {
    const { channelId } = await openChannel({
      budgetUsdc: 10,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    signCommitment(channelId, usdcToBaseUnits(0.07))

    const channel = getChannel(channelId)
    expect(channel!.currentCommitmentAmount).toBe(usdcToBaseUnits(0.07))
  })

  it('throws CHANNEL_NOT_FOUND for unknown channel', () => {
    expect(() =>
      signCommitment('non-existent-id', usdcToBaseUnits(0.05)),
    ).toThrow(PulsarError)
  })

  it('throws when amount decreases (monotonic violation)', async () => {
    const { channelId } = await openChannel({
      budgetUsdc: 10,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    signCommitment(channelId, usdcToBaseUnits(0.10))

    expect(() =>
      signCommitment(channelId, usdcToBaseUnits(0.05)),
    ).toThrow()
  })

  it('throws BUDGET_EXHAUSTED when amount exceeds budget', async () => {
    const { channelId } = await openChannel({
      budgetUsdc: 1,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    expect(() =>
      signCommitment(channelId, usdcToBaseUnits(1.01)),
    ).toThrow(PulsarError)
  })
})

// ─── Settlement ───────────────────────────────────────────────────────────────

describe('settleChannel', () => {
  it('settles channel and returns correct refund', async () => {
    const budgetUsdc = 10
    const { channelId } = await openChannel({
      budgetUsdc,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    // Sign some commitments
    signCommitment(channelId, usdcToBaseUnits(0.05))
    signCommitment(channelId, usdcToBaseUnits(0.10))
    signCommitment(channelId, usdcToBaseUnits(0.15))

    const result = await settleChannel(channelId)

    expect(result.txHash).toBeTruthy()
    expect(result.amountPaidUsdc).toBeCloseTo(0.15, 5)
    expect(result.refundUsdc).toBeCloseTo(budgetUsdc - 0.15, 5)
    expect(result.explorerUrl).toContain(result.txHash)

    // Channel must be closed
    const channel = getChannel(channelId)
    expect(channel!.status).toBe('closed')
    expect(channel!.settlementTxHash).toBe(result.txHash)
  })

  it('throws CHANNEL_ALREADY_CLOSED on second settlement', async () => {
    const { channelId } = await openChannel({
      budgetUsdc: 10,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })
    signCommitment(channelId, usdcToBaseUnits(0.05))

    await settleChannel(channelId)

    await expect(settleChannel(channelId)).rejects.toMatchObject({
      code: PulsarErrorCode.CHANNEL_ALREADY_CLOSED,
    })
  })

  it('settles with zero commitment (full refund)', async () => {
    const budgetUsdc = 5
    const { channelId } = await openChannel({
      budgetUsdc,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    // No commitments signed — full refund
    const result = await settleChannel(channelId)

    expect(result.amountPaidUsdc).toBe(0)
    expect(result.refundUsdc).toBeCloseTo(budgetUsdc, 5)
  })
})

// ─── Full Flow Integration ────────────────────────────────────────────────────

describe('Full channel lifecycle', () => {
  it('open → sign 5 commitments → settle → verify monotonic + cumulative', async () => {
    const budgetUsdc = 10
    const { channelId } = await openChannel({
      budgetUsdc,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    const steps = generateTaskSteps('Analyze market trends and generate report')
    expect(steps.length).toBeGreaterThanOrEqual(5)

    let cumulativeCost = 0
    let prevAmount = 0n

    for (const step of steps) {
      cumulativeCost += step.costUsdc
      const newAmount = usdcToBaseUnits(cumulativeCost)

      const commitment = signCommitment(channelId, newAmount)

      // P1: Monotonic
      expect(commitment.amount).toBeGreaterThanOrEqual(prevAmount)
      prevAmount = commitment.amount

      // P2: Budget ceiling
      expect(commitment.amount).toBeLessThanOrEqual(usdcToBaseUnits(budgetUsdc))
    }

    // P3: Final commitment = sum of step costs
    const channel = getChannel(channelId)
    const finalAmount = baseUnitsToUsdc(channel!.currentCommitmentAmount)
    expect(finalAmount).toBeCloseTo(cumulativeCost, 5)

    // Settle
    const settlement = await settleChannel(channelId)

    // P4: Refund correctness
    expect(settlement.amountPaidUsdc).toBeCloseTo(cumulativeCost, 5)
    expect(settlement.refundUsdc).toBeCloseTo(budgetUsdc - cumulativeCost, 5)
    expect(settlement.refundUsdc).toBeGreaterThanOrEqual(0)

    // P5: Channel closed
    const closedChannel = getChannel(channelId)
    expect(closedChannel!.status).toBe('closed')
  })
})

// ─── Serialization ────────────────────────────────────────────────────────────

describe('Commitment serialization', () => {
  it('round-trip preserves all fields', () => {
    const channelId = '550e8400-e29b-41d4-a716-446655440000'
    const amount = 500_000n
    const stepIndex = 42

    const bytes = serializeCommitmentBytes(channelId, amount, stepIndex)
    const decoded = deserializeCommitmentBytes(bytes)

    expect(decoded.channelId).toBe(channelId)
    expect(decoded.amount).toBe(amount)
    expect(decoded.stepIndex).toBe(stepIndex)
  })

  it('throws for invalid byte length', () => {
    expect(() =>
      deserializeCommitmentBytes(Buffer.alloc(10)),
    ).toThrow('Invalid commitment bytes length')
  })
})

// ─── Budget Exhaustion Flow ───────────────────────────────────────────────────

/**
 * Integration test: budget exhaustion flow
 *
 * Validates Requirements 2.4 and 3.5:
 * - Req 2.4: IF a new Commitment amount would exceed the channel's Budget,
 *            THEN the Channel_Manager SHALL halt the Agent_Runner and return
 *            an error indicating budget exhausted.
 * - Req 3.5: IF the channel Budget is exhausted mid-task, THEN the Agent_Runner
 *            SHALL stop execution, report the last completed step, and indicate
 *            that the budget limit was reached.
 */
describe('Budget exhaustion flow', () => {
  it('agent stops before all steps complete when budget is too small', async () => {
    // Step costs: reasoning=0.01, tool_web_search=0.02, llm_call=0.05, ...
    // Budget of 0.05 USDC allows steps 1+2 (0.01+0.02=0.03) but not step 3 (0.03+0.05=0.08)
    const tinyBudgetUsdc = 0.05

    const { channelId } = await openChannel({
      budgetUsdc: tinyBudgetUsdc,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    const { runAgent } = await import('../src/agent/runner.js')

    const result = await runAgent({
      channelId,
      taskDescription: 'Analyze market trends and generate report',
      _sleepFn: async () => {}, // skip artificial delays
    })

    // Agent must have stopped before completing all steps
    const allSteps = generateTaskSteps('Analyze market trends and generate report')
    expect(result.totalSteps).toBeLessThan(allSteps.length)

    // completedNormally must be false — budget was exhausted
    expect(result.completedNormally).toBe(false)

    // "budget exhausted" indicator: remainingBudgetUsdc should be >= 0
    // and totalCostUsdc should be <= tinyBudgetUsdc
    expect(result.totalCostUsdc).toBeLessThanOrEqual(tinyBudgetUsdc)
    expect(result.remainingBudgetUsdc).toBeGreaterThanOrEqual(0)
  })

  it('result contains budget exhausted indicator (completedNormally: false)', async () => {
    // Use a budget that covers only the first step (reasoning = 0.01 USDC)
    // Step 2 (tool_web_search = 0.02) would bring cumulative to 0.03, still within 0.02? No.
    // Budget 0.01 → step 1 costs 0.01 (exactly at limit), step 2 would exceed
    const budgetUsdc = 0.01

    const { channelId } = await openChannel({
      budgetUsdc,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    const { runAgent } = await import('../src/agent/runner.js')

    const result = await runAgent({
      channelId,
      taskDescription: 'Analyze market trends and generate report',
      _sleepFn: async () => {},
    })

    // Must not have completed normally
    expect(result.completedNormally).toBe(false)

    // Channel status should be 'completed' (runner sets this on budget exhaustion)
    const channel = getChannel(channelId)
    expect(channel!.status).toBe('completed')

    // Verify the agent stopped early — fewer steps than total
    const allSteps = generateTaskSteps('Analyze market trends and generate report')
    expect(result.totalSteps).toBeLessThan(allSteps.length)
  })

  it('channel state reflects partial execution after budget exhaustion', async () => {
    const budgetUsdc = 0.05

    const { channelId } = await openChannel({
      budgetUsdc,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    const { runAgent } = await import('../src/agent/runner.js')

    await runAgent({
      channelId,
      taskDescription: 'Analyze market trends and generate report',
      _sleepFn: async () => {},
    })

    const channel = getChannel(channelId)

    // Channel should be in 'completed' state (not 'closed' — settlement not yet done)
    expect(channel!.status).toBe('completed')

    // currentCommitmentAmount should be > 0 (some steps ran)
    expect(channel!.currentCommitmentAmount).toBeGreaterThan(0n)

    // currentCommitmentAmount must not exceed budget
    expect(channel!.currentCommitmentAmount).toBeLessThanOrEqual(channel!.budgetBaseUnits)

    // lastStepIndex should be >= 0 (at least one step completed)
    expect(channel!.lastStepIndex).toBeGreaterThanOrEqual(0)
  })
})
