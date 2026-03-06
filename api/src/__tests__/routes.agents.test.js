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
 * @inkd/api — routes/agents.ts tests
 *
 * Covers:
 *   GET /v1/agents
 *   GET /v1/agents/by-name/:name
 *   GET /v1/agents/:id
 */
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockReadContract = vitest_1.vi.fn();
vitest_1.vi.mock('../clients.js', () => ({
    buildPublicClient: vitest_1.vi.fn(() => ({
        readContract: mockReadContract,
    })),
    buildWalletClient: vitest_1.vi.fn(),
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
// ─── Fixtures ─────────────────────────────────────────────────────────────────
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
const rawAgent = {
    id: 1n,
    name: 'smart-agent',
    description: 'A smart AI agent',
    owner: '0xOWNER0000000000000000000000000000000001',
    agentEndpoint: 'https://smart-agent.example.com',
    isPublic: true,
    isAgent: true,
    license: 'MIT',
    readmeHash: '',
    versionCount: 2n,
    createdAt: 1700000000n,
    exists: true,
};
async function makeApp() {
    const { agentsRouter } = await Promise.resolve().then(() => __importStar(require('../routes/agents.js')));
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/v1/agents', agentsRouter(baseCfg));
    return app;
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('GET /v1/agents', () => {
    (0, vitest_1.beforeEach)(() => { mockReadContract.mockReset(); });
    (0, vitest_1.it)('returns list of agents', async () => {
        mockReadContract.mockResolvedValue([rawAgent]);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveLength(1);
        (0, vitest_1.expect)(res.body.data[0].name).toBe('smart-agent');
    });
    (0, vitest_1.it)('returns empty array when no agents', async () => {
        mockReadContract.mockResolvedValue([]);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveLength(0);
        (0, vitest_1.expect)(res.body.count).toBe(0);
    });
    (0, vitest_1.it)('includes offset, limit, count in response', async () => {
        mockReadContract.mockResolvedValue([rawAgent]);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents?offset=5&limit=10');
        (0, vitest_1.expect)(res.body.offset).toBe(5);
        (0, vitest_1.expect)(res.body.limit).toBe(10);
        (0, vitest_1.expect)(res.body.count).toBe(1);
    });
    (0, vitest_1.it)('serializes bigint fields as strings', async () => {
        mockReadContract.mockResolvedValue([rawAgent]);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents');
        (0, vitest_1.expect)(typeof res.body.data[0].id).toBe('string');
        (0, vitest_1.expect)(typeof res.body.data[0].versionCount).toBe('string');
        (0, vitest_1.expect)(typeof res.body.data[0].createdAt).toBe('string');
    });
    (0, vitest_1.it)('returns 502 when RPC fails', async () => {
        mockReadContract.mockRejectedValue(new Error('RPC error'));
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents');
        (0, vitest_1.expect)(res.status).toBe(502);
    });
});
(0, vitest_1.describe)('GET /v1/agents/by-name/:name', () => {
    (0, vitest_1.beforeEach)(() => { mockReadContract.mockReset(); });
    (0, vitest_1.it)('returns agent by name', async () => {
        mockReadContract
            .mockResolvedValueOnce(1n) // getProjectByName → projectId
            .mockResolvedValueOnce(rawAgent); // getProject
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/by-name/smart-agent');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.name).toBe('smart-agent');
    });
    (0, vitest_1.it)('returns 404 when project id is 0n', async () => {
        mockReadContract.mockResolvedValue(0n); // getProjectByName → not found
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/by-name/unknown-agent');
        (0, vitest_1.expect)(res.status).toBe(404);
        (0, vitest_1.expect)(res.body.error.code).toBe('NOT_FOUND');
    });
    (0, vitest_1.it)('returns 404 when project does not exist', async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce({ ...rawAgent, exists: false });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/by-name/gone-agent');
        (0, vitest_1.expect)(res.status).toBe(404);
    });
    (0, vitest_1.it)('returns 404 when project is not an agent', async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce({ ...rawAgent, isAgent: false });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/by-name/not-an-agent');
        (0, vitest_1.expect)(res.status).toBe(404);
    });
    (0, vitest_1.it)('returns 502 when RPC fails', async () => {
        mockReadContract.mockRejectedValue(new Error('RPC contract failure'));
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/by-name/some-agent');
        (0, vitest_1.expect)(res.status).toBe(502);
    });
});
(0, vitest_1.describe)('GET /v1/agents/:id', () => {
    (0, vitest_1.beforeEach)(() => { mockReadContract.mockReset(); });
    (0, vitest_1.it)('returns agent project by id', async () => {
        mockReadContract.mockResolvedValue(rawAgent);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/1');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.agentEndpoint).toBe('https://smart-agent.example.com');
    });
    (0, vitest_1.it)('returns 404 when project does not exist', async () => {
        mockReadContract.mockResolvedValue({ ...rawAgent, exists: false });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/999');
        (0, vitest_1.expect)(res.status).toBe(404);
    });
    (0, vitest_1.it)('returns 404 when project is not an agent', async () => {
        mockReadContract.mockResolvedValue({ ...rawAgent, isAgent: false });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/2');
        (0, vitest_1.expect)(res.status).toBe(404);
        (0, vitest_1.expect)(res.body.error.message).toContain('not an agent');
    });
    (0, vitest_1.it)('returns 400 for invalid id', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/xyz');
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.error.code).toBe('BAD_REQUEST');
    });
    (0, vitest_1.it)('returns 400 for id=0', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/0');
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('returns 502 on RPC error', async () => {
        mockReadContract.mockRejectedValue(new Error('RPC failed'));
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/agents/1');
        (0, vitest_1.expect)(res.status).toBe(502);
    });
});
//# sourceMappingURL=routes.agents.test.js.map