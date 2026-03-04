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
})
