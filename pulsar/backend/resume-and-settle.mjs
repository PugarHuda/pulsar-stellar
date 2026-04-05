/**
 * resume-and-settle.mjs
 * 
 * Script to run the full Pulsar demo in one shot:
 * 1. Open channel (real Soroban open_channel)
 * 2. Run agent (off-chain commitments)
 * 3. Settle (real Soroban close_channel)
 */

const BASE_URL = 'http://localhost:3001'
const USER_PUBLIC_KEY = 'GBUHNO53JCBELILRLNUGUR27G3TSL33M2TQIPEWS64HNEVBKR7RSRXFI'
const BUDGET_USDC = 5

console.log('=== Pulsar Full Demo — Real Stellar Testnet ===\n')

// Step 1: Open channel
console.log('STEP 1: Opening channel (real Soroban open_channel)...')
const openRes = await fetch(`${BASE_URL}/api/channels`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ budgetUsdc: BUDGET_USDC, userPublicKey: USER_PUBLIC_KEY })
})

if (!openRes.ok) {
  const err = await openRes.json()
  console.error('❌ Open channel failed:', err.details ?? err.error)
  process.exit(1)
}

const channel = await openRes.json()
console.log(`✅ Channel opened!`)
console.log(`   channelId: ${channel.channelId}`)
console.log(`   contractAddress: ${channel.contractAddress}`)
console.log(`   budget: ${channel.budgetUsdc} USDC`)

// Step 2: Run agent
console.log('\nSTEP 2: Running agent task (off-chain commitments)...')
const runRes = await fetch(`${BASE_URL}/api/channels/${channel.channelId}/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskDescription: 'Analyze Stellar DeFi ecosystem and generate investment report' })
})

if (!runRes.ok) {
  const err = await runRes.json()
  console.error('❌ Run agent failed:', err.error)
  process.exit(1)
}

const run = await runRes.json()
console.log(`✅ Agent completed!`)
console.log(`   Steps: ${run.totalSteps}`)
console.log(`   Total cost: ${run.totalCostUsdc} USDC`)
console.log(`   Remaining: ${run.remainingBudgetUsdc} USDC`)

// Step 3: Settle
console.log('\nSTEP 3: Settling channel (real Soroban close_channel)...')
const settleRes = await fetch(`${BASE_URL}/api/channels/${channel.channelId}/settle`, {
  method: 'POST'
})

const settlement = await settleRes.json()

if (!settleRes.ok) {
  console.error('❌ Settlement failed:', settlement.details ?? settlement.error)
  process.exit(1)
}

console.log(`✅ Settlement complete!`)
console.log(`   TxHash: ${settlement.txHash}`)
console.log(`   Amount paid: ${settlement.amountPaidUsdc} USDC`)
console.log(`   Refund: ${settlement.refundUsdc} USDC`)
console.log(`   Explorer: ${settlement.explorerUrl}`)
console.log('\n🎉 Full Pulsar demo complete!')
