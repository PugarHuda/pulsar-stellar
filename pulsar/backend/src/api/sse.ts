/**
 * api/sse.ts
 *
 * Server-Sent Events (SSE) manager for Pulsar.
 *
 * Broadcasts real-time agent step events to all connected clients.
 * Used by the frontend TaskPanel to show live step-by-step progress.
 *
 * Event format: standard SSE with JSON data payload.
 *
 * Context: See backend/CONTEXT.md
 */

import type { Response } from 'express'

// ─── Client Registry ──────────────────────────────────────────────────────────

const clients = new Set<Response>()

/**
 * Register a new SSE client connection.
 * Sets appropriate headers and sends initial connection event.
 */
export function addClient(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
  res.flushHeaders()

  // Send initial connection confirmation
  sendEvent(res, 'connected', { message: 'Pulsar SSE stream connected' })

  clients.add(res)

  // Remove client on disconnect
  res.on('close', () => {
    clients.delete(res)
  })
}

/**
 * Remove a client from the registry.
 */
export function removeClient(res: Response): void {
  clients.delete(res)
}

/**
 * Broadcast an event to all connected SSE clients.
 */
export function broadcast(eventType: string, data: unknown): void {
  for (const client of clients) {
    sendEvent(client, eventType, data)
  }
}

/**
 * Number of currently connected SSE clients.
 */
export function clientCount(): number {
  return clients.size
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function sendEvent(res: Response, eventType: string, data: unknown): void {
  try {
    res.write(`event: ${eventType}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  } catch {
    // Client disconnected — remove from registry
    clients.delete(res)
  }
}
