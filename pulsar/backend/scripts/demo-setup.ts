/**
 * scripts/demo-setup.ts
 *
 * Demo setup script for Pulsar.
 * - Generates server and user keypairs
 * - Funds both accounts via Friendbot (testnet XLM)
 * - Prints instructions for getting testnet USDC
 *
 * Run: npx tsx scripts/demo-setup.ts
 *
 * Context: See backend/CONTEXT.md
 */

import { Keypair } from '@stellar/stellar-sdk'

const FRIENDBOT_URL = 'https://friendbot.stellar.org'
const CIRCLE_FAUCET_URL = 'https://faucet.circle.com'

async function fundAccount(publicKey: string, label: string): Promise<void> {
  console.log(`\nFunding ${label} (${publicKey.slice(0, 10)}...)`)
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`)
  if (res.ok) {
    console.log(`  ✓ Funded with 10,000 testnet XLM`)
  } else {
    const text = await res.text()
    if (text.includes('already funded') || text.includes('createAccountAlreadyExist')) {
      console.log(`  ℹ Already funded`)
    } else {
      console.log(`  ✗ Friendbot error: ${text.slice(0, 100)}`)
    }
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗')
  console.log('║     Pulsar Demo Setup — Stellar Testnet   ║')
  console.log('╚═══════════════════════════════════════════╝\n')

  // Generate keypairs
  const serverKeypair = Keypair.random()
  const userKeypair = Keypair.random()

  console.log('Generated keypairs:')
  console.log('\n[SERVER KEYPAIR] — signs commitments, receives payment')
  console.log(`  Public:  ${serverKeypair.publicKey()}`)
  console.log(`  Secret:  ${serverKeypair.secret()}`)

  console.log('\n[USER KEYPAIR] — funds channels, receives refunds')
  console.log(`  Public:  ${userKeypair.publicKey()}`)
  console.log(`  Secret:  ${userKeypair.secret()}`)

  // Fund via Friendbot
  console.log('\n─── Funding via Friendbot ───')
  await fundAccount(serverKeypair.publicKey(), 'Server')
  await fundAccount(userKeypair.publicKey(), 'User')

  // Instructions for USDC
  console.log('\n─── Get Testnet USDC ───')
  console.log(`\nVisit: ${CIRCLE_FAUCET_URL}`)
  console.log('Select: Stellar Testnet')
  console.log(`Paste user public key: ${userKeypair.publicKey()}`)
  console.log('(You need USDC in the user account to fund channels)')

  // .env instructions
  console.log('\n─── Add to backend/.env ───')
  console.log(`\nSERVER_SECRET_KEY=${serverKeypair.secret()}`)
  console.log(`USER_SECRET_KEY=${userKeypair.secret()}`)
  console.log(`SOROBAN_RPC_URL=https://soroban-testnet.stellar.org`)
  console.log(`HORIZON_URL=https://horizon-testnet.stellar.org`)
  console.log(`NETWORK_PASSPHRASE=Test SDF Network ; September 2015`)
  console.log(`USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`)
  console.log(`USDC_SAC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`)
  console.log(`PORT=3001`)

  console.log('\n✓ Setup complete! Run `npm run dev` to start the backend.')
}

main().catch(console.error)
