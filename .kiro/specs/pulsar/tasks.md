# Implementation Plan: Pulsar — AI Agent Billing via MPP Session on Stellar

## Overview

Implementasi Pulsar sebagai platform AI agent billing berbasis one-way payment channel di Stellar Testnet.
Stack: Node.js/TypeScript/Express (backend), React/Vite/Tailwind (frontend), Soroban one-way-channel contract,
@stellar/mpp, Vitest + fast-check (property-based testing). Target: 8 hari kerja.

## Tasks

- [x] 1. Project setup — monorepo, dependencies, dan environment config
  - Inisialisasi struktur folder `pulsar/backend` dan `pulsar/frontend`
  - Setup `backend/package.json` dengan dependencies: `express`, `@stellar/stellar-sdk`, `@stellar/mpp`, `dotenv`, `cors`, `zod`
  - Setup `frontend/package.json` dengan dependencies: `react`, `react-dom`, `vite`, `tailwindcss`, `@vitejs/plugin-react`
  - Setup `backend/tsconfig.json` dan `frontend/tsconfig.json`
  - Buat `backend/.env.example` dengan variabel: `SERVER_SECRET_KEY`, `USER_SECRET_KEY`, `SOROBAN_RPC_URL`, `HORIZON_URL`, `USDC_ASSET_CODE`, `USDC_ISSUER`, `CONTRACT_ID`, `PORT`
  - Setup Vitest di backend: `vitest.config.ts`, install `vitest`, `fast-check`, `@vitest/coverage-v8`
  - _Requirements: 7.1, 7.2_

- [x] 2. Stellar config dan keypair setup
  - [x] 2.1 Buat `backend/src/stellar/config.ts`
    - Export `server` (Horizon Server), `sorobanRpc` (SorobanRpc.Server), `USDC_ASSET`, `NETWORK_PASSPHRASE`
    - Load semua config dari environment variables via dotenv
    - Export helper `fundTestnetAccount(publicKey)` menggunakan Friendbot
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 2.2 Write unit test untuk stellar config
    - Test bahwa config terbaca dari env vars dengan benar
    - Test bahwa USDC_ASSET terbentuk dengan issuer yang benar
    - _Requirements: 7.1, 7.2_

- [x] 3. One-way-channel Soroban contract deployment
  - [x] 3.1 Buat Soroban contract `contract/src/lib.rs` (one-way payment channel)
    - Struct `ChannelState`: `sender`, `recipient`, `token`, `amount`, `expiry`, `status`
    - Function `open_channel(sender, recipient, token, amount, expiry)` — escrow token dari sender
    - Function `close_channel(commitment_amount, signature)` — verifikasi signature, transfer dana
    - Function `get_channel()` — return current ChannelState
    - Signature verification menggunakan Ed25519 terhadap `(channel_id, amount)` yang di-sign server
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 5.4, 5.5_
  - [x] 3.2 Deploy contract ke Stellar Testnet
    - Buat script `backend/scripts/deploy-contract.ts`
    - Compile contract dengan `soroban contract build`
    - Deploy menggunakan `soroban contract deploy` ke testnet
    - Simpan `CONTRACT_ID` ke `.env`
    - _Requirements: 7.1, 7.3_

- [x] 4. Channel types dan store
  - [x] 4.1 Buat `backend/src/channel/types.ts`
    - Interface `Channel`: `id`, `userPublicKey`, `serverPublicKey`, `budget`, `currentCommitmentAmount`, `status` (`open`|`closed`|`error`), `contractId`, `txHash?`
    - Interface `Commitment`: `channelId`, `amount`, `stepIndex`, `signature?`
    - Type `ChannelStatus`
    - _Requirements: 1.5, 2.1, 5.1_
  - [x] 4.2 Buat `backend/src/channel/store.ts`
    - In-memory store dengan `Map<string, Channel>`
    - Export `saveChannel(channel)`, `getChannel(id)`, `updateChannel(id, patch)`, `listChannels()`
    - _Requirements: 1.5, 4.4_
  - [x] 4.3 Write unit tests untuk channel store
    - Test CRUD operations
    - Test bahwa update partial tidak menghapus field lain
    - _Requirements: 1.5, 4.4_

- [x] 5. Channel Manager — open channel
  - [x] 5.1 Buat `backend/src/channel/manager.ts` — fungsi `openChannel`
    - Validasi balance USDC user sebelum submit transaksi (req 1.3)
    - Invoke `open_channel` di Soroban contract dengan budget yang diminta
    - Simpan channel ke store dengan status `open`
    - Return `{ channelId, budget, status }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 5.2 Write unit test untuk openChannel
    - Test insufficient balance → error sebelum on-chain call
    - Test contract failure → error + balance unchanged
    - _Requirements: 1.3, 1.4_

- [x] 6. Channel Manager — commitment signing dan serialization
  - [x] 6.1 Implementasi `signCommitment(channelId, amount)` di `manager.ts`
    - Serialize commitment ke canonical byte format: `Buffer.concat([Buffer.from(channelId), bigIntToBytes(amount)])`
    - Sign menggunakan server keypair (`Keypair.sign`)
    - Pastikan amount monotonically increasing (req 2.3)
    - Return `Commitment` object dengan signature
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 5.1, 5.2_
  - [x] 6.2 Implementasi `serializeCommitment` dan `deserializeCommitment` di `manager.ts`
    - Canonical serialization: `channelId (32 bytes) + amount (8 bytes big-endian) + stepIndex (4 bytes)`
    - Deserialization yang exact inverse dari serialization
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 6.3 Write property test: round-trip serialization
    - **Property 1: Commitment round-trip** — `deserialize(serialize(c)) ≡ c` untuk semua valid commitment
    - **Validates: Requirements 5.3**
    - _Requirements: 5.3_
  - [x] 6.4 Write property test: commitment monotonicity
    - **Property 2: Monotonic commitment** — setiap commitment baru ≥ commitment sebelumnya
    - **Validates: Requirements 2.3**
    - _Requirements: 2.3_
  - [x] 6.5 Write property test: commitment tidak melebihi budget
    - **Property 3: Budget ceiling** — `commitment.amount ≤ channel.budget` selalu berlaku
    - **Validates: Requirements 2.4**
    - _Requirements: 2.4_

- [x] 7. Channel Manager — settlement
  - [x] 7.1 Implementasi `settleChannel(channelId)` di `manager.ts`
    - Ambil final commitment dari store
    - Submit ke `close_channel` di Soroban contract
    - Retry hingga 3x jika gagal (req 4.3)
    - Update channel status ke `closed`, simpan `txHash`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 7.2 Write property test: exactly one settlement per channel
    - **Property 4: Single settlement** — memanggil `settleChannel` dua kali pada channel yang sama harus error pada panggilan kedua
    - **Validates: Requirements 4.5**
    - _Requirements: 4.5_
  - [x] 7.3 Write unit test untuk settlement retry
    - Mock contract failure 2x, sukses ke-3 → harus berhasil
    - Mock contract failure 3x → harus return error
    - _Requirements: 4.3_

- [x] 8. Agent Runner — mock steps dan budget tracking
  - [x] 8.1 Buat `backend/src/agent/steps.ts`
    - Definisi step types: `LLM_CALL` (cost: 0.05 USDC), `TOOL_CALL` (cost: 0.02 USDC), `REASONING` (cost: 0.01 USDC)
    - Export `STEP_COSTS: Record<StepType, number>`
    - Export `generateTaskSteps(taskDescription: string): AgentStep[]` — deterministik berdasarkan hash task
    - Minimal 5 steps per task (req 3.1)
    - _Requirements: 3.1, 3.3_
  - [x] 8.2 Buat `backend/src/agent/runner.ts` — fungsi `runAgent`
    - Terima `{ channelId, taskDescription }`
    - Loop setiap step: hitung cumulative cost, panggil `signCommitment`, emit SSE event
    - Jika budget habis mid-task: stop, report last step, return budget exhausted (req 3.5)
    - Return task summary: `{ totalSteps, totalCost, remainingBudget, steps[] }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 2.1, 2.4_
  - [x] 8.3 Write property test: cumulative cost invariant
    - **Property 5: Cumulative cost** — `finalCommitment.amount === sum(step.cost for all completed steps)`
    - **Validates: Requirements 2.6, 3.2**
    - _Requirements: 2.6, 3.2_
  - [x] 8.4 Write property test: deterministic steps
    - **Property 6: Deterministic task steps** — `generateTaskSteps(task)` selalu menghasilkan sequence yang sama untuk input yang sama
    - **Validates: Requirements 3.3**
    - _Requirements: 3.3_
  - [x] 8.5 Write property test: budget exhaustion halts execution
    - **Property 7: Budget halt** — jika `budget < totalCost(allSteps)`, agent berhenti sebelum melebihi budget
    - **Validates: Requirements 3.5, 2.4**
    - _Requirements: 3.5, 2.4_

- [x] 9. Backend API routes dan SSE
  - [x] 9.1 Buat `backend/src/api/sse.ts`
    - SSE manager: `addClient(res)`, `removeClient(res)`, `broadcast(event, data)`
    - Format event: `{ type: 'step'|'commitment'|'settlement'|'error', payload: ... }`
    - _Requirements: 3.2, 6.3_
  - [x] 9.2 Buat `backend/src/api/routes.ts` — 4 REST endpoints + SSE
    - `POST /api/channels` — open channel, body: `{ budget, userPublicKey }`
    - `POST /api/channels/:id/run` — run agent task, body: `{ taskDescription }`
    - `POST /api/channels/:id/settle` — trigger settlement
    - `GET /api/channels/:id` — get channel state
    - `GET /api/events` — SSE stream
    - Validasi input dengan Zod
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 9.3 Buat `backend/src/index.ts` — Express app entry point
    - Setup Express, CORS, JSON middleware
    - Mount routes
    - Listen on `PORT` dari env
    - _Requirements: 6.1_
  - [x] 9.4 Write unit tests untuk API routes
    - Test `POST /api/channels` dengan budget valid dan invalid
    - Test `GET /api/channels/:id` dengan ID yang ada dan tidak ada
    - _Requirements: 1.3, 6.5_

- [x] 10. Checkpoint — backend integration
  - Pastikan semua unit tests dan property tests backend pass
  - Test manual: open channel → run agent → settle via curl/Postman
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend — ChannelPanel component
  - [x] 11.1 Buat `frontend/src/components/ChannelPanel.tsx`
    - Form input: Budget amount (number), tombol "Open Channel"
    - Display setelah open: channel ID, budget, status badge
    - Handle loading state dan error display
    - _Requirements: 6.1, 6.2, 6.5_
  - [x] 11.2 Write unit test untuk ChannelPanel
    - Test render form
    - Test error state display
    - _Requirements: 6.1, 6.5_

- [x] 12. Frontend — TaskPanel component
  - [x] 12.1 Buat `frontend/src/components/TaskPanel.tsx`
    - Input task description, tombol "Run Agent"
    - Real-time step list via SSE: step type, step cost, cumulative cost
    - Progress indicator selama agent berjalan
    - _Requirements: 6.3, 6.5_
  - [x] 12.2 Write unit test untuk TaskPanel
    - Test render step list dari mock SSE events
    - _Requirements: 6.3_

- [x] 13. Frontend — SettlementPanel component
  - [x] 13.1 Buat `frontend/src/components/SettlementPanel.tsx`
    - Tombol "Settle Channel"
    - Display setelah settle: final cost, refund amount, tx hash dengan link ke Stellar Testnet explorer
    - _Requirements: 6.4, 7.4_
  - [x] 13.2 Write unit test untuk SettlementPanel
    - Test render tx hash link ke explorer
    - _Requirements: 6.4, 7.4_

- [x] 14. Frontend — App wiring dan SSE integration
  - [x] 14.1 Buat `frontend/src/App.tsx`
    - Compose ChannelPanel, TaskPanel, SettlementPanel
    - State management: `channelId`, `channelStatus`, `steps[]`, `settlement`
    - SSE client: connect ke `GET /api/events`, dispatch events ke state
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 14.2 Buat `frontend/src/main.tsx`
    - Mount React app ke DOM
    - Setup Tailwind CSS
    - _Requirements: 6.1_

- [x] 15. Property-based tests — correctness properties (fast-check)
  - [x] 15.1 Buat `backend/tests/properties.test.ts` — kumpulkan semua property tests
    - **Property 8: Signature verifiability** — commitment yang di-sign server selalu bisa diverifikasi dengan public key server
    - **Validates: Requirements 2.2, 5.4**
  - [x] 15.2 Tambahkan property tests lanjutan di `properties.test.ts`
    - **Property 9: Refund invariant** — `refund = budget - finalCommitmentAmount` selalu non-negatif
    - **Validates: Requirements 4.2**
    - **Property 10: Channel state transitions** — channel hanya bisa berpindah dari `open` → `closed`, tidak bisa kembali ke `open`
    - **Validates: Requirements 4.4, 4.5**
  - _Requirements: 2.2, 2.3, 2.4, 2.6, 3.3, 3.5, 4.2, 4.4, 4.5, 5.3_

- [x] 16. Integration test end-to-end
  - [x] 16.1 Buat `backend/tests/channel.test.ts` — integration test full flow
    - Test: open channel → run agent (5 steps) → verify commitments monotonic → settle → verify tx hash
    - Mock Soroban RPC calls (tidak hit testnet di CI)
    - Verify final commitment amount = sum of step costs
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 3.1, 3.4, 4.1, 4.4_
  - [x] 16.2 Write integration test: budget exhaustion flow
    - Test: open channel dengan budget kecil → run agent → agent berhenti sebelum semua steps selesai
    - Verify error message "budget exhausted"
    - _Requirements: 2.4, 3.5_

- [x] 17. Final checkpoint — semua tests pass
  - Jalankan `vitest --run` di backend, pastikan semua tests hijau
  - Pastikan tidak ada TypeScript errors (`tsc --noEmit`)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. README dan demo preparation
  - [x] 18.1 Buat `README.md` di root `pulsar/`
    - Setup instructions: install deps, configure `.env`, deploy contract, run backend + frontend
    - Demo walkthrough: open channel → run agent → settle → verify on explorer
    - Architecture diagram (ASCII) menjelaskan MPP Session flow
    - _Requirements: 7.4_
  - [x] 18.2 Buat `backend/scripts/demo-setup.ts`
    - Script untuk fund testnet accounts via Friendbot
    - Script untuk deploy contract dan print CONTRACT_ID
    - _Requirements: 7.1, 7.2_

## Notes

- Tasks bertanda `*` adalah opsional dan bisa di-skip untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk traceability
- Property tests (fast-check) memvalidasi correctness properties universal, bukan hanya contoh spesifik
- Soroban contract di task 3 bisa diganti dengan mock/stub jika waktu terbatas — backend tetap bisa berjalan
- Target 8 hari: Day 1-2 (tasks 1-4), Day 3-4 (tasks 5-8), Day 5-6 (tasks 9-14), Day 7 (tasks 15-16), Day 8 (tasks 17-18)
