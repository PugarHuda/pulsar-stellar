/**
 * close-contract.mjs
 * Close an existing open channel contract and recover USDC
 */
import 'dotenv/config'
import { Keypair, Contract, TransactionBuilder, BASE_FEE, xdr, nativeToScVal, rpc as SorobanRpc } from '@stellar/stellar-sdk'

const CONTRACT_ID = process.argv[2]
if (!CONTRACT_ID) {
  console.error('Usage: npx tsx close-contract.mjs <CONTRACT_ID>')
  process.exit(1)
}

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
const sorobanRpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org')

const serverKP = Keypair.fromSecret(process.env.SERVER_SECRET_KEY)
const userKP = Keypair.fromSecret(process.env.USER_SECRET_KEY)

console.log(`Closing contract: ${CONTRACT_ID}`)
console.log(`Server: ${serverKP.publicKey()}`)
console.log(`User: ${userKP.publicKey()}`)

// Get contract state to know the channel_id for signing
// channel_id = last 32 bytes of contract address XDR
const contractAddr = new (await import('@stellar/stellar-sdk')).Address(CONTRACT_ID)
const contractXdr = contractAddr.toScAddress().toXDR()
const channelId = contractXdr.slice(contractXdr.length - 32)

// Commitment amount = 0 (full refund to user)
const commitmentAmount = 0n

// Build message: channel_id (32 bytes) || amount (8 bytes big-endian)
const amountBytes = Buffer.alloc(8)
amountBytes.writeBigUInt64BE(commitmentAmount)
const message = Buffer.concat([channelId, amountBytes])

console.log(`\nSigning message (${message.length} bytes)...`)
const signature = serverKP.sign(message)
console.log(`Signature: ${Buffer.from(signature).toString('hex')}`)

// Build close_channel transaction
const contract = new Contract(CONTRACT_ID)
const account = await sorobanRpc.getAccount(userKP.publicKey())

const tx = new TransactionBuilder(account, {
  fee: String(Number(BASE_FEE) * 10),
  networkPassphrase: NETWORK_PASSPHRASE,
})
  .addOperation(
    contract.call(
      'close_channel',
      nativeToScVal(commitmentAmount, { type: 'i128' }),
      xdr.ScVal.scvBytes(Buffer.from(signature)),
    ),
  )
  .setTimeout(60)
  .build()

console.log('\nSimulating transaction...')
const simResult = await sorobanRpc.simulateTransaction(tx)
if ('error' in simResult) {
  console.error('Simulation failed:', simResult.error)
  process.exit(1)
}

const preparedTx = await sorobanRpc.prepareTransaction(tx)
preparedTx.sign(userKP)

console.log('Sending transaction...')
const sendResult = await sorobanRpc.sendTransaction(preparedTx)
if (sendResult.status === 'ERROR') {
  console.error('Send failed:', JSON.stringify(sendResult.errorResult))
  process.exit(1)
}

console.log(`TxHash: ${sendResult.hash}`)

let getResult = await sorobanRpc.getTransaction(sendResult.hash)
let attempts = 0
while (getResult.status === 'NOT_FOUND' && attempts < 30) {
  await new Promise(r => setTimeout(r, 1000))
  getResult = await sorobanRpc.getTransaction(sendResult.hash)
  attempts++
}

if (getResult.status === 'SUCCESS') {
  console.log(`✅ Channel closed! USDC refunded to user.`)
  console.log(`Explorer: https://stellar.expert/explorer/testnet/tx/${sendResult.hash}`)
} else {
  console.error(`❌ Transaction failed: ${getResult.status}`)
}
