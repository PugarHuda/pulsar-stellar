/**
 * channel/store.ts
 *
 * In-memory channel state store.
 * Uses Map<string, Channel> keyed by channelId (UUID).
 *
 * In production this would be a database, but for hackathon demo
 * in-memory is sufficient and keeps the stack simple.
 *
 * Context: See backend/CONTEXT.md
 */

import type { Channel } from './types.js'

// ─── Store ────────────────────────────────────────────────────────────────────

const store = new Map<string, Channel>()

/**
 * Save a new channel to the store.
 * Throws if a channel with the same ID already exists.
 */
export function saveChannel(channel: Channel): void {
  if (store.has(channel.id)) {
    throw new Error(`Channel ${channel.id} already exists in store`)
  }
  store.set(channel.id, { ...channel })
}

/**
 * Get a channel by ID.
 * Returns undefined if not found.
 */
export function getChannel(id: string): Channel | undefined {
  const ch = store.get(id)
  return ch ? { ...ch } : undefined
}

/**
 * Update a channel with partial data.
 * Always updates `updatedAt` to current timestamp.
 * Throws if channel not found.
 */
export function updateChannel(id: string, patch: Partial<Channel>): Channel {
  const existing = store.get(id)
  if (!existing) {
    throw new Error(`Channel ${id} not found in store`)
  }
  const updated: Channel = {
    ...existing,
    ...patch,
    id,                          // id is immutable
    updatedAt: Date.now(),
  }
  store.set(id, updated)
  return { ...updated }
}

/**
 * List all channels (returns copies).
 */
export function listChannels(): Channel[] {
  return Array.from(store.values()).map((ch) => ({ ...ch }))
}

/**
 * Delete a channel from the store.
 * Returns true if deleted, false if not found.
 */
export function deleteChannel(id: string): boolean {
  return store.delete(id)
}

/**
 * Clear all channels (useful for tests).
 */
export function clearStore(): void {
  store.clear()
}

/** Number of channels in store (useful for tests) */
export function storeSize(): number {
  return store.size
}
