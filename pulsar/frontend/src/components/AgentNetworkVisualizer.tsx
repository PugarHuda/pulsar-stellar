/**
 * AgentNetworkVisualizer.tsx
 * 
 * VISUAL WOW FACTOR: Interactive visualization of agent-to-agent payment network.
 * Shows agents as nodes and payment channels as edges.
 * Real-time updates as channels open and payments flow.
 */

import { useEffect, useState } from 'react'

interface NetworkNode {
  id: string
  name: string
  type: 'user' | 'agent'
  x: number
  y: number
  color: string
}

interface NetworkEdge {
  from: string
  to: string
  amount: number
  status: 'active' | 'settling' | 'closed'
}

export function AgentNetworkVisualizer() {
  const [nodes] = useState<NetworkNode[]>([
    { id: 'user', name: 'You', type: 'user', x: 50, y: 50, color: '#7c3aed' },
    { id: 'general', name: 'General Agent', type: 'agent', x: 200, y: 50, color: '#3b82f6' },
    { id: 'researcher', name: 'Research Agent', type: 'agent', x: 350, y: 100, color: '#10b981' },
    { id: 'coder', name: 'Coding Agent', type: 'agent', x: 350, y: 0, color: '#f59e0b' },
    { id: 'analyst', name: 'Data Analyst', type: 'agent', x: 500, y: 50, color: '#ef4444' },
  ])

  const [edges, setEdges] = useState<NetworkEdge[]>([
    { from: 'user', to: 'general', amount: 5.0, status: 'active' },
  ])

  const [animatedEdge, setAnimatedEdge] = useState<string | null>(null)

  // Simulate network activity
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly add agent-to-agent connections
      const agentIds = ['general', 'researcher', 'coder', 'analyst']
      const from = agentIds[Math.floor(Math.random() * agentIds.length)]
      const to = agentIds.filter(id => id !== from)[Math.floor(Math.random() * 3)]
      
      const newEdge: NetworkEdge = {
        from,
        to,
        amount: Math.random() * 2,
        status: 'active',
      }

      setEdges(prev => {
        // Check if edge already exists
        const exists = prev.some(e => e.from === from && e.to === to)
        if (exists) return prev
        
        // Limit to 8 edges
        if (prev.length >= 8) {
          return [...prev.slice(1), newEdge]
        }
        return [...prev, newEdge]
      })

      setAnimatedEdge(`${from}-${to}`)
      setTimeout(() => setAnimatedEdge(null), 1000)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">🌐 Agent Payment Network</h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/60 text-xs">Live Network</span>
        </div>
      </div>

      <div className="relative bg-gray-900/50 rounded-xl p-8 h-64 overflow-hidden">
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {edges.map((edge) => {
            const fromNode = nodes.find(n => n.id === edge.from)
            const toNode = nodes.find(n => n.id === edge.to)
            if (!fromNode || !toNode) return null

            const isAnimated = animatedEdge === `${edge.from}-${edge.to}`

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={isAnimated ? '#10b981' : '#ffffff40'}
                  strokeWidth={isAnimated ? 3 : 2}
                  strokeDasharray={isAnimated ? '5,5' : '0'}
                  className={isAnimated ? 'animate-pulse' : ''}
                />
                {/* Payment amount label */}
                <text
                  x={(fromNode.x + toNode.x) / 2}
                  y={(fromNode.y + toNode.y) / 2 - 5}
                  fill="#ffffff80"
                  fontSize="10"
                  textAnchor="middle"
                >
                  ${edge.amount.toFixed(2)}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: node.x, top: node.y }}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xs text-center shadow-lg ${
                node.type === 'user' ? 'ring-2 ring-white/50' : ''
              }`}
              style={{ backgroundColor: node.color }}
            >
              {node.type === 'user' ? '👤' : '🤖'}
            </div>
            <div className="text-white/80 text-xs text-center mt-1 whitespace-nowrap">
              {node.name}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-white/60 mb-1">Active Channels</p>
          <p className="text-white font-semibold text-lg">{edges.length}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-white/60 mb-1">Total Flow</p>
          <p className="text-white font-semibold text-lg">
            ${edges.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>

      <p className="text-white/50 text-xs mt-3 text-center">
        Agents can open payment channels to other agents for specialized services
      </p>
    </div>
  )
}
