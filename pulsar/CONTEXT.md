# Pulsar — Project Context

## Apa ini?
Pulsar adalah platform AI agent billing berbasis **MPP Session (payment channel)** di Stellar Testnet.
Dibangun untuk **Stellar Hacks: Agents hackathon** (DoraHacks, deadline 14 April 2026, prize $10K).

## Keunikan utama
Satu-satunya project yang menggunakan **MPP Session channel mode** secara production-meaningful di Stellar.
Semua demo MPP yang ada masih level "hello world" — Pulsar adalah use case nyata: AI agent billing.

## Flow inti
```
User opens channel → deposits N USDC (budget)
Agent runs task:
  - Each step (LLM call / tool call) → off-chain commitment signature (0 on-chain tx)
Task done → server closes channel → 1 on-chain settlement tx
User receives refund of unused budget
```

## Stack
- **Backend**: Node.js 20+, TypeScript, Express, `@stellar/mpp`, `@stellar/stellar-sdk`
- **Frontend**: React 18, Vite, Tailwind CSS
- **Blockchain**: Stellar Testnet, Soroban one-way-channel contract
- **Testing**: Vitest + fast-check (property-based testing)

## Struktur folder
```
pulsar/
├── backend/          # Express API + Channel Manager + Agent Runner
├── frontend/         # React UI
├── contract/         # Soroban Rust contract (one-way payment channel)
└── CONTEXT.md        # ← kamu di sini
```

## Spec files
- `.kiro/specs/pulsar/requirements.md` — 7 requirements dengan acceptance criteria
- `.kiro/specs/pulsar/design.md` — arsitektur, data models, correctness properties
- `.kiro/specs/pulsar/tasks.md` — 18 tasks implementasi

## Key constants (Stellar Testnet)
- USDC SAC: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- USDC Issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- Soroban RPC: `https://soroban-testnet.stellar.org`
- Horizon: `https://horizon-testnet.stellar.org`
- Network passphrase: `Test SDF Network ; September 2015`
