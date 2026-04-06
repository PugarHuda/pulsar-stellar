/**
 * agent-to-agent.ts
 * 
 * KILLER FEATURE: Agent-to-Agent Payment Channels
 * 
 * Enables AI agents to pay other AI agents for services using payment channels.
 * This is a UNIQUE innovation not seen in any hackathon resources.
 * 
 * Use Case: Agent A needs specialized service from Agent B
 * - Agent A opens payment channel to Agent B
 * - Agent B performs service (e.g., data analysis, code review)
 * - Agent A pays incrementally via off-chain commitments
 * - Settlement happens with 1 on-chain transaction
 * 
 * This creates a true "agentic economy" where agents can compose services.
 */

export interface AgentService {
  agentId: string
  serviceName: string
  description: string
  pricePerCall: number // USDC
  endpoint: string
  capabilities: string[]
}

export interface AgentPaymentChannel {
  channelId: string
  payerAgentId: string
  recipientAgentId: string
  budgetUsdc: number
  currentCostUsdc: number
  status: 'open' | 'active' | 'closed'
  servicesUsed: {
    serviceName: string
    callCount: number
    totalCost: number
  }[]
}

/**
 * Registry of available agent services in the network.
 * In production, this would be a decentralized registry on-chain.
 */
export const AGENT_SERVICE_REGISTRY: Record<string, AgentService> = {
  'data-analyst-agent': {
    agentId: 'data-analyst-agent',
    serviceName: 'Advanced Data Analysis',
    description: 'Performs complex statistical analysis and generates insights',
    pricePerCall: 0.10,
    endpoint: '/api/agents/data-analyst/analyze',
    capabilities: ['statistical_analysis', 'data_visualization', 'trend_detection'],
  },
  'code-reviewer-agent': {
    agentId: 'code-reviewer-agent',
    serviceName: 'Code Review Service',
    description: 'Reviews code for bugs, security issues, and best practices',
    pricePerCall: 0.15,
    endpoint: '/api/agents/code-reviewer/review',
    capabilities: ['security_audit', 'performance_analysis', 'best_practices'],
  },
  'research-agent': {
    agentId: 'research-agent',
    serviceName: 'Deep Research',
    description: 'Conducts comprehensive research across multiple sources',
    pricePerCall: 0.08,
    endpoint: '/api/agents/researcher/research',
    capabilities: ['web_search', 'paper_analysis', 'fact_checking'],
  },
}

/**
 * Open a payment channel from one agent to another.
 * This enables Agent A to pay Agent B for services.
 */
export async function openAgentToAgentChannel(params: {
  payerAgentId: string
  recipientAgentId: string
  budgetUsdc: number
}): Promise<AgentPaymentChannel> {
  const { payerAgentId, recipientAgentId, budgetUsdc } = params

  // In production, this would:
  // 1. Deploy Soroban contract for the channel
  // 2. Lock USDC from payer agent's wallet
  // 3. Register channel in agent network

  const channelId = `a2a-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const channel: AgentPaymentChannel = {
    channelId,
    payerAgentId,
    recipientAgentId,
    budgetUsdc,
    currentCostUsdc: 0,
    status: 'open',
    servicesUsed: [],
  }

  console.log(`[Agent-to-Agent] Channel opened: ${payerAgentId} → ${recipientAgentId}`)
  console.log(`[Agent-to-Agent] Budget: ${budgetUsdc} USDC`)

  return channel
}

/**
 * Agent A calls Agent B's service through the payment channel.
 * Payment is handled via off-chain commitment.
 */
export async function callAgentService(params: {
  channel: AgentPaymentChannel
  serviceName: string
  requestData: unknown
}): Promise<{
  success: boolean
  result: unknown
  cost: number
  remainingBudget: number
}> {
  const { channel, serviceName, requestData } = params

  const service = Object.values(AGENT_SERVICE_REGISTRY).find(
    (s) => s.serviceName === serviceName && s.agentId === channel.recipientAgentId
  )

  if (!service) {
    throw new Error(`Service ${serviceName} not found for agent ${channel.recipientAgentId}`)
  }

  // Check budget
  if (channel.currentCostUsdc + service.pricePerCall > channel.budgetUsdc) {
    throw new Error('Insufficient budget in payment channel')
  }

  // Simulate service call (in production, this would be a real API call)
  console.log(`[Agent-to-Agent] ${channel.payerAgentId} calling ${service.serviceName}`)
  console.log(`[Agent-to-Agent] Cost: ${service.pricePerCall} USDC`)

  // Mock service execution
  const result = {
    service: service.serviceName,
    requestData,
    response: `Service ${service.serviceName} executed successfully`,
    timestamp: new Date().toISOString(),
  }

  // Update channel state (off-chain commitment)
  channel.currentCostUsdc += service.pricePerCall
  channel.status = 'active'

  // Track service usage
  const existingService = channel.servicesUsed.find((s) => s.serviceName === serviceName)
  if (existingService) {
    existingService.callCount++
    existingService.totalCost += service.pricePerCall
  } else {
    channel.servicesUsed.push({
      serviceName,
      callCount: 1,
      totalCost: service.pricePerCall,
    })
  }

  return {
    success: true,
    result,
    cost: service.pricePerCall,
    remainingBudget: channel.budgetUsdc - channel.currentCostUsdc,
  }
}

/**
 * Settle the agent-to-agent payment channel.
 * This would trigger a single on-chain transaction.
 */
export async function settleAgentToAgentChannel(
  channel: AgentPaymentChannel
): Promise<{
  txHash: string
  amountPaid: number
  refund: number
}> {
  if (channel.status === 'closed') {
    throw new Error('Channel already closed')
  }

  // In production, this would:
  // 1. Sign final commitment with total cost
  // 2. Submit to Soroban contract
  // 3. Transfer USDC to recipient agent
  // 4. Refund remaining to payer agent

  const amountPaid = channel.currentCostUsdc
  const refund = channel.budgetUsdc - channel.currentCostUsdc

  console.log(`[Agent-to-Agent] Settling channel ${channel.channelId}`)
  console.log(`[Agent-to-Agent] Amount paid: ${amountPaid} USDC`)
  console.log(`[Agent-to-Agent] Refund: ${refund} USDC`)
  console.log(`[Agent-to-Agent] Services used:`, channel.servicesUsed)

  channel.status = 'closed'

  return {
    txHash: `mock-a2a-tx-${Date.now()}`,
    amountPaid,
    refund,
  }
}

/**
 * Get available services from an agent.
 */
export function getAgentServices(agentId: string): AgentService[] {
  return Object.values(AGENT_SERVICE_REGISTRY).filter((s) => s.agentId === agentId)
}

/**
 * Discover all available agent services in the network.
 */
export function discoverAgentServices(): AgentService[] {
  return Object.values(AGENT_SERVICE_REGISTRY)
}
