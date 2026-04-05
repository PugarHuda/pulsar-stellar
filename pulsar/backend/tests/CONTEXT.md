# tests/ — Context

## Files
- `channel.test.ts` — integration tests: openChannel, signCommitment, settleChannel, full flow
- `open-channel.test.ts` — unit tests for openChannel (balance check, contract failure)
- `settlement-retry.test.ts` — settlement retry logic (Req 4.3)
- `store.test.ts` — channel store CRUD operations
- `stellar-config.test.ts` — Stellar config constants and helpers
- `properties.test.ts` — property-based tests (fast-check): 10 correctness properties

## Run tests
```bash
npm test          # single run
npm run test:watch # watch mode
```

## Property tests (fast-check)
P1: Monotonic commitment — setiap commitment >= sebelumnya
P2: Budget ceiling — commitment tidak melebihi budget
P3: Cumulative sum — final commitment = sum of step costs
P4: Refund correctness — refund = budget - final (non-negatif)
P5: Settlement finality — settle 2x throws
P6: Serialization round-trip — serialize → deserialize = identity
P7: Step count >= 5
P8: Signature verifiability — sig verifiable dengan server pubkey
P9: Deterministic steps — same task → same steps
P10: Budget halt — agent stops before exceeding budget

## Mocking strategy
All tests use **DEMO_MODE** behavior (no real testnet connection required):
- `getUsdcBalance` mocked → returns '100.0000000'
- `getServerKeypair`/`getUserKeypair` mocked → fixed test keypairs
- Soroban RPC tidak di-hit (CONTRACT_ID not set → demo mode in manager.ts)
- SSE broadcast mocked → vi.fn()

## Important: tests are not affected by real Soroban integration
The real Soroban calls in manager.ts are gated behind `CONTRACT_ID` env var.
Since tests do not set `CONTRACT_ID`, they always use demo mode mock behavior.
All 106 tests pass without any real testnet connection.
