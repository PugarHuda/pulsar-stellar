/**
 * channel/types.ts
 *
 * Core type definitions for Pulsar payment channel system.
 *
 * Key concepts:
 * - Channel: one-way payment channel on Soroban, escrows USDC from user
 * - Commitment: off-chain signed message representing cumulative cost (0 on-chain tx)
 * - Settlement: single on-chain tx that closes channel and distributes funds
 *
 * Context: See backend/CONTEXT.md
 */

// ─── Channel ─────────────────────────────────────────────────────────────────

export type ChannelStatus =
  | 'open'       // channel deployed, ready for agent task
  | 'running'    // agent task in progress
  | 'completed'  // task done, awaiting settlement
  | 'closed'     // settled on-chain
  | 'error'      // error state

export interface Channel {
  /** Internal UUID for this channel */
  id: string

  /** Soroban contract address (C...) for this channel instance */
  contractAddress: string

  /** User's Stellar public key (G...) — funder of the channel */
  userPublicKey: string

  /** Server's Stellar public key (G...) — receives payment on settlement */
  serverPublicKey: string

  /**
   * Total budget deposited in base units (7 decimals).
   * e.g. 10 USDC = 100_000_000n
   */
  budgetBaseUnits: bigint

  /**
   * Current highest commitment amount in base units.
   * Monotonically increasing. Starts at 0n.
   */
  currentCommitmentAmount: bigint

  /** Latest commitment signature (ed25519, from server keypair) */
  lastCommitmentSig: Uint8Array | null

  /** Index of the last signed commitment step */
  lastStepIndex: number

  status: ChannelStatus

  createdAt: number   // Unix timestamp ms
  updatedAt: number   // Unix timestamp ms

  /** Set after successful settlement */
  settlementTxHash?: string
  closedAt?: number
}

// ─── Commitment ───────────────────────────────────────────────────────────────

export interface Commitment {
  /** Channel this commitment belongs to */
  channelId: string

  /**
   * Cumulative amount in base units (7 decimals).
   * Represents total cost of all steps up to and including stepIndex.
   */
  amount: bigint

  /** Step index (0-based) this commitment was generated for */
  stepIndex: number

  /** ed25519 signature from server keypair over serialized commitment bytes */
  signature: Uint8Array
}

// ─── Agent Step ───────────────────────────────────────────────────────────────

export type StepType =
  | 'llm_call'
  | 'tool_web_search'
  | 'tool_code_exec'
  | 'tool_data_fetch'
  | 'reasoning'

export interface AgentStep {
  index: number
  type: StepType
  description: string
  /** Cost in USDC (human-readable, e.g. 0.05) */
  costUsdc: number
  /** Cumulative cost in USDC up to this step */
  cumulativeCostUsdc: number
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type SseEventType =
  | 'step'
  | 'task_complete'
  | 'budget_exhausted'
  | 'error'
  | 'channel_opened'
  | 'channel_settled'

export interface StepSseEvent {
  type: 'step'
  channelId: string
  step: AgentStep
  commitment: {
    amount: string  // bigint serialized as string for JSON
    stepIndex: number
  }
  remainingBudgetUsdc: number
}

export interface TaskCompleteSseEvent {
  type: 'task_complete'
  channelId: string
  totalSteps: number
  totalCostUsdc: number
  remainingBudgetUsdc: number
}

export interface BudgetExhaustedSseEvent {
  type: 'budget_exhausted'
  channelId: string
  lastStepIndex: number
  totalCostUsdc: number
}

export interface ErrorSseEvent {
  type: 'error'
  channelId?: string
  message: string
}

export type SseEvent =
  | StepSseEvent
  | TaskCompleteSseEvent
  | BudgetExhaustedSseEvent
  | ErrorSseEvent

// ─── API Request/Response ─────────────────────────────────────────────────────

export interface OpenChannelRequest {
  budgetUsdc: number
  userPublicKey: string
}

export interface OpenChannelResponse {
  channelId: string
  contractAddress: string
  budgetUsdc: number
  status: ChannelStatus
}

export interface RunTaskRequest {
  taskDescription: string
}

export interface SettleChannelResponse {
  txHash: string
  amountPaidUsdc: number
  refundUsdc: number
  explorerUrl: string
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export enum PulsarErrorCode {
  INSUFFICIENT_USDC_BALANCE = 'INSUFFICIENT_USDC_BALANCE',
  CHANNEL_OPEN_FAILED       = 'CHANNEL_OPEN_FAILED',
  BUDGET_EXHAUSTED          = 'BUDGET_EXHAUSTED',
  CHANNEL_NOT_FOUND         = 'CHANNEL_NOT_FOUND',
  CHANNEL_ALREADY_CLOSED    = 'CHANNEL_ALREADY_CLOSED',
  CHANNEL_NOT_OPEN          = 'CHANNEL_NOT_OPEN',
  COMMITMENT_SIGN_FAILED    = 'COMMITMENT_SIGN_FAILED',
  SETTLEMENT_FAILED         = 'SETTLEMENT_FAILED',
  SETTLEMENT_RETRY_EXCEEDED = 'SETTLEMENT_RETRY_EXCEEDED',
}

export class PulsarError extends Error {
  constructor(
    public readonly code: PulsarErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PulsarError'
  }
}
