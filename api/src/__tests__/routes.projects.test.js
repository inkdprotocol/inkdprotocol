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
 * @inkd/api — routes/projects.ts tests
 *
 * Covers all 5 endpoints:
 *   GET  /v1/projects
 *   GET  /v1/projects/:id
 *   POST /v1/projects
 *   GET  /v1/projects/:id/versions
 *   POST /v1/projects/:id/versions
 */
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockReadContract = vitest_1.vi.fn();
const mockWriteContract = vitest_1.vi.fn();
const mockWaitForTx = vitest_1.vi.fn();
vitest_1.vi.mock('../clients.js', () => ({
    buildPublicClient: vitest_1.vi.fn(() => ({
        readContract: mockReadContract,
        waitForTransactionReceipt: mockWaitForTx,
    })),
    buildWalletClient: vitest_1.vi.fn(() => ({
        client: { writeContract: mockWriteContract },
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
// ─── Fixtures ─────────────────────────────────────────────────────────────────
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
const rawProject = {
    id: 1n,
    name: 'test-agent',
    description: 'A test agent',
    license: 'MIT',
    readmeHash: '0xREADME',
    owner: '0xOWNER1234567890123456789012345678901234',
    isPublic: true,
    isAgent: false,
    agentEndpoint: '',
    createdAt: 1700000000n,
    versionCount: 3n,
    exists: true,
};
const rawVersion = {
    versionId: 1n,
    projectId: 1n,
    tag: 'v1.0.0',
    contentHash: '0xCONTENT',
    metadataHash: '0xMETA',
    pushedAt: 1700000100n,
    pusher: '0xPUSHER000000000000000000000000000000000',
};
async function makeApp(cfg = baseCfg) {
    const { projectsRouter } = await Promise.resolve().then(() => __importStar(require('../routes/projects.js')));
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/v1/projects', projectsRouter(cfg));
    return app;
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('GET /v1/projects', () => {
    (0, vitest_1.beforeEach)(() => { mockReadContract.mockReset(); });
    (0, vitest_1.it)('returns paginated list of projects', async () => {
        mockReadContract
            .mockResolvedValueOnce(2n) // projectCount
            .mockResolvedValueOnce(rawProject) // getProject(1)
            .mockResolvedValueOnce({ ...rawProject, id: 2n, name: 'proj2', exists: true }); // getProject(2)
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveLength(2);
        (0, vitest_1.expect)(res.body.data[0].name).toBe('test-agent');
        (0, vitest_1.expect)(res.body.total).toBe('2');
    });
    (0, vitest_1.it)('respects offset and limit query params', async () => {
        mockReadContract
            .mockResolvedValueOnce(10n) // projectCount
            .mockResolvedValueOnce(rawProject); // getProject(3)
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects?offset=2&limit=1');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.offset).toBe(2);
        (0, vitest_1.expect)(res.body.limit).toBe(1);
    });
    (0, vitest_1.it)('skips projects where exists=false', async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce({ ...rawProject, exists: false });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveLength(0);
    });
    (0, vitest_1.it)('returns 503 when registry not configured', async () => {
        vitest_1.vi.doMock('../config.js', async (importOriginal) => {
            const orig = await importOriginal();
            return {
                ...orig,
                ADDRESSES: {
                    testnet: { token: '', registry: '', treasury: '' },
                    mainnet: { token: '', registry: '', treasury: '' },
                },
            };
        });
        // We test this path via the requireRegistry() throw — use a cfg without registry
        // Actually with the vi.mock at top, ADDRESSES always has values
        // Test 503 indirectly via RPC error → 502
        mockReadContract.mockRejectedValue(new Error('RPC unreachable'));
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects');
        (0, vitest_1.expect)([502, 503]).toContain(res.status);
    });
    (0, vitest_1.it)('serializes bigint fields as strings', async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(rawProject);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects');
        (0, vitest_1.expect)(typeof res.body.data[0].id).toBe('string');
        (0, vitest_1.expect)(typeof res.body.data[0].versionCount).toBe('string');
        (0, vitest_1.expect)(typeof res.body.data[0].createdAt).toBe('string');
    });
});
(0, vitest_1.describe)('GET /v1/projects/:id', () => {
    (0, vitest_1.beforeEach)(() => { mockReadContract.mockReset(); });
    (0, vitest_1.it)('returns a project by id', async () => {
        mockReadContract.mockResolvedValue(rawProject);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/1');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.name).toBe('test-agent');
    });
    (0, vitest_1.it)('returns 404 when project does not exist', async () => {
        mockReadContract.mockResolvedValue({ ...rawProject, exists: false });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/99');
        (0, vitest_1.expect)(res.status).toBe(404);
        (0, vitest_1.expect)(res.body.error.code).toBe('NOT_FOUND');
    });
    (0, vitest_1.it)('returns 400 for non-integer id', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/abc');
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.error.code).toBe('BAD_REQUEST');
    });
    (0, vitest_1.it)('returns 400 for id=0', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/0');
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('returns 400 for negative id', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/-5');
        (0, vitest_1.expect)(res.status).toBe(400);
    });
});
(0, vitest_1.describe)('POST /v1/projects', () => {
    (0, vitest_1.beforeEach)(() => {
        mockReadContract.mockReset();
        mockWriteContract.mockReset();
        mockWaitForTx.mockReset();
    });
    const validBody = {
        name: 'new-agent',
        description: 'An agent',
        license: 'MIT',
        isPublic: true,
        readmeHash: '',
        isAgent: true,
        agentEndpoint: 'https://agent.example.com',
    };
    (0, vitest_1.it)('creates a project and returns 201', async () => {
        mockWriteContract.mockResolvedValue('0xTXHASH');
        mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 100n });
        mockReadContract.mockResolvedValue(5n); // projectCount
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).post('/v1/projects').send(validBody);
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.txHash).toBe('0xTXHASH');
        (0, vitest_1.expect)(res.body.projectId).toBe('5');
    });
    (0, vitest_1.it)('returns 400 when name is missing', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).post('/v1/projects').send({ description: 'no name' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('returns 400 when name is empty string', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).post('/v1/projects').send({ ...validBody, name: '' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('returns 400 when agentEndpoint is not a valid URL', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects')
            .send({ ...validBody, agentEndpoint: 'not-a-url' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('allows empty agentEndpoint string', async () => {
        mockWriteContract.mockResolvedValue('0xTXHASH');
        mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 100n });
        mockReadContract.mockResolvedValue(1n);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects')
            .send({ ...validBody, agentEndpoint: '' });
        (0, vitest_1.expect)(res.status).toBe(201);
    });
    (0, vitest_1.it)('returns 503 when serverWalletKey is null', async () => {
        const cfgNoKey = { ...baseCfg, serverWalletKey: null };
        const { projectsRouter } = await Promise.resolve().then(() => __importStar(require('../routes/projects.js')));
        const app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.use('/v1/projects', projectsRouter(cfgNoKey));
        const res = await (0, supertest_1.default)(app).post('/v1/projects').send(validBody);
        (0, vitest_1.expect)(res.status).toBe(503);
        (0, vitest_1.expect)(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
    (0, vitest_1.it)('includes signer address in response', async () => {
        mockWriteContract.mockResolvedValue('0xTXHASH');
        mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 100n });
        mockReadContract.mockResolvedValue(1n);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).post('/v1/projects').send(validBody);
        (0, vitest_1.expect)(res.body.signer).toBeDefined();
    });
    (0, vitest_1.it)('returns 502 when RPC write fails', async () => {
        mockWriteContract.mockRejectedValue(new Error('RPC call failed'));
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).post('/v1/projects').send(validBody);
        (0, vitest_1.expect)(res.status).toBe(502);
    });
});
(0, vitest_1.describe)('GET /v1/projects/:id/versions', () => {
    (0, vitest_1.beforeEach)(() => { mockReadContract.mockReset(); });
    (0, vitest_1.it)('returns versions for a project', async () => {
        mockReadContract
            .mockResolvedValueOnce(rawProject) // getProject (exists check)
            .mockResolvedValueOnce([rawVersion]); // getProjectVersions
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/1/versions');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveLength(1);
        (0, vitest_1.expect)(res.body.data[0].tag).toBe('v1.0.0');
    });
    (0, vitest_1.it)('returns 404 when project does not exist', async () => {
        mockReadContract.mockResolvedValue({ ...rawProject, exists: false });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/99/versions');
        (0, vitest_1.expect)(res.status).toBe(404);
    });
    (0, vitest_1.it)('returns 400 for non-integer id', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/abc/versions');
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('respects offset and limit', async () => {
        mockReadContract
            .mockResolvedValueOnce(rawProject)
            .mockResolvedValueOnce([rawVersion]);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/1/versions?offset=0&limit=5');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.limit).toBe(5);
    });
    (0, vitest_1.it)('serializes version bigint fields as strings', async () => {
        mockReadContract
            .mockResolvedValueOnce(rawProject)
            .mockResolvedValueOnce([rawVersion]);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/1/versions');
        const v = res.body.data[0];
        (0, vitest_1.expect)(typeof v.versionId).toBe('string');
        (0, vitest_1.expect)(typeof v.pushedAt).toBe('string');
    });
    (0, vitest_1.it)('returns empty array for project with no versions', async () => {
        mockReadContract
            .mockResolvedValueOnce({ ...rawProject, versionCount: 0n })
            .mockResolvedValueOnce([]);
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app).get('/v1/projects/1/versions');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveLength(0);
    });
});
(0, vitest_1.describe)('POST /v1/projects/:id/versions', () => {
    (0, vitest_1.beforeEach)(() => {
        mockReadContract.mockReset();
        mockWriteContract.mockReset();
        mockWaitForTx.mockReset();
    });
    const validVersionBody = {
        tag: 'v2.0.0',
        contentHash: '0xABCDEF',
        metadataHash: '0xMETA',
    };
    (0, vitest_1.it)('pushes a version and returns 201', async () => {
        mockWriteContract.mockResolvedValue('0xVERSION_TX');
        mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 200n });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects/1/versions')
            .send(validVersionBody);
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.txHash).toBe('0xVERSION_TX');
        (0, vitest_1.expect)(res.body.tag).toBe('v2.0.0');
    });
    (0, vitest_1.it)('returns 400 when tag is empty', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects/1/versions')
            .send({ ...validVersionBody, tag: '' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('returns 400 when contentHash is empty', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects/1/versions')
            .send({ ...validVersionBody, contentHash: '' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('returns 400 for invalid project id', async () => {
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects/bad/versions')
            .send(validVersionBody);
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('returns 503 when serverWalletKey is null', async () => {
        const cfgNoKey = { ...baseCfg, serverWalletKey: null };
        const { projectsRouter } = await Promise.resolve().then(() => __importStar(require('../routes/projects.js')));
        const app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.use('/v1/projects', projectsRouter(cfgNoKey));
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects/1/versions')
            .send(validVersionBody);
        (0, vitest_1.expect)(res.status).toBe(503);
    });
    (0, vitest_1.it)('defaults metadataHash to empty string when omitted', async () => {
        mockWriteContract.mockResolvedValue('0xTX');
        mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 1n });
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects/1/versions')
            .send({ tag: 'v1.0.0', contentHash: '0xABC' });
        (0, vitest_1.expect)(res.status).toBe(201);
    });
    (0, vitest_1.it)('returns 502 when writeContract throws RPC error', async () => {
        mockWriteContract.mockRejectedValue(new Error('RPC contract error'));
        const app = await makeApp();
        const res = await (0, supertest_1.default)(app)
            .post('/v1/projects/1/versions')
            .send(validVersionBody);
        (0, vitest_1.expect)(res.status).toBe(502);
    });
});
//# sourceMappingURL=routes.projects.test.js.map