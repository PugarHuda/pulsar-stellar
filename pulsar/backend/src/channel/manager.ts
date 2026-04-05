/**
 * channel/manager.ts
 *
 * Core Channel Manager for Pulsar.
 * Handles the full lifecycle of a payment channel:
 *   1. openChannel   — deploy Soroban contract, lock USDC
 *   2. signCommitment — off-chain commitment signing (0 on-chain tx)
 *   3. settleChannel  — close channel, 1 on-chain settlement tx
 *
 * MPP Session flow:
 *   open → [sign commitment × N steps] → settle
 *
 * Real vs Demo mode:
 *   - CONTRACT_ID set → real Soroban contract invocations on Stellar Testnet
 *   - CONTRACT_ID not set (or DEMO_MODE=true) → mock behavior, no real network calls
 *
 * Context: See backend/CONTEXT.md
 */

import {
  Keypair,
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  nativeToScVal,
  Address,
} from '@stellar/stellar-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  getServerKeypair,
  getUsdcBalance,
  usdcToBaseUnits,
  baseUnitsToUsdc,
  sorobanRpc,
  NETWORK_PASSPHRASE,
  USDC_SAC_ADDRESS,
} from '../stellar/config.js'
import { saveChannel, getChannel, updateChannel } from './store.js'
import {
  Channel,
  Commitment,
  OpenChannelRequest,
  OpenChannelResponse,
  SettleChannelResponse,
  PulsarError,
  PulsarErrorCode,
} from './types.js'

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Serialize a commitment to canonical bytes for signing.
 * Format: channelId (UTF-8, padded to 36 bytes) + amount (8 bytes big-endian) + stepIndex (4 bytes big-endian)
 * Total: 48 bytes
 */
export function serializeCommitmentBytes(
  channelId: string,
  amount: bigint,
  stepIndex: number,
): Buffer {
  // channelId as UTF-8, padded/truncated to 36 bytes (UUID length)
  const idBytes = Buffer.alloc(36)
  const idUtf8 = Buffer.from(channelId, 'utf8')
  idUtf8.copy(idBytes, 0, 0, Math.min(idUtf8.length, 36))

  // amount as 8-byte big-endian uint64
  const amountBytes = Buffer.alloc(8)
  amountBytes.writeBigUInt64BE(amount)

  // stepIndex as 4-byte big-endian uint32
  const stepBytes = Buffer.alloc(4)
  stepBytes.writeUInt32BE(stepIndex)

  return Buffer.concat([idBytes, amountBytes, stepBytes])
}

/**
 * Deserialize commitment bytes back to components.
 * Inverse of serializeCommitmentBytes.
 */
export function deserializeCommitmentBytes(bytes: Buffer): {
  channelId: string
  amount: bigint
  stepIndex: number
} {
  if (bytes.length !== 48) {
    throw new Error(`Invalid commitment bytes length: ${bytes.length}, expected 48`)
  }
  const channelId = bytes.subarray(0, 36).toString('utf8').replace(/\0/g, '')
  const amount = bytes.readBigUInt64BE(36)
  const stepIndex = bytes.readUInt32BE(44)
  return { channelId, amount, stepIndex }
}

// ─── Open Channel ─────────────────────────────────────────────────────────────

/**
 * Open a new payment channel.
 *
 * In demo mode: simulates the Soroban contract deployment by generating
 * a deterministic contract address. In production, this would invoke
 * the one-way-channel Soroban contract.
 *
 * Validates USDC balance before any on-chain operation.
 */
export async function openChannel(
  req: OpenChannelRequest,
): Promise<OpenChannelResponse> {
  const { budgetUsdc, userPublicKey } = req

  // Validate budget
  if (budgetUsdc <= 0) {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_OPEN_FAILED,
      'Budget must be greater than 0',
    )
  }

  // Check USDC balance before submitting any on-chain tx (Req 1.3)
  // In DEMO_MODE=true, skip balance check so the app runs without real USDC
  const demoMode = process.env.DEMO_MODE === 'true'
  if (!demoMode) {
    const balanceStr = await getUsdcBalance(userPublicKey)
    const balance = parseFloat(balanceStr)
    if (balance < budgetUsdc) {
      throw new PulsarError(
        PulsarErrorCode.INSUFFICIENT_USDC_BALANCE,
        `Insufficient USDC balance: have ${balance} USDC, need ${budgetUsdc} USDC`,
      )
    }
  }

  const serverKeypair = getServerKeypair()
  const channelId = uuidv4()
  const budgetBaseUnits = usdcToBaseUnits(budgetUsdc)

  // In demo: generate a deterministic mock contract address
  // In production: deploy one-way-channel Soroban contract
  const contractAddress = await deployChannelContract({
    channelId,
    userPublicKey,
    serverPublicKey: serverKeypair.publicKey(),
    budgetBaseUnits,
  })

  const now = Date.now()
  const channel: Channel = {
    id: channelId,
    contractAddress,
    userPublicKey,
    serverPublicKey: serverKeypair.publicKey(),
    budgetBaseUnits,
    currentCommitmentAmount: 0n,
    lastCommitmentSig: null,
    lastStepIndex: -1,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  }

  saveChannel(channel)

  return {
    channelId,
    contractAddress,
    budgetUsdc,
    status: 'open',
  }
}

// ─── Sign Commitment ──────────────────────────────────────────────────────────

/**
 * Generate and sign an off-chain commitment for a given cumulative amount.
 *
 * Correctness properties enforced:
 * - P1: Monotonic — newAmount >= currentCommitmentAmount
 * - P2: Budget ceiling — newAmount <= budgetBaseUnits
 * - P8: No on-chain transaction submitted
 */
export function signCommitment(
  channelId: string,
  newAmountBaseUnits: bigint,
): Commitment {
  const channel = getChannel(channelId)
  if (!channel) {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_NOT_FOUND,
      `Channel ${channelId} not found`,
    )
  }

  if (channel.status === 'closed') {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_ALREADY_CLOSED,
      `Channel ${channelId} is already closed`,
    )
  }

  if (channel.status !== 'open' && channel.status !== 'running') {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_NOT_OPEN,
      `Channel ${channelId} is not open (status: ${channel.status})`,
    )
  }

  // P1: Monotonic invariant
  if (newAmountBaseUnits < channel.currentCommitmentAmount) {
    throw new PulsarError(
      PulsarErrorCode.COMMITMENT_SIGN_FAILED,
      `New commitment amount ${newAmountBaseUnits} is less than current ${channel.currentCommitmentAmount} (monotonic invariant violated)`,
    )
  }

  // P2: Budget ceiling
  if (newAmountBaseUnits > channel.budgetBaseUnits) {
    throw new PulsarError(
      PulsarErrorCode.BUDGET_EXHAUSTED,
      `Commitment amount ${newAmountBaseUnits} exceeds budget ${channel.budgetBaseUnits}`,
    )
  }

  const stepIndex = channel.lastStepIndex + 1
  const serverKeypair = getServerKeypair()

  // Serialize and sign (P8: no on-chain tx)
  const bytes = serializeCommitmentBytes(channelId, newAmountBaseUnits, stepIndex)
  const signature = serverKeypair.sign(bytes)

  // Update channel state
  updateChannel(channelId, {
    currentCommitmentAmount: newAmountBaseUnits,
    lastCommitmentSig: signature,
    lastStepIndex: stepIndex,
    status: 'running',
  })

  return {
    channelId,
    amount: newAmountBaseUnits,
    stepIndex,
    signature,
  }
}

// ─── Settle Channel ───────────────────────────────────────────────────────────

/**
 * Close the payment channel with a single on-chain settlement transaction.
 *
 * Correctness properties enforced:
 * - P4: Single settlement — throws if already closed
 * - P9: Refund = budget - finalCommitment (non-negative)
 * - Retry up to 3 times on failure (Req 4.3)
 */
export async function settleChannel(
  channelId: string,
): Promise<SettleChannelResponse> {
  const channel = getChannel(channelId)
  if (!channel) {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_NOT_FOUND,
      `Channel ${channelId} not found`,
    )
  }

  // P4: Single settlement
  if (channel.status === 'closed') {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_ALREADY_CLOSED,
      `Channel ${channelId} is already settled`,
    )
  }

  const finalAmount = channel.currentCommitmentAmount
  const finalSig = channel.lastCommitmentSig

  // Retry logic (Req 4.3)
  const MAX_RETRIES = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const txHash = await submitSettlementTx({
        channel,
        finalAmount,
        finalSig,
      })

      // P9: Refund calculation
      const amountPaidBaseUnits = finalAmount
      const refundBaseUnits = channel.budgetBaseUnits - finalAmount

      const amountPaidUsdc = baseUnitsToUsdc(amountPaidBaseUnits)
      const refundUsdc = baseUnitsToUsdc(refundBaseUnits)

      // Update channel to closed (Req 4.4)
      updateChannel(channelId, {
        status: 'closed',
        settlementTxHash: txHash,
        closedAt: Date.now(),
      })

      const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`

      return {
        txHash,
        amountPaidUsdc,
        refundUsdc,
        explorerUrl,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(1000 * Math.pow(2, attempt - 1))
      }
    }
  }

  throw new PulsarError(
    PulsarErrorCode.SETTLEMENT_RETRY_EXCEEDED,
    `Settlement failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
  )
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Deploy the one-way-channel Soroban contract.
 *
 * If CONTRACT_ID env var is set → invoke real Soroban open_channel function.
 * Otherwise (demo mode) → return a deterministic mock contract address.
 */
async function deployChannelContract(params: {
  channelId: string
  userPublicKey: string
  serverPublicKey: string
  budgetBaseUnits: bigint
}): Promise<string> {
  const contractId = process.env.CONTRACT_ID
  const demoMode = process.env.DEMO_MODE === 'true' || !contractId

  if (!demoMode && contractId) {
    // ── Real Soroban invocation ──────────────────────────────────────────────
    try {
      const serverKeypair = getServerKeypair()
      const contract = new Contract(contractId)

      // Load server account for sequence number
      const account = await sorobanRpc.getAccount(serverKeypair.publicKey())

      // Expiry: 1 hour from now (Unix seconds)
      const expiry = Math.floor(Date.now() / 1000) + 3600

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'open_channel',
            nativeToScVal(params.userPublicKey, { type: 'address' }),
            nativeToScVal(serverKeypair.publicKey(), { type: 'address' }),
            nativeToScVal(USDC_SAC_ADDRESS, { type: 'address' }),
            nativeToScVal(params.budgetBaseUnits, { type: 'i128' }),
            xdr.ScVal.scvU64(xdr.Uint64.fromString(String(expiry))),
          ),
        )
        .setTimeout(30)
        .build()

      // Simulate first to get the prepared transaction
      const simResult = await sorobanRpc.simulateTransaction(tx)
      if ('error' in simResult) {
        throw new Error(`Soroban simulation failed: ${simResult.error}`)
      }

      const preparedTx = await sorobanRpc.prepareTransaction(tx)
      preparedTx.sign(serverKeypair)

      const sendResult = await sorobanRpc.sendTransaction(preparedTx)
      if (sendResult.status === 'ERROR') {
        throw new Error(`Soroban sendTransaction failed: ${JSON.stringify(sendResult.errorResult)}`)
      }

      // Poll for confirmation
      const txHash = sendResult.hash
      let getResult = await sorobanRpc.getTransaction(txHash)
      let attempts = 0
      while (getResult.status === 'NOT_FOUND' && attempts < 20) {
        await sleep(1000)
        getResult = await sorobanRpc.getTransaction(txHash)
        attempts++
      }

      if (getResult.status !== 'SUCCESS') {
        throw new Error(`open_channel transaction failed: ${getResult.status}`)
      }

      // Return the contract address as the channel contract
      return contractId
    } catch (err) {
      throw new Error(
        `Failed to invoke open_channel on Soroban contract: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // ── Demo mode: deterministic mock contract address ───────────────────────
  const hash = Buffer.from(params.channelId.replace(/-/g, ''), 'hex')
  const padded = Buffer.alloc(32)
  hash.copy(padded, 0, 0, Math.min(hash.length, 32))

  const mockContractId = `C${Buffer.from(padded).toString('base64url').toUpperCase().slice(0, 55)}`
  return mockContractId
}

/**
 * Submit the settlement transaction to Stellar Testnet.
 *
 * If CONTRACT_ID env var is set → invoke real Soroban close_channel function.
 * Otherwise (demo mode) → return a mock tx hash.
 */
async function submitSettlementTx(params: {
  channel: Channel
  finalAmount: bigint
  finalSig: Uint8Array | null
}): Promise<string> {
  const contractId = process.env.CONTRACT_ID
  const demoMode = process.env.DEMO_MODE === 'true' || !contractId

  if (!demoMode && contractId) {
    // ── Real Soroban close_channel invocation ────────────────────────────────
    try {
      const serverKeypair = getServerKeypair()
      const contract = new Contract(contractId)

      const account = await sorobanRpc.getAccount(serverKeypair.publicKey())

      // Build signature ScVal (BytesN<64>)
      const sigBytes = params.finalSig ?? new Uint8Array(64)
      const sigScVal = xdr.ScVal.scvBytes(Buffer.from(sigBytes))

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'close_channel',
            nativeToScVal(params.finalAmount, { type: 'i128' }),
            sigScVal,
          ),
        )
        .setTimeout(30)
        .build()

      const simResult = await sorobanRpc.simulateTransaction(tx)
      if ('error' in simResult) {
        throw new Error(`Soroban simulation failed: ${simResult.error}`)
      }

      const preparedTx = await sorobanRpc.prepareTransaction(tx)
      preparedTx.sign(serverKeypair)

      const sendResult = await sorobanRpc.sendTransaction(preparedTx)
      if (sendResult.status === 'ERROR') {
        throw new Error(`Soroban sendTransaction failed: ${JSON.stringify(sendResult.errorResult)}`)
      }

      // Poll for confirmation
      const txHash = sendResult.hash
      let getResult = await sorobanRpc.getTransaction(txHash)
      let attempts = 0
      while (getResult.status === 'NOT_FOUND' && attempts < 20) {
        await sleep(1000)
        getResult = await sorobanRpc.getTransaction(txHash)
        attempts++
      }

      if (getResult.status !== 'SUCCESS') {
        throw new Error(`close_channel transaction failed: ${getResult.status}`)
      }

      return txHash
    } catch (err) {
      throw new Error(
        `Failed to invoke close_channel on Soroban contract: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // ── Demo mode: mock tx hash ───────────────────────────────────────────────
  const mockTxHash = Buffer.from(
    `pulsar-settlement-${params.channel.id}-${Date.now()}`,
  )
    .toString('hex')
    .slice(0, 64)
    .padEnd(64, '0')

  // Simulate network latency
  await sleep(500)

  return mockTxHash
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
