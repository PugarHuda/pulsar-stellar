/**
 * WalletConnect.tsx
 * 
 * Freighter wallet integration using official @stellar/freighter-api
 * Supports SEP-10 challenge-response authentication
 * Falls back to demo mode if Freighter is not installed
 */

import { useState, useEffect } from 'react'
import { isConnected, requestAccess, getAddress } from '@stellar/freighter-api'

interface WalletConnectProps {
  onConnect: (publicKey: string, token: string) => void
  onDisconnect: () => void
}

export function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDemoInput, setShowDemoInput] = useState(false)
  const [demoPublicKey, setDemoPublicKey] = useState('')
  const [freighterAvailable, setFreighterAvailable] = useState(false)

  // Check if Freighter is installed on mount
  useEffect(() => {
    checkFreighterInstalled()
  }, [])

  async function checkFreighterInstalled() {
    try {
      const result = await isConnected()
      setFreighterAvailable(result.isConnected)
    } catch (err) {
      setFreighterAvailable(false)
    }
  }

  // Check if already connected on mount
  useEffect(() => {
    const storedPublicKey = localStorage.getItem('pulsar_wallet_public_key')
    const storedToken = localStorage.getItem('pulsar_wallet_token')
    
    if (storedPublicKey && storedToken) {
      setPublicKey(storedPublicKey)
      setConnected(true)
      onConnect(storedPublicKey, storedToken)
    }
  }, [onConnect])

  async function connectWallet() {
    setLoading(true)
    setError(null)

    try {
      // Check if Freighter is installed
      const connectionCheck = await isConnected()
      if (!connectionCheck.isConnected) {
        setError('Freighter wallet not installed')
        setShowDemoInput(true)
        setLoading(false)
        return
      }

      // Request access to user's public key
      const accessResult = await requestAccess()
      
      if (accessResult.error) {
        throw new Error(accessResult.error)
      }

      const userPublicKey = accessResult.address
      
      if (!userPublicKey) {
        throw new Error('Failed to get public key from Freighter')
      }
      
      // Get SEP-10 challenge from backend
      const challengeRes = await fetch(`/api/auth/sep10/challenge?account=${userPublicKey}`)
      if (!challengeRes.ok) {
        throw new Error('Failed to get authentication challenge')
      }
      
      const { transaction: challengeXdr } = await challengeRes.json()
      
      // Sign challenge with Freighter
      const { signTransaction } = await import('@stellar/freighter-api')
      const signResult = await signTransaction(challengeXdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
        address: userPublicKey
      })
      
      if (signResult.error) {
        throw new Error(signResult.error)
      }

      const signedTxXdr = signResult.signedTxXdr
      
      // Submit signed challenge to get JWT token
      const tokenRes = await fetch('/api/auth/sep10/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: signedTxXdr }),
      })
      
      if (!tokenRes.ok) {
        throw new Error('Authentication failed')
      }
      
      const { token } = await tokenRes.json()
      
      // Store credentials
      localStorage.setItem('pulsar_wallet_public_key', userPublicKey)
      localStorage.setItem('pulsar_wallet_token', token)
      
      setPublicKey(userPublicKey)
      setConnected(true)
      onConnect(userPublicKey, token)
    } catch (err) {
      console.error('Wallet connection failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }

  async function connectDemoMode() {
    if (!demoPublicKey.match(/^G[A-Z2-7]{55}$/)) {
      setError('Invalid Stellar public key format')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Use simple login endpoint for demo mode
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: demoPublicKey }),
      })
      
      if (!res.ok) {
        throw new Error('Demo login failed')
      }
      
      const { token } = await res.json()
      
      // Store credentials
      localStorage.setItem('pulsar_wallet_public_key', demoPublicKey)
      localStorage.setItem('pulsar_wallet_token', token)
      
      setPublicKey(demoPublicKey)
      setConnected(true)
      setShowDemoInput(false)
      onConnect(demoPublicKey, token)
    } catch (err) {
      console.error('Demo login failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  function disconnectWallet() {
    localStorage.removeItem('pulsar_wallet_public_key')
    localStorage.removeItem('pulsar_wallet_token')
    setPublicKey(null)
    setConnected(false)
    setShowDemoInput(false)
    setDemoPublicKey('')
    onDisconnect()
  }

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/80 text-sm font-mono">
            {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
          </span>
        </div>
        <button
          onClick={disconnectWallet}
          className="text-white/60 hover:text-white text-xs transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  if (showDemoInput) {
    return (
      <div className="flex flex-col gap-2 min-w-[300px]">
        <div className="flex gap-2">
          <input
            type="text"
            value={demoPublicKey}
            onChange={(e) => setDemoPublicKey(e.target.value)}
            placeholder="G... (Stellar public key)"
            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-white/40"
          />
          <button
            onClick={connectDemoMode}
            disabled={loading}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 rounded-lg text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Connect'}
          </button>
        </div>
        
        {error && (
          <p className="text-red-300 text-xs">{error}</p>
        )}
        
        <button
          onClick={() => setShowDemoInput(false)}
          className="text-white/60 hover:text-white text-xs transition-colors text-left"
        >
          ← Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={connectWallet}
          disabled={loading}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
        >
          {loading ? 'Connecting...' : freighterAvailable ? 'Connect Freighter' : 'Connect Wallet'}
        </button>
        
        <button
          onClick={() => setShowDemoInput(true)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg border border-white/20 text-white/70 text-sm font-medium transition-colors"
          title="Connect with public key (demo mode)"
        >
          Demo Mode
        </button>
      </div>
      
      {error && !showDemoInput && (
        <p className="text-red-300 text-xs">{error}</p>
      )}
      
      {!freighterAvailable && !error && (
        <a
          href="https://freighter.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 hover:text-white text-xs underline transition-colors"
        >
          Install Freighter Extension
        </a>
      )}
    </div>
  )
}
