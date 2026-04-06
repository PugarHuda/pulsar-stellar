/**
 * CostComparisonChart.tsx
 * 
 * VISUAL WOW FACTOR: Animated bar chart comparing costs.
 * Shows dramatic difference between traditional and Pulsar.
 */

import { useEffect, useState } from 'react'

interface ComparisonData {
  steps: number
  traditional: number
  pulsar: number
}

export function CostComparisonChart() {
  const [selectedSteps, setSelectedSteps] = useState(100)
  const [animatedHeight, setAnimatedHeight] = useState(0)

  const data: ComparisonData[] = [
    { steps: 10, traditional: 0.10, pulsar: 0.01 },
    { steps: 50, traditional: 0.50, pulsar: 0.01 },
    { steps: 100, traditional: 1.00, pulsar: 0.01 },
    { steps: 500, traditional: 5.00, pulsar: 0.01 },
    { steps: 1000, traditional: 10.00, pulsar: 0.01 },
  ]

  const current = data.find(d => d.steps === selectedSteps) || data[2]
  const savings = ((current.traditional - current.pulsar) / current.traditional * 100).toFixed(1)

  // Animate bars
  useEffect(() => {
    setAnimatedHeight(0)
    const timer = setTimeout(() => setAnimatedHeight(100), 100)
    return () => clearTimeout(timer)
  }, [selectedSteps])

  return (
    <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10 dark:border-gray-700">
      <h3 className="text-white font-semibold text-lg mb-4">💰 Cost Comparison</h3>

      {/* Step selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {data.map((d) => (
          <button
            key={d.steps}
            onClick={() => setSelectedSteps(d.steps)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              selectedSteps === d.steps
                ? 'bg-white text-stellar-700 shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {d.steps} steps
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Traditional */}
        <div className="text-center">
          <p className="text-white/60 text-sm mb-2">Traditional (x402/MPP Charge)</p>
          <div className="bg-gray-900/50 rounded-lg p-4 h-48 flex flex-col justify-end">
            <div
              className="bg-gradient-to-t from-red-500 to-red-400 rounded-t-lg transition-all duration-1000 ease-out flex items-end justify-center pb-2"
              style={{ height: `${animatedHeight}%` }}
            >
              <span className="text-white font-bold text-lg">
                ${current.traditional.toFixed(2)}
              </span>
            </div>
          </div>
          <p className="text-red-400 text-xs mt-2">{selectedSteps} transactions</p>
        </div>

        {/* Pulsar */}
        <div className="text-center">
          <p className="text-white/60 text-sm mb-2">Pulsar (MPP Session)</p>
          <div className="bg-gray-900/50 rounded-lg p-4 h-48 flex flex-col justify-end">
            <div
              className="bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg transition-all duration-1000 ease-out flex items-end justify-center pb-2"
              style={{ height: `${animatedHeight * 0.01}%`, minHeight: '40px' }}
            >
              <span className="text-white font-bold text-lg">
                ${current.pulsar.toFixed(2)}
              </span>
            </div>
          </div>
          <p className="text-green-400 text-xs mt-2">1 transaction</p>
        </div>
      </div>

      {/* Savings highlight */}
      <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Cost Savings</p>
            <p className="text-white font-bold text-2xl">{savings}%</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">You Save</p>
            <p className="text-green-400 font-bold text-2xl">
              ${(current.traditional - current.pulsar).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <p className="text-white/50 text-xs mt-4 text-center">
        Pulsar uses payment channels to batch {selectedSteps} steps into 1 transaction
      </p>
    </div>
  )
}
