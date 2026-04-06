/**
 * CostPredictionPanel.tsx
 * 
 * AI-Powered Cost Prediction Component
 * 
 * Features:
 * - Predict task cost before opening channel
 * - Recommend optimal agent type
 * - Show confidence score
 * - Display cost breakdown
 */

import { useState } from 'react'

interface CostPrediction {
  estimatedSteps: number
  estimatedCost: number
  recommendedAgent: string
  recommendedAgentName: string
  recommendedBudget: number
  confidence: number
  reasoning: string
  breakdown: {
    llmCalls: number
    webSearches: number
    codeExecutions: number
    dataFetches: number
  }
  summary: {
    estimatedCost: string
    recommendedBudget: string
    confidence: string
    confidenceColor: string
    agentName: string
    steps: number
  }
}

export default function CostPredictionPanel() {
  const [taskDescription, setTaskDescription] = useState('')
  const [prediction, setPrediction] = useState<CostPrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePredict = async () => {
    if (!taskDescription.trim()) {
      setError('Please enter a task description')
      return
    }

    setLoading(true)
    setError('')
    setPrediction(null)

    try {
      const res = await fetch('/api/predict-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskDescription }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error?.message || 'Prediction failed')
      }

      const data = await res.json()
      setPrediction(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to predict cost')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🤖 AI Cost Prediction
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Let AI analyze your task and predict the optimal setup
        </p>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Task Description
          </label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Describe your task... (e.g., 'Research the latest AI trends and create a summary report')"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            rows={4}
          />
        </div>

        <button
          onClick={handlePredict}
          disabled={loading || !taskDescription.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            '🔮 Predict Cost & Recommend Agent'
          )}
        </button>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400 text-sm">❌ {error}</p>
          </div>
        )}
      </div>

      {/* Prediction Results */}
      {prediction && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl shadow-lg p-6 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                💡 Prediction Results
              </h3>
              <div
                className="px-3 py-1 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: prediction.summary.confidenceColor + '20',
                  color: prediction.summary.confidenceColor,
                }}
              >
                {prediction.summary.confidence} Confidence
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estimated Cost</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {prediction.summary.estimatedCost}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recommended Budget</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {prediction.summary.recommendedBudget}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">+20% buffer</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Recommended Agent</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                🤖 {prediction.summary.agentName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                ~{prediction.summary.steps} steps estimated
              </p>
            </div>
          </div>

          {/* Breakdown Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h4 className="text-md font-bold text-gray-900 dark:text-white mb-4">
              📊 Cost Breakdown
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  💬 LLM Calls
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {prediction.breakdown.llmCalls} × 0.05 USDC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  🔍 Web Searches
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {prediction.breakdown.webSearches} × 0.02 USDC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  💻 Code Executions
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {prediction.breakdown.codeExecutions} × 0.03 USDC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  📡 Data Fetches
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {prediction.breakdown.dataFetches} × 0.02 USDC
                </span>
              </div>
            </div>
          </div>

          {/* Reasoning Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h4 className="text-md font-bold text-gray-900 dark:text-white mb-3">
              🧠 AI Reasoning
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {prediction.reasoning}
            </p>
          </div>

          {/* Action Hint */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              💡 <span className="font-semibold">Next Step:</span> Go to the Channels tab and open a channel with{' '}
              <span className="font-bold text-green-600 dark:text-green-400">
                {prediction.summary.recommendedBudget}
              </span>{' '}
              budget using the{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {prediction.summary.agentName}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
