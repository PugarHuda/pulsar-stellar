#!/usr/bin/env node
/**
 * test-real-settlement.mjs
 * 
 * End-to-end test for real on-chain settlement.
 * Tests the full flow: open channel → run agent → settle channel
 * 
 * Usage: node test-real-settlement.mjs
 */

import { Keypair } from '@stellar/stellar-sdk'
import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3001/api'

// Load keypairs from .env
const SERVER_SECRET = process.env.SERVER_SECRET_KEY || 'SDBZAJ3MQVER4UFYNHWKDWWLG2PAX3B2T3QBSB5L2CHKGLBKPCLRA6PO'
const USER_SECRET = process.env.USER_SECRET_KEY || 'SD64HPWQK6J4KKRLWLXTOPFEYYVG25V3GIRQG7A73VRTFH75RCLDVQ7Q'

const userKeypair = Keypair.fromSecret(USER_SECRET)
const userPublicKey = userKeypair.publicKey()

console.log('🧪 Testing Real On-Chain Settlement')
console.log('=' .repeat(60))
console.log()

// Step 1: Check backend status
console.log('📡 Step 1: Checking backend status...')
const statusRes = await fetch(`${API_BASE}/status`)
const status = await statusRes.json()
console.log(`   Network: ${status.network}`)
console.log(`   AI Mode: ${status.aiMode}`)
console.log(`   Contract: ${status.contractId}`)
console.log(`   Demo Mode: ${status.demoMode}`)
console.log()

if (!status.contractId) {
  console.error('❌ ERROR: No contract deployed!')
  console.error('   Please ensure CONTRACT_WASM_HASH is set and backend started successfully.')
  process.exit(1)
}

// Step 2: Get initial USDC balances
console.log('💰 Step 2: Checking initial USDC balances...')
const horizonUrl = 'https://horizon-testnet.stellar.org'
const userAccountRes = await fetch(`${horizonUrl}/accounts/${userPublicKey}`)
const userAccount = await userAccountRes.json()
const userUsdcBalance = userAccount.balances.find(b => b.asset_code === 'USDC')?.balance || '0'
console.log(`   User USDC: ${userUsdcBalance}`)
console.log()

// Step 3: Open channel
console.log('🔓 Step 3: Opening payment channel...')
const openRes = await fetch(`${API_BASE}/channels`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    budgetUsdc: 1.0, // Small budget for testing
    userPublicKey,
  }),
})

if (!openRes.ok) {
  const error = await openRes.json()
  console.error('❌ ERROR: Failed to open channel')
  console.error(JSON.stringify(error, null, 2))
  process.exit(1)
}

const channel = await openRes.json()
console.log(`   ✅ Channel opened: ${channel.channelId}`)
console.log(`   Contract: ${channel.contractAddress}`)
console.log(`   Budget: ${channel.budgetUsdc} USDC`)
console.log()

// Wait for channel to be confirmed
console.log('⏳ Waiting 3 seconds for channel confirmation...')
await new Promise(resolve => setTimeout(resolve, 3000))

// Step 4: Run a simple agent task
console.log('🤖 Step 4: Running agent task...')
const runRes = await fetch(`${API_BASE}/channels/${channel.channelId}/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskDescription: 'Simple test task',
    agentId: 'general',
  }),
})

if (!runRes.ok) {
  const error = await runRes.json()
  console.error('❌ ERROR: Failed to run agent')
  console.error(JSON.stringify(error, null, 2))
  process.exit(1)
}

const runResult = await runRes.json()
console.log(`   ✅ Agent completed`)
console.log(`   Steps: ${runResult.steps?.length || 0}`)
console.log(`   Cost: ${runResult.totalCostUsdc} USDC`)
console.log()

// Step 5: Settle channel
console.log('💎 Step 5: Settling channel (on-chain)...')
const settleRes = await fetch(`${API_BASE}/channels/${channel.channelId}/settle`, {
  method: 'POST',
})

if (!settleRes.ok) {
  const error = await settleRes.json()
  console.error('❌ ERROR: Failed to settle channel')
  console.error(JSON.stringify(error, null, 2))
  process.exit(1)
}

const settlement = await settleRes.json()
console.log(`   ✅ Settlement complete!`)
console.log(`   TX Hash: ${settlement.txHash}`)
console.log(`   Amount Paid: ${settlement.amountPaidUsdc} USDC`)
console.log(`   Refund: ${settlement.refundUsdc} USDC`)
console.log(`   Explorer: ${settlement.explorerUrl}`)
console.log()

// Step 6: Verify balances changed
console.log('🔍 Step 6: Verifying USDC balances changed...')
await new Promise(resolve => setTimeout(resolve, 5000)) // Wait for settlement to confirm

const userAccountRes2 = await fetch(`${horizonUrl}/accounts/${userPublicKey}`)
const userAccount2 = await userAccountRes2.json()
const userUsdcBalance2 = userAccount2.balances.find(b => b.asset_code === 'USDC')?.balance || '0'

const balanceChange = parseFloat(userUsdcBalance) - parseFloat(userUsdcBalance2)
console.log(`   Initial: ${userUsdcBalance} USDC`)
console.log(`   Final: ${userUsdcBalance2} USDC`)
console.log(`   Change: ${balanceChange.toFixed(7)} USDC`)
console.log()

if (Math.abs(balanceChange - settlement.amountPaidUsdc) < 0.0001) {
  console.log('✅ SUCCESS: USDC actually transferred on-chain!')
  console.log('   Balance change matches settlement amount.')
} else {
  console.log('⚠️  WARNING: Balance change does not match settlement')
  console.log(`   Expected: ${settlement.amountPaidUsdc} USDC`)
  console.log(`   Actual: ${balanceChange.toFixed(7)} USDC`)
}

console.log()
console.log('=' .repeat(60))
console.log('🎉 Test Complete!')
