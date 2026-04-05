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

  // Session stats
  const [totalChannelsOpened, setTotalChannelsOpened] = useState(0)
  const [totalUsdcSpent, setTotalUsdcSpent] = useState(0)

  // Backend status (AI mode)
  const [aiMode, setAiMode] = useState<'claude' | 'mock' | null>(null)

  // Fetch backend status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.aiMode === 'claude' || data.aiMode === 'mock') {
          setAiMode(data.aiMode)
        }
      })
      .catch(() => {/* ignore */})
  }, [])

  useEffect(() => {
    const es = new EventSource('/api/events')
    eventSourceRef.current = es

    es.addEventListener('connected', () => {
      setSseConnected(true)
    })

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
    setTotalChannelsOpened((n) => n + 1)
  }

  function handleTaskComplete(cost: number, remaining: number) {
    setTotalCostUsdc(cost)
    setRemainingBudgetUsdc(remaining)
    setAppStatus('task_complete')
    setTotalUsdcSpent((n) => Math.round((n + cost) * 10_000_000) / 10_000_000)
  }

  // Current phase index for step indicator
  const currentPhase =
    appStatus === 'idle' ? 0 :
    appStatus === 'channel_open' ? 1 :
    appStatus === 'task_complete' || appStatus === 'task_running' ? 2 :
    3

  return (
    <div className="min-h-screen bg-gradient-to-br from-stellar-900 via-stellar-700 to-pulsar-accent">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-base">⚡</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">Pulsar</h1>
            <p className="text-white/60 text-xs">AI Agent Billing · MPP Session</p>
          </div>
          {/* Network badge */}
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-xs font-medium">
            Stellar Testnet
          </span>
          {/* AI mode badge */}
          {aiMode !== null && (
            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${
              aiMode === 'claude'
                ? 'bg-purple-500/20 border-purple-400/30 text-purple-200'
                : 'bg-white/10 border-white/20 text-white/50'
            }`}>
              AI: {aiMode === 'claude' ? 'Claude' : 'Mock'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Session stats */}
          {(totalChannelsOpened > 0 || totalUsdcSpent > 0) && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-white/60">
              <span>{totalChannelsOpened} channel{totalChannelsOpened !== 1 ? 's' : ''} opened</span>
              <span>·</span>
              <span>{totalUsdcSpent.toFixed(4)} USDC spent</span>
            </div>
          )}

          {/* SSE status */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-red-400'}`}
            />
            <span className="text-white/60 text-xs">
              {sseConnected ? 'Live' : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 pb-12">
        {/* Hero */}
        <div className="text-center mb-8 pt-2">
          <p className="text-white/80 text-sm max-w-lg mx-auto">
            Open a payment channel → run an AI agent task → settle with 1 on-chain transaction.
            Each step signs an off-chain commitment. Zero gas per step.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['Open Channel', 'Run Agent', 'Settle'] as const).map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i < currentPhase
                    ? 'bg-white text-stellar-700'
                    : i === currentPhase
                    ? 'bg-white/90 text-stellar-700 ring-2 ring-white/50'
                    : 'bg-white/20 text-white/60'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                  i < currentPhase ? 'bg-green-500 text-white' : 'bg-current/20'
                }`}>
                  {i < currentPhase ? '✓' : i + 1}
                </span>
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
          <ChannelPanel onChannelOpened={handleChannelOpened} aiMode={aiMode} />

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
