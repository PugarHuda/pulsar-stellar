/**
 * agent/llm.ts
 *
 * Claude API integration for Pulsar AI agent.
 *
 * Uses Anthropic claude-3-haiku-20240307 (cheapest model) for real LLM calls.
 * Falls back to mock behavior gracefully if ANTHROPIC_API_KEY is not set.
 *
 * Context: See backend/CONTEXT.md
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicRequest {
  model: string
  max_tokens: number
  messages: AnthropicMessage[]
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>
  usage?: { input_tokens: number; output_tokens: number }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CLAUDE_MODEL = 'claude-3-haiku-20240307'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_API_VERSION = '2023-06-01'

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Call Claude API with a prompt and return the text response.
 *
 * If ANTHROPIC_API_KEY is not set, returns a mock response gracefully.
 * Keeps max_tokens low (256) to minimize cost per call.
 */
export async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    // Graceful fallback — no API key configured
    return generateMockLlmResponse(prompt)
  }

  try {
    const body: AnthropicRequest = {
      model: CLAUDE_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[Pulsar] Claude API error ${res.status}: ${errText}`)
      return generateMockLlmResponse(prompt)
    }

    const data = (await res.json()) as AnthropicResponse
    const text = data.content?.[0]?.text ?? ''

    if (!text) {
      return generateMockLlmResponse(prompt)
    }

    return text
  } catch (err) {
    console.warn(`[Pulsar] Claude API call failed: ${err instanceof Error ? err.message : String(err)}`)
    return generateMockLlmResponse(prompt)
  }
}

/**
 * Check if Claude API is available (API key is set).
 */
export function isClaudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

/**
 * Generate a realistic mock LLM response when API key is not available.
 * Uses the prompt content to make the response contextually relevant.
 */
function generateMockLlmResponse(prompt: string): string {
  const taskSnippet = prompt.slice(0, 60).replace(/\n/g, ' ')
  return (
    `Based on the analysis of "${taskSnippet}...", I have identified key patterns ` +
    `and synthesized the relevant information. The findings suggest a structured ` +
    `approach would be most effective for this task. Key considerations include ` +
    `data quality, contextual relevance, and actionable insights.`
  )
}
