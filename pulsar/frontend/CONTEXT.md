# Frontend Context — Pulsar

## Tujuan
React/Vite UI untuk demo interaksi lengkap dengan Pulsar payment channel lifecycle.

## Struktur
```
frontend/
├── src/
│   ├── components/
│   │   ├── ChannelPanel.tsx    # Form budget + open channel + status display
│   │   ├── TaskPanel.tsx       # Task input + real-time SSE step list
│   │   └── SettlementPanel.tsx # Settle button + txHash + explorer link
│   ├── App.tsx                 # Root component, state management, SSE client
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
  channelStatus: 'idle' | 'open' | 'running' | 'completed' | 'closed'
  steps: AgentStepEvent[]
  settlement: SettlementResult | null
  error: string | null

SSE events dari GET /api/events:
  'step'           → append ke steps[]
  'task_complete'  → update channelStatus = 'completed'
  'budget_exhausted' → update channelStatus = 'completed' + error
  'error'          → set error
```

## Komponen
- **ChannelPanel**: input budget (USDC), tombol "Open Channel", tampilkan channelId + status badge
- **TaskPanel**: input task description, tombol "Run Agent", real-time step list dengan cost per step
- **SettlementPanel**: tombol "Settle Channel", tampilkan final cost + refund + txHash + link explorer

## API calls
- `POST /api/channels` — open channel
- `POST /api/channels/:id/run` — run agent task
- `POST /api/channels/:id/settle` — settle channel
- `GET /api/events` — SSE stream (via EventSource)

## Dev server
- Frontend: http://localhost:5173
- Backend proxy: /api → http://localhost:3001
- Run: `npm run dev` (di folder frontend/)
