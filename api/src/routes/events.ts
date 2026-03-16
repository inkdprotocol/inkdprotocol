/**
 * Inkd API — /v1/events
 *
 * GET /v1/events?projectId=42&type=version_pushed
 * Returns SSE stream: text/event-stream
 * Events:
 *   - version_pushed: { projectId, versionIndex, arweaveHash, pushedBy, timestamp }
 *   - project_created: { projectId, name, owner, timestamp }
 */

import { Router, Request, Response } from 'express'

// In-memory subscriber registry (per worker — good enough for MVP)
const subscribers = new Map<string, Set<Response>>()

export function eventsRouter(): Router {
  const router = Router()

  // Subscribe to events
  router.get('/', (req: Request, res: Response) => {
    const projectId = req.query['projectId'] as string | undefined
    const type = req.query['type'] as string | undefined

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // Send heartbeat every 30s
    const hb = setInterval(() => res.write(': heartbeat\n\n'), 30000)

    // Register subscriber
    const key = projectId ?? 'global'
    if (!subscribers.has(key)) subscribers.set(key, new Set())
    subscribers.get(key)!.add(res)

    // Send connected confirmation
    res.write(`event: connected\ndata: ${JSON.stringify({ projectId, type, ts: Date.now() })}\n\n`)

    req.on('close', () => {
      clearInterval(hb)
      subscribers.get(key)?.delete(res)
    })
  })

  return router
}

// Broadcast an event to all relevant subscribers
export function broadcastEvent(event: { type: string; projectId?: number; [key: string]: unknown }): void {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  // Broadcast to project-specific subscribers
  if (event.projectId) {
    subscribers.get(String(event.projectId))?.forEach(res => res.write(payload))
  }
  // Broadcast to global subscribers
  subscribers.get('global')?.forEach(res => res.write(payload))
}
