/**
 * api/routes.ts
 *
 * Express route handlers for Pulsar API.
 *
 * Endpoints:
 *   POST /api/channels          — open new payment channel
 *   GET  /api/channels/:id      — get channel state
 *   POST /api/channels/:id/run  — run agent task (async, SSE events)
 *   POST /api/channels/:id/settle — close channel + settle on-chain
 *   GET  /api/events            — SSE stream
 *
 * Context: See backend/CONTEXT.md
 */

import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { Keypair } from '@stellar/stellar-sdk'
import { openChannel, settleChannel } from '../channel/manager.js'
import { getChannel } from '../channel/store.js'
import { runAgent } from '../agent/runner.js'
import { addClient } from './sse.js'
import { PulsarError, PulsarErrorCode } from '../channel/types.js'
import { baseUnitsToUsdc } from '../stellar/config.js'

export const router = Router()

// ─── Validation Schemas ───────────────────────────────────────────────────────

const OpenChannelSchema = z.object({
  budgetUsdc: z.number().positive('Budget must be positive'),
  userPublicKey: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar public key (must start with G)'),
})

const RunTaskSchema = z.object({
  taskDescription: z
    .string()
    .min(3, 'Task description must be at least 3 characters')
    .max(500, 'Task description too long'),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/events
 * SSE stream for real-time agent step events.
 */
router.get('/events', (req: Request, res: Response) => {
  addClient(res)
})

/**
 * GET /api/status
 * Returns backend status: network, AI mode, contract ID, demo mode, user public key.
 */
router.get('/status', (_req: Request, res: Response) => {
  let userPublicKey: string | null = null
  try {
    if (process.env.USER_SECRET_KEY) {
      userPublicKey = Keypair.fromSecret(process.env.USER_SECRET_KEY).publicKey()
    }
  } catch {
    // ignore invalid key
  }

  res.json({
    network: 'stellar:testnet',
    aiMode: process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.ANTHROPIC_API_KEY ? 'claude' : 'mock',
    contractId: process.env.CONTRACT_ID ?? null,
    demoMode: process.env.DEMO_MODE === 'true',
    userPublicKey,
  })
})

/**
 * POST /api/channels
 * Open a new payment channel with USDC deposit.
 *
 * Body: { budgetUsdc: number, userPublicKey: string }
 * Response: { channelId, contractAddress, budgetUsdc, status }
 */
router.post('/channels', async (req: Request, res: Response) => {
  const parsed = OpenChannelSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    const result = await openChannel(parsed.data)
    return res.status(201).json(result)
  } catch (err) {
    return handleError(err, res)
  }
})

/**
 * GET /api/channels/:id
 * Get current state of a payment channel.
 */
router.get('/channels/:id', (req: Request, res: Response) => {
  const channel = getChannel(req.params['id'] as string)
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' })
  }

  // Serialize bigints for JSON
  return res.json({
    id: channel.id,
    contractAddress: channel.contractAddress,
    userPublicKey: channel.userPublicKey,
    serverPublicKey: channel.serverPublicKey,
    budgetUsdc: baseUnitsToUsdc(channel.budgetBaseUnits),
    currentCostUsdc: baseUnitsToUsdc(channel.currentCommitmentAmount),
    remainingBudgetUsdc: baseUnitsToUsdc(
      channel.budgetBaseUnits - channel.currentCommitmentAmount,
    ),
    lastStepIndex: channel.lastStepIndex,
    status: channel.status,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    settlementTxHash: channel.settlementTxHash,
    closedAt: channel.closedAt,
  })
})

/**
 * POST /api/channels/:id/run
 * Run a mock AI agent task against the channel.
 * Emits SSE events for each step.
 *
 * Body: { taskDescription: string }
 * Response: task summary
 */
router.post('/channels/:id/run', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const channel = getChannel(id)
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' })
  }

  const parsed = RunTaskSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    // Run agent async — SSE events are broadcast during execution
    const result = await runAgent({
      channelId: id,
      taskDescription: parsed.data.taskDescription,
    })
    return res.json(result)
  } catch (err) {
    return handleError(err, res)
  }
})

/**
 * POST /api/channels/:id/settle
 * Close the channel and settle on-chain.
 *
 * Response: { txHash, amountPaidUsdc, refundUsdc, explorerUrl }
 */
router.post('/channels/:id/settle', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const channel = getChannel(id)
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' })
  }

  try {
    const result = await settleChannel(id)
    return res.json(result)
  } catch (err) {
    return handleError(err, res)
  }
})

// ─── Error Handler ────────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): Response {
  if (err instanceof PulsarError) {
    const statusMap: Record<PulsarErrorCode, number> = {
      [PulsarErrorCode.INSUFFICIENT_USDC_BALANCE]: 402,
      [PulsarErrorCode.CHANNEL_OPEN_FAILED]:       500,
      [PulsarErrorCode.BUDGET_EXHAUSTED]:          402,
      [PulsarErrorCode.CHANNEL_NOT_FOUND]:         404,
      [PulsarErrorCode.CHANNEL_ALREADY_CLOSED]:    409,
      [PulsarErrorCode.CHANNEL_NOT_OPEN]:          409,
      [PulsarErrorCode.COMMITMENT_SIGN_FAILED]:    500,
      [PulsarErrorCode.SETTLEMENT_FAILED]:         500,
      [PulsarErrorCode.SETTLEMENT_RETRY_EXCEEDED]: 500,
    }
    return res.status(statusMap[err.code] ?? 500).json({
      error: err.message,
      code: err.code,
    })
  }

  console.error('Unexpected error:', err)
  return res.status(500).json({
    error: 'Internal server error',
    details: err instanceof Error ? err.message : String(err),
  })
}
