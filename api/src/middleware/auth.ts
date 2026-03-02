/**
 * Inkd API Server — Bearer token authentication middleware
 *
 * If INKD_API_KEY is set, every request must include:
 *   Authorization: Bearer <key>
 *
 * If INKD_API_KEY is NOT set (local dev), auth is skipped entirely.
 */

import type { Request, Response, NextFunction } from 'express'
import { UnauthorizedError, sendError } from '../errors.js'

export function authMiddleware(apiKey: string | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // No API key configured — open access (dev mode)
    if (apiKey === null) {
      next()
      return
    }

    const header = req.headers['authorization'] ?? ''
    const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

    if (!token) {
      sendError(res, new UnauthorizedError('Authorization header required: Bearer <key>'))
      return
    }

    if (token !== apiKey) {
      sendError(res, new UnauthorizedError())
      return
    }

    next()
  }
}
