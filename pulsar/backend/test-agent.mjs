#!/usr/bin/env node
/**
 * test-agent.mjs
 * 
 * Quick test to verify agent execution works
 */

import 'dotenv/config'

console.log('🧪 Testing Agent Components...\n')

// Test 1: Check environment
console.log('1️⃣ Environment Check:')
console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Not set'}`)
console.log(`   DEMO_MODE: ${process.env.DEMO_MODE}`)
console.log(`   CONTRACT_WASM_HASH: ${process.env.CONTRACT_WASM_HASH ? '✅ Set' : '❌ Not set'}`)

// Test 2: Test OpenRouter
console.log('\n2️⃣ Testing OpenRouter...')
try {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://github.com/PugarHuda/pulsar-stellar',
      'X-Title': 'Pulsar Test',
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-plus:free',
      max_tokens: 50,
      messages: [
        { role: 'system', content: 'You are a test assistant. Respond with "OK" only.' },
        { role: 'user', content: 'Test' },
      ],
    }),
  })

  if (response.ok) {
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    console.log(`   ✅ OpenRouter working: "${text.slice(0, 50)}"`)
  } else {
    const error = await response.text()
    console.log(`   ❌ OpenRouter error ${response.status}: ${error.slice(0, 100)}`)
  }
} catch (err) {
  console.log(`   ❌ OpenRouter failed: ${err.message}`)
}

// Test 3: Test Web Search
console.log('\n3️⃣ Testing Web Search (DuckDuckGo)...')
try {
  const response = await fetch('https://api.duckduckgo.com/?q=test&format=json&no_html=1')
  if (response.ok) {
    const data = await response.json()
    console.log(`   ✅ DuckDuckGo working: ${data.Heading || 'OK'}`)
  } else {
    console.log(`   ❌ DuckDuckGo error ${response.status}`)
  }
} catch (err) {
  console.log(`   ❌ DuckDuckGo failed: ${err.message}`)
}

// Test 4: Test Backend API
console.log('\n4️⃣ Testing Backend API...')
try {
  const response = await fetch('http://localhost:3001/api/status')
  if (response.ok) {
    const data = await response.json()
    console.log(`   ✅ Backend API working`)
    console.log(`      - AI Mode: ${data.aiMode}`)
    console.log(`      - Demo Mode: ${data.demoMode}`)
    console.log(`      - Contract: ${data.contractId?.slice(0, 10)}...`)
  } else {
    console.log(`   ❌ Backend API error ${response.status}`)
  }
} catch (err) {
  console.log(`   ❌ Backend API failed: ${err.message}`)
  console.log(`   💡 Make sure backend is running: npm start`)
}

console.log('\n✅ Diagnostic complete!')
console.log('\nIf all tests pass, agent should work.')
console.log('If any test fails, that component needs fixing.\n')
