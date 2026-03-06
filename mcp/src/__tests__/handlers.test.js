"use strict";
/**
 * @inkd/mcp — Handler unit tests
 *
 * Tests all 5 tool handlers in isolation.
 * No MCP server, no stdio, no network — pure function testing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const handlers_js_1 = require("../handlers.js");
// ─── Helpers ─────────────────────────────────────────────────────────────────
function mockRes(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Server Error',
        json: () => Promise.resolve(body),
    };
}
function makeCtx(overrides = {}) {
    return {
        apiUrl: 'https://api.inkdprotocol.com',
        fetch: vitest_1.vi.fn(),
        readFetch: vitest_1.vi.fn(),
        ...overrides,
    };
}
// ─── handleCreateProject ─────────────────────────────────────────────────────
(0, vitest_1.describe)('handleCreateProject', () => {
    (0, vitest_1.it)('returns success message on 201', async () => {
        const ctx = makeCtx({
            fetch: vitest_1.vi.fn().mockResolvedValue(mockRes({
                projectId: '7',
                owner: '0xABCD',
                txHash: '0xTX',
            }, 201)),
        });
        const result = await (0, handlers_js_1.handleCreateProject)({ name: 'my-tool' }, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('my-tool');
        (0, vitest_1.expect)(result.content[0].text).toContain('Project ID: 7');
        (0, vitest_1.expect)(result.content[0].text).toContain('0xABCD');
        (0, vitest_1.expect)(result.content[0].text).toContain('0xTX');
    });
    (0, vitest_1.it)('includes basescan link', async () => {
        const ctx = makeCtx({
            fetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ projectId: '1', owner: '0x1', txHash: '0xHASH' })),
        });
        const result = await (0, handlers_js_1.handleCreateProject)({ name: 'x' }, ctx);
        (0, vitest_1.expect)(result.content[0].text).toContain('basescan.org/tx/0xHASH');
    });
    (0, vitest_1.it)('sends correct body with defaults', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ projectId: '1', owner: '0x1', txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await (0, handlers_js_1.handleCreateProject)({ name: 'test-proj' }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.name).toBe('test-proj');
        (0, vitest_1.expect)(body.license).toBe('MIT');
        (0, vitest_1.expect)(body.isPublic).toBe(true);
        (0, vitest_1.expect)(body.isAgent).toBe(false);
        (0, vitest_1.expect)(body.description).toBe('');
    });
    (0, vitest_1.it)('passes through custom fields', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ projectId: '2', owner: '0x2', txHash: '0x2' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await (0, handlers_js_1.handleCreateProject)({
            name: 'agent-tool',
            description: 'A useful agent',
            license: 'Apache-2.0',
            isPublic: false,
            isAgent: true,
            agentEndpoint: 'https://api.agent.xyz',
        }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.description).toBe('A useful agent');
        (0, vitest_1.expect)(body.license).toBe('Apache-2.0');
        (0, vitest_1.expect)(body.isPublic).toBe(false);
        (0, vitest_1.expect)(body.isAgent).toBe(true);
        (0, vitest_1.expect)(body.agentEndpoint).toBe('https://api.agent.xyz');
    });
    (0, vitest_1.it)('returns isError on non-ok response', async () => {
        const ctx = makeCtx({
            fetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ error: { message: 'name taken' } }, 409)),
        });
        const result = await (0, handlers_js_1.handleCreateProject)({ name: 'taken' }, ctx);
        (0, vitest_1.expect)(result.isError).toBe(true);
        (0, vitest_1.expect)(result.content[0].text).toContain('Error');
    });
    (0, vitest_1.it)('posts to correct endpoint', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ projectId: '1', owner: '0x1', txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock, apiUrl: 'https://custom.api' });
        await (0, handlers_js_1.handleCreateProject)({ name: 'x' }, ctx);
        (0, vitest_1.expect)(fetchMock.mock.calls[0][0]).toBe('https://custom.api/v1/projects');
    });
});
// ─── handlePushVersion ───────────────────────────────────────────────────────
(0, vitest_1.describe)('handlePushVersion', () => {
    (0, vitest_1.it)('returns success on ok', async () => {
        const ctx = makeCtx({
            fetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ txHash: '0xVERSIONTX' })),
        });
        const result = await (0, handlers_js_1.handlePushVersion)({
            projectId: '5',
            tag: 'v1.2.0',
            contentHash: 'ar://QmXyz',
        }, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('v1.2.0');
        (0, vitest_1.expect)(result.content[0].text).toContain('#5');
        (0, vitest_1.expect)(result.content[0].text).toContain('0xVERSIONTX');
    });
    (0, vitest_1.it)('sends metadataHash defaulting to empty string', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await (0, handlers_js_1.handlePushVersion)({ projectId: '1', tag: 'v1', contentHash: 'ar://abc' }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.metadataHash).toBe('');
    });
    (0, vitest_1.it)('passes metadataHash when provided', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await (0, handlers_js_1.handlePushVersion)({
            projectId: '1',
            tag: 'v2',
            contentHash: 'ar://abc',
            metadataHash: 'ar://meta',
        }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.metadataHash).toBe('ar://meta');
    });
    (0, vitest_1.it)('calls correct endpoint', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await (0, handlers_js_1.handlePushVersion)({ projectId: '42', tag: 'v1', contentHash: 'ar://x' }, ctx);
        (0, vitest_1.expect)(fetchMock.mock.calls[0][0]).toContain('/v1/projects/42/versions');
    });
    (0, vitest_1.it)('returns isError on failure', async () => {
        const ctx = makeCtx({
            fetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ error: { message: 'not owner' } }, 403)),
        });
        const result = await (0, handlers_js_1.handlePushVersion)({ projectId: '1', tag: 'v1', contentHash: 'ar://x' }, ctx);
        (0, vitest_1.expect)(result.isError).toBe(true);
    });
});
// ─── handleGetProject ─────────────────────────────────────────────────────────
(0, vitest_1.describe)('handleGetProject', () => {
    const project = {
        id: '3',
        name: 'my-sdk',
        owner: '0xOWNER',
        description: 'A cool SDK',
        license: 'MIT',
        versionCount: '5',
        isPublic: true,
        isAgent: false,
        agentEndpoint: '',
    };
    (0, vitest_1.it)('returns formatted project info', async () => {
        const ctx = makeCtx({ readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ data: project })) });
        const result = await (0, handlers_js_1.handleGetProject)({ projectId: '3' }, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('my-sdk');
        (0, vitest_1.expect)(result.content[0].text).toContain('0xOWNER');
        (0, vitest_1.expect)(result.content[0].text).toContain('MIT');
        (0, vitest_1.expect)(result.content[0].text).toContain('Versions: 5');
    });
    (0, vitest_1.it)('shows agent endpoint when isAgent=true', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({
                data: { ...project, isAgent: true, agentEndpoint: 'https://api.agent.xyz' },
            })),
        });
        const result = await (0, handlers_js_1.handleGetProject)({ projectId: '3' }, ctx);
        (0, vitest_1.expect)(result.content[0].text).toContain('https://api.agent.xyz');
    });
    (0, vitest_1.it)('returns not-found message on 404', async () => {
        const ctx = makeCtx({ readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({}, 404)) });
        const result = await (0, handlers_js_1.handleGetProject)({ projectId: '999' }, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('not found');
    });
    (0, vitest_1.it)('returns isError on server error', async () => {
        const ctx = makeCtx({ readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({}, 500)) });
        const result = await (0, handlers_js_1.handleGetProject)({ projectId: '1' }, ctx);
        (0, vitest_1.expect)(result.isError).toBe(true);
    });
    (0, vitest_1.it)('omits endpoint line when isAgent=false', async () => {
        const ctx = makeCtx({ readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ data: project })) });
        const result = await (0, handlers_js_1.handleGetProject)({ projectId: '3' }, ctx);
        (0, vitest_1.expect)(result.content[0].text).not.toContain('Endpoint:');
    });
});
// ─── handleGetVersions ────────────────────────────────────────────────────────
(0, vitest_1.describe)('handleGetVersions', () => {
    const versions = [
        { tag: 'v1.0.0', contentHash: 'ar://Qm1', pushedAt: '1700000000' },
        { tag: 'v1.1.0', contentHash: 'ar://Qm2', pushedAt: '1700100000' },
    ];
    (0, vitest_1.it)('returns formatted version list', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ data: versions, total: '2' })),
        });
        const result = await (0, handlers_js_1.handleGetVersions)({ projectId: '5' }, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('total: 2');
        (0, vitest_1.expect)(result.content[0].text).toContain('v1.0.0');
        (0, vitest_1.expect)(result.content[0].text).toContain('v1.1.0');
        (0, vitest_1.expect)(result.content[0].text).toContain('ar://Qm1');
    });
    (0, vitest_1.it)('uses default limit=20 and offset=0', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await (0, handlers_js_1.handleGetVersions)({ projectId: '1' }, ctx);
        const url = fetchMock.mock.calls[0][0];
        (0, vitest_1.expect)(url).toContain('limit=20');
        (0, vitest_1.expect)(url).toContain('offset=0');
    });
    (0, vitest_1.it)('passes custom limit and offset', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await (0, handlers_js_1.handleGetVersions)({ projectId: '1', limit: 5, offset: 10 }, ctx);
        const url = fetchMock.mock.calls[0][0];
        (0, vitest_1.expect)(url).toContain('limit=5');
        (0, vitest_1.expect)(url).toContain('offset=10');
    });
    (0, vitest_1.it)('returns isError on failure', async () => {
        const ctx = makeCtx({ readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({}, 500)) });
        const result = await (0, handlers_js_1.handleGetVersions)({ projectId: '1' }, ctx);
        (0, vitest_1.expect)(result.isError).toBe(true);
    });
});
// ─── handleListAgents ─────────────────────────────────────────────────────────
(0, vitest_1.describe)('handleListAgents', () => {
    const agents = [
        { id: '1', name: 'agent-alpha', owner: '0xA1', agentEndpoint: 'https://alpha.ai' },
        { id: '2', name: 'agent-beta', owner: '0xB2', agentEndpoint: '' },
    ];
    (0, vitest_1.it)('returns formatted agent list', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ data: agents, total: '2' })),
        });
        const result = await (0, handlers_js_1.handleListAgents)({}, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('total: 2');
        (0, vitest_1.expect)(result.content[0].text).toContain('agent-alpha');
        (0, vitest_1.expect)(result.content[0].text).toContain('0xA1');
        (0, vitest_1.expect)(result.content[0].text).toContain('https://alpha.ai');
    });
    (0, vitest_1.it)('omits endpoint when empty', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ data: agents, total: '2' })),
        });
        const result = await (0, handlers_js_1.handleListAgents)({}, ctx);
        // agent-beta has no endpoint — line should not have "endpoint:"
        const lines = result.content[0].text.split('\n');
        const betaLine = lines.find(l => l.includes('agent-beta'));
        (0, vitest_1.expect)(betaLine).not.toContain('endpoint:');
    });
    (0, vitest_1.it)('uses default pagination', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await (0, handlers_js_1.handleListAgents)({}, ctx);
        const url = fetchMock.mock.calls[0][0];
        (0, vitest_1.expect)(url).toContain('limit=20');
        (0, vitest_1.expect)(url).toContain('offset=0');
    });
    (0, vitest_1.it)('accepts custom pagination', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await (0, handlers_js_1.handleListAgents)({ limit: 10, offset: 5 }, ctx);
        const url = fetchMock.mock.calls[0][0];
        (0, vitest_1.expect)(url).toContain('limit=10');
        (0, vitest_1.expect)(url).toContain('offset=5');
    });
    (0, vitest_1.it)('returns isError on failure', async () => {
        const ctx = makeCtx({ readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({}, 503)) });
        const result = await (0, handlers_js_1.handleListAgents)({}, ctx);
        (0, vitest_1.expect)(result.isError).toBe(true);
    });
    (0, vitest_1.it)('calls correct agents endpoint', async () => {
        const fetchMock = vitest_1.vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock, apiUrl: 'https://api.test' });
        await (0, handlers_js_1.handleListAgents)({}, ctx);
        (0, vitest_1.expect)(fetchMock.mock.calls[0][0]).toContain('https://api.test/v1/agents');
    });
    (0, vitest_1.it)('handles empty agents list gracefully', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' })),
        });
        const result = await (0, handlers_js_1.handleListAgents)({}, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('total: 0');
        // Only the header line, no agent entries
        const lines = result.content[0].text.split('\n').filter(Boolean);
        (0, vitest_1.expect)(lines).toHaveLength(1);
    });
});
// ─── Edge cases: untested branches ───────────────────────────────────────────
(0, vitest_1.describe)('handleCreateProject — json parse failure on error response', () => {
    (0, vitest_1.it)('falls back to {} when error body is not valid JSON', async () => {
        const ctx = makeCtx({
            fetch: vitest_1.vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                // json() rejects — simulates non-JSON error body (e.g. HTML 502 page)
                json: () => Promise.reject(new SyntaxError('Unexpected token')),
            }),
        });
        const result = await (0, handlers_js_1.handleCreateProject)({ name: 'x' }, ctx);
        (0, vitest_1.expect)(result.isError).toBe(true);
        // Fallback {} serialises to "{}"
        (0, vitest_1.expect)(result.content[0].text).toContain('Error:');
        (0, vitest_1.expect)(result.content[0].text).toContain('{}');
    });
});
(0, vitest_1.describe)('handlePushVersion — json parse failure on error response', () => {
    (0, vitest_1.it)('falls back to {} when error body is not valid JSON', async () => {
        const ctx = makeCtx({
            fetch: vitest_1.vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
                json: () => Promise.reject(new SyntaxError('Unexpected token')),
            }),
        });
        const result = await (0, handlers_js_1.handlePushVersion)({ projectId: '1', tag: 'v1', contentHash: 'ar://x' }, ctx);
        (0, vitest_1.expect)(result.isError).toBe(true);
        (0, vitest_1.expect)(result.content[0].text).toContain('{}');
    });
});
(0, vitest_1.describe)('handleGetProject — description fallback', () => {
    (0, vitest_1.it)('shows (none) when description is empty string', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({
                data: {
                    id: '10',
                    name: 'no-desc-proj',
                    owner: '0xX',
                    description: '', // ← empty
                    license: 'MIT',
                    versionCount: '0',
                    isPublic: true,
                    isAgent: false,
                    agentEndpoint: '',
                },
            })),
        });
        const result = await (0, handlers_js_1.handleGetProject)({ projectId: '10' }, ctx);
        (0, vitest_1.expect)(result.content[0].text).toContain('(none)');
    });
    (0, vitest_1.it)('shows (none) when description is undefined', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({
                data: {
                    id: '11',
                    name: 'undef-desc',
                    owner: '0xY',
                    // description omitted
                    license: 'Apache-2.0',
                    versionCount: '1',
                    isPublic: false,
                    isAgent: false,
                    agentEndpoint: '',
                },
            })),
        });
        const result = await (0, handlers_js_1.handleGetProject)({ projectId: '11' }, ctx);
        (0, vitest_1.expect)(result.content[0].text).toContain('(none)');
    });
});
(0, vitest_1.describe)('handleGetVersions — empty list and date formatting', () => {
    (0, vitest_1.it)('handles empty versions list gracefully', async () => {
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' })),
        });
        const result = await (0, handlers_js_1.handleGetVersions)({ projectId: '99' }, ctx);
        (0, vitest_1.expect)(result.isError).toBeFalsy();
        (0, vitest_1.expect)(result.content[0].text).toContain('total: 0');
        const lines = result.content[0].text.split('\n').filter(Boolean);
        (0, vitest_1.expect)(lines).toHaveLength(1);
    });
    (0, vitest_1.it)('formats pushedAt unix timestamp as ISO date YYYY-MM-DD', async () => {
        // 2024-01-15T00:00:00Z === 1705276800
        const ctx = makeCtx({
            readFetch: vitest_1.vi.fn().mockResolvedValue(mockRes({
                data: [{ tag: 'v2.0.0', contentHash: 'ar://QmZ', pushedAt: '1705276800' }],
                total: '1',
            })),
        });
        const result = await (0, handlers_js_1.handleGetVersions)({ projectId: '1' }, ctx);
        (0, vitest_1.expect)(result.content[0].text).toContain('2024-01-15');
    });
});
//# sourceMappingURL=handlers.test.js.map