/**
 * LiveTransactionFeed.tsx
 * 
 * VISUAL WOW FACTOR: Live feed of off-chain commitments vs on-chain transactions.
 * Shows the dramatic difference in transaction volume.
 */

import { useEffect, useState } from 'react'

interface Transaction {
  id: string
  type: 'off-chain' | 'on-chain'
  description: string
  amount: number
  timestamp: Date
}

export function LiveTransactionFeed() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState({
    offChain: 0,
    onChain: 0,
  })

  useEffect(() => {
    // Simulate transaction activity
    const interval = setInterval(() => {
      // Add off-chain commitment (frequent)
      const offChainTx: Transaction = {
        id: `off-${Date.now()}`,
        type: 'off-chain',
        description: `Agent step ${Math.floor(Math.random() * 100)}`,
        amount: Math.random() * 0.1,
        timestamp: new Date(),
      }

      setTransactions(prev => [offChainTx, ...prev.slice(0, 9)])
      setStats(prev => ({ ...prev, offChain: prev.offChain + 1 }))

      // Occasionally add on-chain settlement (rare)
      if (Math.random() < 0.1) {
        setTimeout(() => {
          const onChainTx: Transaction = {
            id: `on-${Date.now()}`,
            type: 'on-chain',
            description: 'Channel settlement',
            amount: Math.random() * 5,
            timestamp: new Date(),
          }

          setTransactions(prev => [onChainTx, ...prev.slice(0, 9)])
          setStats(prev => ({ ...prev, onChain: prev.onChain + 1 }))
        }, 500)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const ratio = stats.offChain > 0 ? (stats.offChain / Math.max(stats.onChain, 1)).toFixed(1) : '0'

  return (
    <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">📡 Live Transaction Feed</h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/60 text-xs">Live</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
          <p className="text-blue-300 text-xs mb-1">Off-Chain</p>
          <p className="text-white font-bold text-xl">{stats.offChain}</p>
        </div>
        <div className="bg-purple-500/20 rounded-lg p-3 border border-purple-500/30">
          <p className="text-purple-300 text-xs mb-1">On-Chain</p>
          <p className="text-white font-bold text-xl">{stats.onChain}</p>
        </div>
        <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30">
          <p className="text-green-300 text-xs mb-1">Ratio</p>
          <p className="text-white font-bold text-xl">{ratio}:1</p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className={`p-3 rounded-lg border animate-slide-in ${
              tx.type === 'off-chain'
                ? 'bg-blue-500/10 border-blue-500/30'
                : 'bg-purple-500/10 border-purple-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {tx.type === 'off-chain' ? '⚡' : '⛓️'}
                </span>
                <div>
                  <p className="text-white text-sm font-medium">{tx.description}</p>
                  <p className="text-white/50 text-xs">
                    {tx.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  tx.type === 'off-chain' ? 'text-blue-300' : 'text-purple-300'
                }`}>
                  ${tx.amount.toFixed(3)}
                </p>
                <p className="text-white/50 text-xs">
                  {tx.type === 'off-chain' ? 'Commitment' : 'Settlement'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-white/50 text-xs mt-4 text-center">
        Off-chain commitments are instant and free. Settlement happens once.
      </p>
    </div>
  )
}
