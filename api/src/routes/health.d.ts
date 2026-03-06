/**
 * GET /v1/health
 * GET /v1/status
 *
 * Returns server health + protocol status (project count, network).
 * These endpoints are NOT gated by auth — safe for uptime monitors.
 */
import { Router } from 'express';
import { type ApiConfig } from '../config.js';
export declare function healthRouter(cfg: ApiConfig): Router;
