/**
 * agent/llm.ts
 *
 * OpenRouter LLM integration for Pulsar AI agent.
 *
 * Uses OpenRouter API (openrouter.ai) with free models:
 *   - Primary: qwen/qwen3.6-plus:free (1M context, strong agentic reasoning)
 *   - Fallback: nvidia/nemotron-3-super:free (262K context)
 *
 * Falls back to mock behavior gracefully if OPENROUTER_API_KEY is not set.
 * Also supports ANTHROPIC_API_KEY for backward compatibility.
 *
 * Context: See backend/CONTEXT.md
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface OpenRouterRequest {
  model: string
  max_tokens: number
  messages: OpenRouterMessage[]
}

interface OpenRouterResponse {
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage?: { prompt_tokens: number; completion_tokens: number }
  model?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Free models on OpenRouter — ordered by preference for agentic tasks
const FREE_MODELS = [
  'qwen/qwen3.6-plus:free',       // Best: 1M context, strong agentic/coding
  'nvidia/nemotron-3-super:free', // Fallback: 262K context, multi-agent
  'minimax/minimax-m2.5:free',    // Fallback: 197K context, agentic
]

const PRIMARY_MODEL = FREE_MODELS[0]

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Call LLM via OpenRouter with a prompt and return the text response.
 *
 * Priority:
 *   1. OPENROUTER_API_KEY → OpenRouter free models
 *   2. ANTHROPIC_API_KEY → Claude (backward compat)
 *   3. No key → mock fallback
 */
export async function callLLM(prompt: string): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (openRouterKey) {
    return callOpenRouter(prompt, openRouterKey)
  }

  if (anthropicKey) {
    return callClaude(prompt, anthropicKey)
  }

  return generateMockLlmResponse(prompt)
}

/** @deprecated Use callLLM instead */
export async function callClaude(prompt: string, apiKey?: string): Promise<string> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!key) return generateMockLlmResponse(prompt)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      console.warn(`[Pulsar] Claude API error ${res.status}`)
      return generateMockLlmResponse(prompt)
    }

    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    return data.content?.[0]?.text ?? generateMockLlmResponse(prompt)
  } catch {
    return generateMockLlmResponse(prompt)
  }
}

/**
 * Call OpenRouter API with a free model.
 */
async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  try {
    const body: OpenRouterRequest = {
      model: PRIMARY_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'You are a concise AI agent. Respond in 2-3 sentences maximum. Be specific and actionable.',
        },
        { role: 'user', content: prompt },
      ],
    }

    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/PugarHuda/pulsar-stellar',
        'X-Title': 'Pulsar — AI Agent Billing on Stellar',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[Pulsar] OpenRouter error ${res.status}: ${errText.slice(0, 200)}`)
      return generateMockLlmResponse(prompt)
    }

    const data = (await res.json()) as OpenRouterResponse
    const text = data.choices?.[0]?.message?.content ?? ''
    const model = data.model ?? PRIMARY_MODEL

    if (!text) {
      return generateMockLlmResponse(prompt)
    }

    // Sanitize: remove non-ASCII characters that can cause encoding issues
    const sanitized = text.replace(/[^\x00-\x7F]/g, (c) => {
      // Replace common Unicode punctuation with ASCII equivalents
      const map: Record<string, string> = {
        '\u2014': '--', '\u2013': '-', '\u2018': "'", '\u2019': "'",
        '\u201C': '"', '\u201D': '"', '\u2026': '...', '\u00B7': '*',
      }
      return map[c] ?? ' '
    })

    console.log(`[Pulsar] OpenRouter response via ${model} (${sanitized.length} chars)`)
    return sanitized
  } catch (err) {
    console.warn(`[Pulsar] OpenRouter call failed: ${err instanceof Error ? err.message : String(err)}`)
    return generateMockLlmResponse(prompt)
  }
}

/**
 * Check if a real LLM is available (OpenRouter or Anthropic key set).
 */
export function isLLMAvailable(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY)
}

/** @deprecated Use isLLMAvailable instead */
export function isClaudeAvailable(): boolean {
  return isLLMAvailable()
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function generateMockLlmResponse(prompt: string): string {
  const taskSnippet = prompt.slice(0, 60).replace(/\n/g, ' ')
  return (
    `Based on the analysis of "${taskSnippet}...", I have identified key patterns ` +
    `and synthesized the relevant information. The findings suggest a structured ` +
    `approach would be most effective for this task. Key considerations include ` +
    `data quality, contextual relevance, and actionable insights.`
  )
}
