/**
 * reputation.ts
 * 
 * Agent Reputation System - Track agent performance and build trust
 * 
 * Features:
 * - On-chain reputation tracking via Soroban events
 * - Success rate calculation
 * - Total earnings tracking
 * - Verifiable reputation scores
 * - Badge system (Bronze, Silver, Gold, Platinum)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface AgentReputation {
  agentId: string
  totalTasks: number
  successfulTasks: number
  failedTasks: number
  totalEarned: number // USDC
  averageTaskCost: number // USDC
  successRate: number // 0-100
  badge: 'bronze' | 'silver' | 'gold' | 'platinum' | 'none'
  onChainProofs: string[] // TX hashes
  lastUpdated: Date
  createdAt: Date
}

interface ReputationStore {
  reputations: Record<string, AgentReputation>
}

const REPUTATION_FILE = join(process.cwd(), 'agent-reputations.json')

// Badge thresholds
const BADGE_THRESHOLDS = {
  bronze: { tasks: 5, successRate: 70 },
  silver: { tasks: 20, successRate: 80 },
  gold: { tasks: 50, successRate: 90 },
  platinum: { tasks: 100, successRate: 95 },
}

/**
 * Load reputations from file
 */
function loadReputations(): ReputationStore {
  if (!existsSync(REPUTATION_FILE)) {
    return { reputations: {} }
  }
  
  try {
    const data = readFileSync(REPUTATION_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('[Reputation] Failed to load reputations:', err)
    return { reputations: {} }
  }
}

/**
 * Save reputations to file
 */
function saveReputations(store: ReputationStore): void {
  try {
    writeFileSync(REPUTATION_FILE, JSON.stringify(store, null, 2))
  } catch (err) {
    console.error('[Reputation] Failed to save reputations:', err)
  }
}

/**
 * Calculate badge based on performance
 */
function calculateBadge(totalTasks: number, successRate: number): AgentReputation['badge'] {
  if (totalTasks >= BADGE_THRESHOLDS.platinum.tasks && successRate >= BADGE_THRESHOLDS.platinum.successRate) {
    return 'platinum'
  }
  if (totalTasks >= BADGE_THRESHOLDS.gold.tasks && successRate >= BADGE_THRESHOLDS.gold.successRate) {
    return 'gold'
  }
  if (totalTasks >= BADGE_THRESHOLDS.silver.tasks && successRate >= BADGE_THRESHOLDS.silver.successRate) {
    return 'silver'
  }
  if (totalTasks >= BADGE_THRESHOLDS.bronze.tasks && successRate >= BADGE_THRESHOLDS.bronze.successRate) {
    return 'bronze'
  }
  return 'none'
}

/**
 * Get or create agent reputation
 */
export function getAgentReputation(agentId: string): AgentReputation {
  const store = loadReputations()
  
  if (store.reputations[agentId]) {
    return store.reputations[agentId]
  }
  
  // Create new reputation
  const newReputation: AgentReputation = {
    agentId,
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    totalEarned: 0,
    averageTaskCost: 0,
    successRate: 0,
    badge: 'none',
    onChainProofs: [],
    lastUpdated: new Date(),
    createdAt: new Date(),
  }
  
  store.reputations[agentId] = newReputation
  saveReputations(store)
  
  return newReputation
}

/**
 * Update agent reputation after task completion
 */
export function updateAgentReputation(params: {
  agentId: string
  success: boolean
  amountEarned: number
  txHash?: string
}): AgentReputation {
  const { agentId, success, amountEarned, txHash } = params
  const store = loadReputations()
  
  let reputation = store.reputations[agentId] || getAgentReputation(agentId)
  
  // Update stats
  reputation.totalTasks++
  if (success) {
    reputation.successfulTasks++
    reputation.totalEarned += amountEarned
  } else {
    reputation.failedTasks++
  }
  
  // Calculate success rate
  reputation.successRate = (reputation.successfulTasks / reputation.totalTasks) * 100
  
  // Calculate average task cost
  if (reputation.successfulTasks > 0) {
    reputation.averageTaskCost = reputation.totalEarned / reputation.successfulTasks
  }
  
  // Update badge
  reputation.badge = calculateBadge(reputation.totalTasks, reputation.successRate)
  
  // Add on-chain proof
  if (txHash) {
    reputation.onChainProofs.push(txHash)
    // Keep only last 10 proofs
    if (reputation.onChainProofs.length > 10) {
      reputation.onChainProofs = reputation.onChainProofs.slice(-10)
    }
  }
  
  reputation.lastUpdated = new Date()
  
  // Save
  store.reputations[agentId] = reputation
  saveReputations(store)
  
  console.log(`[Reputation] Updated ${agentId}: ${reputation.successRate.toFixed(1)}% success, ${reputation.badge} badge`)
  
  return reputation
}

/**
 * Get all agent reputations
 */
export function getAllReputations(): AgentReputation[] {
  const store = loadReputations()
  return Object.values(store.reputations)
}

/**
 * Get top agents by success rate
 */
export function getTopAgents(limit: number = 10): AgentReputation[] {
  const all = getAllReputations()
  return all
    .filter(r => r.totalTasks >= 5) // Minimum 5 tasks
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, limit)
}

/**
 * Get badge emoji
 */
export function getBadgeEmoji(badge: AgentReputation['badge']): string {
  const emojis = {
    platinum: '💎',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
    none: '⭐',
  }
  return emojis[badge]
}

/**
 * Get badge color
 */
export function getBadgeColor(badge: AgentReputation['badge']): string {
  const colors = {
    platinum: '#E5E4E2',
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    none: '#9CA3AF',
  }
  return colors[badge]
}

/**
 * Get reputation summary for display
 */
export function getReputationSummary(agentId: string): {
  badge: string
  badgeEmoji: string
  badgeColor: string
  successRate: string
  totalTasks: number
  totalEarned: string
  averageCost: string
  hasProof: boolean
} {
  const rep = getAgentReputation(agentId)
  
  return {
    badge: rep.badge,
    badgeEmoji: getBadgeEmoji(rep.badge),
    badgeColor: getBadgeColor(rep.badge),
    successRate: rep.successRate.toFixed(1) + '%',
    totalTasks: rep.totalTasks,
    totalEarned: rep.totalEarned.toFixed(2) + ' USDC',
    averageCost: rep.averageTaskCost.toFixed(4) + ' USDC',
    hasProof: rep.onChainProofs.length > 0,
  }
}
