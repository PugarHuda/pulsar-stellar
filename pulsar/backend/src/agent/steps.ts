/**
 * agent/steps.ts
 *
 * AI agent step types, costs, and task step generation.
 *
 * Step costs are fixed and deterministic so demo results are reproducible.
 * generateTaskSteps() produces the same sequence for the same input (Req 3.3, P9).
 *
 * When ANTHROPIC_API_KEY is set, runner.ts will call Claude for llm_call and
 * reasoning steps. This file only defines the step structure and costs.
 *
 * Context: See backend/CONTEXT.md
 */

import type { AgentStep, StepType } from '../channel/types.js'

// ─── Step Costs ───────────────────────────────────────────────────────────────

/** Cost per step type in USDC (human-readable) */
export const STEP_COSTS: Record<StepType, number> = {
  llm_call:        0.05,
  tool_web_search: 0.02,
  tool_code_exec:  0.03,
  tool_data_fetch: 0.02,
  reasoning:       0.01,
}

// ─── Step Templates ───────────────────────────────────────────────────────────

interface StepTemplate {
  type: StepType
  descriptionFn: (task: string) => string
}

const STEP_TEMPLATES: StepTemplate[] = [
  {
    type: 'reasoning',
    descriptionFn: (task) => `Analyzing task requirements: "${task.slice(0, 50)}${task.length > 50 ? '...' : ''}"`,
  },
  {
    type: 'tool_web_search',
    descriptionFn: (task) => `Searching web for: "${task.slice(0, 40)}${task.length > 40 ? '...' : ''}"`,
  },
  {
    type: 'llm_call',
    descriptionFn: (task) => `Processing search results for task: "${task.slice(0, 35)}${task.length > 35 ? '...' : ''}"`,
  },
  {
    type: 'tool_data_fetch',
    descriptionFn: (task) => `Fetching structured data relevant to: "${task.slice(0, 30)}${task.length > 30 ? '...' : ''}"`,
  },
  {
    type: 'llm_call',
    descriptionFn: (task) => `Synthesizing data and generating response for: "${task.slice(0, 25)}${task.length > 25 ? '...' : ''}"`,
  },
  {
    type: 'tool_code_exec',
    descriptionFn: () => `Executing validation code to verify output correctness`,
  },
  {
    type: 'reasoning',
    descriptionFn: () => `Reviewing output quality, checking for errors and inconsistencies`,
  },
  {
    type: 'llm_call',
    descriptionFn: (task) => `Generating final polished response for: "${task.slice(0, 30)}${task.length > 30 ? '...' : ''}"`,
  },
  {
    type: 'tool_web_search',
    descriptionFn: (task) => `Verifying facts and cross-referencing sources for: "${task.slice(0, 25)}${task.length > 25 ? '...' : ''}"`,
  },
  {
    type: 'reasoning',
    descriptionFn: () => `Final reasoning pass: ensuring completeness and accuracy`,
  },
]

// ─── Task Step Generation ─────────────────────────────────────────────────────

/**
 * Generate a deterministic sequence of agent steps for a given task.
 *
 * Determinism: same taskDescription always produces same steps (Req 3.3, P9).
 * Step count: 5-10 based on task complexity (hash of description).
 * Minimum 5 steps per task (Req 3.1).
 * 
 * @param taskDescription - The task to generate steps for
 * @param costMultiplier - Multiplier for step costs based on agent type (default 1.0)
 */
export function generateTaskSteps(taskDescription: string, costMultiplier: number = 1.0): AgentStep[] {
  // Deterministic step count: 5-10 based on task hash
  const hash = simpleHash(taskDescription)
  const stepCount = 5 + (hash % 6) // 5, 6, 7, 8, 9, or 10

  const templates = STEP_TEMPLATES.slice(0, stepCount)
  const steps: AgentStep[] = []
  let cumulativeCost = 0

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i]
    const baseCost = STEP_COSTS[template.type]
    const cost = Math.round(baseCost * costMultiplier * 100) / 100 // Apply multiplier and round to 2 decimals
    cumulativeCost = Math.round((cumulativeCost + cost) * 10_000_000) / 10_000_000

    steps.push({
      index: i,
      type: template.type,
      description: template.descriptionFn(taskDescription),
      costUsdc: cost,
      cumulativeCostUsdc: cumulativeCost,
    })
  }

  return steps
}

/**
 * Calculate total cost of a step sequence in USDC.
 */
export function totalCostUsdc(steps: AgentStep[]): number {
  return steps.reduce((sum, s) => sum + s.costUsdc, 0)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash of a string.
 * Not cryptographic — just for deterministic step count selection.
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
