/**
 * scripts/deploy-contract.ts
 *
 * Deployment script for the Pulsar one-way-channel Soroban contract.
 * - Builds the contract with `stellar contract build`
 * - Deploys to Stellar Testnet using `stellar contract deploy`
 * - Prints the CONTRACT_ID and optionally updates backend/.env
 *
 * Run: npx tsx scripts/deploy-contract.ts
 *
 * Prerequisites:
 *   - Rust + cargo installed
 *   - stellar CLI installed (https://developers.stellar.org/docs/tools/stellar-cli)
 *   - SERVER_SECRET_KEY set in backend/.env
 *
 * Context: See backend/CONTEXT.md
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import 'dotenv/config'

// ─── Paths ───────────────────────────────────────────────────────────────────

const SCRIPT_DIR = new URL('.', import.meta.url).pathname
const BACKEND_DIR = resolve(SCRIPT_DIR, '..')
const CONTRACT_DIR = resolve(BACKEND_DIR, '..', 'contract')
const WASM_PATH = join(
  CONTRACT_DIR,
  'target',
  'wasm32-unknown-unknown',
  'release',
  'pulsar_channel.wasm',
)
const ENV_FILE = join(BACKEND_DIR, '.env')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd: string, cwd: string): string {
  console.log(`  $ ${cmd}`)
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }).trim()
}

function updateEnvFile(key: string, value: string): void {
  if (!existsSync(ENV_FILE)) {
    console.log(`\n  ℹ No .env file found at ${ENV_FILE} — skipping auto-update.`)
    console.log(`  Add manually: ${key}=${value}`)
    return
  }

  let content = readFileSync(ENV_FILE, 'utf8')

  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`)
    console.log(`  ✓ Updated ${key} in .env`)
  } else {
    content += `\n${key}=${value}\n`
    console.log(`  ✓ Appended ${key} to .env`)
  }

  writeFileSync(ENV_FILE, content, 'utf8')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════╗')
  console.log('║  Pulsar Contract Deploy — Stellar Testnet     ║')
  console.log('╚═══════════════════════════════════════════════╝\n')

  // ── 1. Validate SERVER_SECRET_KEY ──────────────────────────────────────────
  const serverSecretKey = process.env.SERVER_SECRET_KEY
  if (!serverSecretKey || serverSecretKey.startsWith('SXXX')) {
    console.error('✗ SERVER_SECRET_KEY is not set in backend/.env')
    console.error('  Run `npx tsx scripts/demo-setup.ts` first to generate keypairs.')
    process.exit(1)
  }

  // ── 2. Build contract ──────────────────────────────────────────────────────
  console.log('─── Step 1: Build contract ───')
  console.log(`  Contract dir: ${CONTRACT_DIR}\n`)

  try {
    run('stellar contract build', CONTRACT_DIR)
    console.log('  ✓ Contract built successfully\n')
  } catch (err) {
    console.error('  ✗ Build failed. Make sure Rust and cargo are installed.')
    console.error('    Install: https://rustup.rs')
    console.error('    Then: rustup target add wasm32-unknown-unknown')
    throw err
  }

  // ── 3. Verify WASM exists ──────────────────────────────────────────────────
  if (!existsSync(WASM_PATH)) {
    console.error(`  ✗ WASM not found at: ${WASM_PATH}`)
    console.error('  Check Cargo.toml — package name must be "pulsar_channel"')
    process.exit(1)
  }
  console.log(`  WASM: ${WASM_PATH}\n`)

  // ── 4. Deploy contract ─────────────────────────────────────────────────────
  console.log('─── Step 2: Deploy to Testnet ───\n')

  const deployCmd = [
    'stellar contract deploy',
    `--wasm ${WASM_PATH}`,
    '--network testnet',
    `--source ${serverSecretKey}`,
  ].join(' ')

  let contractId: string
  try {
    contractId = run(deployCmd, CONTRACT_DIR)
    console.log(`\n  ✓ Contract deployed!\n`)
  } catch (err) {
    console.error('  ✗ Deploy failed.')
    console.error('  Make sure stellar CLI is installed: https://developers.stellar.org/docs/tools/stellar-cli')
    console.error('  And that SERVER_SECRET_KEY account is funded with XLM on testnet.')
    throw err
  }

  // ── 5. Print result ────────────────────────────────────────────────────────
  console.log('─── Result ───')
  console.log(`\n  CONTRACT_ID: ${contractId}`)
  console.log(`\n  View on explorer: https://stellar.expert/explorer/testnet/contract/${contractId}`)

  // ── 6. Update .env ─────────────────────────────────────────────────────────
  console.log('\n─── Updating .env ───')
  updateEnvFile('CONTRACT_ID', contractId)

  console.log('\n✓ Done! CONTRACT_ID is ready for use.')
}

main().catch((err) => {
  console.error('\n✗ Deployment failed:', err.message ?? err)
  process.exit(1)
})
