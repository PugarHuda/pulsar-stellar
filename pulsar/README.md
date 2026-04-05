# ⚡ Pulsar — AI Agent Billing via MPP Session on Stellar

> **Stellar Hacks: Agents** · DoraHacks · April 2026

Pulsar is an AI agent billing platform built on **MPP Session (payment channel)** on Stellar Testnet.
Instead of paying per-request on-chain, Pulsar streams off-chain micropayments for every agent step,
settling with a **single on-chain transaction** when the task is done.

## Why Pulsar?

Every existing x402/MPP demo uses **charge mode** (pay-per-request, 1 on-chain tx per step).
Pulsar is the first production-meaningful use of **MPP Session channel mode**:

```
Traditional (charge mode):   100 steps = 100 on-chain transactions
Pulsar (session mode):       100 steps = 100 off-chain commitments + 1 settlement tx
```

This makes Pulsar ideal for AI agent billing where tasks involve dozens of LLM calls and tool calls.

## Architecture

```
User/UI              Pulsar Backend           Stellar Testnet
   |                      |                        |
   | Open Channel         |                        |
   |--------------------->| deploy Soroban         |
   |                      | one-way-channel ------>|
   | { channelId }        |                        |
   |<---------------------|                        |
   |                      |                        |
   | Run Agent Task       |                        |
   |--------------------->|                        |
   |                      | [step 1] sign commitment (off-chain)
   | SSE: step 1 ←- - - - |                        |
   |                      | [step 2] sign commitment (off-chain)
   | SSE: step 2 ←- - - - |                        |
   |                      | ... (N steps, 0 on-chain tx)
   |                      |                        |
   | Settle Channel       |                        |
   |--------------------->| close channel -------->|
   | { txHash, refund }   | 1 on-chain tx          |
   |<---------------------|                        |
```

## Quick Start

### Prerequisites
- Node.js 20+
- Stellar testnet accounts funded with XLM + USDC

### 1. Setup

```bash
# Clone and install
git clone <repo>
cd pulsar

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your keypairs

# Frontend
cd ../frontend
npm install
```

### 2. Fund testnet accounts

```bash
cd backend
npm run demo-setup
```

This will:
- Fund server and user accounts via Friendbot (10,000 XLM each)
- Print your public keys for the Circle USDC faucet

Then get testnet USDC from: https://faucet.circle.com (select Stellar Testnet)

### 3. Configure `.env`

```env
SERVER_SECRET_KEY=S...   # Server keypair (signs commitments)
USER_SECRET_KEY=S...     # Demo user keypair (funds channels)
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open http://localhost:5173

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

## Mock Agent Steps

| Step Type | Cost | Description |
|-----------|------|-------------|
| LLM Call | 0.05 USDC | Language model inference |
| Web Search | 0.02 USDC | Tool: web search |
| Code Exec | 0.03 USDC | Tool: code execution |
| Data Fetch | 0.02 USDC | Tool: external API |
| Reasoning | 0.01 USDC | Internal reasoning step |

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
- **Contract**: Soroban one-way-channel contract
- **Frontend**: React 18, Vite, Tailwind CSS
- **Testing**: Vitest + fast-check (property-based testing)
- **Network**: Stellar Testnet

## Key Constants (Testnet)

```
USDC SAC:    CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
USDC Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
Soroban RPC: https://soroban-testnet.stellar.org
Horizon:     https://horizon-testnet.stellar.org
```

## License

MIT — Built for Stellar Hacks: Agents hackathon
