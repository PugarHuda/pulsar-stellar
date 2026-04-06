#!/usr/bin/env node
/**
 * check-accounts.mjs
 * 
 * Check if server and user accounts are funded on Stellar Testnet.
 * Provides helpful instructions if accounts need funding.
 */

import { Keypair } from '@stellar/stellar-sdk'
import 'dotenv/config'

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'

async function checkAccount(name, secretKey) {
  if (!secretKey) {
    console.log(`\n❌ ${name}: No secret key found in .env`)
    return false
  }

  try {
    const keypair = Keypair.fromSecret(secretKey)
    const publicKey = keypair.publicKey()
    
    console.log(`\n🔍 Checking ${name}...`)
    console.log(`   Public Key: ${publicKey}`)
    
    const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`   ❌ Account NOT FOUND on testnet`)
        console.log(`   💡 Fund this account:`)
        console.log(`      1. Go to: https://laboratory.stellar.org/#account-creator?network=test`)
        console.log(`      2. Enter public key: ${publicKey}`)
        console.log(`      3. Click "Get test network lumens"`)
        return false
      }
      throw new Error(`HTTP ${response.status}`)
    }
    
    const account = await response.json()
    const xlmBalance = account.balances.find(b => b.asset_type === 'native')
    const usdcBalance = account.balances.find(b => 
      b.asset_code === 'USDC' && 
      b.asset_issuer === 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    )
    
    console.log(`   ✅ Account FOUND`)
    console.log(`   💰 XLM Balance: ${xlmBalance?.balance || '0'} XLM`)
    console.log(`   💵 USDC Balance: ${usdcBalance?.balance || '0'} USDC`)
    
    if (parseFloat(xlmBalance?.balance || '0') < 1) {
      console.log(`   ⚠️  WARNING: Low XLM balance (need at least 1 XLM for gas fees)`)
      return false
    }
    
    return true
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`)
    return false
  }
}

async function main() {
  console.log('🚀 Pulsar Account Checker')
  console.log('=' .repeat(60))
  
  const serverOk = await checkAccount('SERVER ACCOUNT', process.env.SERVER_SECRET_KEY)
  const userOk = await checkAccount('USER ACCOUNT', process.env.USER_SECRET_KEY)
  
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Server Account: ${serverOk ? '✅ Ready' : '❌ Needs funding'}`)
  console.log(`   User Account: ${userOk ? '✅ Ready' : '❌ Needs funding'}`)
  
  if (serverOk && userOk) {
    console.log('\n🎉 All accounts are funded and ready!')
    console.log('   You can now run: npm start')
  } else {
    console.log('\n⚠️  Some accounts need funding before you can use Pulsar')
    console.log('   Follow the instructions above to fund your accounts')
  }
  
  console.log('')
}

main().catch(console.error)
