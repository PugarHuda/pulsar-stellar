/**
 * ChannelPanel.tsx
 *
 * UI for opening a Pulsar payment channel.
 * - Input: budget amount (USDC) + user public key
 * - Output: channel ID, contract address, status badge
 *
 * Context: See frontend/CONTEXT.md
 */

import { useState } from 'react'

interface ChannelInfo {
  channelId: string
  contractAddress: string
  budgetUsdc: number
  status: string
}

interface ChannelPanelProps {
  onChannelOpened: (channelId: string, budgetUsdc: number) => void
}

export function ChannelPanel({ onChannelOpened }: ChannelPanelProps) {
  const [budgetUsdc, setBudgetUsdc] = useState<string>('10')
  const [userPublicKey, setUserPublicKey] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<ChannelInfo | null>(null)

  async function handleOpenChannel() {
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetUsdc: parseFloat(budgetUsdc),
          userPublicKey,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to open channel')
      }

      setChannel(data)
      onChannelOpened(data.channelId, data.budgetUsdc)
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
        <div className="w-10 h-10 rounded-full bg-stellar-100 flex items-center justify-center">
          <span className="text-stellar-600 text-lg">⚡</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Open Payment Channel</h2>
          <p className="text-sm text-gray-500">Deposit USDC to fund your agent task</p>
        </div>
      </div>

      {!channel ? (
        <div className="space-y-4">
          {/* Budget input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={budgetUsdc}
                onChange={(e) => setBudgetUsdc(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stellar-500 focus:border-transparent outline-none text-gray-900"
                placeholder="10.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                USDC
              </span>
            </div>
          </div>

          {/* User public key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Stellar Public Key (G...)
            </label>
            <input
              type="text"
              value={userPublicKey}
              onChange={(e) => setUserPublicKey(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stellar-500 focus:border-transparent outline-none text-gray-900 font-mono text-sm"
              placeholder="GABC...XYZ"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Open button */}
          <button
            onClick={handleOpenChannel}
            disabled={loading || !budgetUsdc || !userPublicKey}
            className="w-full py-3 px-4 bg-stellar-600 hover:bg-stellar-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span> Opening Channel...
              </span>
            ) : (
              'Open Channel'
            )}
          </button>
        </div>
      ) : (
        /* Channel opened — show info */
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ● {channel.status}
            </span>
            <span className="text-sm text-gray-500">Channel active</span>
          </div>

          <InfoRow label="Channel ID" value={channel.channelId} mono />
          <InfoRow label="Contract" value={channel.contractAddress} mono truncate />
          <InfoRow label="Budget" value={`${channel.budgetUsdc} USDC`} />
        </div>
      )}
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono = false,
  truncate = false,
}: {
  label: string
  value: string
  mono?: boolean
  truncate?: boolean
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-sm text-gray-900 text-right ${mono ? 'font-mono' : ''} ${truncate ? 'truncate max-w-[200px]' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
