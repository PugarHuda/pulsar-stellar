/**
 * stellar/config.ts
 *
 * Stellar Testnet configuration for Pulsar.
 * Exports SDK clients, keypairs, and USDC asset constants.
 *
 * Context: See backend/CONTEXT.md
 */

import 'dotenv/config'
import {
  Horizon,
  Keypair,
  Asset,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk'

// ─── Network ────────────────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015'

export const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'

export const HORIZON_URL =
  process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org'

// ─── SDK Clients ────────────────────────────────────────────────────────────

/** Horizon REST client for classic Stellar operations */
export const horizonServer = new Horizon.Server(HORIZON_URL)

/** Soroban RPC client for smart contract operations */
export const sorobanRpc = new SorobanRpc.Server(SOROBAN_RPC_URL)

// ─── USDC Asset ─────────────────────────────────────────────────────────────

export const USDC_ISSUER =
  process.env.USDC_ISSUER ??
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export const USDC_ASSET_CODE = process.env.USDC_ASSET_CODE ?? 'USDC'

/** Classic Stellar USDC asset (for balance checks via Horizon) */
export const USDC_ASSET = new Asset(USDC_ASSET_CODE, USDC_ISSUER)

/**
 * USDC Stellar Asset Contract address on testnet.
 * Used by @stellar/mpp for SAC token transfers.
 */
export const USDC_SAC_ADDRESS =
  process.env.USDC_SAC_ADDRESS ??
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'

// ─── Keypairs ────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

/**
 * Server keypair — signs commitments and closes channels.
 * Must be funded with XLM on testnet.
 */
export function getServerKeypair(): Keypair {
  return Keypair.fromSecret(requireEnv('SERVER_SECRET_KEY'))
}

/**
 * Demo user keypair — funds channels in demo.
 * Must be funded with XLM + USDC on testnet.
 */
export function getUserKeypair(): Keypair {
  return Keypair.fromSecret(requireEnv('USER_SECRET_KEY'))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fund a testnet account via Friendbot.
 * Only works on testnet — gives 10,000 XLM.
 */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
  const res = await fetch(friendbotUrl)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Friendbot failed for ${publicKey}: ${text}`)
  }
}

/**
 * Get USDC balance for an account (in human-readable units, e.g. "10.5000000").
 * Returns "0" if no USDC trustline exists.
 */
export async function getUsdcBalance(publicKey: string): Promise<string> {
  try {
    const account = await horizonServer.loadAccount(publicKey)
    const usdcBalance = account.balances.find(
      (b) =>
        b.asset_type !== 'native' &&
        'asset_code' in b &&
        b.asset_code === USDC_ASSET_CODE &&
        b.asset_issuer === USDC_ISSUER,
    )
    return usdcBalance?.balance ?? '0'
  } catch {
    return '0'
  }
}

/** Convert USDC human amount (e.g. 10.5) to base units (stroops × 10^7) */
export function usdcToBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10_000_000))
}

/** Convert base units back to human-readable USDC amount */
export function baseUnitsToUsdc(amount: bigint): number {
  return Number(amount) / 10_000_000
}

/**
 * Set up a USDC trustline for an account if it doesn't already have one.
 * Uses Horizon + TransactionBuilder (classic Stellar operation).
 *
 * This is required before an account can hold USDC on Stellar.
 * In production, call this once per user account before opening a channel.
 */
export async function setupUsdcTrustline(keypair: Keypair): Promise<void> {
  const { TransactionBuilder, Operation, Networks, BASE_FEE } = await import('@stellar/stellar-sdk')

  // Load account to check existing trustlines
  const account = await horizonServer.loadAccount(keypair.publicKey())

  // Check if USDC trustline already exists
  const hasTrustline = account.balances.some(
    (b) =>
      b.asset_type !== 'native' &&
      'asset_code' in b &&
      b.asset_code === USDC_ASSET_CODE &&
      b.asset_issuer === USDC_ISSUER,
  )

  if (hasTrustline) {
    return // Already has trustline, nothing to do
  }

  // Build a ChangeTrust transaction to add the USDC trustline
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: USDC_ASSET,
      }),
    )
    .setTimeout(30)
    .build()

  tx.sign(keypair)

  await horizonServer.submitTransaction(tx)
}
