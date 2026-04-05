/**
 * SettlementPanel.tsx
 *
 * UI for settling a Pulsar payment channel on-chain.
 * - Shows: final cost, refund amount, tx hash + Stellar explorer link
 * - Single on-chain transaction closes the channel
 *
 * Context: See frontend/CONTEXT.md
 */

import { useState } from 'react'

interface SettlementResult {
  txHash: string
  amountPaidUsdc: number
  refundUsdc: number
  explorerUrl: string
}

interface SettlementPanelProps {
  channelId: string | null
  totalCostUsdc: number
  remainingBudgetUsdc: number
  taskComplete: boolean
}

export function SettlementPanel({
  channelId,
  totalCostUsdc,
  remainingBudgetUsdc,
  taskComplete,
}: SettlementPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settlement, setSettlement] = useState<SettlementResult | null>(null)

  async function handleSettle() {
    if (!channelId) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/channels/${channelId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Settlement failed')
      }

      setSettlement(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <span className="text-lg">🔒</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Settle Channel</h2>
          <p className="text-sm text-gray-500">1 on-chain transaction closes the channel</p>
        </div>
      </div>

      {!settlement ? (
        <div className="space-y-4">
          {/* Pre-settlement summary */}
          {taskComplete && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount to pay</span>
                <span className="font-semibold text-gray-900">
                  {totalCostUsdc.toFixed(4)} USDC
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Your refund</span>
                <span className="font-semibold text-green-600">
                  {remainingBudgetUsdc.toFixed(4)} USDC
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-xs text-gray-400">
                <span>Settled via 1 Soroban tx</span>
                <span>Stellar Testnet</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Settle button */}
          <button
            onClick={handleSettle}
            disabled={loading || !channelId || !taskComplete}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span> Settling on Stellar...
              </span>
            ) : (
              'Settle Channel'
            )}
          </button>

          {!taskComplete && (
            <p className="text-xs text-center text-gray-400">
              Run an agent task first to enable settlement
            </p>
          )}
        </div>
      ) : (
        /* Settlement complete */
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Settled
            </span>
            <span className="text-sm text-gray-500">Channel closed on Stellar Testnet</span>
          </div>

          {/* Settlement details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount paid</span>
              <span className="font-semibold text-gray-900">
                {settlement.amountPaidUsdc.toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Refund received</span>
              <span className="font-semibold text-green-600">
                {settlement.refundUsdc.toFixed(4)} USDC
              </span>
            </div>
          </div>

          {/* Transaction hash */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Settlement Transaction
            </p>
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs font-mono text-green-400 break-all">
                {settlement.txHash}
              </p>
            </div>
          </div>

          {/* Explorer link */}
          <a
            href={settlement.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-stellar-500 text-stellar-600 hover:bg-stellar-50 font-medium rounded-lg transition-colors text-sm"
          >
            <span>View on Stellar Explorer</span>
            <span>↗</span>
          </a>

          {/* Pulsar summary */}
          <div className="bg-stellar-50 rounded-xl p-4 text-center">
            <p className="text-xs text-stellar-700 font-medium">
              ⚡ Pulsar: {settlement.amountPaidUsdc > 0
                ? `${Math.round(settlement.amountPaidUsdc / 0.05)} off-chain commitments → 1 on-chain tx`
                : '0 commitments → 1 on-chain tx (full refund)'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
