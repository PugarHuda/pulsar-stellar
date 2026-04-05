# Pulsar — Project Context

## What is this?
Pulsar is an AI agent billing platform built on **MPP Session (payment channel)** on Stellar Testnet.
Built for **Stellar Hacks: Agents hackathon** (DoraHacks, deadline 14 April 2026, prize $10K).

## Core uniqueness
The only project using **MPP Session channel mode** in a production-meaningful way on Stellar.
All existing MPP demos are "hello world" level — Pulsar is a real use case: AI agent billing.

## Core flow
```
User opens channel → deposits N USDC (budget)
Agent runs task:
  - Each step (LLM call / tool call) → off-chain commitment signature (0 on-chain tx)
Task done → server closes channel → 1 on-chain settlement tx
User receives refund of unused budget
```

## Real vs Mock — Accurate Summary

### Stellar / Soroban — 100% REAL
- `open_channel` → real Soroban contract call on Stellar Testnet (when `CONTRACT_ID` set)
- `close_channel` → real Soroban contract call on Stellar Testnet (when `CONTRACT_ID` set)
- Ed25519 commitment signing → real cryptography (always, both modes)
- USDC balance check → real Horizon API (when `DEMO_MODE=false`)

### AI Agent — PARTIALLY REAL
- `llm.ts` has full Claude API integration (claude-3-haiku-20240307)
- `llm_call` and `reasoning` steps → real Claude API when `ANTHROPIC_API_KEY` is set
- Falls back to mock descriptions gracefully if key not set or API call fails
- `tool_web_search`, `tool_code_exec`, `tool_data_fetch` → always simulated (intentional for demo)

### Agent Step Generation — MOCK (intentional)
- `steps.ts` generates deterministic steps based on task hash
- Step costs are fixed (llm_call: 0.05, web_search: 0.02, etc.)
- Intentional for demo predictability and reproducible test results

### Frontend — REAL
- `GET /api/status` → shows "🤖 Claude AI" or "🎭 Demo Mode" badge in header
- Real-time SSE step streaming with live LLM response text
- All UI state driven by actual backend events

## Real vs Demo Mode

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Demo** (default) | `DEMO_MODE=true` or `CONTRACT_ID` not set | Mock contract address, mock tx hash, no real USDC needed |
| **Production** | `CONTRACT_ID=<deployed-contract>` and `DEMO_MODE=false` | Real Soroban `open_channel` / `close_channel` invocations on Stellar Testnet |
| **Claude AI** | `ANTHROPIC_API_KEY` set | Real Claude claude-3-haiku-20240307 for llm_call + reasoning steps |

## What's Real vs Simulated

| Component | Demo Mode | Production Mode |
|-----------|-----------|-----------------|
| Off-chain commitment signing | ✅ Real Ed25519 | ✅ Real Ed25519 |
| Signature verification | ✅ Real crypto | ✅ Real crypto |
| USDC balance check | 🔵 Skipped | ✅ Real Horizon query |
| Contract deployment | 🔵 Mock address | ✅ Real Soroban `open_channel` |
| Settlement tx | 🔵 Mock hash | ✅ Real Soroban `close_channel` |
| USDC transfer | 🔵 Simulated | ✅ Real on-chain transfer |
| AI agent (llm_call, reasoning) | 🔵 Mock descriptions | ✅ Real Claude API (if `ANTHROPIC_API_KEY` set) |
| AI agent (tool calls) | 🔵 Simulated | 🔵 Simulated (realistic, intentional) |
| Agent step generation | 🔵 Deterministic mock | 🔵 Deterministic mock (intentional) |

## Stack
- **Backend**: Node.js 20+, TypeScript, Express, `@stellar/stellar-sdk`
- **Frontend**: React 18, Vite, Tailwind CSS
- **Blockchain**: Stellar Testnet, Soroban one-way-channel contract
- **AI**: Anthropic Claude claude-3-haiku-20240307 (optional)
- **Testing**: Vitest + fast-check (property-based testing)

## Folder structure
```
pulsar/
├── backend/          # Express API + Channel Manager + Agent Runner
├── frontend/         # React UI
├── contract/         # Soroban Rust contract (one-way payment channel)
└── CONTEXT.md        # ← you are here
```

## Key constants (Stellar Testnet)
- USDC SAC: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- USDC Issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- Soroban RPC: `https://soroban-testnet.stellar.org`
- Horizon: `https://horizon-testnet.stellar.org`
- Network passphrase: `Test SDF Network ; September 2015`
- Deployed contract: `CBHQ2SN6OMW7XLRRXU44COVWGHHFRRTLNA24EZFJ5EU2KRFYKWFUKOUE`

## Test status
- Backend: 106/106 tests pass
- Frontend: 24/24 tests pass
