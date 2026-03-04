/**
 * @inkd/api — errors.ts unit tests
 *
 * Covers: ApiError + subclasses, sendError() routing
 */
import { describe, it, expect, vi } from 'vitest'
import {
  ApiError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ServiceUnavailableError,
  sendError,
} from '../errors.js'
import type { Response } from 'express'

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeMockRes() {
  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  return { res: { status, json } as unknown as Response, status, json }
}

// ─── ApiError & subclasses ────────────────────────────────────────────────────

describe('ApiError', () => {
  it('stores statusCode, message, and code', () => {
    const e = new ApiError(418, "I'm a teapot", 'TEAPOT')
    expect(e.statusCode).toBe(418)
    expect(e.message).toBe("I'm a teapot")
    expect(e.code).toBe('TEAPOT')
    expect(e.name).toBe('ApiError')
  })

  it('code is optional', () => {
    const e = new ApiError(500, 'oops')
    expect(e.code).toBeUndefined()
  })

  it('instanceof Error', () => {
    expect(new ApiError(400, 'bad')).toBeInstanceOf(Error)
  })
})

describe('NotFoundError', () => {
  it('formats message and sets 404', () => {
    const e = new NotFoundError('Project #42')
    expect(e.statusCode).toBe(404)
    expect(e.message).toBe('Project #42 not found')
    expect(e.code).toBe('NOT_FOUND')
  })
})

describe('BadRequestError', () => {
  it('uses custom message and sets 400', () => {
    const e = new BadRequestError('name is required')
    expect(e.statusCode).toBe(400)
    expect(e.message).toBe('name is required')
    expect(e.code).toBe('BAD_REQUEST')
  })
})

describe('UnauthorizedError', () => {
  it('uses default message', () => {
    const e = new UnauthorizedError()
    expect(e.statusCode).toBe(401)
    expect(e.message).toBe('Invalid or missing API key')
    expect(e.code).toBe('UNAUTHORIZED')
  })

  it('accepts custom message', () => {
    const e = new UnauthorizedError('Bearer token required')
    expect(e.message).toBe('Bearer token required')
  })
})

describe('ServiceUnavailableError', () => {
  it('uses custom message and sets 503', () => {
    const e = new ServiceUnavailableError('RPC unavailable')
    expect(e.statusCode).toBe(503)
    expect(e.message).toBe('RPC unavailable')
    expect(e.code).toBe('SERVICE_UNAVAILABLE')
  })
})

// ─── sendError ────────────────────────────────────────────────────────────────

describe('sendError()', () => {
  it('sends ApiError status + body', () => {
    const { res, status, json } = makeMockRes()
    sendError(res, new BadRequestError('missing name'))
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'missing name' },
    })
  })

  it('sends 404 for NotFoundError', () => {
    const { res, status, json } = makeMockRes()
    sendError(res, new NotFoundError('Agent #5'))
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Agent #5 not found' },
    })
  })

  it('sends 401 for UnauthorizedError', () => {
    const { res, status } = makeMockRes()
    sendError(res, new UnauthorizedError())
    expect(status).toHaveBeenCalledWith(401)
  })

  it('falls back to ERROR when code is undefined', () => {
    const { res, status, json } = makeMockRes()
    sendError(res, new ApiError(418, 'teapot'))
    expect(status).toHaveBeenCalledWith(418)
    expect(json).toHaveBeenCalledWith({
      error: { code: 'ERROR', message: 'teapot' },
    })
  })

  it('routes RPC errors to 502', () => {
    const { res, status, json } = makeMockRes()
    sendError(res, new Error('RPC call timed out'))
    expect(status).toHaveBeenCalledWith(502)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'RPC_ERROR' }) })
    )
  })

  it('routes contract errors to 502', () => {
    const { res, status } = makeMockRes()
    sendError(res, new Error('contract execution reverted'))
    expect(status).toHaveBeenCalledWith(502)
  })

  it('routes unknown errors to 500', () => {
    const { res, status, json } = makeMockRes()
    sendError(res, new Error('something exploded'))
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    })
  })

  it('handles non-Error objects as 500', () => {
    const { res, status } = makeMockRes()
    sendError(res, 'string error')
    expect(status).toHaveBeenCalledWith(500)
  })
})
