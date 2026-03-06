/**
 * Inkd API — /v1/agents routes
 *
 * Agent-specific endpoints for AI agent discovery and interaction.
 *
 * GET  /v1/agents               List all registered AI agents (paginated)
 * GET  /v1/agents/by-name/:name Get an agent by its project name
 * GET  /v1/agents/:id           Get an agent project by numeric id
 */
import { Router } from 'express';
import { type ApiConfig } from '../config.js';
export declare function agentsRouter(cfg: ApiConfig): Router;
