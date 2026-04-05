# Backend Context — Pulsar

## Purpose
Express API server managing the full lifecycle of MPP Session payment channels on Stellar Testnet.

## Structure
```
backend/
├── src/
│   ├── channel/
│   │   ├── types.ts      # Channel, Commitment, ChannelStatus interfaces
│   │   ├── store.ts      # In-memory channel state store (Map<string, Channel>)
│   │   └── manager.ts    # openChannel, signCommitment, settleChannel
│   ├── agent/
│   │   ├── llm.ts        # Claude API integration (callClaude, isClaudeAvailable)
│   │   ├── steps.ts      # Step types, costs, generateTaskSteps()
│   │   └── runner.ts     # runAgent() — real/mock AI task execution + SSE events
│   ├── api/
│   │   ├── sse.ts        # SSE manager (addClient, broadcast)
│   │   └── routes.ts     # Express routes (4 REST + 1 SSE)
│   ├── stellar/
│   │   └── config.ts     # Stellar SDK config, keypairs, USDC SAC, setupUsdcTrustline
│   └── index.ts          # Express app entry point
├── tests/
│   ├── channel.test.ts         # Integration tests
│   ├── properties.test.ts      # Property-based tests (fast-check)
│   ├── open-channel.test.ts    # openChannel unit tests
│   ├── settlement-retry.test.ts # Settlement retry logic tests
│   ├── store.test.ts           # Channel store CRUD tests
│   └── stellar-config.test.ts  # Stellar config unit tests
├── scripts/
│   ├── demo-setup.ts     # Fund accounts + print .env instructions
│   └── deploy-contract.ts # Deploy Soroban contract to testnet
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
| GET | `/api/status` | Backend status: aiMode, network, contractId, demoMode |

## Real vs Demo Mode

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Demo** (default) | `DEMO_MODE=true` or `CONTRACT_ID` not set | Mock contract address, mock tx hash, no real USDC needed |
| **Production** | `CONTRACT_ID=<deployed-contract>` and `DEMO_MODE=false` | Real Soroban `open_channel` / `close_channel` on Stellar Testnet |
| **Claude AI** | `ANTHROPIC_API_KEY` set | Real Claude claude-3-haiku-20240307 for llm_call + reasoning steps |

### DEMO_MODE=true (default)
- `deployChannelContract()` → returns deterministic mock `C...` address
- `submitSettlementTx()` → returns mock tx hash (hex string)
- `getUsdcBalance()` check is skipped
- All 106 tests pass without any real testnet connection

### CONTRACT_ID set (production)
- `deployChannelContract()` → invokes `open_channel(sender, recipient, token, amount, expiry)` on Soroban
- `submitSettlementTx()` → invokes `close_channel(commitment_amount, signature)` on Soroban
- Uses `sorobanRpc.simulateTransaction()` + `prepareTransaction()` + `sendTransaction()` + polling
- Server keypair signs and submits the transaction

### ANTHROPIC_API_KEY set (Claude AI)
- `llm_call` steps → real Claude claude-3-haiku-20240307 API call
- `reasoning` steps → real Claude API call for analysis
- `tool_web_search`, `tool_code_exec`, `tool_data_fetch` → simulated with realistic descriptions
- Falls back to mock descriptions gracefully if API key not set or API call fails

## Key concepts
- **Channel**: one-way payment channel on Soroban, escrows USDC from user
- **Commitment**: off-chain signed message, cumulative amount, 0 on-chain tx
- **Settlement**: 1 on-chain tx to close channel + transfer to server + refund to user
- **Agent steps**: LLM_CALL (0.05 USDC), TOOL_CALL (0.02-0.03 USDC), REASONING (0.01 USDC)

## Correctness properties (fast-check)
1. Monotonic commitment: each commitment >= previous
2. Budget ceiling: commitment never exceeds budget
3. Cumulative sum: final commitment = sum of all step costs
4. Refund correctness: refund = budget - final_commitment (non-negative)
5. Single settlement: channel can only be settled once
6. Serialization round-trip: serialize → deserialize = identity
7. Signature verifiability: commitment signed by server always verifiable
8. Deterministic steps: generateTaskSteps(task) always same for same input
9. Budget halt: agent stops before exceeding budget
10. State transition: open → closed, cannot go back

## Environment variables
See `.env.example` for full list.
Required: `SERVER_SECRET_KEY`, `USER_SECRET_KEY`, `USDC_SAC_ADDRESS`
Optional for production: `CONTRACT_ID` (enables real Soroban calls)
Optional for Claude AI: `ANTHROPIC_API_KEY` (enables real LLM calls)
