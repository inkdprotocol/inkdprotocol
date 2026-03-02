/**
 * Inkd API Server — Error types & helpers
 */

import type { Response } from 'express'

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND')
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(400, message, 'BAD_REQUEST')
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Invalid or missing API key') {
    super(401, message, 'UNAUTHORIZED')
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string) {
    super(503, message, 'SERVICE_UNAVAILABLE')
  }
}

export interface ErrorResponse {
  error: {
    code:    string
    message: string
  }
}

export function sendError(res: Response, err: unknown): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        code:    err.code ?? 'ERROR',
        message: err.message,
      },
    } satisfies ErrorResponse)
    return
  }

  // Unknown / RPC errors
  const message = err instanceof Error ? err.message : String(err)
  const isRpc   = message.toLowerCase().includes('rpc') ||
                  message.toLowerCase().includes('contract')

  if (isRpc) {
    res.status(502).json({
      error: { code: 'RPC_ERROR', message: `RPC call failed: ${message}` },
    } satisfies ErrorResponse)
    return
  }

  console.error('[inkd-api] Unhandled error:', err)
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  } satisfies ErrorResponse)
}
