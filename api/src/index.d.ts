/**
 * @inkd/api — Inkd Protocol HTTP REST API Server
 *
 * Exposes the Inkd Protocol as a JSON REST API.
 * Enables non-TypeScript agents (Python, Rust, raw HTTP) to:
 *   - Discover registered projects and AI agents
 *   - Register new projects
 *   - Push file versions on-chain
 *   - Query protocol status
 *
 * ─── Quick start ─────────────────────────────────────────────────────────────
 *
 *   cp api/.env.example .env
 *   # Edit .env with contract addresses + RPC URL
 *   npm run dev                 # tsx watch mode
 *   npm run build && npm start  # production
 *
 * ─── Endpoints ───────────────────────────────────────────────────────────────
 *
 *   GET  /v1/health
 *   GET  /v1/status
 *   GET  /v1/projects
 *   GET  /v1/projects/:id
 *   POST /v1/projects
 *   GET  /v1/projects/:id/versions
 *   POST /v1/projects/:id/versions
 *   GET  /v1/agents
 *   GET  /v1/agents/:id
 *   GET  /v1/agents/by-name/:name
 */
declare const app: import("express-serve-static-core").Express;
export default app;
