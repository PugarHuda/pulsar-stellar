/**
 * index.ts
 *
 * Pulsar Backend — Express app entry point.
 *
 * Starts the API server for the Pulsar AI agent billing platform.
 * See backend/CONTEXT.md for full architecture overview.
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { router } from './api/routes.js'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json())

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', router)

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pulsar-backend',
    network: 'stellar:testnet',
    timestamp: new Date().toISOString(),
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║         PULSAR — Agent Billing            ║
║         MPP Session on Stellar            ║
╠═══════════════════════════════════════════╣
║  Backend:  http://localhost:${PORT}          ║
║  Network:  Stellar Testnet                ║
║  Health:   http://localhost:${PORT}/health   ║
╚═══════════════════════════════════════════╝
  `)
})

export default app
