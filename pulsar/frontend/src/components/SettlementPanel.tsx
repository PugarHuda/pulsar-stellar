/**
 * SettlementPanel.tsx
 *
 * UI for settling a Pulsar payment channel on-chain.
 * - Shows: final cost, refund amount, tx hash + Stellar explorer link
 * - Breakdown: "Server earned: X USDC | You get back: Y USDC"
 * - Copy TX Hash button
 * - Settlement timeline/receipt
 * - Success animation CSS class on settlement
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
  const [copiedTxHash, setCopiedTxHash] = useState(false)

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

  async function handleCopyTxHash() {
    if (!settlement) return
    await navigator.clipboard.writeText(settlement.txHash)
    setCopiedTxHash(true)
    setTimeout(() => setCopiedTxHash(false), 2000)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-lg border p-6 transition-all duration-500 ${
      settlement ? 'border-green-300 shadow-green-100' : 'border-gray-100'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          settlement ? 'bg-green-100' : 'bg-green-100'
        }`}>
          <span className="text-lg">{settlement ? '✅' : '🔒'}</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Settle Channel</h2>
          <p className="text-sm text-gray-500">1 on-chain transaction closes the channel</p>
        </div>
      </div>

      {!settlement ? (
        <div className="space-y-4">
          {/* Pre-settlement breakdown */}
          {taskComplete && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Settlement Preview
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Server earned</span>
                <span className="font-semibold text-gray-900">
                  {totalCostUsdc.toFixed(4)} USDC
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">You get back</span>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleSettle}
            disabled={loading || !channelId || !taskComplete}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Settling on Stellar...
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
        /* Settlement complete — receipt view */
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Settled
            </span>
            <span className="text-sm text-gray-500">Channel closed on Stellar Testnet</span>
          </div>

          {/* Receipt timeline */}
          <div className="relative pl-4 space-y-3">
            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-green-200" />

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-[13px] w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
              <div>
                <p className="text-xs font-medium text-gray-700">Channel opened</p>
                <p className="text-xs text-gray-400">Budget locked in Soroban contract</p>
              </div>
            </div>

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-[13px] w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
              <div>
                <p className="text-xs font-medium text-gray-700">Agent task completed</p>
                <p className="text-xs text-gray-400">
                  {Math.round(settlement.amountPaidUsdc / 0.05)} off-chain commitments signed
                </p>
              </div>
            </div>

            <div className="relative flex items-start gap-3">
              <div className="absolute -left-[13px] w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
              <div>
                <p className="text-xs font-medium text-gray-700">Settlement confirmed</p>
                <p className="text-xs text-gray-400">1 on-chain transaction</p>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Server earned</span>
              <span className="font-semibold text-gray-900">
                {settlement.amountPaidUsdc.toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">You get back</span>
              <span className="font-semibold text-green-600">
                {settlement.refundUsdc.toFixed(4)} USDC
              </span>
            </div>
          </div>

          {/* TX Hash with copy */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Settlement Transaction
              </p>
              <button
                onClick={handleCopyTxHash}
                className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                {copiedTxHash ? '✓ Copied' : 'Copy TX Hash'}
              </button>
            </div>
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
