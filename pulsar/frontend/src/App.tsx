/**
 * App.tsx
 *
 * Root component for Pulsar frontend.
 * Manages global state, SSE connection, and view routing (landing ↔ app).
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
import { LandingPage } from './components/LandingPage'
import { AnalyticsDashboard } from './components/AnalyticsDashboard'
import { DarkModeToggle } from './components/DarkModeToggle'
import { WalletConnect } from './components/WalletConnect'
import { AgentMarketplace } from './components/AgentMarketplace'
import { Navbar } from './components/Navbar'
import { CostComparisonChart } from './components/CostComparisonChart'
import CostPredictionPanel from './components/CostPredictionPanel'

type AppStatus = 'idle' | 'channel_open' | 'task_running' | 'task_complete' | 'settled'
type AppView = 'landing' | 'app'
type AppTab = 'channels' | 'marketplace' | 'analytics' | 'prediction'

export interface SseEvent {
  type: string
  channelId?: string
  [key: string]: unknown
}

export default function App() {
  const [view, setView] = useState<AppView>('landing')
  const [activeTab, setActiveTab] = useState<AppTab>('channels')
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
  const [aiMode, setAiMode] = useState<'openrouter' | 'claude' | 'mock' | null>(null)

  // Wallet connection
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null)

  // Agent selection
  const [selectedAgentId, setSelectedAgentId] = useState<string>('general')

  // Fetch backend status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.aiMode === 'openrouter' || data.aiMode === 'claude' || data.aiMode === 'mock') {
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
    
    // Log selected agent for this channel
    console.log(`[Pulsar] Channel opened with agent type: ${selectedAgentId}`)
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

  // ── Landing page ──────────────────────────────────────────────────────────
  if (view === 'landing') {
    return <LandingPage onLaunch={() => setView('app')} />
  }

  // ── App view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-stellar-900 via-stellar-700 to-pulsar-accent dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Dark mode toggle */}
      <DarkModeToggle />
      
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(124,58,237,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(35,64,176,0.3) 0%, transparent 50%)',
        }}
      />

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          {/* Back to landing */}
          <button
            onClick={() => setView('landing')}
            className="text-white/50 hover:text-white text-sm transition-colors mr-1"
            title="Back to landing page"
          >
            ←
          </button>

          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center animate-pulse-glow">
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
              aiMode === 'openrouter'
                ? 'bg-green-500/20 border-green-400/30 text-green-200'
                : aiMode === 'claude'
                ? 'bg-purple-500/20 border-purple-400/30 text-purple-200'
                : 'bg-white/10 border-white/20 text-white/50'
            }`}>
              AI: {aiMode === 'openrouter' ? 'OpenRouter' : aiMode === 'claude' ? 'Claude' : 'Mock'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Wallet connection */}
          <WalletConnect
            onConnect={(publicKey) => {
              setWalletPublicKey(publicKey)
            }}
            onDisconnect={() => {
              setWalletPublicKey(null)
            }}
          />

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

      {/* Navigation Tabs */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 pb-12 pt-8">
        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <>
            {/* Hero subtitle */}
            <div className="text-center mb-8 animate-fade-in">
              <p className="text-white/70 text-sm max-w-lg mx-auto">
                Open a payment channel → run an AI agent task → settle with 1 on-chain transaction.
                Each step signs an off-chain commitment. Zero gas per step.
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {(['Open Channel', 'Run Agent', 'Settle'] as const).map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                      i < currentPhase
                        ? 'bg-white text-stellar-700 shadow-lg'
                        : i === currentPhase
                        ? 'bg-white/90 text-stellar-700 ring-2 ring-white/50 shadow-lg'
                        : 'bg-white/20 text-white/60'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < currentPhase
                        ? 'bg-green-500 text-white'
                        : i === currentPhase
                        ? 'bg-pulsar-accent text-white'
                        : 'bg-white/20 text-white/60'
                    }`}>
                      {i < currentPhase ? '✓' : i + 1}
                    </span>
                    <span>{label}</span>
                  </div>
                  {i < 2 && (
                    <span className={`text-xs transition-colors ${i < currentPhase ? 'text-white/60' : 'text-white/20'}`}>
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Panels — 3 columns on desktop, stacked on mobile */}
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-3 animate-slide-up">
              <ChannelPanel 
                onChannelOpened={handleChannelOpened} 
                aiMode={aiMode}
                walletPublicKey={walletPublicKey}
                selectedAgentId={selectedAgentId}
              />

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
            <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white/80 text-sm border border-white/10">
              <h3 className="font-semibold text-white mb-3">How Pulsar works</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="font-medium text-white mb-1">🔒 1. Open Channel</p>
                  <p>Deploys a Soroban one-way-channel contract and locks your USDC budget.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-1">🤖 2. Agent Runs</p>
                  <p>Each step signs an off-chain commitment. No on-chain transaction per step.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-1">✅ 3. Settle</p>
                  <p>1 on-chain tx closes the channel. Server gets payment, you get refund.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Marketplace Tab */}
        {activeTab === 'marketplace' && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-white text-2xl font-bold mb-2">Agent Marketplace</h2>
              <p className="text-white/70 text-sm max-w-lg mx-auto">
                Choose from specialized AI agents with different capabilities and pricing.
                Each agent is optimized for specific types of tasks.
              </p>
            </div>
            
            <AgentMarketplace
              onSelectAgent={setSelectedAgentId}
              selectedAgentId={selectedAgentId}
            />

            {/* Marketplace info */}
            <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white/80 text-sm border border-white/10">
              <h3 className="font-semibold text-white mb-3">💡 How Agent Pricing Works</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-medium text-white mb-1">Per-Step Pricing</p>
                  <p>Each agent charges per execution step. More complex agents cost more per step but deliver better results.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-1">Off-Chain Commitments</p>
                  <p>All payments are off-chain commitments until settlement. No gas fees per step!</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cost Prediction Tab */}
        {activeTab === 'prediction' && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <CostPredictionPanel />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-white text-2xl font-bold mb-2">Platform Analytics</h2>
              <p className="text-white/70 text-sm max-w-lg mx-auto">
                Real-time metrics showing the power of MPP Session payment channels.
                See how Pulsar reduces costs by 99% compared to traditional approaches.
              </p>
            </div>
            
            {/* Main Analytics Dashboard - REAL DATA */}
            <AnalyticsDashboard />

            {/* Cost Comparison Chart - REAL CALCULATION */}
            <div className="grid grid-cols-1 gap-6">
              <CostComparisonChart />
            </div>

            {/* Analytics info */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white/80 text-sm border border-white/10">
              <h3 className="font-semibold text-white mb-3">📈 Why These Metrics Matter</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="font-medium text-white mb-1">Transaction Reduction</p>
                  <p>Traditional: 100 steps = 100 txs. Pulsar: 100 steps = 1 tx. That's 99% fewer transactions!</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-1">Cost Savings</p>
                  <p>Each Stellar transaction costs ~$0.01. With 100 steps, you save ~$0.99 per task.</p>
                </div>
                <div>
                  <p className="font-medium text-white mb-1">Latency Improvement</p>
                  <p>Off-chain commitments are instant. No waiting for blockchain confirmation per step.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
