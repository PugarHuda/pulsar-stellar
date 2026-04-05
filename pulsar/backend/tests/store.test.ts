/**
 * tests/store.test.ts
 *
 * Unit tests for channel/store.ts
 * Tests CRUD operations on the in-memory channel store.
 *
 * Requirements: 1.5, 4.4
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveChannel,
  getChannel,
  updateChannel,
  listChannels,
  clearStore,
} from '../src/channel/store.js'
import type { Channel } from '../src/channel/types.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'test-channel-1',
    contractAddress: 'CTEST123',
    userPublicKey: 'GUSER123',
    serverPublicKey: 'GSERVER123',
    budgetBaseUnits: 100_000_000n,
    currentCommitmentAmount: 0n,
    lastCommitmentSig: null,
    lastStepIndex: -1,
    status: 'open',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore()
})

// ─── saveChannel ──────────────────────────────────────────────────────────────

describe('saveChannel', () => {
  it('saves a channel and can be retrieved', () => {
    const channel = makeChannel()
    saveChannel(channel)

    const retrieved = getChannel(channel.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.id).toBe(channel.id)
    expect(retrieved!.contractAddress).toBe(channel.contractAddress)
    expect(retrieved!.budgetBaseUnits).toBe(channel.budgetBaseUnits)
  })

  it('throws if channel with same ID already exists', () => {
    const channel = makeChannel()
    saveChannel(channel)

    expect(() => saveChannel(channel)).toThrow()
  })

  it('stores a copy — mutations to original do not affect store', () => {
    const channel = makeChannel()
    saveChannel(channel)

    // Mutate original
    channel.status = 'closed'

    const retrieved = getChannel(channel.id)
    expect(retrieved!.status).toBe('open')
  })
})

// ─── getChannel ───────────────────────────────────────────────────────────────

describe('getChannel', () => {
  it('returns undefined for non-existent ID', () => {
    const result = getChannel('does-not-exist')
    expect(result).toBeUndefined()
  })

  it('returns the saved channel', () => {
    const channel = makeChannel({ id: 'abc-123', status: 'running' })
    saveChannel(channel)

    const result = getChannel('abc-123')
    expect(result).toBeDefined()
    expect(result!.id).toBe('abc-123')
    expect(result!.status).toBe('running')
  })

  it('returns a copy — mutations to returned value do not affect store', () => {
    const channel = makeChannel()
    saveChannel(channel)

    const retrieved = getChannel(channel.id)!
    retrieved.status = 'closed'

    const again = getChannel(channel.id)
    expect(again!.status).toBe('open')
  })
})

// ─── updateChannel ────────────────────────────────────────────────────────────

describe('updateChannel', () => {
  it('partial update does not remove other fields', () => {
    const channel = makeChannel({
      id: 'update-test',
      status: 'open',
      currentCommitmentAmount: 0n,
      lastStepIndex: -1,
    })
    saveChannel(channel)

    updateChannel('update-test', { status: 'running' })

    const updated = getChannel('update-test')!
    // Updated field
    expect(updated.status).toBe('running')
    // Other fields preserved
    expect(updated.id).toBe('update-test')
    expect(updated.contractAddress).toBe(channel.contractAddress)
    expect(updated.userPublicKey).toBe(channel.userPublicKey)
    expect(updated.budgetBaseUnits).toBe(channel.budgetBaseUnits)
    expect(updated.currentCommitmentAmount).toBe(0n)
    expect(updated.lastStepIndex).toBe(-1)
  })

  it('throws for non-existent ID', () => {
    expect(() => updateChannel('ghost-id', { status: 'closed' })).toThrow()
  })

  it('updates updatedAt timestamp', () => {
    const before = Date.now()
    const channel = makeChannel({ id: 'ts-test', updatedAt: before - 1000 })
    saveChannel(channel)

    const result = updateChannel('ts-test', { status: 'completed' })

    expect(result.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('id is immutable — patch cannot change it', () => {
    const channel = makeChannel({ id: 'immutable-id' })
    saveChannel(channel)

    // @ts-expect-error — intentionally passing id in patch to test immutability
    updateChannel('immutable-id', { id: 'hacked-id', status: 'closed' })

    const result = getChannel('immutable-id')
    expect(result).toBeDefined()
    expect(result!.id).toBe('immutable-id')
  })
})

// ─── listChannels ─────────────────────────────────────────────────────────────

describe('listChannels', () => {
  it('returns empty array when no channels', () => {
    const result = listChannels()
    expect(result).toEqual([])
  })

  it('returns all saved channels', () => {
    saveChannel(makeChannel({ id: 'ch-1' }))
    saveChannel(makeChannel({ id: 'ch-2' }))
    saveChannel(makeChannel({ id: 'ch-3' }))

    const result = listChannels()
    expect(result).toHaveLength(3)

    const ids = result.map((c) => c.id).sort()
    expect(ids).toEqual(['ch-1', 'ch-2', 'ch-3'])
  })

  it('returns copies — mutations do not affect store', () => {
    saveChannel(makeChannel({ id: 'list-copy-test' }))

    const list = listChannels()
    list[0].status = 'closed'

    const again = listChannels()
    expect(again[0].status).toBe('open')
  })
})
