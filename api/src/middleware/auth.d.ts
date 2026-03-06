/**
 * Inkd API Server — Bearer token authentication middleware
 *
 * If INKD_API_KEY is set, every request must include:
 *   Authorization: Bearer <key>
 *
 * If INKD_API_KEY is NOT set (local dev), auth is skipped entirely.
 */
import type { Request, Response, NextFunction } from 'express';
export declare function authMiddleware(apiKey: string | null): (req: Request, res: Response, next: NextFunction) => void;
