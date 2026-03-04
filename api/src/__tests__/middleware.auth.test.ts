/**
 * @inkd/api — middleware/auth.ts unit tests
 */
import { describe, it, expect, vi } from 'vitest'
import { authMiddleware } from '../middleware/auth.js'
import type { Request, Response, NextFunction } from 'express'

function makeReqRes(headerValue?: string) {
  const req = {
    headers: {
      authorization: headerValue,
    },
  } as unknown as Request

  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  const res = { status, json } as unknown as Response
  const next: NextFunction = vi.fn()

  return { req, res, next, status, json }
}

describe('authMiddleware', () => {
  describe('when apiKey is null (dev mode)', () => {
    it('calls next() without checking headers', () => {
      const { req, res, next } = makeReqRes()
      authMiddleware(null)(req, res, next)
      expect(next).toHaveBeenCalled()
      expect((res as any).status).not.toHaveBeenCalled()
    })

    it('calls next() even when Authorization header is present', () => {
      const { req, res, next } = makeReqRes('Bearer sometoken')
      authMiddleware(null)(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('when apiKey is set', () => {
    const KEY = 'secret-test-key'

    it('calls next() on valid Bearer token', () => {
      const { req, res, next } = makeReqRes(`Bearer ${KEY}`)
      authMiddleware(KEY)(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('returns 401 when Authorization header is missing', () => {
      const { req, res, next } = makeReqRes(undefined)
      authMiddleware(KEY)(req, res, next)
      expect(next).not.toHaveBeenCalled()
      expect((res as any).status).toHaveBeenCalledWith(401)
    })

    it('returns 401 when Authorization header is empty string', () => {
      const { req, res, next } = makeReqRes('')
      authMiddleware(KEY)(req, res, next)
      expect((res as any).status).toHaveBeenCalledWith(401)
    })

    it('returns 401 when token does not match', () => {
      const { req, res, next } = makeReqRes('Bearer wrongkey')
      authMiddleware(KEY)(req, res, next)
      expect(next).not.toHaveBeenCalled()
      expect((res as any).status).toHaveBeenCalledWith(401)
    })

    it('returns 401 when format is not Bearer', () => {
      const { req, res, next } = makeReqRes(`Basic ${KEY}`)
      authMiddleware(KEY)(req, res, next)
      expect((res as any).status).toHaveBeenCalledWith(401)
    })

    it('trims whitespace from Bearer token', () => {
      const { req, res, next } = makeReqRes(`Bearer   ${KEY}   `)
      // trim() is applied in middleware
      authMiddleware(KEY)(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('401 response includes error body', () => {
      const { req, res, next, json } = makeReqRes(undefined)
      authMiddleware(KEY)(req, res, next)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
      )
    })
  })
})
