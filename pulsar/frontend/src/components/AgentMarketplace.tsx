/**
 * AgentMarketplace.tsx
 * 
 * UI for browsing and selecting different agent types.
 */

import { useState, useEffect } from 'react'

interface AgentType {
  id: string
  name: string
  description: string
  baseRate: number
  tools: string[]
  category: 'research' | 'coding' | 'analysis' | 'general'
}

interface AgentReputation {
  agentId: string
  totalTasks: number
  successfulTasks: number
  failedTasks: number
  successRate: number
  badge: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'
  lastUpdated: string
}

interface AgentMarketplaceProps {
  onSelectAgent: (agentId: string) => void
  selectedAgentId?: string
}

export function AgentMarketplace({ onSelectAgent, selectedAgentId }: AgentMarketplaceProps) {
  const [agents, setAgents] = useState<AgentType[]>([])
  const [reputations, setReputations] = useState<Record<string, AgentReputation>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
    fetchReputations()
  }, [])

  async function fetchAgents() {
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error('Failed to fetch agents')
      
      const data = await res.json()
      setAgents(data.agents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  async function fetchReputations() {
    try {
      const res = await fetch('/api/reputation/all')
      if (!res.ok) return // Reputation is optional
      
      const data = await res.json()
      const reputationMap: Record<string, AgentReputation> = {}
      for (const rep of data.reputations) {
        reputationMap[rep.agentId] = rep
      }
      setReputations(reputationMap)
    } catch {
      // Reputation is optional, ignore errors
    }
  }

  const categoryColors = {
    research: 'from-blue-500/20 to-blue-600/20 border-blue-400/30',
    coding: 'from-purple-500/20 to-purple-600/20 border-purple-400/30',
    analysis: 'from-green-500/20 to-green-600/20 border-green-400/30',
    general: 'from-gray-500/20 to-gray-600/20 border-gray-400/30',
  }

  const categoryIcons = {
    research: '🔍',
    coding: '💻',
    analysis: '📊',
    general: '🤖',
  }

  const badgeConfig = {
    platinum: { emoji: '💎', color: 'text-cyan-300', bg: 'bg-cyan-500/20', border: 'border-cyan-400/30' },
    gold: { emoji: '🥇', color: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-400/30' },
    silver: { emoji: '🥈', color: 'text-gray-300', bg: 'bg-gray-500/20', border: 'border-gray-400/30' },
    bronze: { emoji: '🥉', color: 'text-orange-300', bg: 'bg-orange-500/20', border: 'border-orange-400/30' },
    none: { emoji: '', color: '', bg: '', border: '' },
  }

  function getReputation(agentId: string): AgentReputation | null {
    return reputations[agentId] || null
  }

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <p className="text-white/60 text-sm">Loading agents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10 dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const reputation = getReputation(agent.id)
          const badge = reputation ? badgeConfig[reputation.badge] : null

          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`text-left p-5 rounded-xl border-2 transition-all hover:shadow-xl ${
                selectedAgentId === agent.id
                  ? 'bg-white/20 dark:bg-gray-700/50 border-white/40 dark:border-gray-500 shadow-lg scale-[1.02]'
                  : 'bg-gradient-to-br ' + categoryColors[agent.category] + ' hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-4xl">{categoryIcons[agent.category]}</span>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-semibold text-lg">{agent.name}</h4>
                      {badge && reputation && reputation.badge !== 'none' && (
                        <div
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${badge.bg} ${badge.border} border`}
                          title={`${reputation.successRate.toFixed(1)}% success rate (${reputation.totalTasks} tasks)`}
                        >
                          <span className="text-sm">{badge.emoji}</span>
                          <span className={`text-xs font-semibold ${badge.color}`}>
                            {reputation.badge.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    {selectedAgentId === agent.id && (
                      <span className="text-green-400 text-xl">✓</span>
                    )}
                  </div>
                  
                  <p className="text-white/70 text-sm mb-3">{agent.description}</p>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-white/90 font-mono text-base font-semibold">
                      ${agent.baseRate.toFixed(2)}
                    </span>
                    <span className="text-white/60 text-xs">USDC per step</span>
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-white/20 text-white/70 text-xs font-medium">
                      {agent.category}
                    </span>
                  </div>

                  {/* Reputation stats */}
                  {reputation && reputation.totalTasks > 0 && (
                    <div className="mb-3 flex items-center gap-3 text-xs text-white/60">
                      <span>✅ {reputation.successRate.toFixed(0)}% success</span>
                      <span>·</span>
                      <span>📊 {reputation.totalTasks} tasks</span>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-1.5">
                    {agent.tools.map((tool) => (
                      <span
                        key={tool}
                        className="px-2 py-1 rounded-md bg-white/10 text-white/70 text-xs font-medium"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
