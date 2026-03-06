"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_js_1 = require("./config.js");
const auth_js_1 = require("./middleware/auth.js");
const rateLimit_js_1 = require("./middleware/rateLimit.js");
const x402_js_1 = require("./middleware/x402.js");
const health_js_1 = require("./routes/health.js");
const projects_js_1 = require("./routes/projects.js");
const agents_js_1 = require("./routes/agents.js");
// ─── Bootstrap ────────────────────────────────────────────────────────────────
const cfg = (0, config_js_1.loadConfig)();
const app = (0, express_1.default)();
// ─── Global middleware ────────────────────────────────────────────────────────
app.use((0, cors_1.default)({ origin: cfg.corsOrigin }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// Request logger
app.use((req, _res, next) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
    next();
});
// Rate limiting (all routes)
app.use((0, rateLimit_js_1.rateLimitMiddleware)(cfg.rateLimitWindowMs, cfg.rateLimitMax));
// ─── Health routes (no auth) ──────────────────────────────────────────────────
app.use('/v1', (0, health_js_1.healthRouter)(cfg));
// ─── x402 Payment middleware (wallet = identity) ──────────────────────────────
// Protects POST /v1/projects and POST /v1/projects/:id/versions
// Falls back to API key auth if x402 is not configured (dev mode)
if (cfg.x402Enabled && cfg.treasuryAddress) {
    const x402 = (0, x402_js_1.buildX402Middleware)({
        treasuryAddress: cfg.treasuryAddress,
        facilitatorUrl: cfg.x402FacilitatorUrl,
        network: cfg.network,
        cdpApiKeyId: cfg.cdpApiKeyId,
        cdpApiKeySecret: cfg.cdpApiKeySecret,
    });
    app.use('/v1', x402);
    console.log(`  [x402] Payment middleware active → Treasury: ${cfg.treasuryAddress}`);
}
else {
    // Dev mode — fall back to optional API key auth
    const authGuard = (0, auth_js_1.authMiddleware)(cfg.apiKey);
    app.use('/v1/projects', authGuard);
    app.use('/v1/agents', authGuard);
    console.log('  [x402] Disabled — using legacy auth (dev mode)');
}
// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/v1/projects', (0, projects_js_1.projectsRouter)(cfg));
app.use('/v1/agents', (0, agents_js_1.agentsRouter)(cfg));
// ─── Root redirect ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.json({
        name: '@inkd/api',
        version: '0.1.0',
        docs: 'https://docs.inkdprotocol.xyz/api',
        health: '/v1/health',
        status: '/v1/status',
        routes: [
            'GET  /v1/health',
            'GET  /v1/status',
            'GET  /v1/projects',
            'GET  /v1/projects/:id',
            'POST /v1/projects',
            'GET  /v1/projects/:id/versions',
            'POST /v1/projects/:id/versions',
            'GET  /v1/agents',
            'GET  /v1/agents/:id',
            'GET  /v1/agents/by-name/:name',
        ],
    });
});
// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
});
// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[inkd-api] Unhandled error:', err);
    res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
});
// ─── Start (local only — Vercel uses export default app) ─────────────────────
// Only listen when running directly (not as Vercel serverless function)
if (process.env['VERCEL'] !== '1') {
    app.listen(cfg.port, () => {
        console.log(`
  ┌─────────────────────────────────────────────────┐
  │           @inkd/api  v0.1.0                     │
  ├─────────────────────────────────────────────────┤
  │  Port:     ${String(cfg.port).padEnd(37)}│
  │  Network:  ${cfg.network.padEnd(37)}│
  │  RPC:      ${cfg.rpcUrl.slice(0, 37).padEnd(37)}│
  │  Auth:     ${(cfg.apiKey ? 'Bearer token (INKD_API_KEY)' : 'disabled (dev mode)').padEnd(37)}│
  │  Limit:    ${`${cfg.rateLimitMax} req/${cfg.rateLimitWindowMs / 1000}s`.padEnd(37)}│
  └─────────────────────────────────────────────────┘

  GET  http://localhost:${cfg.port}/v1/health
  GET  http://localhost:${cfg.port}/v1/status
  GET  http://localhost:${cfg.port}/v1/projects
  GET  http://localhost:${cfg.port}/v1/agents
  `);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map