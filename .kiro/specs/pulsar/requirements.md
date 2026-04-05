# Requirements Document

## Introduction

Pulsar adalah platform AI agent billing berbasis MPP Session (payment channel) di jaringan Stellar.
Platform ini memungkinkan user membuka payment channel dengan deposit USDC ke Soroban one-way-channel contract,
menjalankan AI agent task dengan ratusan LLM/tool call steps secara off-chain, lalu melakukan satu settlement
on-chain saat task selesai. User menerima refund sisa budget yang tidak terpakai.

Pulsar dibangun untuk Stellar Hacks: Agents (DoraHacks) dengan prize pool $10,000 USD, deadline 14 April 2026.
Keunikan utama: satu-satunya project yang menggunakan MPP Session secara production-meaningful di Stellar,
bukan sekadar hello-world demo.

## Glossary

- **Pulsar**: Platform AI agent billing berbasis MPP Session di Stellar.
- **Channel**: One-way payment channel yang dibuat via Soroban one-way-channel contract.
- **Channel_Manager**: Komponen backend yang mengelola lifecycle channel (open, update commitment, close).
- **Agent_Runner**: Komponen backend yang mensimulasikan eksekusi AI agent task (mock LLM + tool calls).
- **Commitment**: Off-chain signed message yang merepresentasikan akumulasi biaya agent sampai step tertentu.
- **Settlement**: Transaksi on-chain tunggal yang menutup channel dan mendistribusikan USDC ke server dan user.
- **USDC**: USD Coin di Stellar testnet, digunakan sebagai token pembayaran.
- **MPP_Session**: Protokol micropayment streaming via @stellar/mpp yang memungkinkan off-chain commitment.
- **Soroban**: Smart contract platform di Stellar.
- **One_Way_Channel_Contract**: Soroban contract yang mengatur escrow USDC dan validasi commitment.
- **Web_UI**: Antarmuka web sederhana untuk demo interaksi user dengan Pulsar.
- **Testnet**: Stellar testnet environment untuk demo dan pengujian.
- **Budget**: Jumlah USDC yang di-deposit user ke channel sebagai batas maksimum pengeluaran agent.
- **Refund**: Sisa Budget yang dikembalikan ke user setelah Settlement.

## Requirements

### Requirement 1: Channel Lifecycle Management

**User Story:** As a developer, I want to open a payment channel with a USDC deposit, so that I can fund an AI agent task without committing to per-request on-chain transactions.

#### Acceptance Criteria

1. WHEN a user submits a channel open request with a valid Budget amount and Stellar keypair, THE Channel_Manager SHALL deploy or invoke the One_Way_Channel_Contract on Stellar Testnet and lock the specified USDC amount.
2. WHEN the One_Way_Channel_Contract confirms the deposit, THE Channel_Manager SHALL return a channel ID and the initial channel state to the caller.
3. IF the user's USDC balance is insufficient for the requested Budget, THEN THE Channel_Manager SHALL return an error indicating insufficient funds before submitting any on-chain transaction.
4. IF the One_Way_Channel_Contract invocation fails, THEN THE Channel_Manager SHALL return a descriptive error and leave the user's balance unchanged.
5. WHEN a channel is successfully opened, THE Channel_Manager SHALL record the channel state (channel ID, Budget, current commitment amount, status) in persistent storage.

---

### Requirement 2: Off-Chain Commitment Streaming

**User Story:** As a developer, I want each agent step to generate an off-chain commitment instead of an on-chain transaction, so that I can run hundreds of steps without paying per-step gas fees.

#### Acceptance Criteria

1. WHEN the Agent_Runner executes a step (LLM call or tool call), THE Channel_Manager SHALL generate a signed Commitment that reflects the cumulative cost up to that step.
2. THE Channel_Manager SHALL sign each Commitment using the server's Stellar keypair, producing a signature verifiable against the One_Way_Channel_Contract.
3. WHILE a channel is open, THE Channel_Manager SHALL ensure each new Commitment amount is greater than or equal to the previous Commitment amount (monotonically increasing).
4. IF a new Commitment amount would exceed the channel's Budget, THEN THE Channel_Manager SHALL halt the Agent_Runner and return an error indicating budget exhausted.
5. THE Channel_Manager SHALL produce each Commitment without submitting any transaction to the Stellar network.
6. FOR ALL valid Commitment sequences, the final Commitment amount SHALL equal the sum of all individual step costs accumulated during the session (cumulative invariant).

---

### Requirement 3: AI Agent Task Execution (Mock)

**User Story:** As a demo viewer, I want to see a simulated AI agent run a multi-step task, so that I can understand how Pulsar bills agent work in real time.

#### Acceptance Criteria

1. WHEN a user submits a task description and a channel ID, THE Agent_Runner SHALL execute a simulated multi-step task consisting of at least 5 discrete steps (mock LLM calls and/or tool calls).
2. WHEN each step completes, THE Agent_Runner SHALL report the step type, simulated cost, and cumulative cost to the caller.
3. THE Agent_Runner SHALL assign a deterministic simulated cost per step type (e.g., LLM call = 0.05 USDC, tool call = 0.02 USDC) so that demo results are reproducible.
4. WHEN all steps complete, THE Agent_Runner SHALL return a task summary including total steps executed, total cost, and remaining Budget.
5. IF the channel Budget is exhausted mid-task, THEN THE Agent_Runner SHALL stop execution, report the last completed step, and indicate that the budget limit was reached.

---

### Requirement 4: Channel Settlement

**User Story:** As a developer, I want the payment channel to settle on-chain with a single transaction when the task is done, so that I receive a refund of unused budget automatically.

#### Acceptance Criteria

1. WHEN a task completes or the budget is exhausted, THE Channel_Manager SHALL submit the final Commitment to the One_Way_Channel_Contract to close the channel in a single on-chain transaction.
2. WHEN the Settlement transaction is confirmed, THE One_Way_Channel_Contract SHALL transfer the final Commitment amount to the server's address and the Refund (Budget minus final Commitment amount) to the user's address.
3. IF the Settlement transaction fails, THEN THE Channel_Manager SHALL retry the Settlement up to 3 times before returning a settlement failure error.
4. WHEN Settlement succeeds, THE Channel_Manager SHALL update the channel status to "closed" in persistent storage and record the on-chain transaction hash.
5. THE Channel_Manager SHALL produce exactly 1 on-chain Settlement transaction per channel, regardless of the number of steps executed during the task.

---

### Requirement 5: Commitment Serialization and Verification

**User Story:** As a developer, I want commitments to be serializable and verifiable, so that the on-chain contract can validate the final commitment during settlement.

#### Acceptance Criteria

1. WHEN a Commitment is created, THE Channel_Manager SHALL serialize it into a canonical byte format compatible with the One_Way_Channel_Contract's verification function.
2. THE Channel_Manager SHALL deserialize a serialized Commitment back into a Commitment object without data loss.
3. FOR ALL valid Commitment objects, serializing then deserializing SHALL produce an equivalent Commitment object (round-trip property).
4. WHEN the One_Way_Channel_Contract receives a serialized Commitment and server signature during Settlement, THE One_Way_Channel_Contract SHALL verify the signature before executing the fund transfer.
5. IF the signature verification fails, THEN THE One_Way_Channel_Contract SHALL reject the Settlement and leave channel funds unchanged.

---

### Requirement 6: Web UI Demo Interface

**User Story:** As a hackathon judge, I want a simple web interface to interact with Pulsar, so that I can observe the full payment channel lifecycle without using a CLI.

#### Acceptance Criteria

1. THE Web_UI SHALL display a form for the user to input a Budget amount and initiate channel opening.
2. WHEN a channel is opened, THE Web_UI SHALL display the channel ID, Budget, and current status.
3. WHEN the Agent_Runner is executing a task, THE Web_UI SHALL display each step in real time, including step type, step cost, and cumulative cost.
4. WHEN Settlement completes, THE Web_UI SHALL display the final cost, Refund amount, and the on-chain Settlement transaction hash with a link to Stellar Testnet explorer.
5. IF an error occurs at any stage, THE Web_UI SHALL display a human-readable error message and the current channel status.

---

### Requirement 7: Stellar Testnet Integration

**User Story:** As a hackathon judge, I want Pulsar to interact with Stellar Testnet, so that I can verify real blockchain activity during the demo.

#### Acceptance Criteria

1. THE Channel_Manager SHALL connect exclusively to Stellar Testnet for all on-chain operations during the demo.
2. WHEN opening a channel, THE Channel_Manager SHALL use Stellar Testnet USDC (issued by the canonical Testnet USDC issuer) as the payment token.
3. WHEN a Settlement transaction is submitted, THE Channel_Manager SHALL use the Stellar Testnet Horizon or RPC endpoint to broadcast the transaction.
4. THE Channel_Manager SHALL expose the Settlement transaction hash so it can be verified on Stellar Testnet explorer (e.g., stellar.expert or testnet.steexp.com).
