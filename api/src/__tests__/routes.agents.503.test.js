"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @inkd/api — routes/agents.ts — requireRegistry() 503 branch
 *
 * Tests the `ServiceUnavailableError` path thrown by `requireRegistry()`
 * when ADDRESSES[network].registry is empty/unset.
 *
 * Runs in a separate file so it can use its own vi.mock for config.js
 * (empty registry address) without interfering with routes.agents.test.ts.
 */
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
// ─── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../clients.js', () => ({
    buildPublicClient: vitest_1.vi.fn(() => ({
        readContract: vitest_1.vi.fn(),
    })),
    buildWalletClient: vitest_1.vi.fn(),
    normalizePrivateKey: (k) => (k.startsWith('0x') ? k : `0x${k}`),
}));
// Empty registry address → requireRegistry() throws ServiceUnavailableError
vitest_1.vi.mock('../config.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        ADDRESSES: {
            mainnet: { token: '0xTOKEN', registry: '', treasury: '0xTREASURY' },
            testnet: { token: '0xTOKEN', registry: '', treasury: '0xTREASURY' },
        },
    };
});
// ─── Fixture ──────────────────────────────────────────────────────────────────
const baseCfg = {
    port: 3000,
    network: 'testnet',
    rpcUrl: 'http://localhost:8545',
    apiKey: null,
    corsOrigin: '*',
    rateLimitWindowMs: 60_000,
    rateLimitMax: 100,
    serverWalletKey: null,
    serverWalletAddress: null,
    x402FacilitatorUrl: 'https://x402.org/facilitator',
    x402Enabled: false,
    treasuryAddress: null,
};
async function makeApp() {
    const { agentsRouter } = await Promise.resolve().then(() => __importStar(require('../routes/agents.js')));
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/v1/agents', agentsRouter(baseCfg));
    return app;
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('GET /v1/agents — requireRegistry() ServiceUnavailable (503)', () => {
    (0, vitest_1.it)('returns 503 when registry address is not configured', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents');
        (0, vitest_1.expect)(res.status).toBe(503);
        (0, vitest_1.expect)(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
        (0, vitest_1.expect)(res.body.error.message).toContain('Registry contract not deployed');
    });
});
(0, vitest_1.describe)('GET /v1/agents/by-name/:name — requireRegistry() ServiceUnavailable (503)', () => {
    (0, vitest_1.it)('returns 503 when registry address is not configured', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/by-name/my-agent');
        (0, vitest_1.expect)(res.status).toBe(503);
        (0, vitest_1.expect)(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
});
(0, vitest_1.describe)('GET /v1/agents/:id — requireRegistry() ServiceUnavailable (503)', () => {
    (0, vitest_1.it)('returns 503 when registry address is not configured', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/1');
        (0, vitest_1.expect)(res.status).toBe(503);
        (0, vitest_1.expect)(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
});
//# sourceMappingURL=routes.agents.503.test.js.map