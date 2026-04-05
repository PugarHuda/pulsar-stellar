# tests/ — Context

## Files
- `channel.test.ts` — integration tests: openChannel, signCommitment, settleChannel, full flow
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

## Mocking
- getUsdcBalance mocked → returns '100.0000000'
- getServerKeypair/getUserKeypair mocked → fixed test keypairs
- Soroban RPC tidak di-hit (demo mode di manager.ts)
