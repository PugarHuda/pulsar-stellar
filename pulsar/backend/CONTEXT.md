# Backend Context — Pulsar

## Tujuan
Express API server yang mengelola lifecycle payment channel MPP Session di Stellar Testnet.

## Struktur
```
backend/
├── src/
│   ├── channel/
│   │   ├── types.ts      # Channel, Commitment, ChannelStatus interfaces
│   │   ├── store.ts      # In-memory channel state store (Map<string, Channel>)
│   │   └── manager.ts    # openChannel, signCommitment, settleChannel
│   ├── agent/
│   │   ├── steps.ts      # Step types, costs, generateTaskSteps()
│   │   └── runner.ts     # runAgent() — mock AI task execution + SSE events
│   ├── api/
│   │   ├── sse.ts        # SSE manager (addClient, broadcast)
│   │   └── routes.ts     # Express routes (4 REST + 1 SSE)
│   ├── stellar/
│   │   └── config.ts     # Stellar SDK config, keypairs, USDC SAC
│   └── index.ts          # Express app entry point
├── tests/
│   ├── channel.test.ts   # Integration tests
│   └── properties.test.ts # Property-based tests (fast-check)
├── scripts/
│   └── demo-setup.ts     # Fund accounts + deploy contract
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/channels` | Open new payment channel |
| GET | `/api/channels/:id` | Get channel state |
| POST | `/api/channels/:id/run` | Run agent task (SSE stream) |
| POST | `/api/channels/:id/settle` | Close channel + settle on-chain |
| GET | `/api/events` | SSE event stream |

## Key concepts
- **Channel**: one-way payment channel di Soroban, escrow USDC dari user
- **Commitment**: off-chain signed message, cumulative amount, 0 on-chain tx
- **Settlement**: 1 on-chain tx untuk close channel + transfer ke server + refund ke user
- **Agent steps**: mock deterministik — LLM_CALL (0.05 USDC), TOOL_CALL (0.02 USDC), REASONING (0.01 USDC)

## Correctness properties (fast-check)
1. Monotonic commitment: setiap commitment >= sebelumnya
2. Budget ceiling: commitment tidak pernah melebihi budget
3. Cumulative sum: final commitment = sum of all step costs
4. Refund correctness: refund = budget - final_commitment (non-negatif)
5. Single settlement: channel hanya bisa di-settle sekali
6. Serialization round-trip: serialize → deserialize = identity
7. Signature verifiability: commitment yang di-sign server selalu bisa diverifikasi
8. Deterministic steps: generateTaskSteps(task) selalu sama untuk input sama
9. Budget halt: agent berhenti sebelum melebihi budget
10. State transition: open → closed, tidak bisa kembali

## Environment variables
Lihat `.env.example` untuk daftar lengkap.
Wajib diset sebelum run: `SERVER_SECRET_KEY`, `USER_SECRET_KEY`, `USDC_SAC_ADDRESS`
