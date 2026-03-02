/**
 * Inkd API Server — Simple in-memory rate limiter
 *
 * Uses a sliding window per IP. Production deployments should swap this
 * for Redis-backed rate limiting (e.g., @upstash/ratelimit).
 */

import type { Request, Response, NextFunction } from 'express'

interface WindowEntry {
  count:     number
  resetAt:   number
}

const windows = new Map<string, WindowEntry>()

// Cleanup stale entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (entry.resetAt < now) windows.delete(key)
  }
}, 60_000)

export function rateLimitMiddleware(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip  = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()

    let entry = windows.get(ip)
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs }
      windows.set(ip, entry)
    }

    entry.count++

    const remaining = Math.max(0, max - entry.count)
    res.setHeader('X-RateLimit-Limit',     max)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset',     Math.ceil(entry.resetAt / 1000))

    if (entry.count > max) {
      res.status(429).json({
        error: {
          code:    'RATE_LIMITED',
          message: `Too many requests. Limit: ${max} per ${windowMs / 1000}s.`,
        },
      })
      return
    }

    next()
  }
}
