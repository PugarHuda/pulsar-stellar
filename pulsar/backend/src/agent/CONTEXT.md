# agent/ — Context

## Files
- `steps.ts` — STEP_COSTS, generateTaskSteps() (deterministic via simpleHash)
- `runner.ts` — runAgent() — loop steps, executeStep per step, signCommitment, broadcast SSE
- `llm.ts` — Claude API integration (real LLM when ANTHROPIC_API_KEY set, mock fallback)

## Real vs Mock AI — Accurate Summary

### Stellar / Soroban — 100% REAL
- Ed25519 commitment signing is always real cryptography
- `open_channel` / `close_channel` → real Soroban calls when `CONTRACT_ID` is set

### LLM — PARTIALLY REAL
- `ANTHROPIC_API_KEY` set → real Claude claude-3-haiku-20240307 calls for `llm_call` + `reasoning` steps
- `ANTHROPIC_API_KEY` not set → mock descriptions (deterministic, no API calls)
- Falls back to mock gracefully if API key is missing or API call fails

### Tool Steps — SIMULATED (intentional for demo)
- `tool_web_search`, `tool_code_exec`, `tool_data_fetch` → always simulated with realistic delays + descriptions
- This is intentional: keeps demo predictable and avoids external dependencies

### Agent Step Generation — DETERMINISTIC MOCK (intentional)
- `steps.ts` generates deterministic steps based on `simpleHash(taskDescription)`
- Step count: 5–10 based on hash, always same for same input (Req 3.3, P9)
- Step costs are fixed constants (llm_call: 0.05, web_search: 0.02, etc.)
- Intentional for demo predictability and reproducible test results

## Step costs (USDC)
- llm_call: 0.05
- tool_web_search: 0.02
- tool_code_exec: 0.03
- tool_data_fetch: 0.02
- reasoning: 0.01

## Step count
5-10 steps per task based on simpleHash(taskDescription) % 6

## Budget exhaustion
If newAmount > budgetBaseUnits → stop, emit 'budget_exhausted' SSE, return completedNormally: false
