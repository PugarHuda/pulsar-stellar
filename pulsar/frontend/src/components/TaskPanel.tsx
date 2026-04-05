/**
 * TaskPanel.tsx
 *
 * UI for running a mock AI agent task against a payment channel.
 * - Input: task description
 * - Output: real-time step list via SSE (step type, cost, cumulative)
 * - Shows progress indicator while agent is running
 *
 * Context: See frontend/CONTEXT.md
 */

import { useState, useEffect, useRef } from 'react'

interface AgentStep {
  index: number
  type: string
  description: string
  costUsdc: number
  cumulativeCostUsdc: number
}

interface StepEvent {
  type: 'step'
  channelId: string
  step: AgentStep
  commitment: { amount: string; stepIndex: number }
  remainingBudgetUsdc: number
}

interface TaskCompleteEvent {
  type: 'task_complete'
  channelId: string
  totalSteps: number
  totalCostUsdc: number
  remainingBudgetUsdc: number
}

interface BudgetExhaustedEvent {
  type: 'budget_exhausted'
  channelId: string
  lastStepIndex: number
  totalCostUsdc: number
}

type SseEvent = StepEvent | TaskCompleteEvent | BudgetExhaustedEvent

const STEP_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  llm_call:        { label: 'LLM Call',    icon: '🧠', color: 'bg-purple-100 text-purple-700' },
  tool_web_search: { label: 'Web Search',  icon: '🔍', color: 'bg-blue-100 text-blue-700' },
  tool_code_exec:  { label: 'Code Exec',   icon: '⚙️', color: 'bg-orange-100 text-orange-700' },
  tool_data_fetch: { label: 'Data Fetch',  icon: '📡', color: 'bg-cyan-100 text-cyan-700' },
  reasoning:       { label: 'Reasoning',   icon: '💭', color: 'bg-gray-100 text-gray-700' },
}

interface TaskPanelProps {
  channelId: string | null
  budgetUsdc: number
  onTaskComplete: (totalCostUsdc: number, remainingBudgetUsdc: number) => void
  sseEvents: SseEvent[]
}

export function TaskPanel({ channelId, budgetUsdc, onTaskComplete, sseEvents }: TaskPanelProps) {
  const [taskDescription, setTaskDescription] = useState<string>(
    'Analyze market trends and generate a comprehensive investment report',
  )
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskDone, setTaskDone] = useState(false)
  const stepsEndRef = useRef<HTMLDivElement>(null)

  // Filter SSE events for this channel
  const steps = sseEvents.filter(
    (e): e is StepEvent => e.type === 'step' && e.channelId === channelId,
  )
  const completeEvent = sseEvents.find(
    (e): e is TaskCompleteEvent | BudgetExhaustedEvent =>
      (e.type === 'task_complete' || e.type === 'budget_exhausted') &&
      e.channelId === channelId,
  )

  // Auto-scroll to latest step
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps.length])

  // Detect task completion from SSE
  useEffect(() => {
    if (completeEvent && running) {
      setRunning(false)
      setTaskDone(true)
      const totalCost = completeEvent.type === 'task_complete'
        ? completeEvent.totalCostUsdc
        : completeEvent.totalCostUsdc
      const remaining = completeEvent.type === 'task_complete'
        ? completeEvent.remainingBudgetUsdc
        : budgetUsdc - totalCost
      onTaskComplete(totalCost, remaining)
    }
  }, [completeEvent, running])

  async function handleRunTask() {
    if (!channelId) return
    setError(null)
    setRunning(true)
    setTaskDone(false)

    try {
      const res = await fetch(`/api/channels/${channelId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskDescription }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Task failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setRunning(false)
    }
  }

  const currentCost = steps.length > 0
    ? steps[steps.length - 1].step.cumulativeCostUsdc
    : 0
  const progressPct = budgetUsdc > 0 ? Math.min((currentCost / budgetUsdc) * 100, 100) : 0

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-pulsar-accent/10 flex items-center justify-center">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agent Task</h2>
          <p className="text-sm text-gray-500">Each step signs an off-chain commitment</p>
        </div>
      </div>

      {/* Task input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Task Description
        </label>
        <textarea
          value={taskDescription}
          onChange={(e) => setTaskDescription(e.target.value)}
          disabled={running || taskDone || !channelId}
          rows={2}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulsar-accent focus:border-transparent outline-none text-gray-900 text-sm resize-none disabled:bg-gray-50"
        />
      </div>

      {/* Budget progress bar */}
      {(running || steps.length > 0) && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Cost: {currentCost.toFixed(4)} USDC</span>
            <span>Budget: {budgetUsdc} USDC</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-pulsar-accent h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Run button */}
      {!taskDone && (
        <button
          onClick={handleRunTask}
          disabled={running || !channelId || !taskDescription}
          className="w-full py-3 px-4 bg-pulsar-accent hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors mb-4"
        >
          {running ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">●</span> Agent Running...
            </span>
          ) : (
            'Run Agent Task'
          )}
        </button>
      )}

      {/* Step list */}
      {steps.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Steps ({steps.length})
          </p>
          {steps.map((event) => {
            const meta = STEP_TYPE_LABELS[event.step.type] ?? {
              label: event.step.type,
              icon: '•',
              color: 'bg-gray-100 text-gray-700',
            }
            return (
              <div
                key={event.step.index}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm"
              >
                <span className="text-base shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      Step {event.step.index + 1}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs truncate">{event.step.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium text-gray-900">
                    +{event.step.costUsdc.toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-400">
                    Σ {event.step.cumulativeCostUsdc.toFixed(4)}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={stepsEndRef} />
        </div>
      )}

      {/* Task complete summary */}
      {completeEvent && (
        <div className={`mt-4 p-4 rounded-lg border ${
          completeEvent.type === 'budget_exhausted'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <p className={`text-sm font-semibold ${
            completeEvent.type === 'budget_exhausted' ? 'text-amber-800' : 'text-green-800'
          }`}>
            {completeEvent.type === 'budget_exhausted'
              ? '⚠️ Budget exhausted'
              : '✅ Task complete'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {completeEvent.type === 'task_complete'
              ? `${completeEvent.totalSteps} steps · ${completeEvent.totalCostUsdc.toFixed(4)} USDC used`
              : `Stopped at step ${completeEvent.lastStepIndex + 1}`}
          </p>
        </div>
      )}
    </div>
  )
}
