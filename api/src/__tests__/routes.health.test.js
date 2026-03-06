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
 * @inkd/api — routes/health.ts tests
 *
 * Tests GET /v1/health and GET /v1/status using supertest + mocked viem clients.
 */
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
// ─── Mock viem clients ────────────────────────────────────────────────────────
const mockReadContract = vitest_1.vi.fn();
vitest_1.vi.mock('../clients.js', () => ({
    buildPublicClient: vitest_1.vi.fn(() => ({
        readContract: mockReadContract,
    })),
    buildWalletClient: vitest_1.vi.fn(),
    normalizePrivateKey: (k) => (k.startsWith('0x') ? k : `0x${k}`),
}));
// ─── Fixture config ───────────────────────────────────────────────────────────
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
const cfgWithContracts = {
    ...baseCfg,
};
// Override ADDRESSES for tests
vitest_1.vi.mock('../config.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        ADDRESSES: {
            mainnet: {
                token: '0xTOKEN',
                registry: '0xREGISTRY',
                treasury: '0xTREASURY',
            },
            testnet: {
                token: '0xTOKEN',
                registry: '0xREGISTRY',
                treasury: '0xTREASURY',
            },
        },
    };
});
// ─── Setup app ────────────────────────────────────────────────────────────────
async function makeApp(cfg = cfgWithContracts) {
    const { healthRouter } = await Promise.resolve().then(() => __importStar(require('../routes/health.js')));
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/v1', healthRouter(cfg));
    return app;
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('GET /v1/health', () => {
    (0, vitest_1.it)('returns 200 with ok: true', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/health');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.ok).toBe(true);
    });
    (0, vitest_1.it)('includes service and version fields', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/health');
        (0, vitest_1.expect)(res.body.service).toBe('@inkd/api');
        (0, vitest_1.expect)(res.body.version).toBe('0.1.0');
    });
    (0, vitest_1.it)('includes uptimeMs', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/health');
        (0, vitest_1.expect)(typeof res.body.uptimeMs).toBe('number');
        (0, vitest_1.expect)(res.body.uptimeMs).toBeGreaterThanOrEqual(0);
    });
});
(0, vitest_1.describe)('GET /v1/status', () => {
    (0, vitest_1.beforeEach)(() => {
        mockReadContract.mockReset();
    });
    (0, vitest_1.it)('returns rpcReachable: true when contracts are deployed and RPC works', async () => {
        mockReadContract
            .mockResolvedValueOnce(42n) // projectCount
            .mockResolvedValueOnce(1000000000000000000000n); // totalSupply
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.rpcReachable).toBe(true);
        (0, vitest_1.expect)(res.body.protocol.projectCount).toBe('42');
        (0, vitest_1.expect)(res.body.protocol.totalSupply).toContain('INKD');
    });
    (0, vitest_1.it)('returns rpcReachable: false when RPC call throws', async () => {
        mockReadContract.mockRejectedValue(new Error('RPC timeout'));
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.rpcReachable).toBe(false);
        (0, vitest_1.expect)(res.body.protocol.projectCount).toBeNull();
    });
    (0, vitest_1.it)('includes contract addresses in response', async () => {
        mockReadContract.mockResolvedValue(0n);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.body.contracts.token).toBe('0xTOKEN');
        (0, vitest_1.expect)(res.body.contracts.registry).toBe('0xREGISTRY');
    });
    (0, vitest_1.it)('returns network and rpcUrl fields in response', async () => {
        mockReadContract.mockResolvedValue(0n);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.network).toBe('testnet');
        (0, vitest_1.expect)(res.body.rpcUrl).toBe('http://localhost:8545');
    });
    (0, vitest_1.it)('includes server.version', async () => {
        mockReadContract.mockResolvedValue(0n);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.body.server.version).toBe('0.1.0');
    });
    (0, vitest_1.it)('calls sendError when handler throws (outer catch — covers health.ts:90)', async () => {
        // Pass a config whose network key is absent from the mocked ADDRESSES map.
        // healthRouter() sets `addrs = ADDRESSES[cfg.network]` → undefined.
        // Inside the route handler `Boolean(addrs.registry)` throws a TypeError,
        // which is caught by the outer try/catch and forwarded to sendError().
        const brokenCfg = {
            ...baseCfg,
            network: 'broken',
        };
        const { healthRouter } = await Promise.resolve().then(() => __importStar(require('../routes/health.js')));
        const app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.use('/v1', healthRouter(brokenCfg));
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.status).toBe(500);
        (0, vitest_1.expect)(res.body.error).toBeDefined();
    });
});
//# sourceMappingURL=routes.health.test.js.map