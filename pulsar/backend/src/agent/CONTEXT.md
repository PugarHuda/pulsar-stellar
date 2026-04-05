# agent/ — Context

## Files
- `steps.ts` — STEP_COSTS, generateTaskSteps() (deterministik via simpleHash)
- `runner.ts` — runAgent() — loop steps, signCommitment per step, broadcast SSE

## Step costs (USDC)
- llm_call: 0.05
- tool_web_search: 0.02
- tool_code_exec: 0.03
- tool_data_fetch: 0.02
- reasoning: 0.01

## Determinism
generateTaskSteps(task) selalu menghasilkan sequence yang sama untuk input yang sama.
Step count: 5-8 berdasarkan simpleHash(taskDescription) % 4.

## Budget exhaustion
Jika newAmount > budgetBaseUnits → stop, emit 'budget_exhausted' SSE, return completedNormally: false
