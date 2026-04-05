/**
 * agent/runner.ts
 *
 * Mock AI Agent Runner for Pulsar.
 *
 * Simulates a multi-step AI agent task execution with deterministic costs.
 * Each step generates an off-chain commitment via Channel Manager.
 * Emits SSE events for real-time UI updates.
 *
 * Key behaviors:
 * - Each step → signCommitment (0 on-chain tx)
 * - Budget exhausted mid-task → stop + report (Req 3.5)
 * - Returns task summary with total cost + remaining budget (Req 3.4)
 *
 * Context: See backend/CONTEXT.md
 */

import { getChannel, updateChannel } from '../channel/store.js'
import { signCommitment } from '../channel/manager.js'
import { generateTaskSteps } from './steps.js'
import { usdcToBaseUnits, baseUnitsToUsdc } from '../stellar/config.js'
import { broadcast } from '../api/sse.js'
import {
  PulsarError,
  PulsarErrorCode,
  type StepSseEvent,
  type TaskCompleteSseEvent,
  type BudgetExhaustedSseEvent,
  type ErrorSseEvent,
} from '../channel/types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunAgentParams {
  channelId: string
  taskDescription: string
  /** Optional sleep override — used in tests to skip artificial delays */
  _sleepFn?: (ms: number) => Promise<void>
}

export interface RunAgentResult {
  channelId: string
  totalSteps: number
  totalCostUsdc: number
  remainingBudgetUsdc: number
  completedNormally: boolean  // false if budget exhausted
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Run a mock AI agent task against a payment channel.
 *
 * Each step:
 * 1. Simulate work (delay)
 * 2. Calculate new cumulative cost
 * 3. Check budget (stop if exhausted)
 * 4. Sign off-chain commitment
 * 5. Emit SSE event
 *
 * Returns task summary when done.
 */
export async function runAgent(params: RunAgentParams): Promise<RunAgentResult> {
  const { channelId, taskDescription, _sleepFn } = params
  const sleepImpl = _sleepFn ?? sleep

  const channel = getChannel(channelId)
  if (!channel) {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_NOT_FOUND,
      `Channel ${channelId} not found`,
    )
  }

  if (channel.status !== 'open' && channel.status !== 'running') {
    throw new PulsarError(
      PulsarErrorCode.CHANNEL_NOT_OPEN,
      `Channel ${channelId} is not open (status: ${channel.status})`,
    )
  }

  // Mark channel as running
  updateChannel(channelId, { status: 'running' })

  const steps = generateTaskSteps(taskDescription)
  const budgetUsdc = baseUnitsToUsdc(channel.budgetBaseUnits)

  let completedSteps = 0
  let cumulativeCostUsdc = 0

  for (const step of steps) {
    // Simulate agent work (variable delay for realism)
    await sleepImpl(300 + Math.random() * 400)

    // Calculate new cumulative cost
    cumulativeCostUsdc = Math.round(
      (cumulativeCostUsdc + step.costUsdc) * 10_000_000,
    ) / 10_000_000

    const newAmountBaseUnits = usdcToBaseUnits(cumulativeCostUsdc)
    const remainingBudgetUsdc = Math.round(
      (budgetUsdc - cumulativeCostUsdc) * 10_000_000,
    ) / 10_000_000

    // Check budget before signing (Req 3.5, P7)
    if (newAmountBaseUnits > channel.budgetBaseUnits) {
      const exhaustedEvent: BudgetExhaustedSseEvent = {
        type: 'budget_exhausted',
        channelId,
        lastStepIndex: completedSteps - 1,
        totalCostUsdc: cumulativeCostUsdc - step.costUsdc,
      }
      broadcast('budget_exhausted', exhaustedEvent)

      updateChannel(channelId, { status: 'completed' })

      return {
        channelId,
        totalSteps: completedSteps,
        totalCostUsdc: cumulativeCostUsdc - step.costUsdc,
        remainingBudgetUsdc: budgetUsdc - (cumulativeCostUsdc - step.costUsdc),
        completedNormally: false,
      }
    }

    // Sign off-chain commitment (0 on-chain tx)
    let commitment
    try {
      commitment = signCommitment(channelId, newAmountBaseUnits)
    } catch (err) {
      const errorEvent: ErrorSseEvent = {
        type: 'error',
        channelId,
        message: err instanceof Error ? err.message : String(err),
      }
      broadcast('error', errorEvent)
      throw err
    }

    completedSteps++

    // Emit SSE step event for real-time UI update
    const stepEvent: StepSseEvent = {
      type: 'step',
      channelId,
      step: {
        ...step,
        index: completedSteps - 1,
        cumulativeCostUsdc,
      },
      commitment: {
        amount: commitment.amount.toString(),
        stepIndex: commitment.stepIndex,
      },
      remainingBudgetUsdc,
    }
    broadcast('step', stepEvent)
  }

  // All steps completed normally
  const finalRemainingBudget = Math.round(
    (budgetUsdc - cumulativeCostUsdc) * 10_000_000,
  ) / 10_000_000

  updateChannel(channelId, { status: 'completed' })

  const completeEvent: TaskCompleteSseEvent = {
    type: 'task_complete',
    channelId,
    totalSteps: completedSteps,
    totalCostUsdc: cumulativeCostUsdc,
    remainingBudgetUsdc: finalRemainingBudget,
  }
  broadcast('task_complete', completeEvent)

  return {
    channelId,
    totalSteps: completedSteps,
    totalCostUsdc: cumulativeCostUsdc,
    remainingBudgetUsdc: finalRemainingBudget,
    completedNormally: true,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
