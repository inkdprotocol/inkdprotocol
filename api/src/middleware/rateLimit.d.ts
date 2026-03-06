/**
 * Inkd API Server — Simple in-memory rate limiter
 *
 * Uses a sliding window per IP. Production deployments should swap this
 * for Redis-backed rate limiting (e.g., @upstash/ratelimit).
 */
import type { Request, Response, NextFunction } from 'express';
export declare function rateLimitMiddleware(windowMs: number, max: number): (req: Request, res: Response, next: NextFunction) => void;
