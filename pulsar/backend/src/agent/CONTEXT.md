# agent/ — Context

## Files
- `llm.ts` — Claude API integration: `callClaude(prompt)`, `isClaudeAvailable()`
- `steps.ts` — STEP_COSTS, generateTaskSteps() (deterministic via simpleHash)
- `runner.ts` — runAgent() — loop steps, executeStep (real/mock), signCommitment per step, broadcast SSE

## Step costs (USDC)
- llm_call: 0.05
- tool_web_search: 0.02
- tool_code_exec: 0.03
- tool_data_fetch: 0.02
- reasoning: 0.01

## Step count
generateTaskSteps(task) produces 5-10 steps based on simpleHash(taskDescription) % 6.
Deterministic: same input always produces same sequence (P9).

## Claude AI integration (llm.ts)
- `ANTHROPIC_API_KEY` set → real Claude claude-3-haiku-20240307 API calls
- `llm_call` steps → `callClaude(buildLlmPrompt(task))` → real LLM response
- `reasoning` steps → `callClaude(buildReasoningPrompt(task))` → real analysis
- `tool_web_search`, `tool_code_exec`, `tool_data_fetch` → simulated with realistic descriptions
- Graceful fallback: if API key not set or API call fails → mock description returned
- max_tokens=256 per call to minimize cost

## Budget exhaustion
If newAmount > budgetBaseUnits → stop, emit 'budget_exhausted' SSE, return completedNormally: false

## Notes
- Agent runner does NOT perform on-chain tx — only signCommitment (off-chain)
- Not affected by DEMO_MODE or CONTRACT_ID — those only affect channel open/settle
- _sleepFn parameter allows tests to skip artificial delays
- Tests always use mock behavior (ANTHROPIC_API_KEY not set in test env)
