/**
 * TaskPanel.test.tsx
 *
 * Unit tests for TaskPanel component.
 * Validates Requirements 6.3 (real-time step list via SSE events).
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { TaskPanel } from './TaskPanel'

// jsdom doesn't implement scrollIntoView — mock it globally
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

const noop = vi.fn()

const CHANNEL_ID = 'chan-abc-123'

// Helper to build a mock StepEvent
function makeStepEvent(index: number, type: string, description: string, cost: number) {
  return {
    type: 'step' as const,
    channelId: CHANNEL_ID,
    step: {
      index,
      type,
      description,
      costUsdc: cost,
      cumulativeCostUsdc: cost * (index + 1),
    },
    commitment: { amount: String(cost), stepIndex: index },
    remainingBudgetUsdc: 10 - cost * (index + 1),
  }
}

describe('TaskPanel — form render (Req 6.3)', () => {
  it('renders the task description textarea', () => {
    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={[]}
      />
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders the "Run Agent Task" button', () => {
    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={[]}
      />
    )
    expect(screen.getByRole('button', { name: /run agent task/i })).toBeInTheDocument()
  })

  it('button is disabled when channelId is null', () => {
    render(
      <TaskPanel
        channelId={null}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={[]}
      />
    )
    expect(screen.getByRole('button', { name: /run agent task/i })).toBeDisabled()
  })
})

describe('TaskPanel — step list from SSE events (Req 6.3)', () => {
  it('renders a list of steps when sseEvents contains step events', () => {
    const events = [
      makeStepEvent(0, 'llm_call', 'Analyze market data', 0.002),
      makeStepEvent(1, 'tool_web_search', 'Search for trends', 0.001),
      makeStepEvent(2, 'reasoning', 'Synthesize findings', 0.0005),
    ]

    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={events}
      />
    )

    // Step count label
    expect(screen.getByText('Steps (3)')).toBeInTheDocument()

    // Step descriptions
    expect(screen.getByText('Analyze market data')).toBeInTheDocument()
    expect(screen.getByText('Search for trends')).toBeInTheDocument()
    expect(screen.getByText('Synthesize findings')).toBeInTheDocument()
  })

  it('renders correct step type labels', () => {
    const events = [
      makeStepEvent(0, 'llm_call', 'LLM step', 0.002),
      makeStepEvent(1, 'tool_web_search', 'Search step', 0.001),
      makeStepEvent(2, 'tool_code_exec', 'Code step', 0.003),
    ]

    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={events}
      />
    )

    expect(screen.getByText('LLM Call')).toBeInTheDocument()
    expect(screen.getByText('Web Search')).toBeInTheDocument()
    expect(screen.getByText('Code Exec')).toBeInTheDocument()
  })

  it('renders step cost and cumulative cost', () => {
    const events = [makeStepEvent(0, 'llm_call', 'First step', 0.002)]

    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={events}
      />
    )

    // cost: +0.0020, cumulative: Σ 0.0020
    expect(screen.getByText('+0.0020')).toBeInTheDocument()
    expect(screen.getByText('Σ 0.0020')).toBeInTheDocument()
  })

  it('ignores step events for a different channelId', () => {
    const events = [
      makeStepEvent(0, 'llm_call', 'Other channel step', 0.002),
    ]
    // Override channelId on the event
    events[0].channelId = 'other-channel'

    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={events}
      />
    )

    expect(screen.queryByText('Steps (1)')).not.toBeInTheDocument()
    expect(screen.queryByText('Other channel step')).not.toBeInTheDocument()
  })

  it('renders no step list when sseEvents is empty', () => {
    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={[]}
      />
    )

    expect(screen.queryByText(/Steps \(/)).not.toBeInTheDocument()
  })
})

describe('TaskPanel — progress indicator (Req 6.3)', () => {
  it('shows "Agent Running..." when running state is active', async () => {
    // Mock fetch to hang so running state persists
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    const { getByRole } = render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={[]}
      />
    )

    const button = getByRole('button', { name: /run agent task/i })
    button.click()

    // After click, button should show running state
    expect(await screen.findByText(/agent running/i)).toBeInTheDocument()
  })

  it('shows budget progress bar when steps are present', () => {
    const events = [makeStepEvent(0, 'llm_call', 'Step one', 2)]

    render(
      <TaskPanel
        channelId={CHANNEL_ID}
        budgetUsdc={10}
        onTaskComplete={noop}
        sseEvents={events}
      />
    )

    // Progress bar cost label
    expect(screen.getByText(/cost:/i)).toBeInTheDocument()
    expect(screen.getByText(/budget:/i)).toBeInTheDocument()
  })
})
