# tests/ — Context

## Files
- `channel.test.ts` — integration tests: openChannel, signCommitment, settleChannel, full flow
- `open-channel.test.ts` — unit tests for openChannel (balance check, contract failure)
- `settlement-retry.test.ts` — settlement retry logic (Req 4.3)
- `store.test.ts` — channel store CRUD operations
- `stellar-config.test.ts` — Stellar config constants and helpers
- `properties.test.ts` — property-based tests (fast-check): 10 correctness properties
- `routes.test.ts` — API route integration tests

## Run tests
```bash
npm test          # single run
npm run test:watch # watch mode
```

## Test status
106/106 tests pass. All tests run without real testnet connection.

## Property tests (fast-check)
P1: Monotonic commitment — each commitment >= previous
P2: Budget ceiling — commitment never exceeds budget
P3: Cumulative sum — final commitment = sum of step costs
P4: Refund correctness — refund = budget - final (non-negative)
P5: Settlement finality — settle 2x throws
P6: Serialization round-trip — serialize → deserialize = identity
P7: Step count >= 5
P8: Signature verifiability — sig verifiable with server pubkey
P9: Deterministic steps — same task → same steps
P10: Budget halt — agent stops before exceeding budget

## Mocking strategy
All tests use **DEMO_MODE** behavior (no real testnet connection required):
- `getUsdcBalance` mocked → returns '100.0000000'
- `getServerKeypair`/`getUserKeypair` mocked → fixed test keypairs
- Soroban RPC not hit (CONTRACT_ID not set → demo mode in manager.ts)
- SSE broadcast mocked → vi.fn()
- `ANTHROPIC_API_KEY` not set → agent uses mock step descriptions

## Important: tests are not affected by real integrations
- Real Soroban calls in manager.ts are gated behind `CONTRACT_ID` env var
- Real Claude calls in llm.ts are gated behind `ANTHROPIC_API_KEY` env var
- Since tests do not set these, they always use demo/mock behavior
- All 106 tests pass without any real network connection
