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

## Real vs Demo Mode

### deployChannelContract()
- `CONTRACT_ID` set → invokes real Soroban `open_channel(sender, recipient, token, amount, expiry)`
  - Uses `sorobanRpc.simulateTransaction()` → `prepareTransaction()` → `sendTransaction()` → poll
  - Server keypair signs and submits the transaction
  - Returns the CONTRACT_ID as the channel contract address
- `CONTRACT_ID` not set (or `DEMO_MODE=true`) → returns deterministic mock `C...` address

### submitSettlementTx()
- `CONTRACT_ID` set → invokes real Soroban `close_channel(commitment_amount, signature)`
  - Builds i128 ScVal for amount, bytes ScVal for Ed25519 signature
  - Polls for transaction confirmation (up to 20 attempts × 1s)
  - Returns real tx hash from Stellar Testnet
- `CONTRACT_ID` not set (or `DEMO_MODE=true`) → returns mock hex tx hash

## Serialization format (48 bytes)
channelId (36 bytes UTF-8) + amount (8 bytes big-endian uint64) + stepIndex (4 bytes big-endian uint32)

## Error codes
Lihat PulsarErrorCode enum di types.ts
