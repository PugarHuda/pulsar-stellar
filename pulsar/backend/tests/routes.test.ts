/**
 * tests/routes.test.ts
 *
 * Unit tests for API routes.
 * Tests POST /api/channels and GET /api/channels/:id.
 *
 * Requirements: 1.3 (balance check before on-chain), 6.5 (human-readable errors)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'
import { router } from '../src/api/routes.js'
import { PulsarError, PulsarErrorCode } from '../src/channel/types.js'

vi.mock('../src/channel/manager.js', () => ({
  openChannel: vi.fn(),
  settleChannel: vi.fn(),
  signCommitment: vi.fn(),
  serializeCommitmentBytes: vi.fn(),
  deserializeCommitmentBytes: vi.fn(),
}))

vi.mock('../src/channel/store.js', () => ({
  getChannel: vi.fn(),
  saveChannel: vi.fn(),
  updateChannel: vi.fn(),
  clearStore: vi.fn(),
  listChannels: vi.fn(),
  deleteChannel: vi.fn(),
  storeSize: vi.fn(),
}))

vi.mock('../src/agent/runner.js', () => ({
  runAgent: vi.fn(),
}))

vi.mock('../src/api/sse.js', () => ({
  addClient: vi.fn(),
  broadcast: vi.fn(),
}))

vi.mock('../src/stellar/config.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUsdcBalance: vi.fn().mockResolvedValue('100.0000000'),
    baseUnitsToUsdc: actual.baseUnitsToUsdc,
    usdcToBaseUnits: actual.usdcToBaseUnits,
  }
})

// Valid 56-char Stellar public key (G + 55 base32 chars)
const VALID_KEY = 'GBQPQE3N2SELH7GTILSDZMMI2WLJAYHSVYDXIYRAENMEE2FBLHDWYQ45'

let server: Server
let baseUrl: string

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api', router)
  await new Promise<void>((resolve) => {
    server = createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      baseUrl = `http://127.0.0.1:${addr.port}/api`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})

async function post(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

async function get(path: string) {
  const res = await fetch(`${baseUrl}${path}`)
  return { status: res.status, body: await res.json() }
}

describe('POST /api/channels', () => {
  it('returns 201 with channelId for valid budget', async () => {
    const { openChannel } = await import('../src/channel/manager.js')
    vi.mocked(openChannel).mockResolvedValueOnce({
      channelId: 'test-channel-id-123',
      contractAddress: 'CABC123',
      budgetUsdc: 10,
      status: 'open',
    })

    const { status, body } = await post('/channels', {
      budgetUsdc: 10,
      userPublicKey: VALID_KEY,
    })

    expect(status).toBe(201)
    expect(body.channelId).toBe('test-channel-id-123')
    expect(body.status).toBe('open')
    expect(body.budgetUsdc).toBe(10)
  })

  it('returns 400 when budgetUsdc is missing', async () => {
    const { status, body } = await post('/channels', {
      userPublicKey: VALID_KEY,
    })
    expect(status).toBe(400)
    expect(body.error).toBeTruthy()
    expect(typeof body.error).toBe('string')
  })

  it('returns 400 when budgetUsdc is zero', async () => {
    const { status, body } = await post('/channels', {
      budgetUsdc: 0,
      userPublicKey: VALID_KEY,
    })
    expect(status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it('returns 400 when budgetUsdc is negative', async () => {
    const { status, body } = await post('/channels', {
      budgetUsdc: -5,
      userPublicKey: VALID_KEY,
    })
    expect(status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it('returns 400 when userPublicKey is missing', async () => {
    const { status, body } = await post('/channels', {
      budgetUsdc: 10,
    })
    expect(status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it('returns 402 when INSUFFICIENT_USDC_BALANCE (Req 1.3)', async () => {
    const { openChannel } = await import('../src/channel/manager.js')
    vi.mocked(openChannel).mockRejectedValueOnce(
      new PulsarError(
        PulsarErrorCode.INSUFFICIENT_USDC_BALANCE,
        'Insufficient USDC balance: have 5 USDC, need 10 USDC',
      ),
    )

    const { status, body } = await post('/channels', {
      budgetUsdc: 10,
      userPublicKey: VALID_KEY,
    })

    expect(status).toBe(402)
    expect(body.error).toContain('USDC')
    expect(body.code).toBe(PulsarErrorCode.INSUFFICIENT_USDC_BALANCE)
  })
})

describe('GET /api/channels/:id', () => {
  it('returns 200 with channel data for existing ID', async () => {
    const { getChannel } = await import('../src/channel/store.js')
    vi.mocked(getChannel).mockReturnValueOnce({
      id: 'existing-channel-id',
      contractAddress: 'CABC123',
      userPublicKey: VALID_KEY,
      serverPublicKey: VALID_KEY,
      budgetBaseUnits: 100_000_000n,
      currentCommitmentAmount: 5_000_000n,
      lastCommitmentSig: null,
      lastStepIndex: 2,
      status: 'running',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
    })

    const { status, body } = await get('/channels/existing-channel-id')

    expect(status).toBe(200)
    expect(body.id).toBe('existing-channel-id')
    expect(body.status).toBe('running')
    expect(body.budgetUsdc).toBeCloseTo(10, 5)
    expect(body.currentCostUsdc).toBeCloseTo(0.5, 5)
    expect(body.remainingBudgetUsdc).toBeCloseTo(9.5, 5)
  })

  it('returns 404 for non-existent channel ID (Req 6.5)', async () => {
    const { getChannel } = await import('../src/channel/store.js')
    vi.mocked(getChannel).mockReturnValueOnce(undefined)

    const { status, body } = await get('/channels/non-existent-id')

    expect(status).toBe(404)
    expect(body.error).toBeTruthy()
    expect(typeof body.error).toBe('string')
    expect(body.error).toContain('not found')
  })
})
