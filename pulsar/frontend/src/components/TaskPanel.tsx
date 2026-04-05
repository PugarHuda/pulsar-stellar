/**
 * TaskPanel.tsx - AI agent task runner with real-time SSE step list.
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
  llm_call:        { label: 'LLM Call',    icon: 'LLM',  color: 'bg-purple-100 text-purple-700' },
  tool_web_search: { label: 'Web Search',  icon: 'WEB',  color: 'bg-blue-100 text-blue-700' },
  tool_code_exec:  { label: 'Code Exec',   icon: 'CODE', color: 'bg-orange-100 text-orange-700' },
  tool_data_fetch: { label: 'Data Fetch',  icon: 'DATA', color: 'bg-cyan-100 text-cyan-700' },
  reasoning:       { label: 'Reasoning',   icon: 'THINK',color: 'bg-gray-100 text-gray-700' },
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
  const [copiedResult, setCopiedResult] = useState(false)
  const stepsEndRef = useRef<HTMLDivElement>(null)

  const steps = sseEvents.filter(
    (e): e is StepEvent => e.type === 'step' && e.channelId === channelId,
  )
  const completeEvent = sseEvents.find(
    (e): e is TaskCompleteEvent | BudgetExhaustedEvent =>
      (e.type === 'task_complete' || e.type === 'budget_exhausted') &&
      e.channelId === channelId,
  )

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps.length])

  useEffect(() => {
    if (completeEvent && running) {
      setRunning(false)
      setTaskDone(true)
      const totalCost = completeEvent.totalCostUsdc
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

  async function handleCopyResult() {
    if (!completeEvent) return
    const lines = [
      `Task: ${taskDescription}`,
      `Steps: ${steps.length}`,
      `Total cost: ${completeEvent.totalCostUsdc.toFixed(4)} USDC`,
      '',
      ...steps.map((e, i) =>
        `${i + 1}. [${e.step.type}] ${e.step.description} (+${e.step.costUsdc.toFixed(4)} USDC)`
      ),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopiedResult(true)
    setTimeout(() => setCopiedResult(false), 2000)
  }

  const currentCost = steps.length > 0 ? steps[steps.length - 1].step.cumulativeCostUsdc : 0
  const progressPct = budgetUsdc > 0 ? Math.min((currentCost / budgetUsdc) * 100, 100) : 0
  const remainingBudget = budgetUsdc - currentCost
  const estimatedRemainingSteps = running && remainingBudget > 0
    ? Math.floor(remainingBudget / 0.03)
    : null

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-pulsar-accent/10 flex items-center justify-center">
          <span className="text-lg">AI</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agent Task</h2>
          <p className="text-sm text-gray-500">Each step signs an off-chain commitment</p>
        </div>
      </div>

      {!channelId && (
        <div className="text-center py-4 text-gray-400 text-sm mb-4">
          Open a payment channel first to run an agent task
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Task Description</label>
        <textarea
          value={taskDescription}
          onChange={(e) => setTaskDescription(e.target.value)}
          disabled={running || taskDone || !channelId}
          rows={2}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulsar-accent focus:border-transparent outline-none text-gray-900 text-sm resize-none disabled:bg-gray-50"
        />
      </div>

      {(running || steps.length > 0) && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Cost: {currentCost.toFixed(4)} USDC</span>
            <div className="flex items-center gap-2">
              {estimatedRemainingSteps !== null && (
                <span className="text-gray-400">~{estimatedRemainingSteps} steps left</span>
              )}
              <span>Budget: {budgetUsdc} USDC</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${progressPct > 80 ? 'bg-amber-500' : 'bg-pulsar-accent'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!taskDone && (
        <button
          onClick={handleRunTask}
          disabled={running || !channelId || !taskDescription}
          className="w-full py-3 px-4 bg-pulsar-accent hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors mb-4"
        >
          {running ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">...</span>
              Agent Running...
            </span>
          ) : (
            'Run Agent Task'
          )}
        </button>
      )}

      {steps.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Steps ({steps.length})
            </p>
          </div>
          {steps.map((event) => {
            const meta = STEP_TYPE_LABELS[event.step.type] ?? {
              label: event.step.type, icon: 'X', color: 'bg-gray-100 text-gray-700',
            }
            return (
              <div key={event.step.index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="text-xs shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-gray-400">Step {event.step.index + 1}</span>
                  </div>
                  <p className="text-gray-600 text-xs truncate">{event.step.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium text-gray-900">+{event.step.costUsdc.toFixed(4)}</div>
                  <div className="text-xs text-gray-400">Σ {event.step.cumulativeCostUsdc.toFixed(4)}</div>
                </div>
              </div>
            )
          })}
          <div ref={stepsEndRef} />
        </div>
      )}

      {completeEvent && (
        <div className={`mt-4 p-4 rounded-lg border ${
          completeEvent.type === 'budget_exhausted' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <p className={`text-sm font-semibold ${
              completeEvent.type === 'budget_exhausted' ? 'text-amber-800' : 'text-green-800'
            }`}>
              {completeEvent.type === 'budget_exhausted' ? 'Budget exhausted' : 'Task complete'}
            </p>
            <button
              onClick={handleCopyResult}
              className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              {copiedResult ? 'Copied' : 'Copy Result'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {completeEvent.type === 'task_complete'
              ? `${completeEvent.totalSteps} steps - ${completeEvent.totalCostUsdc.toFixed(4)} USDC used`
              : `Stopped at step ${completeEvent.lastStepIndex + 1}`}
          </p>
        </div>
      )}
    </div>
  )
}
