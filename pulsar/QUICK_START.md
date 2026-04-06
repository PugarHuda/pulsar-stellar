# 🚀 Pulsar - Quick Start Guide

Get Pulsar running in 5 minutes!

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn installed
- (Optional) Stellar CLI for generating keypairs

---

## 🏃 Quick Start (Demo Mode)

### 1. Clone Repository
```bash
git clone https://github.com/PugarHuda/pulsar-stellar.git
cd pulsar-stellar/pulsar
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and set these minimum values:
```env
# Use demo mode (no real Stellar transactions)
DEMO_MODE=true

# Generate keypairs with: stellar keys generate --network testnet
# Or use these demo keys (testnet only, no real funds):
SERVER_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
USER_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Optional: Add OpenRouter API key for real AI (free tier available)
OPENROUTER_API_KEY=your_key_here
```

Start backend:
```bash
npm run dev
```

Backend will run on: http://localhost:3001

### 3. Setup Frontend

Open new terminal:
```bash
cd pulsar/frontend
npm install
npm run dev
```

Frontend will run on: http://localhost:5173

### 4. Open Browser

Navigate to: http://localhost:5173

---

## 🎮 Using Pulsar

### Step 1: Landing Page
- See the value proposition and stats
- Click "Launch App" button

### Step 2: Payment Channels Tab
1. Enter budget (e.g., 10 USDC)
2. Enter your Stellar public key (or use demo mode)
3. Click "Open Channel"
4. Wait for channel to open (demo mode is instant)

### Step 3: Run AI Agent
1. Enter a task (e.g., "Research AI agents on blockchain")
2. Click "Run Agent Task"
3. Watch real-time updates via SSE
4. See budget tracking and step progress

### Step 4: Settle Channel
1. Click "Settle Channel"
2. See final settlement with 1 transaction
3. View receipt with transaction details

### Step 5: Explore Other Tabs
- **Agent Marketplace**: Browse different agent types
- **Analytics**: See cost comparisons and visualizations

---

## 🔑 Generating Stellar Keypairs

### Using Stellar CLI (Recommended)

Install Stellar CLI:
```bash
# macOS
brew install stellar/tap/stellar-cli

# Linux/Windows
# Download from: https://github.com/stellar/stellar-cli/releases
```

Generate keypairs:
```bash
# Server keypair
stellar keys generate server-key --network testnet

# User keypair
stellar keys generate user-key --network testnet
```

Copy the secret keys to your `.env` file.

### Using Stellar Laboratory (Web)

1. Go to: https://laboratory.stellar.org/#account-creator?network=test
2. Click "Generate keypair"
3. Copy the secret key to `.env`
4. Fund the account with testnet XLM (click "Fund with Friendbot")

---

## 🧪 Running Tests

### Backend Tests (106 tests)
```bash
cd pulsar/backend
npm test
```

Expected output:
```
✓ tests/channel.test.ts (18)
✓ tests/open-channel.test.ts (10)
✓ tests/properties.test.ts (30)
✓ tests/routes.test.ts (8)
✓ tests/settlement-retry.test.ts (8)
✓ tests/stellar-config.test.ts (19)
✓ tests/store.test.ts (13)

Test Files  7 passed (7)
Tests  106 passed (106)
```

### Soroban Contract Tests (7 tests)
```bash
cd pulsar/contract
cargo test
```

Expected output:
```
running 7 tests
test tests::test_open_channel_stores_state ... ok
test tests::test_reclaim_expired_channel ... ok
test tests::test_get_channel_before_open - should panic ... ok
test tests::test_zero_amount_rejected - should panic ... ok
test tests::test_cannot_open_twice - should panic ... ok
test tests::test_cannot_reclaim_before_expiry - should panic ... ok
test tests::test_close_exceeds_amount - should panic ... ok

test result: ok. 7 passed; 0 failed
```

---

## 🌐 Production Mode (Real Stellar Testnet)

### 1. Setup Environment

Edit `.env`:
```env
# Disable demo mode
DEMO_MODE=false

# Use real Stellar testnet
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org

# Your real keypairs (with testnet XLM and USDC)
SERVER_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
USER_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Contract WASM hash (already uploaded to testnet)
CONTRACT_WASM_HASH=394a957ec687ca7212c82af920af339fdabe685f1f92ee646d3c4c867874dacd
```

### 2. Fund Accounts

Fund both accounts with testnet XLM:
```bash
# Fund server account
curl "https://friendbot.stellar.org?addr=YOUR_SERVER_PUBLIC_KEY"

# Fund user account
curl "https://friendbot.stellar.org?addr=YOUR_USER_PUBLIC_KEY"
```

### 3. Get Testnet USDC

1. Go to: https://laboratory.stellar.org/#account-creator?network=test
2. Add trustline to USDC:
   - Asset Code: USDC
   - Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
3. Request testnet USDC from faucet or swap XLM

### 4. Deploy Contract

The backend will automatically deploy a contract instance on startup using the WASM hash.

Or deploy manually:
```bash
cd pulsar/backend/scripts
npx tsx deploy-contract.ts
```

### 5. Start Services

```bash
# Backend
cd pulsar/backend
npm run dev

# Frontend
cd pulsar/frontend
npm run dev
```

---

## 🐛 Troubleshooting

### Backend won't start
- Check `.env` file exists and has valid values
- Ensure port 3001 is not in use
- Run `npm install` again

### Frontend won't start
- Check port 5173 is not in use
- Run `npm install` again
- Clear browser cache

### Tests failing
- Ensure all dependencies installed: `npm install`
- Check Node.js version: `node --version` (should be 18+)
- Try: `npm run build` first

### Contract deployment fails
- Check Stellar testnet is accessible
- Verify WASM hash is correct
- Ensure server account has XLM balance
- Try demo mode instead: `DEMO_MODE=true`

### Freighter wallet not detected
- Install Freighter extension: https://www.freighter.app/
- Refresh the page
- Or use "Demo Mode" button to bypass wallet

---

## 📚 Additional Resources

- **Full Documentation**: See `README.md`
- **Feature List**: See `FEATURES_IMPLEMENTED.md`
- **Competitive Analysis**: See `COMPETITIVE_ADVANTAGES.md`
- **Submission Highlights**: See `FINAL_SUBMISSION_HIGHLIGHTS.md`
- **Demo Script**: See `DEMO_VIDEO_SCRIPT.md`

---

## 🎯 Key Features to Try

1. **Payment Channels**: Open channel → Run agent → Settle with 1 tx
2. **Real AI**: Set OPENROUTER_API_KEY for real LLM calls
3. **Real-time Updates**: Watch SSE stream during agent execution
4. **Budget Tracking**: See cost accumulation in real-time
5. **Analytics**: View cost comparison charts
6. **Agent Marketplace**: Browse different agent types
7. **Dark Mode**: Toggle dark/light theme
8. **PDF Receipts**: Export channel receipts

---

## 💡 Demo Tips

### For Video Recording
1. Use demo mode for instant responses
2. Prepare a simple task: "Research blockchain payments"
3. Show all 3 tabs: Channels, Marketplace, Analytics
4. Highlight the 99% cost reduction in analytics
5. Show the code and tests in GitHub

### For Live Demo
1. Have backend and frontend running before demo
2. Use demo mode to avoid network delays
3. Prepare 2-3 example tasks
4. Show the real-time SSE updates
5. Emphasize the single settlement transaction

---

## 🏆 What Makes This Special

- **Only MPP Session implementation** (vs x402/MPP Charge)
- **99% cost reduction** (1 tx vs 100 txs)
- **Real AI agent** (not mocked)
- **113 tests** (106 backend + 7 Soroban)
- **Production-ready** (comprehensive error handling)
- **Agent-to-agent payments** (original innovation)

---

## 📞 Support

- **GitHub Issues**: https://github.com/PugarHuda/pulsar-stellar/issues
- **Documentation**: See `README.md`
- **Hackathon**: Stellar Hacks: Agents (DoraHacks)

---

**Happy hacking! 🚀**
