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
import { openChannel, settleChannel, deployFreshContract, getGlobalContractId } from '../channel/manager.js'
import { getChannel, listChannels } from '../channel/store.js'
import { runAgent } from '../agent/runner.js'
import { addClient } from './sse.js'
import { PulsarError, PulsarErrorCode } from '../channel/types.js'
import { formatErrorResponse } from '../channel/error-messages.js'
import { baseUnitsToUsdc } from '../stellar/config.js'
import { generateToken } from '../auth/jwt.js'
import { authMiddleware, optionalAuthMiddleware } from '../auth/middleware.js'
import { generateChallenge, verifyChallenge } from '../auth/sep10.js'
import { listAgentTypes, getAgentType, recommendAgent } from '../agent/marketplace.js'
import {
  openAgentToAgentChannel,
  callAgentService,
  settleAgentToAgentChannel,
  discoverAgentServices,
  getAgentServices,
  type AgentPaymentChannel,
} from '../agent/agent-to-agent.js'

export const router = Router()

// In-memory store for agent-to-agent channels (demo purposes)
const agentChannels = new Map<string, AgentPaymentChannel>()

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * GET /api/auth/sep10/challenge
 * 
 * Generate a SEP-10 challenge transaction for Stellar Web Authentication.
 * Client must sign this transaction and submit to /api/auth/sep10/token.
 */
router.get('/auth/sep10/challenge', (req, res) => {
  const { account } = req.query

  if (!account || typeof account !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'account parameter is required',
      },
    })
  }

  try {
    const challenge = generateChallenge(account)
    res.json(challenge)
  } catch (err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: err instanceof Error ? err.message : 'Failed to generate challenge',
      },
    })
  }
})

/**
 * POST /api/auth/sep10/token
 * 
 * Verify a signed SEP-10 challenge transaction and issue JWT token.
 */
router.post('/auth/sep10/token', (req, res) => {
  const { transaction } = req.body

  if (!transaction || typeof transaction !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'transaction parameter is required',
      },
    })
  }

  try {
    const result = verifyChallenge(transaction)
    res.json(result)
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: err instanceof Error ? err.message : 'Challenge verification failed',
      },
    })
  }
})

/**
 * POST /api/auth/login
 * 
 * Simple authentication - returns JWT token for a Stellar public key.
 * In production, this would verify a signature challenge.
 */
router.post('/auth/login', (req, res) => {
  const LoginSchema = z.object({
    publicKey: z.string().regex(/^G[A-Z0-9]{55}$/, 'Invalid Stellar public key'),
  })

  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request data',
        details: parsed.error.errors,
      },
    })
  }

  const { publicKey } = parsed.data
  const token = generateToken(publicKey)

  res.json({
    token,
    publicKey,
    expiresIn: '24h',
  })
})

/**
 * GET /api/auth/me
 * 
 * Get current authenticated user info.
 */
router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({
    publicKey: req.user!.publicKey,
  })
})

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
 * GET /api/analytics
 * 
 * Returns analytics about all channels (for demo/hackathon showcase).
 */
router.get('/analytics', (req, res) => {
  const allChannels = listChannels()
  
  const totalChannels = allChannels.length
  const closedChannels = allChannels.filter((c) => c.status === 'closed')
  
  const totalUsdcProcessed = closedChannels.reduce((sum: number, c) => {
    return sum + baseUnitsToUsdc(c.currentCommitmentAmount)
  }, 0)
  
  const avgTaskCost = closedChannels.length > 0 
    ? totalUsdcProcessed / closedChannels.length 
    : 0
  
  const totalSteps = closedChannels.reduce((sum: number, c) => {
    return sum + (c.lastStepIndex + 1)
  }, 0)
  
  // Calculate cost savings vs traditional (100 tx per 100 steps)
  const traditionalTxCount = totalSteps
  const pulsarTxCount = closedChannels.length
  const txReduction = traditionalTxCount > 0 
    ? ((traditionalTxCount - pulsarTxCount) / traditionalTxCount * 100).toFixed(1)
    : 0
  
  res.json({
    totalChannels,
    openChannels: allChannels.filter((c) => c.status === 'open' || c.status === 'running').length,
    closedChannels: closedChannels.length,
    totalUsdcProcessed: Number(totalUsdcProcessed.toFixed(6)),
    avgTaskCost: Number(avgTaskCost.toFixed(6)),
    totalSteps,
    costSavings: {
      traditionalTxCount,
      pulsarTxCount,
      txReduction: `${txReduction}%`,
      message: `${txReduction}% fewer transactions vs traditional pay-per-request`
    }
  })
})

/**
 * GET /api/channels/:id/receipt
 * 
 * Download PDF receipt for a settled channel.
 */
router.get('/channels/:id/receipt', async (req, res) => {
  const { id } = req.params
  const channel = getChannel(id)

  if (!channel) {
    return res.status(404).json(formatErrorResponse(
      PulsarErrorCode.CHANNEL_NOT_FOUND,
      `Channel ${id} not found`,
    ))
  }

  if (channel.status !== 'closed') {
    return res.status(400).json({
      error: {
        code: 'CHANNEL_NOT_SETTLED',
        message: 'Channel has not been settled yet',
        action: 'Please settle the channel first',
      },
    })
  }

  try {
    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ margin: 50 })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=pulsar-receipt-${id}.pdf`)

    doc.pipe(res)

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Pulsar Receipt', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text('AI Agent Billing on Stellar', { align: 'center' })
    doc.moveDown(2)

    // Channel Details
    doc.fontSize(14).fillColor('#000').font('Helvetica-Bold').text('Channel Details')
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica')

    const budgetUsdc = baseUnitsToUsdc(channel.budgetBaseUnits)
    const paidUsdc = baseUnitsToUsdc(channel.currentCommitmentAmount)
    const refundUsdc = budgetUsdc - paidUsdc

    doc.text(`Channel ID: ${channel.id}`)
    doc.text(`Contract Address: ${channel.contractAddress}`)
    doc.text(`User: ${channel.userPublicKey}`)
    doc.text(`Server: ${channel.serverPublicKey}`)
    doc.moveDown()

    // Financial Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Financial Summary')
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica')

    doc.text(`Budget: ${budgetUsdc.toFixed(6)} USDC`)
    doc.text(`Amount Paid: ${paidUsdc.toFixed(6)} USDC`)
    doc.text(`Refund: ${refundUsdc.toFixed(6)} USDC`)
    doc.text(`Steps Executed: ${channel.lastStepIndex + 1}`)
    doc.moveDown()

    // Transaction Details
    doc.fontSize(14).font('Helvetica-Bold').text('Settlement Transaction')
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica')

    doc.text(`TX Hash: ${channel.settlementTxHash}`)
    doc.text(`Explorer: https://stellar.expert/explorer/testnet/tx/${channel.settlementTxHash}`, {
      link: `https://stellar.expert/explorer/testnet/tx/${channel.settlementTxHash}`,
      underline: true,
    })
    doc.moveDown()

    // Timestamps
    doc.fontSize(14).font('Helvetica-Bold').text('Timeline')
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica')

    doc.text(`Opened: ${new Date(channel.createdAt).toLocaleString()}`)
    doc.text(`Settled: ${new Date(channel.closedAt!).toLocaleString()}`)
    doc.moveDown(2)

    // Footer
    doc.fontSize(9).fillColor('#999').text(
      'This receipt was generated by Pulsar - AI Agent Billing on Stellar Testnet',
      { align: 'center' }
    )
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })

    doc.end()
  } catch (err) {
    console.error('PDF generation failed:', err)
    return res.status(500).json(formatErrorResponse(
      PulsarErrorCode.INTERNAL_ERROR,
      'Failed to generate PDF receipt',
    ))
  }
})

/**
 * GET /api/agents
 * 
 * List all available agent types in the marketplace.
 */
router.get('/agents', (_req, res) => {
  const agents = listAgentTypes()
  res.json({ agents })
})

/**
 * GET /api/agents/:id
 * 
 * Get details of a specific agent type.
 */
router.get('/agents/:id', (req, res) => {
  const agent = getAgentType(req.params.id)
  
  if (!agent) {
    return res.status(404).json({
      error: {
        code: 'AGENT_NOT_FOUND',
        message: `Agent type '${req.params.id}' not found`,
      },
    })
  }
  
  res.json(agent)
})

/**
 * POST /api/agents/recommend
 * 
 * Get recommended agent type for a task description.
 */
router.post('/agents/recommend', (req, res) => {
  const { taskDescription } = req.body
  
  if (!taskDescription || typeof taskDescription !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'taskDescription is required',
      },
    })
  }
  
  const agent = recommendAgent(taskDescription)
  res.json(agent)
})

// ─── Agent-to-Agent Payments (KILLER FEATURE) ────────────────────────────────

/**
 * GET /api/agent-network/services
 * 
 * Discover all available agent services in the network.
 * This enables agents to find and pay other agents for specialized services.
 */
router.get('/agent-network/services', (_req, res) => {
  const services = discoverAgentServices()
  res.json({ services })
})

/**
 * GET /api/agent-network/agents/:agentId/services
 * 
 * Get services offered by a specific agent.
 */
router.get('/agent-network/agents/:agentId/services', (req, res) => {
  const services = getAgentServices(req.params.agentId)
  res.json({ services })
})

/**
 * POST /api/agent-network/channels
 * 
 * Open a payment channel from one agent to another.
 * Enables Agent A to pay Agent B for services.
 */
router.post('/agent-network/channels', async (req, res) => {
  const { payerAgentId, recipientAgentId, budgetUsdc } = req.body
  
  if (!payerAgentId || !recipientAgentId || !budgetUsdc) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'payerAgentId, recipientAgentId, and budgetUsdc are required',
      },
    })
  }
  
  try {
    const channel = await openAgentToAgentChannel({
      payerAgentId,
      recipientAgentId,
      budgetUsdc,
    })
    
    agentChannels.set(channel.channelId, channel)
    
    res.status(201).json(channel)
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'CHANNEL_OPEN_FAILED',
        message: err instanceof Error ? err.message : 'Failed to open agent channel',
      },
    })
  }
})

/**
 * POST /api/agent-network/channels/:channelId/call
 * 
 * Agent A calls Agent B's service through the payment channel.
 * Payment is handled via off-chain commitment.
 */
router.post('/agent-network/channels/:channelId/call', async (req, res) => {
  const { channelId } = req.params
  const { serviceName, requestData } = req.body
  
  const channel = agentChannels.get(channelId)
  if (!channel) {
    return res.status(404).json({
      error: {
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel ${channelId} not found`,
      },
    })
  }
  
  try {
    const result = await callAgentService({
      channel,
      serviceName,
      requestData,
    })
    
    res.json(result)
  } catch (err) {
    return res.status(400).json({
      error: {
        code: 'SERVICE_CALL_FAILED',
        message: err instanceof Error ? err.message : 'Failed to call service',
      },
    })
  }
})

/**
 * POST /api/agent-network/channels/:channelId/settle
 * 
 * Settle the agent-to-agent payment channel.
 * Single on-chain transaction for all service calls.
 */
router.post('/agent-network/channels/:channelId/settle', async (req, res) => {
  const { channelId } = req.params
  
  const channel = agentChannels.get(channelId)
  if (!channel) {
    return res.status(404).json({
      error: {
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel ${channelId} not found`,
      },
    })
  }
  
  try {
    const result = await settleAgentToAgentChannel(channel)
    res.json(result)
  } catch (err) {
    return res.status(400).json({
      error: {
        code: 'SETTLEMENT_FAILED',
        message: err instanceof Error ? err.message : 'Failed to settle channel',
      },
    })
  }
})

/**
 * GET /api/agent-network/channels/:channelId
 * 
 * Get agent-to-agent channel state.
 */
router.get('/agent-network/channels/:channelId', (req, res) => {
  const channel = agentChannels.get(req.params.channelId)
  
  if (!channel) {
    return res.status(404).json({
      error: {
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel ${req.params.channelId} not found`,
      },
    })
  }
  
  res.json(channel)
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

  // Use globalContractId if available, otherwise fall back to env var
  const contractId = getGlobalContractId() ?? process.env.CONTRACT_ID ?? null

  res.json({
    network: 'stellar:testnet',
    aiMode: process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.ANTHROPIC_API_KEY ? 'claude' : 'mock',
    contractId,
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

/**
 * POST /api/admin/reset-contract
 * Deploy a fresh Soroban contract instance from the pre-uploaded WASM hash.
 * Updates process.env.CONTRACT_ID in memory so subsequent openChannel calls use it.
 *
 * Use this when openChannel fails with "channel already open" (contract already used).
 *
 * Response: { contractId: string }
 */
router.post('/admin/reset-contract', async (_req: Request, res: Response) => {
  try {
    const newContractId = await deployFreshContract()
    process.env.CONTRACT_ID = newContractId
    console.log(`[Pulsar] CONTRACT_ID reset to: ${newContractId}`)
    return res.json({ contractId: newContractId })
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
      [PulsarErrorCode.AGENT_EXECUTION_FAILED]:    500,
      [PulsarErrorCode.INVALID_REQUEST]:           400,
      [PulsarErrorCode.INTERNAL_ERROR]:            500,
    }
    
    // Return user-friendly error message
    const errorResponse = formatErrorResponse(err.code, err.message)
    return res.status(statusMap[err.code] ?? 500).json(errorResponse)
  }

  console.error('Unexpected error:', err)
  const errorResponse = formatErrorResponse(
    PulsarErrorCode.INTERNAL_ERROR,
    err instanceof Error ? err.message : String(err)
  )
  return res.status(500).json(errorResponse)
}
