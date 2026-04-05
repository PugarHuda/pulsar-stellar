# channel/ — Context

## Files
- `types.ts` — semua interfaces: Channel, Commitment, AgentStep, SseEvent, PulsarError
- `store.ts` — in-memory Map<string, Channel>, CRUD operations
- `manager.ts` — openChannel, signCommitment, settleChannel, serialize/deserialize

## Key invariants (enforced in manager.ts)
- P1: Monotonic — newAmount >= currentCommitmentAmount (throws jika dilanggar)
- P2: Budget ceiling — amount <= budgetBaseUnits (throws BUDGET_EXHAUSTED)
- P4: Single settlement — throws CHANNEL_ALREADY_CLOSED jika settle 2x
- P8: No on-chain tx during signCommitment

## Serialization format (48 bytes)
channelId (36 bytes UTF-8) + amount (8 bytes big-endian uint64) + stepIndex (4 bytes big-endian uint32)

## Error codes
Lihat PulsarErrorCode enum di types.ts
