#!/usr/bin/env node
/**
 * test-full-agent.mjs
 * 
 * Test full agent execution flow
 */

import 'dotenv/config'

const API_BASE = 'http://localhost:3001'

async function testFullFlow() {
  console.log('🚀 Testing Full Agent Flow...\n')

  try {
    // Step 1: Open channel
    console.log('1️⃣ Opening channel...')
    const openRes = await fetch(`${API_BASE}/api/channels/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPublicKey: process.env.USER_SECRET_KEY ? 
          (await import('@stellar/stellar-sdk')).Keypair.fromSecret(process.env.USER_SECRET_KEY).publicKey() :
          'GBUHNO53JCBELILRLNUGUR27G3TSL33M2TQIPEWS64HNEVBKR7RSRXFI',
        budgetUsdc: 0.5,
        expiryHours: 1,
      }),
    })

    if (!openRes.ok) {
      const error = await openRes.text()
      throw new Error(`Open channel failed: ${error}`)
    }

    const { channelId } = await openRes.json()
    console.log(`   ✅ Channel opened: ${channelId}`)

    // Step 2: Run agent
    console.log('\n2️⃣ Running agent...')
    const runRes = await fetch(`${API_BASE}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        taskDescription: 'Simple test task',
        agentId: 'general',
      }),
    })

    if (!runRes.ok) {
      const error = await runRes.text()
      throw new Error(`Run agent failed: ${error}`)
    }

    const result = await runRes.json()
    console.log(`   ✅ Agent completed`)
    console.log(`      - Steps: ${result.stepsCompleted}`)
    console.log(`      - Cost: ${result.totalCostUsdc} USDC`)
    console.log(`      - Remaining: ${result.remainingBudgetUsdc} USDC`)
    console.log(`      - Success: ${result.completedNormally}`)

    // Step 3: Get channel info
    console.log('\n3️⃣ Checking channel state...')
    const channelRes = await fetch(`${API_BASE}/api/channels/${channelId}`)
    if (channelRes.ok) {
      const channel = await channelRes.json()
      console.log(`   ✅ Channel state:`)
      console.log(`      - Status: ${channel.status}`)
      console.log(`      - Budget: ${channel.budgetUsdc} USDC`)
      console.log(`      - Used: ${channel.currentCommitmentAmount} base units`)
    }

    console.log('\n✅ Full flow test PASSED!')
    console.log('   Agent execution is working correctly.\n')

  } catch (err) {
    console.error(`\n❌ Test FAILED: ${err.message}\n`)
    console.error('Stack:', err.stack)
    process.exit(1)
  }
}

testFullFlow()
