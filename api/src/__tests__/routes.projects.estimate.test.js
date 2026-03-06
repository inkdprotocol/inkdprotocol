"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @inkd/api — GET /v1/projects/estimate route tests
 *
 * Tests the dynamic-pricing estimate endpoint end-to-end:
 *   - Happy path: valid bytes → JSON with arweaveCost, markup, total, human-readable fields
 *   - Validation: missing/zero/negative bytes → 400
 *   - Validation: bytes > 500MB → 400
 *   - Upstream failure: Arweave/CoinGecko fetch throws → 500
 *
 * Uses fetch mock (like arweave.test.ts) so getArweaveCostUsdc works
 * through the real implementation without hitting the network.
 */
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
// ─── Global fetch mock ────────────────────────────────────────────────────────
const mockFetch = vitest_1.vi.fn();
vitest_1.vi.stubGlobal('fetch', mockFetch);
// ─── Mock other dependencies ──────────────────────────────────────────────────
vitest_1.vi.mock('../clients.js', () => ({
    buildPublicClient: vitest_1.vi.fn(() => ({ readContract: vitest_1.vi.fn(), waitForTransactionReceipt: vitest_1.vi.fn() })),
    buildWalletClient: vitest_1.vi.fn(() => ({
        client: { writeContract: vitest_1.vi.fn() },
        address: '0xSERVER000000000000000000000000000000000A',
    })),
    normalizePrivateKey: (k) => (k.startsWith('0x') ? k : `0x${k}`),
}));
vitest_1.vi.mock('../config.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        ADDRESSES: {
            mainnet: { token: '0xTOKEN', registry: '0xREGISTRY', treasury: '0xTREASURY' },
            testnet: { token: '0xTOKEN', registry: '0xREGISTRY', treasury: '0xTREASURY' },
        },
    };
});
// ─── App factory ──────────────────────────────────────────────────────────────
const baseCfg = {
    port: 3000,
    network: 'testnet',
    rpcUrl: 'http://localhost:8545',
    apiKey: null,
    corsOrigin: '*',
    rateLimitWindowMs: 60_000,
    rateLimitMax: 100,
    serverWalletKey: '0xdeadbeef00000000000000000000000000000000000000000000000000000001',
    serverWalletAddress: '0xSERVER000000000000000000000000000000000A',
    x402FacilitatorUrl: 'https://x402.org/facilitator',
    x402Enabled: false,
    treasuryAddress: null,
};
let app;
// Import router once; arweave module is not mocked so fetch mock controls pricing
const projects_js_1 = require("../routes/projects.js");
(0, vitest_1.beforeEach)(() => {
    mockFetch.mockReset();
    const freshApp = (0, express_1.default)();
    freshApp.use(express_1.default.json());
    freshApp.use('/v1/projects', (0, projects_js_1.projectsRouter)(baseCfg));
    app = freshApp;
});
// ─── Fetch helpers ────────────────────────────────────────────────────────────
/** Set up fetch to return: arweave oracle → winstonStr, CoinGecko → arUsd  */
function mockPriceFetches(winstonStr, arUsd) {
    mockFetch
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(winstonStr), json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: arUsd } }), text: () => Promise.resolve('') });
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('GET /v1/projects/estimate', () => {
    (0, vitest_1.it)('returns correct estimate shape for a 1MB upload', async () => {
        // 1 AR in Winston at $10/AR → cost = $10, with 10% buffer → $11, 20% markup → $13.20
        mockPriceFetches('1000000000000', 10);
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=1048576');
        (0, vitest_1.expect)(res.status).toBe(200);
        // All required fields present
        (0, vitest_1.expect)(res.body).toHaveProperty('bytes', 1_048_576);
        (0, vitest_1.expect)(res.body).toHaveProperty('arweaveCost');
        (0, vitest_1.expect)(res.body).toHaveProperty('markup');
        (0, vitest_1.expect)(res.body).toHaveProperty('total');
        (0, vitest_1.expect)(res.body).toHaveProperty('markupPct', '20%');
        (0, vitest_1.expect)(res.body).toHaveProperty('arweaveCostUsd');
        (0, vitest_1.expect)(res.body).toHaveProperty('totalUsd');
    });
    (0, vitest_1.it)('markup = 20% of arweaveCost, total = arweaveCost + markup', async () => {
        mockPriceFetches('1000000000000', 10); // 1 AR × $10 × 1.10 = $11 = 11_000_000 base units
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=1048576');
        (0, vitest_1.expect)(res.status).toBe(200);
        const { arweaveCost, markup, total } = res.body;
        const cost = BigInt(arweaveCost);
        const m = BigInt(markup);
        const t = BigInt(total);
        (0, vitest_1.expect)(m).toBe(cost * 2000n / 10000n);
        (0, vitest_1.expect)(t).toBe(cost + m);
    });
    (0, vitest_1.it)('human-readable USD fields start with $', async () => {
        mockPriceFetches('500000000000', 20); // 0.5 AR × $20 × 1.10
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=512000');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.arweaveCostUsd).toMatch(/^\$/);
        (0, vitest_1.expect)(res.body.totalUsd).toMatch(/^\$/);
    });
    (0, vitest_1.it)('returns numeric string for arweaveCost, markup, total (USDC bigint serialized)', async () => {
        mockPriceFetches('1000000000000', 5);
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=100000');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.arweaveCost).toMatch(/^\d+$/);
        (0, vitest_1.expect)(res.body.markup).toMatch(/^\d+$/);
        (0, vitest_1.expect)(res.body.total).toMatch(/^\d+$/);
    });
    (0, vitest_1.it)('reflects correct bytes value in response', async () => {
        mockPriceFetches('1000000000000', 5);
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=250000');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.bytes).toBe(250_000);
    });
    // ─── Validation ────────────────────────────────────────────────────────────
    (0, vitest_1.it)('returns 400 when bytes param is missing', async () => {
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate');
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(mockFetch).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('returns 400 when bytes=0', async () => {
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=0');
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(mockFetch).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('returns 400 when bytes is negative', async () => {
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=-100');
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(mockFetch).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('returns 400 for non-numeric bytes', async () => {
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=foo');
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(mockFetch).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('returns 400 when bytes exceeds 500MB', async () => {
        const overLimit = 500 * 1024 * 1024 + 1;
        const res = await (0, supertest_1.default)(app).get(`/v1/projects/estimate?bytes=${overLimit}`);
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(mockFetch).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('accepts exactly 500MB as boundary', async () => {
        mockPriceFetches('1000000000000', 5);
        const boundary = 500 * 1024 * 1024;
        const res = await (0, supertest_1.default)(app).get(`/v1/projects/estimate?bytes=${boundary}`);
        (0, vitest_1.expect)(res.status).toBe(200);
    });
    // ─── Upstream errors ───────────────────────────────────────────────────────
    (0, vitest_1.it)('returns 500 when Arweave price oracle fails', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 10 } }), text: () => Promise.resolve('') });
        const res = await (0, supertest_1.default)(app).get('/v1/projects/estimate?bytes=1048576');
        (0, vitest_1.expect)(res.status).toBe(500);
    });
});
//# sourceMappingURL=routes.projects.estimate.test.js.map