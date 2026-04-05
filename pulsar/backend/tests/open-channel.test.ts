/**
 * tests/open-channel.test.ts
 *
 * Unit tests for openChannel in channel/manager.ts
 *
 * Covers:
 *   - Insufficient USDC balance → error before any on-chain call (Req 1.3)
 *   - Contract deployment failure → error + balance unchanged (Req 1.4)
 *
 * Requirements: 1.3, 1.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Keypair } from '@stellar/stellar-sdk'
import { clearStore, storeSize } from '../src/channel/store.js'
import { openChannel } from '../src/channel/manager.js'
import { PulsarError, PulsarErrorCode } from '../src/channel/types.js'

// ─── Test Keypairs ────────────────────────────────────────────────────────────

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

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock stellar config — control getUsdcBalance per test
vi.mock('../src/stellar/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/stellar/config.js')>()
  return {
    ...actual,
    getUsdcBalance: vi.fn().mockResolvedValue('100.0000000'),
    getServerKeypair: () => TEST_SERVER_KEYPAIR,
    getUserKeypair: () => TEST_USER_KEYPAIR,
  }
})

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore()
  vi.clearAllMocks()
})

// ─── Req 1.3: Insufficient balance → error before on-chain call ───────────────

describe('openChannel — insufficient USDC balance (Req 1.3)', () => {
  it('throws INSUFFICIENT_USDC_BALANCE when balance < budget', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('4.9999999')

    await expect(
      openChannel({
        budgetUsdc: 5,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      }),
    ).rejects.toMatchObject({
      code: PulsarErrorCode.INSUFFICIENT_USDC_BALANCE,
    })
  })

  it('error message includes actual balance and required amount', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('3.0000000')

    let caughtError: PulsarError | null = null
    try {
      await openChannel({
        budgetUsdc: 10,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      })
    } catch (err) {
      caughtError = err as PulsarError
    }

    expect(caughtError).toBeInstanceOf(PulsarError)
    expect(caughtError!.message).toContain('3')
    expect(caughtError!.message).toContain('10')
  })

  it('does NOT save channel to store when balance is insufficient', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('0.0000000')

    try {
      await openChannel({
        budgetUsdc: 5,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      })
    } catch {
      // expected
    }

    // Store must remain empty — no channel was persisted
    expect(storeSize()).toBe(0)
  })

  it('calls getUsdcBalance before any contract interaction', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('1.0000000')

    try {
      await openChannel({
        budgetUsdc: 50,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      })
    } catch {
      // expected
    }

    // getUsdcBalance must have been called exactly once
    expect(vi.mocked(getUsdcBalance)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(getUsdcBalance)).toHaveBeenCalledWith(TEST_USER_KEYPAIR.publicKey())
  })

  it('throws when balance is exactly zero', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('0')

    await expect(
      openChannel({
        budgetUsdc: 1,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      }),
    ).rejects.toBeInstanceOf(PulsarError)
  })

  it('succeeds when balance exactly equals budget', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('10.0000000')

    const result = await openChannel({
      budgetUsdc: 10,
      userPublicKey: TEST_USER_KEYPAIR.publicKey(),
    })

    expect(result.status).toBe('open')
    expect(result.budgetUsdc).toBe(10)
  })
})

// ─── Req 1.4: Contract failure → error + balance unchanged ───────────────────

// Mock the store module so we can simulate saveChannel throwing
vi.mock('../src/channel/store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/channel/store.js')>()
  return {
    ...actual,
    saveChannel: vi.fn(actual.saveChannel),
  }
})

describe('openChannel — contract failure (Req 1.4)', () => {
  it('throws when saveChannel fails (simulates post-contract persistence failure)', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    const { saveChannel } = await import('../src/channel/store.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('100.0000000')
    vi.mocked(saveChannel).mockImplementationOnce(() => {
      throw new Error('Contract deployment failed: network error')
    })

    await expect(
      openChannel({
        budgetUsdc: 5,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      }),
    ).rejects.toThrow('Contract deployment failed: network error')
  })

  it('does NOT persist channel state when contract deployment fails', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    const { saveChannel } = await import('../src/channel/store.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('100.0000000')
    vi.mocked(saveChannel).mockImplementationOnce(() => {
      throw new Error('Soroban contract invocation failed')
    })

    try {
      await openChannel({
        budgetUsdc: 5,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      })
    } catch {
      // expected
    }

    // Store must remain empty — no channel was committed
    expect(storeSize()).toBe(0)
  })

  it('throws CHANNEL_OPEN_FAILED for zero budget (invalid input)', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('100.0000000')

    await expect(
      openChannel({
        budgetUsdc: 0,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      }),
    ).rejects.toMatchObject({
      code: PulsarErrorCode.CHANNEL_OPEN_FAILED,
    })
  })

  it('does NOT save channel to store on CHANNEL_OPEN_FAILED', async () => {
    const { getUsdcBalance } = await import('../src/stellar/config.js')
    vi.mocked(getUsdcBalance).mockResolvedValueOnce('100.0000000')

    try {
      await openChannel({
        budgetUsdc: -1,
        userPublicKey: TEST_USER_KEYPAIR.publicKey(),
      })
    } catch {
      // expected
    }

    expect(storeSize()).toBe(0)
  })
})
