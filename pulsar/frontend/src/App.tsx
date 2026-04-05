/**
 * App.tsx
 *
 * Root component for Pulsar frontend.
 * Manages global state and SSE connection.
 *
 * State flow:
 *   idle → channel opened → task running → task complete → settled
 *
 * SSE: connects to GET /api/events, dispatches events to TaskPanel
 *
 * Context: See frontend/CONTEXT.md
 */

import { useState, useEffect, useRef } from 'react'
import { ChannelPanel } from './components/ChannelPanel'
import { TaskPanel } from './components/TaskPanel'
import { SettlementPanel } from './components/SettlementPanel'

type AppStatus = 'idle' | 'channel_open' | 'task_running' | 'task_complete' | 'settled'

export interface SseEvent {
  type: string
  channelId?: string
  [key: string]: unknown
}

export default function App() {
  const [channelId, setChannelId] = useState<string | null>(null)
  const [budgetUsdc, setBudgetUsdc] = useState<number>(0)
  const [appStatus, setAppStatus] = useState<AppStatus>('idle')
  const [sseEvents, setSseEvents] = useState<SseEvent[]>([])
  const [totalCostUsdc, setTotalCostUsdc] = useState<number>(0)
  const [remainingBudgetUsdc, setRemainingBudgetUsdc] = useState<number>(0)
  const [sseConnected, setSseConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Connect to SSE stream
  useEffect(() => {
    const es = new EventSource('/api/events')
    eventSourceRef.current = es

    es.addEventListener('connected', () => {
      setSseConnected(true)
    })

    // Listen for all event types
    const eventTypes = ['step', 'task_complete', 'budget_exhausted', 'error', 'channel_settled']
    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as SseEvent
          setSseEvents((prev) => [...prev, data])
        } catch {
          // ignore parse errors
        }
      })
    }

    es.onerror = () => {
      setSseConnected(false)
    }

    return () => {
      es.close()
    }
  }, [])

  function handleChannelOpened(id: string, budget: number) {
    setChannelId(id)
    setBudgetUsdc(budget)
    setRemainingBudgetUsdc(budget)
    setAppStatus('channel_open')
    setSseEvents([])
  }

  function handleTaskComplete(cost: number, remaining: number) {
    setTotalCostUsdc(cost)
    setRemainingBudgetUsdc(remaining)
    setAppStatus('task_complete')
  }

  const steps = 1 + (channelId ? 1 : 0) + (appStatus === 'task_complete' || appStatus === 'settled' ? 1 : 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-stellar-900 via-stellar-700 to-pulsar-accent">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-sm">⚡</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">Pulsar</h1>
            <p className="text-white/60 text-xs">AI Agent Billing · MPP Session · Stellar</p>
          </div>
        </div>

        {/* SSE status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-red-400'}`}
          />
          <span className="text-white/60 text-xs">
            {sseConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 pb-12">
        {/* Hero */}
        <div className="text-center mb-8 pt-4">
          <p className="text-white/80 text-sm max-w-lg mx-auto">
            Open a payment channel → run an AI agent task → settle with 1 on-chain transaction.
            Each step signs an off-chain commitment. Zero gas per step.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Open Channel', 'Run Agent', 'Settle'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i < steps
                    ? 'bg-white text-stellar-700'
                    : 'bg-white/20 text-white/60'
                }`}
              >
                <span>{i + 1}</span>
                <span>{label}</span>
              </div>
              {i < 2 && (
                <span className="text-white/30 text-xs">→</span>
              )}
            </div>
          ))}
        </div>

        {/* Panels */}
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          <ChannelPanel onChannelOpened={handleChannelOpened} />

          <TaskPanel
            channelId={channelId}
            budgetUsdc={budgetUsdc}
            onTaskComplete={handleTaskComplete}
        sseEvents={sseEvents as unknown as Parameters<typeof TaskPanel>[0]['sseEvents']}
          />

          <SettlementPanel
            channelId={channelId}
            totalCostUsdc={totalCostUsdc}
            remainingBudgetUsdc={remainingBudgetUsdc}
            taskComplete={appStatus === 'task_complete' || appStatus === 'settled'}
          />
        </div>

        {/* How it works */}
        <div className="mt-8 bg-white/10 rounded-2xl p-6 text-white/80 text-sm">
          <h3 className="font-semibold text-white mb-3">How Pulsar works</h3>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-medium text-white mb-1">1. Open Channel</p>
              <p>Deploys a Soroban one-way-channel contract and locks your USDC budget.</p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">2. Agent Runs</p>
              <p>Each step signs an off-chain commitment. No on-chain transaction per step.</p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">3. Settle</p>
              <p>1 on-chain tx closes the channel. Server gets payment, you get refund.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
