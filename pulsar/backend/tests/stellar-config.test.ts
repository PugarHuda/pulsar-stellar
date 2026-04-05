/**
 * tests/stellar-config.test.ts
 *
 * Unit tests for stellar/config.ts
 *
 * Tests that config values are read correctly from env vars,
 * and that USDC_ASSET is constructed with the correct issuer.
 *
 * Requirements: 7.1, 7.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Asset, Keypair } from '@stellar/stellar-sdk'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
const DEFAULT_SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org'
const DEFAULT_HORIZON_URL = 'https://horizon-testnet.stellar.org'

// Save original env vars so we can restore them
const originalEnv = { ...process.env }

afterEach(() => {
  // Restore env vars after each test
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) delete process.env[key]
  })
  Object.assign(process.env, originalEnv)
  vi.resetModules()
})

// ─── Helper to re-import config with fresh env ────────────────────────────────

async function importConfig() {
  return import('../src/stellar/config.js?t=' + Date.now())
}

// ─── NETWORK_PASSPHRASE ───────────────────────────────────────────────────────

describe('NETWORK_PASSPHRASE', () => {
  it('uses default testnet passphrase when env var is not set', async () => {
    delete process.env.NETWORK_PASSPHRASE
    const { NETWORK_PASSPHRASE } = await importConfig()
    expect(NETWORK_PASSPHRASE).toBe(DEFAULT_NETWORK_PASSPHRASE)
  })

  it('reads NETWORK_PASSPHRASE from env var', async () => {
    process.env.NETWORK_PASSPHRASE = 'Custom Network ; January 2024'
    const { NETWORK_PASSPHRASE } = await importConfig()
    expect(NETWORK_PASSPHRASE).toBe('Custom Network ; January 2024')
  })
})

// ─── SOROBAN_RPC_URL ──────────────────────────────────────────────────────────

describe('SOROBAN_RPC_URL', () => {
  it('uses default testnet RPC URL when env var is not set', async () => {
    delete process.env.SOROBAN_RPC_URL
    const { SOROBAN_RPC_URL } = await importConfig()
    expect(SOROBAN_RPC_URL).toBe(DEFAULT_SOROBAN_RPC_URL)
  })

  it('reads SOROBAN_RPC_URL from env var', async () => {
    process.env.SOROBAN_RPC_URL = 'https://custom-rpc.example.com'
    const { SOROBAN_RPC_URL } = await importConfig()
    expect(SOROBAN_RPC_URL).toBe('https://custom-rpc.example.com')
  })
})

// ─── HORIZON_URL ──────────────────────────────────────────────────────────────

describe('HORIZON_URL', () => {
  it('uses default testnet Horizon URL when env var is not set', async () => {
    delete process.env.HORIZON_URL
    const { HORIZON_URL } = await importConfig()
    expect(HORIZON_URL).toBe(DEFAULT_HORIZON_URL)
  })

  it('reads HORIZON_URL from env var', async () => {
    process.env.HORIZON_URL = 'https://custom-horizon.example.com'
    const { HORIZON_URL } = await importConfig()
    expect(HORIZON_URL).toBe('https://custom-horizon.example.com')
  })
})

// ─── USDC_ISSUER ──────────────────────────────────────────────────────────────

describe('USDC_ISSUER', () => {
  it('uses canonical testnet USDC issuer when env var is not set', async () => {
    delete process.env.USDC_ISSUER
    const { USDC_ISSUER } = await importConfig()
    expect(USDC_ISSUER).toBe(DEFAULT_USDC_ISSUER)
  })

  it('reads USDC_ISSUER from env var', async () => {
    const customIssuer = Keypair.random().publicKey()
    process.env.USDC_ISSUER = customIssuer
    const { USDC_ISSUER } = await importConfig()
    expect(USDC_ISSUER).toBe(customIssuer)
  })
})

// ─── USDC_ASSET ───────────────────────────────────────────────────────────────

describe('USDC_ASSET', () => {
  it('is constructed with default USDC issuer when env var is not set', async () => {
    delete process.env.USDC_ISSUER
    delete process.env.USDC_ASSET_CODE
    const { USDC_ASSET } = await importConfig()
    expect(USDC_ASSET).toBeInstanceOf(Asset)
    expect(USDC_ASSET.getCode()).toBe('USDC')
    expect(USDC_ASSET.getIssuer()).toBe(DEFAULT_USDC_ISSUER)
  })

  it('is constructed with USDC_ISSUER from env var', async () => {
    const customIssuer = Keypair.random().publicKey()
    process.env.USDC_ISSUER = customIssuer
    const { USDC_ASSET } = await importConfig()
    expect(USDC_ASSET.getIssuer()).toBe(customIssuer)
  })

  it('uses USDC_ASSET_CODE from env var', async () => {
    process.env.USDC_ASSET_CODE = 'USDC2'
    const { USDC_ASSET } = await importConfig()
    expect(USDC_ASSET.getCode()).toBe('USDC2')
  })

  it('USDC_ASSET issuer matches USDC_ISSUER constant', async () => {
    const customIssuer = Keypair.random().publicKey()
    process.env.USDC_ISSUER = customIssuer
    const { USDC_ASSET, USDC_ISSUER } = await importConfig()
    // The asset issuer must always match the USDC_ISSUER constant — Req 7.2
    expect(USDC_ASSET.getIssuer()).toBe(USDC_ISSUER)
  })
})

// ─── Keypair helpers ──────────────────────────────────────────────────────────

describe('getServerKeypair', () => {
  it('returns keypair matching SERVER_SECRET_KEY env var', async () => {
    const kp = Keypair.random()
    process.env.SERVER_SECRET_KEY = kp.secret()
    const { getServerKeypair } = await importConfig()
    const result = getServerKeypair()
    expect(result.publicKey()).toBe(kp.publicKey())
  })

  it('throws when SERVER_SECRET_KEY is missing', async () => {
    delete process.env.SERVER_SECRET_KEY
    const { getServerKeypair } = await importConfig()
    expect(() => getServerKeypair()).toThrow('Missing required env var: SERVER_SECRET_KEY')
  })
})

describe('getUserKeypair', () => {
  it('returns keypair matching USER_SECRET_KEY env var', async () => {
    const kp = Keypair.random()
    process.env.USER_SECRET_KEY = kp.secret()
    const { getUserKeypair } = await importConfig()
    const result = getUserKeypair()
    expect(result.publicKey()).toBe(kp.publicKey())
  })

  it('throws when USER_SECRET_KEY is missing', async () => {
    delete process.env.USER_SECRET_KEY
    const { getUserKeypair } = await importConfig()
    expect(() => getUserKeypair()).toThrow('Missing required env var: USER_SECRET_KEY')
  })
})

// ─── Unit conversion helpers ──────────────────────────────────────────────────

describe('usdcToBaseUnits / baseUnitsToUsdc', () => {
  it('converts 1 USDC to 10_000_000 base units', async () => {
    const { usdcToBaseUnits } = await importConfig()
    expect(usdcToBaseUnits(1)).toBe(10_000_000n)
  })

  it('converts 0.05 USDC to 500_000 base units', async () => {
    const { usdcToBaseUnits } = await importConfig()
    expect(usdcToBaseUnits(0.05)).toBe(500_000n)
  })

  it('round-trips: baseUnitsToUsdc(usdcToBaseUnits(x)) === x', async () => {
    const { usdcToBaseUnits, baseUnitsToUsdc } = await importConfig()
    const values = [0, 0.01, 0.05, 1, 10, 100]
    for (const v of values) {
      expect(baseUnitsToUsdc(usdcToBaseUnits(v))).toBeCloseTo(v, 7)
    }
  })
})
