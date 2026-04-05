/**
 * agent/steps.ts
 *
 * Defines mock AI agent step types, costs, and deterministic task generation.
 *
 * Step costs are fixed and deterministic so demo results are reproducible.
 * generateTaskSteps() produces the same sequence for the same input (Req 3.3).
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
    descriptionFn: (task) => `Analyzing task: "${task.slice(0, 50)}..."`,
  },
  {
    type: 'tool_web_search',
    descriptionFn: (task) => `Searching web for relevant information about "${task.slice(0, 30)}..."`,
  },
  {
    type: 'llm_call',
    descriptionFn: (task) => `Processing search results and generating initial response for task`,
  },
  {
    type: 'tool_data_fetch',
    descriptionFn: () => `Fetching structured data from external API`,
  },
  {
    type: 'llm_call',
    descriptionFn: () => `Synthesizing data and refining response`,
  },
  {
    type: 'tool_code_exec',
    descriptionFn: () => `Executing code to validate and format output`,
  },
  {
    type: 'reasoning',
    descriptionFn: () => `Reviewing output quality and checking for errors`,
  },
  {
    type: 'llm_call',
    descriptionFn: () => `Generating final polished response`,
  },
]

// ─── Task Step Generation ─────────────────────────────────────────────────────

/**
 * Generate a deterministic sequence of agent steps for a given task.
 *
 * Determinism: same taskDescription always produces same steps (Req 3.3, P6).
 * Minimum 5 steps per task (Req 3.1).
 *
 * The number of steps is determined by a simple hash of the task description,
 * ranging from 5 to 8 steps.
 */
export function generateTaskSteps(taskDescription: string): AgentStep[] {
  // Deterministic step count: 5-8 based on task hash
  const hash = simpleHash(taskDescription)
  const stepCount = 5 + (hash % 4) // 5, 6, 7, or 8

  const templates = STEP_TEMPLATES.slice(0, stepCount)
  const steps: AgentStep[] = []
  let cumulativeCost = 0

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i]
    const cost = STEP_COSTS[template.type]
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
