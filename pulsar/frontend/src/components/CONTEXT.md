# components/ — Context

## Files
- `ChannelPanel.tsx` — form budget + open channel + status display
- `TaskPanel.tsx` — task input + real-time SSE step list + progress bar
- `SettlementPanel.tsx` — settle button + txHash + explorer link

## Props flow
App.tsx → ChannelPanel (onChannelOpened callback)
App.tsx → TaskPanel (channelId, budgetUsdc, sseEvents, onTaskComplete)
App.tsx → SettlementPanel (channelId, totalCostUsdc, remainingBudgetUsdc, taskComplete)

## SSE events consumed by TaskPanel
- 'step' → append to step list
- 'task_complete' → show summary, enable settle
- 'budget_exhausted' → show warning, enable settle

## API calls
- ChannelPanel: POST /api/channels
- TaskPanel: POST /api/channels/:id/run
- SettlementPanel: POST /api/channels/:id/settle
