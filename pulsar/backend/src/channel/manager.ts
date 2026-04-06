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
  getUserKeypair,
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

// Global contract instance — deployed once at startup, reused for all channels
// This is a pragmatic solution for demo: avoids "channel already open" errors
// and eliminates per-channel deployment complexity
let globalContractId: string | null = null

/**
 * Get the current global contract ID (for status endpoint).
 */
export function getGlobalContractId(): string | null {
  return globalContractId
}

/**
 * Initialize the global contract instance.
 * Called once at backend startup.
 * 
 * For demo hackathon: deploy one contract, use for all channels in this session.
 * This avoids per-channel deployment issues and is sufficient for demo purposes.
 */
export async function initializeGlobalContract(): Promise<void> {
  const wasmHash = process.env.CONTRACT_WASM_HASH
  const fallbackContractId = process.env.CONTRACT_ID

  if (!wasmHash && !fallbackContractId) {
    console.log('[Pulsar] Running in DEMO mode (no CONTRACT_WASM_HASH or CONTRACT_ID)')
    return
  }

  try {
    if (wasmHash) {
      console.log('[Pulsar] Deploying fresh contract instance for this session...')
      globalContractId = await deployFreshContract()
      console.log(`[Pulsar] ✓ Global contract deployed: ${globalContractId}`)
    } else if (fallbackContractId) {
      globalContractId = fallbackContractId
      console.log(`[Pulsar] ✓ Using fallback CONTRACT_ID: ${globalContractId}`)
    }
  } catch (err) {
    console.error(`[Pulsar] ✗ Failed to initialize contract: ${err instanceof Error ? err.message : err}`)
    if (fallbackContractId) {
      console.log(`[Pulsar] Falling back to CONTRACT_ID: ${fallbackContractId}`)
      globalContractId = fallbackContractId
    } else {
      console.warn('[Pulsar] No fallback available, running in DEMO mode')
    }
  }
}

/**
 * Deploy a new one-way-channel Soroban contract instance and invoke open_channel.
 *
 * Architecture for hackathon demo:
 *   - Use globalContractId (deployed at startup) for all channels
 *   - This is pragmatic for demo: one contract, multiple channels
 *   - In test mode (no CONTRACT_WASM_HASH): return mock contract for testing
 *
 * For production: each channel would get its own contract instance to avoid state conflicts.
 */
async function deployChannelContract(params: {
  channelId: string
  userPublicKey: string
  serverPublicKey: string
  budgetBaseUnits: bigint
}): Promise<string> {
  // Test mode: return mock contract (allows tests to run without real Soroban)
  const wasmHash = process.env.CONTRACT_WASM_HASH
  if (!wasmHash) {
    console.log('[Pulsar] Test mode: using mock contract (no CONTRACT_WASM_HASH)')
    const hash = Buffer.from(params.channelId.replace(/-/g, ''), 'hex')
    const padded = Buffer.alloc(32)
    hash.copy(padded, 0, 0, Math.min(hash.length, 32))
    const mockContractId = `C${Buffer.from(padded).toString('base64url').toUpperCase().slice(0, 55)}`
    return mockContractId
  }

  // Production mode: use global contract
  if (!globalContractId) {
    throw new Error(
      'No contract available. Please ensure CONTRACT_WASM_HASH is set and backend started successfully. ' +
      'Check backend logs for contract deployment status.'
    )
  }

  // Use the global contract for all channels (demo mode)
  try {
    console.log(`[Pulsar] Using global contract ${globalContractId} for channel ${params.channelId}...`)
    return await invokeOpenChannel(globalContractId, params)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Pulsar] Failed to open channel on contract ${globalContractId}: ${errorMsg}`)
    throw new Error(
      `Failed to open payment channel: ${errorMsg}. ` +
      'This may be because the contract already has an open channel. ' +
      'For demo purposes, please settle the existing channel first or restart the backend to deploy a fresh contract.'
    )
  }
}

/**
 * Deploy a fresh contract instance from the pre-uploaded WASM hash using Stellar SDK.
 * Called by deployChannelContract (per channel) and POST /api/admin/reset-contract.
 *
 * Uses CONTRACT_WASM_HASH env var (the hash of the uploaded WASM).
 * The WASM is already uploaded to testnet — we only need to instantiate it.
 * Default hash: 394a957ec687ca7212c82af920af339fdabe685f1f92ee646d3c4c867874dacd
 */
export async function deployFreshContract(): Promise<string> {
  const WASM_HASH = process.env.CONTRACT_WASM_HASH ?? '394a957ec687ca7212c82af920af339fdabe685f1f92ee646d3c4c867874dacd'
  const serverKeypair = getServerKeypair()

  try {
    console.log(`[Pulsar] Fetching account ${serverKeypair.publicKey()}...`)
    const account = await sorobanRpc.getAccount(serverKeypair.publicKey())
    console.log(`[Pulsar] Account fetched successfully`)
    
    const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
    const wasmHashBytes = Buffer.from(WASM_HASH, 'hex')

    // Build InvokeHostFunction operation to create a new contract instance
    const deployTx = new TransactionBuilder(account, {
      fee: String(Number(BASE_FEE) * 100),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        xdr.Operation.fromXDR(
          new xdr.Operation({
            sourceAccount: null,
            body: xdr.OperationBody.invokeHostFunction(
              new xdr.InvokeHostFunctionOp({
                hostFunction: xdr.HostFunction.hostFunctionTypeCreateContract(
                  new xdr.CreateContractArgs({
                    contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
                      new xdr.ContractIdPreimageFromAddress({
                        address: xdr.ScAddress.scAddressTypeAccount(
                          xdr.PublicKey.publicKeyTypeEd25519(serverKeypair.rawPublicKey()),
                        ),
                        salt: salt as unknown as Buffer,
                      }),
                    ),
                    executable: xdr.ContractExecutable.contractExecutableWasm(
                      xdr.Hash.fromXDR(wasmHashBytes),
                    ),
                  }),
                ),
                auth: [],
              }),
            ),
          }).toXDR(),
        ),
      )
      .setTimeout(60)
      .build()

    console.log('[Pulsar] Simulating contract deployment...')
    const simResult = await sorobanRpc.simulateTransaction(deployTx)
    if ('error' in simResult) {
      throw new Error(`Deploy simulation failed: ${simResult.error}`)
    }
    console.log('[Pulsar] Simulation successful')

    const preparedTx = await sorobanRpc.prepareTransaction(deployTx)
    preparedTx.sign(serverKeypair)

    console.log('[Pulsar] Sending deployment transaction...')
    const sendResult = await sorobanRpc.sendTransaction(preparedTx)
    if (sendResult.status === 'ERROR') {
      throw new Error(`Deploy sendTransaction failed: ${JSON.stringify(sendResult.errorResult)}`)
    }
    console.log(`[Pulsar] Transaction sent: ${sendResult.hash}`)

    // Poll for confirmation
    console.log('[Pulsar] Waiting for confirmation...')
    let getResult = await sorobanRpc.getTransaction(sendResult.hash)
    let attempts = 0
    while (getResult.status === 'NOT_FOUND' && attempts < 30) {
      await sleep(1000)
      getResult = await sorobanRpc.getTransaction(sendResult.hash)
      attempts++
      if (attempts % 5 === 0) {
        console.log(`[Pulsar] Still waiting... (${attempts}/30)`)
      }
    }

    if (getResult.status !== 'SUCCESS') {
      throw new Error(`Deploy tx failed: ${getResult.status}`)
    }

    // Extract new contract address from return value
    const successResult = getResult as { returnValue?: xdr.ScVal; status: string }
    if (!successResult.returnValue) {
      throw new Error('Deploy tx succeeded but no return value')
    }

    const newAddress = Address.fromScVal(successResult.returnValue)
    const newContractId = newAddress.toString()
    console.log(`[Pulsar] ✅ Deployed fresh contract: ${newContractId}`)
    console.log(`[Pulsar] View on Stellar Expert: https://stellar.expert/explorer/testnet/contract/${newContractId}`)
    return newContractId
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Pulsar] ❌ Contract deployment FAILED: ${errorMsg}`)
    
    // Check if it's an account not found error
    if (errorMsg.includes('Account not found') || errorMsg.includes('404')) {
      console.error('[Pulsar] ERROR: Server account not found on testnet!')
      console.error('[Pulsar] SOLUTION: Fund your server account with XLM:')
      console.error(`[Pulsar]   1. Go to: https://laboratory.stellar.org/#account-creator?network=test`)
      console.error(`[Pulsar]   2. Enter public key: ${getServerKeypair().publicKey()}`)
      console.error(`[Pulsar]   3. Click "Get test network lumens"`)
    }
    
    throw err
  }
}

/**
 * Invoke open_channel on an existing Soroban contract instance.
 * 
 * IMPORTANT: Uses the userPublicKey from params (connected wallet), not USER_SECRET_KEY.
 * The transaction must be signed by the actual user wallet, not the demo keypair.
 */
async function invokeOpenChannel(
  contractId: string,
  params: {
    userPublicKey: string
    serverPublicKey: string
    budgetBaseUnits: bigint
  },
): Promise<string> {
  try {
    const serverKeypair = getServerKeypair()
    const contract = new Contract(contractId)

    // CRITICAL: Use the actual user's public key from params (connected wallet)
    // NOT the demo USER_SECRET_KEY - that's only for testing without a real wallet
    const userPublicKey = params.userPublicKey
    
    // For demo/testing: if user is using the demo key, we can sign with USER_SECRET_KEY
    // For real wallet: user must sign the transaction in their wallet (not implemented yet)
    const demoUserKeypair = getUserKeypair()
    const isDemoUser = userPublicKey === demoUserKeypair.publicKey()
    
    if (!isDemoUser) {
      // Real wallet user - we can't sign for them!
      throw new Error(
        `Cannot open channel: wallet integration not yet implemented. ` +
        `Please use the demo user key: ${demoUserKeypair.publicKey()} ` +
        `or click "Demo key" button in the UI.`
      )
    }

    // Use demo user account for transaction
    const userAccount = await sorobanRpc.getAccount(userPublicKey)
    const expiry = Math.floor(Date.now() / 1000) + 3600

    const tx = new TransactionBuilder(userAccount, {
      fee: String(Number(BASE_FEE) * 10),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'open_channel',
          nativeToScVal(userPublicKey, { type: 'address' }),
          nativeToScVal(serverKeypair.publicKey(), { type: 'address' }),
          nativeToScVal(USDC_SAC_ADDRESS, { type: 'address' }),
          nativeToScVal(params.budgetBaseUnits, { type: 'i128' }),
          xdr.ScVal.scvU64(xdr.Uint64.fromString(String(expiry))),
        ),
      )
      .setTimeout(60)
      .build()

    // Simulate to get resource fees
    const simResult = await sorobanRpc.simulateTransaction(tx)
    if ('error' in simResult) {
      throw new Error(`Soroban simulation failed: ${simResult.error}`)
    }

    // Prepare and sign with demo user keypair
    const preparedTx = await sorobanRpc.prepareTransaction(tx)
    preparedTx.sign(demoUserKeypair)

    const sendResult = await sorobanRpc.sendTransaction(preparedTx)
    if (sendResult.status === 'ERROR') {
      throw new Error(`sendTransaction failed: ${JSON.stringify(sendResult.errorResult)}`)
    }

    let getResult = await sorobanRpc.getTransaction(sendResult.hash)
    let attempts = 0
    while (getResult.status === 'NOT_FOUND' && attempts < 30) {
      await sleep(1000)
      getResult = await sorobanRpc.getTransaction(sendResult.hash)
      attempts++
    }

    if (getResult.status !== 'SUCCESS') {
      const resultMeta = getResult as { 
        resultXdr?: string
        resultMetaXdr?: string
        status: string 
      }
      
      // Try to extract detailed error from XDR
      let errorDetail = ''
      try {
        if (resultMeta.resultXdr) {
          const result = xdr.TransactionResult.fromXDR(resultMeta.resultXdr, 'base64')
          errorDetail = ` | Result: ${JSON.stringify(result)}`
        }
      } catch {
        // Ignore XDR parsing errors
      }
      
      throw new Error(
        `open_channel tx failed: ${getResult.status}${errorDetail}`
      )
    }

    console.log(`[Pulsar] open_channel success: https://stellar.expert/explorer/testnet/tx/${sendResult.hash}`)
    return contractId
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Pulsar] open_channel ERROR: ${errorMsg}`)
    throw new Error(
      `Failed to invoke open_channel on Soroban contract: ${errorMsg}`,
    )
  }
}

/**
 * Submit the settlement transaction to Stellar Testnet.
 *
 * Uses the contract address stored in the channel (from open_channel).
 * - If globalContractId is set and matches → real on-chain settlement
 * - If no globalContractId (test mode) → mock settlement for testing
 * - If mismatch → error (channel from different session)
 */
async function submitSettlementTx(params: {
  channel: Channel
  finalAmount: bigint
  finalSig: Uint8Array | null
}): Promise<string> {
  const contractId = params.channel.contractAddress

  // Test mode: no global contract, use mock settlement
  if (!globalContractId) {
    console.log('[Pulsar] Test mode: using mock settlement (no globalContractId)')
    const mockTxHash = Buffer.from(
      `pulsar-settlement-${params.channel.id}-${Date.now()}`,
    )
      .toString('hex')
      .slice(0, 64)
      .padEnd(64, '0')
    await sleep(100) // Simulate network latency
    return mockTxHash
  }
  
  // Production mode: verify contract matches global contract
  if (contractId !== globalContractId) {
    throw new Error(
      `Cannot settle channel: contract address ${contractId} does not match global contract ${globalContractId}. ` +
      'This channel may have been created in a previous session or with a different contract.'
    )
  }

  // ── Real Soroban close_channel invocation ────────────────────────────────
  try {
    const serverKeypair = getServerKeypair()
    const userKeypair = getUserKeypair()
    const contract = new Contract(contractId)

    // Build the correct signature for close_channel:
    // Message = channel_id (32 bytes from contract address XDR) || amount (8 bytes big-endian)
    const contractAddr = new Address(contractId)
    const contractXdr = contractAddr.toScAddress().toXDR()
    const channelIdBytes = contractXdr.slice(contractXdr.length - 32)

    const amountBytes = Buffer.alloc(8)
    amountBytes.writeBigUInt64BE(params.finalAmount)
    const message = Buffer.concat([channelIdBytes, amountBytes])

    // Server signs the message (recipient in contract)
    const signature = serverKeypair.sign(message)

    // Use user as source account (implicit auth for token operations)
    const account = await sorobanRpc.getAccount(userKeypair.publicKey())

      const tx = new TransactionBuilder(account, {
        fee: String(Number(BASE_FEE) * 10),
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'close_channel',
            nativeToScVal(params.finalAmount, { type: 'i128' }),
            xdr.ScVal.scvBytes(Buffer.from(signature)),
          ),
        )
        .setTimeout(60)
        .build()

      const simResult = await sorobanRpc.simulateTransaction(tx)
      if ('error' in simResult) {
        throw new Error(`Soroban simulation failed: ${simResult.error}`)
      }

      const preparedTx = await sorobanRpc.prepareTransaction(tx)
      preparedTx.sign(userKeypair)

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

      console.log(`[Pulsar] close_channel success: https://stellar.expert/explorer/testnet/tx/${txHash}`)
      return txHash
    } catch (err) {
      throw new Error(
        `Failed to invoke close_channel on Soroban contract: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
