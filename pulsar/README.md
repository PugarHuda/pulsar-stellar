# ⚡ Pulsar — AI Agent Billing via MPP Session on Stellar

> **Stellar Hacks: Agents** · DoraHacks · April 2026 · 🏆 First Production MPP Session Implementation

Pulsar is an AI agent billing platform built on **MPP Session (payment channel)** on Stellar Testnet.
Instead of paying per-request on-chain, Pulsar streams off-chain micropayments for every agent step,
settling with a **single on-chain transaction** when the task is done.

**🚀 Quick Start**: See [QUICK_START.md](QUICK_START.md) to get running in 5 minutes!  
**📋 Submission**: See [READY_FOR_SUBMISSION.md](READY_FOR_SUBMISSION.md) for final status

## 🎯 Hackathon Submission

**Innovation:** Pulsar is the first production-meaningful implementation of MPP Session (payment channel) mode on Stellar. While existing demos use x402 or MPP Charge (1 tx per request), Pulsar demonstrates the power of payment channels for high-frequency AI agent interactions.

**Why This Matters:** AI agents need to make dozens or hundreds of paid API calls per task. Traditional approaches create 100 on-chain transactions. Pulsar creates 100 off-chain commitments + 1 settlement tx, reducing costs and latency by 99%.

**Technical Depth:**
- ✅ Advanced Soroban features: persistent storage, SAC integration, Ed25519 verification, time-locks, events
- ✅ Per-channel contract deployment for isolation
- ✅ Real AI tools: DuckDuckGo search, VM2 code execution, public APIs (all free)
- ✅ 106 backend tests + 7 Soroban tests with property-based testing
- ✅ Real-time SSE streaming for live updates
- ✅ SEP-10 Stellar Web Authentication
- ✅ Agent Marketplace with multiple agent types
- ✅ Partial settlement support (keep channel open)
- ✅ Analytics dashboard with cost savings metrics
- ✅ Dark mode support
- ✅ PDF receipt export

## Why Pulsar?

Every existing x402/MPP demo uses **charge mode** (pay-per-request, 1 on-chain tx per step).
Pulsar is the first production-meaningful use of **MPP Session channel mode**:

```
Traditional (charge mode):   100 steps = 100 on-chain transactions
Pulsar (session mode):       100 steps = 100 off-chain commitments + 1 settlement tx
```

This makes Pulsar ideal for AI agent billing where tasks involve dozens of LLM calls and tool calls.

## ✨ Features

### Core Features
- **Payment Channels**: MPP Session implementation with off-chain commitments
- **AI Agent Execution**: Real LLM calls, web search, code execution, data fetching
- **Real-time Updates**: Server-Sent Events (SSE) for live task progress
- **Automatic Settlement**: Single on-chain transaction when task completes
- **Time-locked Refunds**: Expired channel recovery for safety

### Advanced Features
- **SEP-10 Authentication**: Stellar Web Authentication with challenge-response
- **Freighter Wallet Integration**: Connect with Freighter browser extension
- **Agent Marketplace**: Choose from multiple specialized agent types (Research, Coding, Analysis, General)
- **Partial Settlement**: Pay incrementally while keeping channel open
- **Analytics Dashboard**: Real-time metrics and cost savings visualization
- **PDF Receipts**: Download detailed transaction receipts
- **Dark Mode**: Full dark mode support across UI
- **Multi-user Support**: JWT authentication for multiple users

### 🆕 Unique Differentiators (NEW!)
- **🤖 AI Cost Prediction**: LLM-powered cost estimation before opening channels
  - Analyzes task description to predict steps, cost, and optimal agent
  - Provides confidence score and detailed cost breakdown
  - Recommends budget with 20% safety buffer
  - Works with LLM (when API key set) or heuristic fallback
  
- **🏆 Agent Reputation System**: On-chain proof of agent performance
  - Tracks success rate, total tasks, and completion history
  - Badge system: Bronze (70%), Silver (80%), Gold (90%), Platinum (95%)
  - On-chain verification via transaction hashes
  - Leaderboard for agent comparison
  - Persistent storage across sessions

## What's Real vs Simulated

| Component | Demo Mode | Production Mode |
|-----------|-----------|-----------------|
| Off-chain commitment signing | ✅ Real Ed25519 signatures | ✅ Real Ed25519 signatures |
| Signature verification | ✅ Real crypto | ✅ Real crypto |
| USDC balance check | 🔵 Skipped | ✅ Real Horizon query |
| Contract deployment | 🔵 Mock address | ✅ Real Soroban deploy per channel |
| Open channel | 🔵 Mock address | ✅ Real Soroban `open_channel` |
| Settlement tx | 🔵 Mock hash | ✅ Real Soroban `close_channel` |
| Partial settlement | 🔵 Mock | ✅ Real Soroban `partial_settle` |
| Expired refund | 🔵 Not available | ✅ Real Soroban `reclaim_expired` |
| USDC transfer | 🔵 Simulated | ✅ Real on-chain transfer |
| Soroban events | 🔵 Not emitted | ✅ Real events for indexing |
| AI agent (llm_call) | 🔵 Mock descriptions | ✅ Real OpenRouter API (if key set) |
| AI agent (reasoning) | 🔵 Mock descriptions | ✅ Real OpenRouter API (if key set) |
| AI agent (web_search) | 🔵 Mock | ✅ Real DuckDuckGo API (free) |
| AI agent (code_exec) | 🔵 Mock | ✅ Real VM2 sandbox (local) |
| AI agent (data_fetch) | 🔵 Mock | ✅ Real public APIs (free) |
| SEP-10 auth | ✅ Real | ✅ Real |
| Wallet integration | ✅ Real Freighter | ✅ Real Freighter |

## Payment Protocol Comparison

| Protocol | Txs per 100 steps | Latency | Gas Cost (est.) | Use Case | Real-time Updates |
|----------|-------------------|---------|-----------------|----------|-------------------|
| **Pulsar (MPP Session)** | **1** | **Low** | **~$0.01** | **High-frequency agents** | **✅ SSE** |
| x402 | 100 | High | ~$1.00 | Single requests | ❌ |
| MPP Charge | 100 | High | ~$1.00 | Per-request billing | ❌ |

**Cost Savings:** Pulsar reduces transaction costs by 99% compared to traditional pay-per-request approaches.

**Latency Improvement:** Off-chain commitments eliminate network round-trips for each step, enabling sub-second agent responses.

## Demo Mode vs Production Mode

| Feature | Demo Mode (default) | Production Mode |
|---------|--------------------|--------------------|
| Trigger | `DEMO_MODE=true` or no `CONTRACT_WASM_HASH`/`CONTRACT_ID` | `CONTRACT_WASM_HASH` set and `DEMO_MODE=false` |
| Contract deployment | Mock contract address (deterministic) | Real Soroban contract deployed per channel (fresh instance) |
| Open Channel | Mock contract address | Real Soroban `open_channel()` call on fresh contract |
| Settlement | Mock tx hash | Real Soroban `close_channel()` call on channel's contract |
| Partial settlement | Mock | Real Soroban `partial_settle()` for incremental payments |
| Expired refund | Not available | Real Soroban `reclaim_expired()` for time-locked safety |
| USDC balance check | Skipped | Real Horizon balance check |
| Testnet USDC needed | No | Yes |
| AI agent (LLM) | Mock descriptions | Real OpenRouter API (if `OPENROUTER_API_KEY` set) |
| AI tools (web search) | Mock | Real DuckDuckGo API (free, no key needed) |
| AI tools (code exec) | Mock | Real VM2 sandbox (local, secure) |
| AI tools (data fetch) | Mock | Real public APIs (free tier) |
| Tests | All 106 pass | Same (tests always use demo mode) |

**Note:** In production mode, each channel gets its own fresh Soroban contract instance to avoid state conflicts. This ensures proper isolation and allows multiple concurrent channels.

## Architecture

### High-Level Flow

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   User/UI   │         │  Pulsar Backend  │         │ Stellar Testnet │
└──────┬──────┘         └────────┬─────────┘         └────────┬────────┘
       │                         │                            │
       │  1. Open Channel        │                            │
       │  (budget: 10 USDC)      │                            │
       ├────────────────────────>│                            │
       │                         │  2. Deploy Contract        │
       │                         │  open_channel(...)         │
       │                         ├───────────────────────────>│
       │                         │                            │
       │                         │  3. USDC → Escrow          │
       │                         │<───────────────────────────┤
       │  4. Channel ID          │                            │
       │<────────────────────────┤                            │
       │                         │                            │
       │  5. Run Agent Task      │                            │
       ├────────────────────────>│                            │
       │                         │  6. Execute Steps          │
       │                         │  [LLM, Search, Code...]    │
       │                         │                            │
       │  7. SSE: Step 1         │  8. Sign Commitment        │
       │  (off-chain)            │  (0 on-chain tx)           │
       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                            │
       │                         │                            │
       │  SSE: Step 2            │  Sign Commitment           │
       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  (0 on-chain tx)           │
       │                         │                            │
       │  ... (N steps)          │  ... (N commitments)       │
       │                         │                            │
       │  9. Settle Channel      │                            │
       ├────────────────────────>│                            │
       │                         │  10. close_channel(...)    │
       │                         │  (1 on-chain tx)           │
       │                         ├───────────────────────────>│
       │                         │                            │
       │                         │  11. Verify Signature      │
       │                         │  Transfer USDC             │
       │                         │<───────────────────────────┤
       │  12. Receipt + Refund   │                            │
       │<────────────────────────┤                            │
       │                         │                            │
```

### Key Innovation: Off-Chain Commitments

```
Traditional (x402/MPP Charge):
Step 1 → On-chain TX 1 → Wait → Step 2 → On-chain TX 2 → Wait → ...
Cost: N transactions × gas fee
Latency: N × network round-trip

Pulsar (MPP Session):
Step 1 → Sign commitment (instant) → Step 2 → Sign commitment (instant) → ...
→ Final settlement (1 on-chain TX)
Cost: 1 transaction × gas fee
Latency: 1 × network round-trip

Result: 99% cost reduction, instant responses
```

### Component Architecture

```
pulsar/
├── backend/                    # Node.js + TypeScript + Express
│   ├── src/
│   │   ├── channel/           # Payment channel logic
│   │   │   ├── manager.ts     # Open, sign, settle
│   │   │   ├── store.ts       # In-memory state
│   │   │   └── types.ts       # Type definitions
│   │   ├── agent/             # AI agent execution
│   │   │   ├── runner.ts      # Task orchestration
│   │   │   ├── steps.ts       # Step generation
│   │   │   ├── llm.ts         # OpenRouter integration
│   │   │   └── tools.ts       # Real tools (search, code, data)
│   │   ├── api/               # HTTP + SSE endpoints
│   │   │   ├── routes.ts      # REST API
│   │   │   └── sse.ts         # Server-Sent Events
│   │   └── stellar/           # Blockchain integration
│   │       └── config.ts      # SDK, RPC, keypairs
│   └── tests/                 # 106 tests (unit + integration)
├── frontend/                   # React 18 + Vite + Tailwind
│   └── src/
│       ├── components/        # UI components
│       │   ├── LandingPage.tsx
│       │   ├── ChannelPanel.tsx
│       │   ├── TaskPanel.tsx
│       │   └── SettlementPanel.tsx
│       └── App.tsx            # Root + SSE client
└── contract/                   # Soroban (Rust)
    └── src/
        └── lib.rs             # one-way-channel contract
```

## Quick Start (Demo Mode)

### Prerequisites
- Node.js 20+

### 1. Setup

```bash
git clone <repo>
cd pulsar

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env: add SERVER_SECRET_KEY and USER_SECRET_KEY (any valid Stellar keypairs)

# Frontend
cd ../frontend
npm install
```

### 2. Generate keypairs (optional — for demo)

```bash
cd backend
npm run demo-setup
```

This generates keypairs and funds them via Friendbot (testnet XLM).

### 3. Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open http://localhost:5173

## Claude AI Integration (Optional)

Pulsar can use real Claude claude-3-haiku-20240307 for `llm_call` and `reasoning` agent steps.

### Setup

1. Get an API key at https://console.anthropic.com/
2. Add to `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

3. Restart the backend.

When `ANTHROPIC_API_KEY` is set:
- `llm_call` steps → real Claude API call with the task as prompt
- `reasoning` steps → real Claude API call for analysis
- `tool_web_search`, `tool_code_exec`, `tool_data_fetch` → simulated with realistic descriptions

If the key is not set or the API call fails, the agent falls back to mock descriptions gracefully.
**Tests are not affected** — they never set `ANTHROPIC_API_KEY`.

## Running with Real Stellar Testnet

To use real Soroban contract calls (production mode):

### Step 1: Fund testnet accounts

```bash
cd backend
npm run demo-setup
```

Copy the generated `SERVER_SECRET_KEY` and `USER_SECRET_KEY` into `backend/.env`.

### Step 2: Get testnet USDC

Visit [https://faucet.circle.com](https://faucet.circle.com):
- Select: **Stellar Testnet**
- Paste your **user public key** (printed by demo-setup)
- Request USDC (you'll receive testnet USDC)

You also need a USDC trustline on the user account. Use `setupUsdcTrustline()` from `stellar/config.ts` or the Stellar Laboratory.

### Step 3: Deploy the Soroban contract

```bash
cd backend
npm run deploy-contract
```

This compiles and deploys `pulsar/contract/src/lib.rs` to Stellar Testnet and prints the contract address.

Or use the already-deployed contract:
```
CONTRACT_ID=CBHQ2SN6OMW7XLRRXU44COVWGHHFRRTLNA24EZFJ5EU2KRFYKWFUKOUE
```

### Step 4: Configure `.env`

```env
# Add to backend/.env
CONTRACT_ID=C...          # deployed contract address from step 3
DEMO_MODE=false           # enable real Soroban calls
SERVER_SECRET_KEY=S...    # server keypair
USER_SECRET_KEY=S...      # user keypair (must have USDC)
ANTHROPIC_API_KEY=sk-ant-... # optional: enable real Claude AI
```

### Step 5: Run

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Now `open_channel` and `close_channel` will invoke the real Soroban contract on Stellar Testnet.

## Demo Walkthrough

1. **Open Channel** — Enter budget (e.g. 10 USDC) and your Stellar public key → click "Open Channel"
2. **Run Agent** — Enter a task description → click "Run Agent Task" → watch steps stream in real-time
3. **Settle** — Click "Settle Channel" → get tx hash + refund amount → verify on Stellar Explorer

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/channels` | Open payment channel |
| GET | `/api/channels/:id` | Get channel state |
| POST | `/api/channels/:id/run` | Run agent task (SSE) |
| POST | `/api/channels/:id/settle` | Settle on-chain |
| GET | `/api/events` | SSE stream |

## Agent Step Types

| Step Type | Cost | Real (Production) | Demo Mode |
|-----------|------|-------------------|-----------|
| LLM Call | 0.05 USDC | ✅ OpenRouter qwen/qwen3.6-plus:free | Mock description |
| Reasoning | 0.01 USDC | ✅ OpenRouter qwen/qwen3.6-plus:free | Mock description |
| Web Search | 0.02 USDC | ✅ Real DuckDuckGo API (free) | Mock description |
| Code Exec | 0.03 USDC | ✅ Real VM2 sandbox (local) | Mock description |
| Data Fetch | 0.02 USDC | ✅ Real public APIs (free) | Mock description |

## Correctness Properties

Pulsar enforces 10 formal correctness properties validated via property-based testing (fast-check):

1. **Monotonic commitment** — each commitment ≥ previous
2. **Budget ceiling** — commitment never exceeds budget
3. **Cumulative sum** — final commitment = sum of all step costs
4. **Refund correctness** — refund = budget - final commitment (non-negative)
5. **Settlement finality** — channel can only be settled once
6. **Serialization round-trip** — serialize → deserialize = identity
7. **Step count** — every task has ≥ 5 steps
8. **Signature verifiability** — commitments verifiable with server public key
9. **Deterministic steps** — same task → same steps
10. **Budget halt** — agent stops before exceeding budget

```bash
cd backend
npm test
```

## Tech Stack

- **Backend**: Node.js 20, TypeScript, Express
- **Stellar**: `@stellar/stellar-sdk` v14, `@stellar/mpp` (MPP Session)
- **Contract**: Soroban one-way-channel contract (Rust)
- **AI**: OpenRouter API (qwen/qwen3.6-plus:free, fallback to Claude)
- **AI Tools**: DuckDuckGo API (free), VM2 sandbox (local), Public APIs (free)
- **Frontend**: React 18, Vite, Tailwind CSS
- **Testing**: Vitest + fast-check (property-based testing)
- **Network**: Stellar Testnet

## Soroban Contract

**File:** `pulsar/contract/src/lib.rs`

**Functions:**
- `open_channel(sender, recipient, token, amount, expiry)` — escrow USDC from sender
- `close_channel(commitment_amount, signature)` — verify Ed25519 sig, transfer funds
- `reclaim_expired()` — time-locked refund if channel expires without settlement
- `get_channel()` — return ChannelState

**Advanced Stellar Features Used:**
- ✅ Soroban persistent storage for channel state
- ✅ Stellar Asset Contract (SAC) integration for USDC
- ✅ Ed25519 cryptographic verification (env.crypto().ed25519_verify)
- ✅ Address authorization (require_auth)
- ✅ Time-locked operations (env.ledger().timestamp)
- ✅ XDR encoding/decoding for channel ID
- ✅ Contract-to-contract calls (token client)

## Key Constants (Testnet)

```
USDC SAC:    CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
USDC Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
Soroban RPC: https://soroban-testnet.stellar.org
Horizon:     https://horizon-testnet.stellar.org
Contract:    CBHQ2SN6OMW7XLRRXU44COVWGHHFRRTLNA24EZFJ5EU2KRFYKWFUKOUE
```

## License

MIT — Built for Stellar Hacks: Agents hackathon
