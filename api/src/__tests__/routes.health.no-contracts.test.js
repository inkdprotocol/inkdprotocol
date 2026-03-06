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
 * @inkd/api — routes/health.ts — contracts-not-deployed branch
 *
 * Tests the `contractsDeployed = false` path in GET /v1/status.
 * When ADDRESSES has empty token/registry the if(contractsDeployed) block
 * is skipped entirely: rpcReachable stays false, counts stay null.
 *
 * Runs in a separate file so we can use a different vi.mock for config.js
 * without affecting the main routes.health.test.ts mock.
 */
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
// ─── Mock clients (no RPC calls expected in this scenario) ───────────────────
const mockReadContract = vitest_1.vi.fn();
vitest_1.vi.mock('../clients.js', () => ({
    buildPublicClient: vitest_1.vi.fn(() => ({
        readContract: mockReadContract,
    })),
    buildWalletClient: vitest_1.vi.fn(),
    normalizePrivateKey: (k) => (k.startsWith('0x') ? k : `0x${k}`),
}));
// ─── Mock config: no contracts deployed ──────────────────────────────────────
vitest_1.vi.mock('../config.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        ADDRESSES: {
            mainnet: { token: '', registry: '', treasury: '' },
            testnet: { token: '', registry: '', treasury: '' },
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
    const { healthRouter } = await Promise.resolve().then(() => __importStar(require('../routes/health.js')));
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/v1', healthRouter(baseCfg));
    return app;
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('GET /v1/status — contracts not deployed (empty ADDRESSES)', () => {
    (0, vitest_1.it)('returns 200 with rpcReachable: false when no contract addresses configured', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.ok).toBe(true);
        (0, vitest_1.expect)(res.body.rpcReachable).toBe(false);
    });
    (0, vitest_1.it)('returns null protocol counts when contracts not deployed', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.body.protocol.projectCount).toBeNull();
        (0, vitest_1.expect)(res.body.protocol.totalSupply).toBeNull();
    });
    (0, vitest_1.it)('returns contracts.deployed: false', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.body.contracts.deployed).toBe(false);
    });
    (0, vitest_1.it)('returns null contract addresses', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.body.contracts.token).toBeNull();
        (0, vitest_1.expect)(res.body.contracts.registry).toBeNull();
        (0, vitest_1.expect)(res.body.contracts.treasury).toBeNull();
    });
    (0, vitest_1.it)('does NOT call readContract when contracts are not deployed', async () => {
        mockReadContract.mockReset();
        const app = await makeApp();
        await (0, supertest_1.default)(app).get('/v1/status');
        // The if(contractsDeployed) block is skipped — no RPC calls
        (0, vitest_1.expect)(mockReadContract).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('still returns server uptime and version', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(typeof res.body.server.uptimeMs).toBe('number');
        (0, vitest_1.expect)(res.body.server.version).toBe('0.1.0');
    });
    (0, vitest_1.it)('still returns network and rpcUrl fields', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/status');
        (0, vitest_1.expect)(res.body.network).toBe('testnet');
        (0, vitest_1.expect)(res.body.rpcUrl).toBe('http://localhost:8545');
    });
});
(0, vitest_1.describe)('GET /v1/health — always 200 regardless of contract state', () => {
    (0, vitest_1.it)('returns ok: true even when no contracts deployed', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/health');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.ok).toBe(true);
        (0, vitest_1.expect)(res.body.service).toBe('@inkd/api');
    });
});
//# sourceMappingURL=routes.health.no-contracts.test.js.map