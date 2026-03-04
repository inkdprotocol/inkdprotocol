/**
 * @inkd/api — middleware/rateLimit.ts unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Request, Response, NextFunction } from 'express'

function makeReqRes(ip = '127.0.0.1') {
  const req = {
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request

  const headers: Record<string, string | number> = {}
  const setHeader = vi.fn((k: string, v: string | number) => { headers[k] = v })
  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  const res = { status, json, setHeader } as unknown as Response
  const next: NextFunction = vi.fn()

  return { req, res, next, status, json, headers, setHeader }
}

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    // Reset module to clear the windows Map between tests
    vi.resetModules()
  })

  it('calls next() for first request under limit', async () => {
    const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
    const { req, res, next } = makeReqRes('10.0.0.1')
    rl(60_000, 10)(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('sets X-RateLimit-Limit header', async () => {
    const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
    const { req, res, next, setHeader } = makeReqRes('10.0.0.2')
    rl(60_000, 5)(req, res, next)
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5)
  })

  it('sets X-RateLimit-Remaining header', async () => {
    const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
    const { req, res, next, setHeader } = makeReqRes('10.0.0.3')
    rl(60_000, 5)(req, res, next)
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4)
  })

  it('returns 429 when limit exceeded', async () => {
    const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
    const ip = '10.0.0.4'
    const mw = rl(60_000, 2)

    // Hit limit
    for (let i = 0; i < 2; i++) {
      const { req, res, next } = makeReqRes(ip)
      mw(req, res, next)
    }
    // One more — should 429
    const { req, res, next, status, json } = makeReqRes(ip)
    mw(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(429)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'RATE_LIMITED' }) })
    )
  })

  it('different IPs have independent windows', async () => {
    const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
    const mw = rl(60_000, 1)

    // IP A hits limit
    for (let i = 0; i < 2; i++) {
      const { req, res, next } = makeReqRes('10.1.0.1')
      mw(req, res, next)
    }

    // IP B should still pass
    const { req, res, next } = makeReqRes('10.1.0.2')
    mw(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('uses socket.remoteAddress as fallback when req.ip is undefined', async () => {
    const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
    const req = {
      ip: undefined,
      socket: { remoteAddress: '10.2.0.1' },
    } as unknown as Request
    const { res, next } = makeReqRes()
    rl(60_000, 10)(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('uses "unknown" when both req.ip and socket.remoteAddress are undefined', async () => {
    const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
    const req = {
      ip:     undefined,
      socket: { remoteAddress: undefined },
    } as unknown as Request
    const { res, next } = makeReqRes()
    rl(60_000, 10)(req, res, next)
    // Should still proceed without error
    expect(next).toHaveBeenCalled()
  })

  it('cleans up expired entries via setInterval (fake timers)', async () => {
    vi.useFakeTimers()
    try {
      const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')
      const ip = '10.5.0.1'
      // Use a very short 50ms window so the entry expires quickly
      const mw = rl(50, 5)

      // First request — creates an entry, consumes 1 of 5
      const { req, res, next } = makeReqRes(ip)
      mw(req, res, next)
      expect(next).toHaveBeenCalledTimes(1)

      // Advance past the window (50ms) AND past the cleanup interval (60_000ms)
      vi.advanceTimersByTime(70_000)

      // After cleanup the old entry is deleted; next request gets a fresh window
      const { req: req2, res: res2, next: next2, setHeader } = makeReqRes(ip)
      mw(req2, res2, next2)
      expect(next2).toHaveBeenCalled()
      // Remaining should be max-1 = 4, proving the entry was reset by cleanup
      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cleanup keeps non-expired entries while removing expired ones (covers line-21 else branch)', async () => {
    vi.useFakeTimers()
    try {
      const { rateLimitMiddleware: rl } = await import('../middleware/rateLimit.js')

      // Two middleware instances sharing the same internal Map
      // Short window: expires within the cleanup interval
      const shortMw = rl(50,      5)
      // Long window: still alive when cleanup fires at 60_000ms
      const longMw  = rl(120_000, 5)

      // Create both entries at t=0
      const { req: reqA, res: resA, next: nextA } = makeReqRes('10.6.0.1')
      shortMw(reqA, resA, nextA)
      expect(nextA).toHaveBeenCalledTimes(1)

      const { req: reqB, res: resB, next: nextB } = makeReqRes('10.6.0.2')
      longMw(reqB, resB, nextB)
      expect(nextB).toHaveBeenCalledTimes(1)

      // Advance past cleanup interval (60_000ms); short entry (resetAt=+50ms) expires,
      // long entry (resetAt=+120_000ms) does NOT → cleanup loop exercises both branches.
      vi.advanceTimersByTime(70_000)

      // Short-window IP: entry was deleted → fresh window, remaining = max-1 = 4
      const { req: reqA2, res: resA2, next: nextA2, setHeader: shA } = makeReqRes('10.6.0.1')
      shortMw(reqA2, resA2, nextA2)
      expect(nextA2).toHaveBeenCalled()
      expect(shA).toHaveBeenCalledWith('X-RateLimit-Remaining', 4)   // reset, used 1 of 5

      // Long-window IP: entry persisted → count was 1, now incremented to 2 → remaining = 3
      const { req: reqB2, res: resB2, next: nextB2, setHeader: shB } = makeReqRes('10.6.0.2')
      longMw(reqB2, resB2, nextB2)
      expect(nextB2).toHaveBeenCalled()
      expect(shB).toHaveBeenCalledWith('X-RateLimit-Remaining', 3)   // persisted: 2 of 5 used
    } finally {
      vi.useRealTimers()
    }
  })
})
