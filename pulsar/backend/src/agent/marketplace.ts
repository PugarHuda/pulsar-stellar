/**
 * agent/marketplace.ts
 * 
 * Agent marketplace with multiple agent types and pricing.
 */

export interface AgentType {
  id: string
  name: string
  description: string
  baseRate: number // USDC per step
  tools: string[]
  category: 'research' | 'coding' | 'analysis' | 'general'
}

export const AGENT_MARKETPLACE: Record<string, AgentType> = {
  researcher: {
    id: 'researcher',
    name: 'Research Agent',
    description: 'Specialized in web search, data fetching, and information gathering',
    baseRate: 0.05,
    tools: ['web_search', 'data_fetch', 'reasoning'],
    category: 'research',
  },
  coder: {
    id: 'coder',
    name: 'Coding Agent',
    description: 'Expert in code generation, debugging, and technical problem solving',
    baseRate: 0.08,
    tools: ['code_exec', 'llm_call', 'reasoning', 'data_fetch'],
    category: 'coding',
  },
  analyst: {
    id: 'analyst',
    name: 'Data Analyst',
    description: 'Analyzes data, generates insights, and creates visualizations',
    baseRate: 0.06,
    tools: ['reasoning', 'data_fetch', 'web_search'],
    category: 'analysis',
  },
  general: {
    id: 'general',
    name: 'General Agent',
    description: 'Multi-purpose agent for various tasks',
    baseRate: 0.04,
    tools: ['reasoning', 'llm_call', 'data_fetch'],
    category: 'general',
  },
}

/**
 * Get agent type by ID.
 */
export function getAgentType(agentId: string): AgentType | null {
  return AGENT_MARKETPLACE[agentId] || null
}

/**
 * List all available agent types.
 */
export function listAgentTypes(): AgentType[] {
  return Object.values(AGENT_MARKETPLACE)
}

/**
 * Calculate cost for a specific agent type and number of steps.
 */
export function calculateAgentCost(agentId: string, steps: number): number {
  const agent = getAgentType(agentId)
  if (!agent) return 0
  return agent.baseRate * steps
}

/**
 * Get recommended agent for a task description.
 */
export function recommendAgent(taskDescription: string): AgentType {
  const lower = taskDescription.toLowerCase()
  
  if (lower.includes('code') || lower.includes('debug') || lower.includes('program')) {
    return AGENT_MARKETPLACE.coder
  }
  
  if (lower.includes('research') || lower.includes('search') || lower.includes('find')) {
    return AGENT_MARKETPLACE.researcher
  }
  
  if (lower.includes('analyze') || lower.includes('data') || lower.includes('insight')) {
    return AGENT_MARKETPLACE.analyst
  }
  
  return AGENT_MARKETPLACE.general
}
