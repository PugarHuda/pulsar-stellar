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

interface AgentMarketplaceProps {
  onSelectAgent: (agentId: string) => void
  selectedAgentId?: string
}

export function AgentMarketplace({ onSelectAgent, selectedAgentId }: AgentMarketplaceProps) {
  const [agents, setAgents] = useState<AgentType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
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
        {agents.map((agent) => (
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
                  <h4 className="text-white font-semibold text-lg">{agent.name}</h4>
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
        ))}
      </div>
    </div>
  )
}
