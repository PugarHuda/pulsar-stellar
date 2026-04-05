# components/ — Context

## Files
- `ChannelPanel.tsx` — budget form + open channel + copy channel ID + contract explorer link + balance status
- `TaskPanel.tsx` — task input + real-time SSE step list + progress bar + copy result + empty state
- `SettlementPanel.tsx` — settle button + receipt timeline + copy TX hash + explorer link + success animation

## Props flow
App.tsx → ChannelPanel (onChannelOpened callback)
App.tsx → TaskPanel (channelId, budgetUsdc, sseEvents, onTaskComplete)
App.tsx → SettlementPanel (channelId, totalCostUsdc, remainingBudgetUsdc, taskComplete)

## SSE events consumed by TaskPanel
- 'step' → append to step list, update progress bar
- 'task_complete' → show summary with copy button, enable settle
- 'budget_exhausted' → show warning, enable settle

## Step type icons
- llm_call → LLM (purple badge)
- tool_web_search → WEB (blue badge)
- tool_code_exec → CODE (orange badge)
- tool_data_fetch → DATA (cyan badge)
- reasoning → THINK (gray badge)

## API calls
- ChannelPanel: POST /api/channels
- TaskPanel: POST /api/channels/:id/run
- SettlementPanel: POST /api/channels/:id/settle

## UX features added
- ChannelPanel: copy channel ID button, contract address → Stellar Explorer link, USDC balance check status, spinner animation
- TaskPanel: step type icons, budget progress bar (amber when >80%), estimated remaining steps, copy result button, empty state when no channel
- SettlementPanel: server earned / you get back breakdown, settlement receipt timeline, copy TX hash button, success border animation
- App.tsx: Stellar Testnet network badge, step indicator with completed states, session stats (channels opened, USDC spent)
