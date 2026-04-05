# Frontend Context — Pulsar

## Purpose
React/Vite UI for complete interactive demo of Pulsar payment channel lifecycle.

## Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── ChannelPanel.tsx    # Form budget + open channel + copy ID + contract explorer link
│   │   ├── TaskPanel.tsx       # Task input + real-time SSE step list + progress bar + copy result
│   │   └── SettlementPanel.tsx # Settle button + receipt timeline + copy TX hash + explorer link
│   ├── App.tsx                 # Root component, state management, SSE client, session stats
│   ├── main.tsx                # React mount + Tailwind
│   └── index.css               # Tailwind directives
├── index.html
├── vite.config.ts              # Vite config + proxy /api → localhost:3001
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## State flow
```
App state:
  channelId: string | null
  appStatus: 'idle' | 'channel_open' | 'task_running' | 'task_complete' | 'settled'
  sseEvents: SseEvent[]
  totalCostUsdc: number
  remainingBudgetUsdc: number
  totalChannelsOpened: number  (session stat)
  totalUsdcSpent: number       (session stat)

SSE events from GET /api/events:
  'step'             → append to sseEvents[]
  'task_complete'    → update appStatus = 'task_complete'
  'budget_exhausted' → update appStatus = 'task_complete' + warning
  'error'            → set error
```

## Components
- **ChannelPanel**: budget input, "Open Channel" button, channel ID with copy button, contract address with Stellar Explorer link, USDC balance check status indicator, spinner animation
- **TaskPanel**: task description input, "Run Agent Task" button, real-time step list with type icons, budget progress bar, estimated remaining steps, "Copy Result" button, empty state when no channel
- **SettlementPanel**: "Settle Channel" button, server earned / you get back breakdown, settlement receipt timeline, TX hash with copy button, Stellar Explorer link, success animation

## App.tsx features
- Header with Pulsar logo, network badge (Stellar Testnet)
- Step indicator: 1. Open Channel → 2. Run Agent → 3. Settle (with active/completed states)
- Session stats: total channels opened, total USDC spent
- SSE connection status indicator

## API calls
- `POST /api/channels` — open channel
- `POST /api/channels/:id/run` — run agent task
- `POST /api/channels/:id/settle` — settle channel
- `GET /api/events` — SSE stream (via EventSource)

## Dev server
- Frontend: http://localhost:5173
- Backend proxy: /api → http://localhost:3001
- Run: `npm run dev` (in frontend/ folder)

## Test status
24/24 tests pass
