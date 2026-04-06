/**
 * cost-prediction.ts
 * 
 * AI-Powered Cost Prediction - Predict task cost before opening channel
 * 
 * Features:
 * - Analyze task complexity using LLM
 * - Estimate number of steps needed
 * - Recommend optimal agent type
 * - Suggest budget amount
 * - Provide confidence score
 */

import { callLLM, isLLMAvailable } from './llm.js'
import { getAgentType, listAgentTypes } from './marketplace.js'

export interface CostPrediction {
  estimatedSteps: number
  estimatedCost: number // USDC
  recommendedAgent: string
  recommendedAgentName: string
  recommendedBudget: number // USDC (with 20% buffer)
  confidence: number // 0-100
  reasoning: string
  breakdown: {
    llmCalls: number
    webSearches: number
    codeExecutions: number
    dataFetches: number
  }
}

/**
 * Analyze task complexity and predict cost
 */
export async function predictTaskCost(taskDescription: string): Promise<CostPrediction> {
  console.log('[CostPrediction] Analyzing task:', taskDescription.slice(0, 100))
  
  // Use LLM to analyze task if available
  if (isLLMAvailable()) {
    return await predictWithLLM(taskDescription)
  }
  
  // Fallback to heuristic-based prediction
  return predictWithHeuristics(taskDescription)
}

/**
 * Predict using LLM analysis
 */
async function predictWithLLM(taskDescription: string): Promise<CostPrediction> {
  const prompt = `Analyze this AI agent task and predict its complexity:

Task: "${taskDescription}"

Provide a JSON response with:
1. estimatedSteps: Total number of steps (5-50)
2. breakdown: How many of each tool type:
   - llmCalls: LLM reasoning steps
   - webSearches: Web search operations
   - codeExecutions: Code execution steps
   - dataFetches: API data fetches
3. recommendedAgent: Which agent type is best (research, code, data, or general)
4. confidence: Your confidence level (0-100)
5. reasoning: Brief explanation

Available agent types:
- research: Best for web search and information gathering (0.06 USDC/step)
- code: Best for programming and debugging (0.05 USDC/step)
- data: Best for data analysis and insights (0.07 USDC/step)
- general: Multi-purpose for various tasks (0.04 USDC/step)

Cost per tool:
- LLM call: 0.05 USDC
- Web search: 0.02 USDC
- Code execution: 0.03 USDC
- Data fetch: 0.02 USDC

Respond ONLY with valid JSON, no markdown.`

  try {
    const response = await callLLM(prompt)
    const analysis = JSON.parse(response)
    
    // Calculate cost based on breakdown
    const breakdown = analysis.breakdown
    const baseCost = 
      (breakdown.llmCalls * 0.05) +
      (breakdown.webSearches * 0.02) +
      (breakdown.codeExecutions * 0.03) +
      (breakdown.dataFetches * 0.02)
    
    // Get agent multiplier
    const agent = getAgentType(analysis.recommendedAgent)
    const agentMultiplier = agent ? agent.baseRate / 0.04 : 1.0
    const estimatedCost = baseCost * agentMultiplier
    
    // Add 20% buffer for budget
    const recommendedBudget = estimatedCost * 1.2
    
    return {
      estimatedSteps: analysis.estimatedSteps,
      estimatedCost: parseFloat(estimatedCost.toFixed(4)),
      recommendedAgent: analysis.recommendedAgent,
      recommendedAgentName: agent?.name || 'General Agent',
      recommendedBudget: parseFloat(recommendedBudget.toFixed(4)),
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      breakdown: breakdown,
    }
  } catch (err) {
    console.error('[CostPrediction] LLM analysis failed:', err)
    return predictWithHeuristics(taskDescription)
  }
}

/**
 * Predict using heuristic rules
 */
function predictWithHeuristics(taskDescription: string): CostPrediction {
  const lower = taskDescription.toLowerCase()
  const words = taskDescription.split(/\s+/).length
  
  // Determine agent type
  let recommendedAgent = 'general'
  if (lower.includes('search') || lower.includes('research') || lower.includes('find')) {
    recommendedAgent = 'research'
  } else if (lower.includes('code') || lower.includes('program') || lower.includes('debug')) {
    recommendedAgent = 'code'
  } else if (lower.includes('analyze') || lower.includes('data') || lower.includes('insight')) {
    recommendedAgent = 'data'
  }
  
  const agent = getAgentType(recommendedAgent)
  const agentMultiplier = agent ? agent.baseRate / 0.04 : 1.0
  
  // Estimate steps based on task complexity
  let estimatedSteps = 10 // Base
  if (words > 50) estimatedSteps += 10 // Complex task
  if (words > 100) estimatedSteps += 10 // Very complex
  if (lower.includes('step by step')) estimatedSteps += 5
  if (lower.includes('detailed')) estimatedSteps += 5
  if (lower.includes('comprehensive')) estimatedSteps += 10
  
  // Estimate breakdown
  const breakdown = {
    llmCalls: Math.ceil(estimatedSteps * 0.4), // 40% LLM
    webSearches: recommendedAgent === 'research' ? Math.ceil(estimatedSteps * 0.3) : Math.ceil(estimatedSteps * 0.1),
    codeExecutions: recommendedAgent === 'code' ? Math.ceil(estimatedSteps * 0.3) : Math.ceil(estimatedSteps * 0.1),
    dataFetches: recommendedAgent === 'data' ? Math.ceil(estimatedSteps * 0.3) : Math.ceil(estimatedSteps * 0.1),
  }
  
  // Calculate cost
  const baseCost = 
    (breakdown.llmCalls * 0.05) +
    (breakdown.webSearches * 0.02) +
    (breakdown.codeExecutions * 0.03) +
    (breakdown.dataFetches * 0.02)
  
  const estimatedCost = baseCost * agentMultiplier
  const recommendedBudget = estimatedCost * 1.2
  
  // Confidence based on task clarity
  let confidence = 70 // Base confidence
  if (words < 10) confidence -= 20 // Too vague
  if (words > 20 && words < 100) confidence += 10 // Good detail
  if (lower.includes('specific') || lower.includes('exactly')) confidence += 10
  
  const reasoning = `Based on task complexity (${words} words), recommended ${agent?.name || 'General Agent'} with ~${estimatedSteps} steps. Task appears to need ${breakdown.llmCalls} LLM calls, ${breakdown.webSearches} searches, ${breakdown.codeExecutions} code executions, and ${breakdown.dataFetches} data fetches.`
  
  return {
    estimatedSteps,
    estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    recommendedAgent,
    recommendedAgentName: agent?.name || 'General Agent',
    recommendedBudget: parseFloat(recommendedBudget.toFixed(4)),
    confidence: Math.min(100, Math.max(0, confidence)),
    reasoning,
    breakdown,
  }
}

/**
 * Get cost prediction summary for display
 */
export function getCostPredictionSummary(prediction: CostPrediction): {
  estimatedCost: string
  recommendedBudget: string
  confidence: string
  confidenceColor: string
  agentName: string
  steps: number
} {
  // Confidence color
  let confidenceColor = '#10B981' // green
  if (prediction.confidence < 50) confidenceColor = '#EF4444' // red
  else if (prediction.confidence < 70) confidenceColor = '#F59E0B' // yellow
  
  return {
    estimatedCost: prediction.estimatedCost.toFixed(4) + ' USDC',
    recommendedBudget: prediction.recommendedBudget.toFixed(4) + ' USDC',
    confidence: prediction.confidence.toFixed(0) + '%',
    confidenceColor,
    agentName: prediction.recommendedAgentName,
    steps: prediction.estimatedSteps,
  }
}
