/**
 * AnalyticsDashboard.tsx
 * 
 * Displays real-time analytics and cost savings metrics.
 * Shows the power of MPP Session vs traditional approaches.
 */

import { useEffect, useState } from 'react'

interface Analytics {
  totalChannels: number
  openChannels: number
  closedChannels: number
  totalUsdcProcessed: number
  avgTaskCost: number
  totalSteps: number
  costSavings: {
    traditionalTxCount: number
    pulsarTxCount: number
    txReduction: string
    message: string
  }
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [])

  async function fetchAnalytics() {
    try {
      const res = await fetch('http://localhost:3001/api/analytics')
      const data = await res.json()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <p className="text-gray-600 dark:text-gray-400">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        📊 Platform Analytics
      </h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          icon="🔓"
          label="Total Channels"
          value={analytics.totalChannels}
          subtitle={`${analytics.openChannels} open, ${analytics.closedChannels} closed`}
        />
        <MetricCard
          icon="💰"
          label="USDC Processed"
          value={`${analytics.totalUsdcProcessed.toFixed(2)} USDC`}
          subtitle={`Avg: ${analytics.avgTaskCost.toFixed(3)} USDC/task`}
        />
        <MetricCard
          icon="⚡"
          label="Total Steps"
          value={analytics.totalSteps}
          subtitle={`Across all tasks`}
        />
      </div>

      {/* Cost Savings Highlight */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border-2 border-purple-200 dark:border-purple-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            💎 Cost Savings vs Traditional
          </h3>
          <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {analytics.costSavings.txReduction}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Traditional (x402/MPP Charge)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {analytics.costSavings.traditionalTxCount} txs
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pulsar (MPP Session)</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {analytics.costSavings.pulsarTxCount} txs
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300">
          {analytics.costSavings.message}
        </p>
      </div>

      {/* Real-time Indicator */}
      <div className="mt-6 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
        Live data • Updates every 10 seconds
      </div>
    </div>
  )
}

interface MetricCardProps {
  icon: string
  label: string
  value: string | number
  subtitle: string
}

function MetricCard({ icon, label, value, subtitle }: MetricCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center mb-2">
        <span className="text-3xl mr-3">{icon}</span>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  )
}
