/**
 * agent/runner.ts
 *
 * AI Agent Runner for Pulsar.
 *
 * Executes a multi-step AI agent task with real or mock LLM calls.
 * Each step generates an off-chain commitment via Channel Manager.
 * Emits SSE events for real-time UI updates.
 *
 * Real vs Mock:
 *   - ANTHROPIC_API_KEY set → real Claude API calls for llm_call + reasoning steps
 *   - ANTHROPIC_API_KEY not set → mock descriptions (DEMO_MODE behavior)
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
import { callClaude, isClaudeAvailable } from './llm.js'
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
 * Run an AI agent task against a payment channel.
 *
 * Each step:
 * 1. Execute step work (real LLM call or simulated)
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
  const useRealLlm = isClaudeAvailable()

  let completedSteps = 0
  let cumulativeCostUsdc = 0

  for (const step of steps) {
    // Execute step work — real LLM or simulated
    const description = await executeStep(step.type, taskDescription, step.description, sleepImpl, useRealLlm)

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
        description,
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

// ─── Step execution ───────────────────────────────────────────────────────────

/**
 * Execute a single agent step and return its description/result.
 *
 * - llm_call → real Claude API call (or mock fallback)
 * - reasoning → real Claude API call for analysis (or mock fallback)
 * - tool_web_search → simulated with realistic description
 * - tool_code_exec → simulated with realistic description
 * - tool_data_fetch → simulated with realistic description
 */
async function executeStep(
  stepType: string,
  taskDescription: string,
  defaultDescription: string,
  sleepImpl: (ms: number) => Promise<void>,
  useRealLlm: boolean,
): Promise<string> {
  switch (stepType) {
    case 'llm_call': {
      if (useRealLlm) {
        const prompt = buildLlmPrompt(taskDescription)
        const result = await callClaude(prompt)
        // Return a concise description of what was done
        return `LLM analysis: ${result.slice(0, 120).replace(/\n/g, ' ')}${result.length > 120 ? '...' : ''}`
      }
      // Mock: simulate LLM latency
      await sleepImpl(300 + Math.random() * 400)
      return defaultDescription
    }

    case 'reasoning': {
      if (useRealLlm) {
        const prompt = buildReasoningPrompt(taskDescription)
        const result = await callClaude(prompt)
        return `Reasoning: ${result.slice(0, 120).replace(/\n/g, ' ')}${result.length > 120 ? '...' : ''}`
      }
      await sleepImpl(200 + Math.random() * 300)
      return defaultDescription
    }

    case 'tool_web_search': {
      // Simulate web search with realistic delay
      await sleepImpl(400 + Math.random() * 600)
      const query = taskDescription.slice(0, 40)
      return `Web search completed for "${query}${taskDescription.length > 40 ? '...' : ''}" — found 12 relevant results`
    }

    case 'tool_code_exec': {
      // Simulate code execution
      await sleepImpl(500 + Math.random() * 500)
      return `Code executed successfully — output validated, 0 errors, 3 assertions passed`
    }

    case 'tool_data_fetch': {
      // Simulate data fetch
      await sleepImpl(300 + Math.random() * 400)
      return `Data fetched from external API — received 847 bytes, parsed 23 records`
    }

    default: {
      await sleepImpl(200 + Math.random() * 300)
      return defaultDescription
    }
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildLlmPrompt(taskDescription: string): string {
  return (
    `You are an AI agent completing a task. Provide a brief, focused analysis.\n\n` +
    `Task: ${taskDescription}\n\n` +
    `Provide a concise 2-3 sentence analysis or partial result for this task. ` +
    `Be specific and actionable. Do not ask clarifying questions.`
  )
}

function buildReasoningPrompt(taskDescription: string): string {
  return (
    `You are an AI agent reasoning about a task. Think step by step.\n\n` +
    `Task: ${taskDescription}\n\n` +
    `In 2-3 sentences, reason about the key considerations and approach for this task. ` +
    `Focus on what matters most.`
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
