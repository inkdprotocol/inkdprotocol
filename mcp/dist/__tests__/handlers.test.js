/**
 * @inkd/mcp — Handler unit tests
 *
 * Tests all 5 tool handlers in isolation.
 * No MCP server, no stdio, no network — pure function testing.
 */
import { describe, it, expect, vi } from 'vitest';
import { handleCreateProject, handlePushVersion, handleGetProject, handleGetVersions, handleListAgents, } from '../handlers.js';
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
        fetch: vi.fn(),
        readFetch: vi.fn(),
        ...overrides,
    };
}
// ─── handleCreateProject ─────────────────────────────────────────────────────
describe('handleCreateProject', () => {
    it('returns success message on 201', async () => {
        const ctx = makeCtx({
            fetch: vi.fn().mockResolvedValue(mockRes({
                projectId: '7',
                owner: '0xABCD',
                txHash: '0xTX',
            }, 201)),
        });
        const result = await handleCreateProject({ name: 'my-tool' }, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('my-tool');
        expect(result.content[0].text).toContain('Project ID: 7');
        expect(result.content[0].text).toContain('0xABCD');
        expect(result.content[0].text).toContain('0xTX');
    });
    it('includes basescan link', async () => {
        const ctx = makeCtx({
            fetch: vi.fn().mockResolvedValue(mockRes({ projectId: '1', owner: '0x1', txHash: '0xHASH' })),
        });
        const result = await handleCreateProject({ name: 'x' }, ctx);
        expect(result.content[0].text).toContain('basescan.org/tx/0xHASH');
    });
    it('sends correct body with defaults', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ projectId: '1', owner: '0x1', txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await handleCreateProject({ name: 'test-proj' }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.name).toBe('test-proj');
        expect(body.license).toBe('MIT');
        expect(body.isPublic).toBe(true);
        expect(body.isAgent).toBe(false);
        expect(body.description).toBe('');
    });
    it('passes through custom fields', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ projectId: '2', owner: '0x2', txHash: '0x2' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await handleCreateProject({
            name: 'agent-tool',
            description: 'A useful agent',
            license: 'Apache-2.0',
            isPublic: false,
            isAgent: true,
            agentEndpoint: 'https://api.agent.xyz',
        }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.description).toBe('A useful agent');
        expect(body.license).toBe('Apache-2.0');
        expect(body.isPublic).toBe(false);
        expect(body.isAgent).toBe(true);
        expect(body.agentEndpoint).toBe('https://api.agent.xyz');
    });
    it('returns isError on non-ok response', async () => {
        const ctx = makeCtx({
            fetch: vi.fn().mockResolvedValue(mockRes({ error: { message: 'name taken' } }, 409)),
        });
        const result = await handleCreateProject({ name: 'taken' }, ctx);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error');
    });
    it('posts to correct endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ projectId: '1', owner: '0x1', txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock, apiUrl: 'https://custom.api' });
        await handleCreateProject({ name: 'x' }, ctx);
        expect(fetchMock.mock.calls[0][0]).toBe('https://custom.api/v1/projects');
    });
});
// ─── handlePushVersion ───────────────────────────────────────────────────────
describe('handlePushVersion', () => {
    it('returns success on ok', async () => {
        const ctx = makeCtx({
            fetch: vi.fn().mockResolvedValue(mockRes({ txHash: '0xVERSIONTX' })),
        });
        const result = await handlePushVersion({
            projectId: '5',
            tag: 'v1.2.0',
            contentHash: 'ar://QmXyz',
        }, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('v1.2.0');
        expect(result.content[0].text).toContain('#5');
        expect(result.content[0].text).toContain('0xVERSIONTX');
    });
    it('sends metadataHash defaulting to empty string', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await handlePushVersion({ projectId: '1', tag: 'v1', contentHash: 'ar://abc' }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.metadataHash).toBe('');
    });
    it('passes metadataHash when provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await handlePushVersion({
            projectId: '1',
            tag: 'v2',
            contentHash: 'ar://abc',
            metadataHash: 'ar://meta',
        }, ctx);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.metadataHash).toBe('ar://meta');
    });
    it('calls correct endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ txHash: '0x1' }));
        const ctx = makeCtx({ fetch: fetchMock });
        await handlePushVersion({ projectId: '42', tag: 'v1', contentHash: 'ar://x' }, ctx);
        expect(fetchMock.mock.calls[0][0]).toContain('/v1/projects/42/versions');
    });
    it('returns isError on failure', async () => {
        const ctx = makeCtx({
            fetch: vi.fn().mockResolvedValue(mockRes({ error: { message: 'not owner' } }, 403)),
        });
        const result = await handlePushVersion({ projectId: '1', tag: 'v1', contentHash: 'ar://x' }, ctx);
        expect(result.isError).toBe(true);
    });
});
// ─── handleGetProject ─────────────────────────────────────────────────────────
describe('handleGetProject', () => {
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
    it('returns formatted project info', async () => {
        const ctx = makeCtx({ readFetch: vi.fn().mockResolvedValue(mockRes({ data: project })) });
        const result = await handleGetProject({ projectId: '3' }, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('my-sdk');
        expect(result.content[0].text).toContain('0xOWNER');
        expect(result.content[0].text).toContain('MIT');
        expect(result.content[0].text).toContain('Versions: 5');
    });
    it('shows agent endpoint when isAgent=true', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({
                data: { ...project, isAgent: true, agentEndpoint: 'https://api.agent.xyz' },
            })),
        });
        const result = await handleGetProject({ projectId: '3' }, ctx);
        expect(result.content[0].text).toContain('https://api.agent.xyz');
    });
    it('returns not-found message on 404', async () => {
        const ctx = makeCtx({ readFetch: vi.fn().mockResolvedValue(mockRes({}, 404)) });
        const result = await handleGetProject({ projectId: '999' }, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('not found');
    });
    it('returns isError on server error', async () => {
        const ctx = makeCtx({ readFetch: vi.fn().mockResolvedValue(mockRes({}, 500)) });
        const result = await handleGetProject({ projectId: '1' }, ctx);
        expect(result.isError).toBe(true);
    });
    it('omits endpoint line when isAgent=false', async () => {
        const ctx = makeCtx({ readFetch: vi.fn().mockResolvedValue(mockRes({ data: project })) });
        const result = await handleGetProject({ projectId: '3' }, ctx);
        expect(result.content[0].text).not.toContain('Endpoint:');
    });
});
// ─── handleGetVersions ────────────────────────────────────────────────────────
describe('handleGetVersions', () => {
    const versions = [
        { tag: 'v1.0.0', contentHash: 'ar://Qm1', pushedAt: '1700000000' },
        { tag: 'v1.1.0', contentHash: 'ar://Qm2', pushedAt: '1700100000' },
    ];
    it('returns formatted version list', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({ data: versions, total: '2' })),
        });
        const result = await handleGetVersions({ projectId: '5' }, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('total: 2');
        expect(result.content[0].text).toContain('v1.0.0');
        expect(result.content[0].text).toContain('v1.1.0');
        expect(result.content[0].text).toContain('ar://Qm1');
    });
    it('uses default limit=20 and offset=0', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await handleGetVersions({ projectId: '1' }, ctx);
        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain('limit=20');
        expect(url).toContain('offset=0');
    });
    it('passes custom limit and offset', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await handleGetVersions({ projectId: '1', limit: 5, offset: 10 }, ctx);
        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain('limit=5');
        expect(url).toContain('offset=10');
    });
    it('returns isError on failure', async () => {
        const ctx = makeCtx({ readFetch: vi.fn().mockResolvedValue(mockRes({}, 500)) });
        const result = await handleGetVersions({ projectId: '1' }, ctx);
        expect(result.isError).toBe(true);
    });
});
// ─── handleListAgents ─────────────────────────────────────────────────────────
describe('handleListAgents', () => {
    const agents = [
        { id: '1', name: 'agent-alpha', owner: '0xA1', agentEndpoint: 'https://alpha.ai' },
        { id: '2', name: 'agent-beta', owner: '0xB2', agentEndpoint: '' },
    ];
    it('returns formatted agent list', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({ data: agents, total: '2' })),
        });
        const result = await handleListAgents({}, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('total: 2');
        expect(result.content[0].text).toContain('agent-alpha');
        expect(result.content[0].text).toContain('0xA1');
        expect(result.content[0].text).toContain('https://alpha.ai');
    });
    it('omits endpoint when empty', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({ data: agents, total: '2' })),
        });
        const result = await handleListAgents({}, ctx);
        // agent-beta has no endpoint — line should not have "endpoint:"
        const lines = result.content[0].text.split('\n');
        const betaLine = lines.find(l => l.includes('agent-beta'));
        expect(betaLine).not.toContain('endpoint:');
    });
    it('uses default pagination', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await handleListAgents({}, ctx);
        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain('limit=20');
        expect(url).toContain('offset=0');
    });
    it('accepts custom pagination', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock });
        await handleListAgents({ limit: 10, offset: 5 }, ctx);
        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain('limit=10');
        expect(url).toContain('offset=5');
    });
    it('returns isError on failure', async () => {
        const ctx = makeCtx({ readFetch: vi.fn().mockResolvedValue(mockRes({}, 503)) });
        const result = await handleListAgents({}, ctx);
        expect(result.isError).toBe(true);
    });
    it('calls correct agents endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' }));
        const ctx = makeCtx({ readFetch: fetchMock, apiUrl: 'https://api.test' });
        await handleListAgents({}, ctx);
        expect(fetchMock.mock.calls[0][0]).toContain('https://api.test/v1/agents');
    });
    it('handles empty agents list gracefully', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' })),
        });
        const result = await handleListAgents({}, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('total: 0');
        // Only the header line, no agent entries
        const lines = result.content[0].text.split('\n').filter(Boolean);
        expect(lines).toHaveLength(1);
    });
});
// ─── Edge cases: untested branches ───────────────────────────────────────────
describe('handleCreateProject — json parse failure on error response', () => {
    it('falls back to {} when error body is not valid JSON', async () => {
        const ctx = makeCtx({
            fetch: vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                // json() rejects — simulates non-JSON error body (e.g. HTML 502 page)
                json: () => Promise.reject(new SyntaxError('Unexpected token')),
            }),
        });
        const result = await handleCreateProject({ name: 'x' }, ctx);
        expect(result.isError).toBe(true);
        // Fallback {} serialises to "{}"
        expect(result.content[0].text).toContain('Error:');
        expect(result.content[0].text).toContain('{}');
    });
});
describe('handlePushVersion — json parse failure on error response', () => {
    it('falls back to {} when error body is not valid JSON', async () => {
        const ctx = makeCtx({
            fetch: vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
                json: () => Promise.reject(new SyntaxError('Unexpected token')),
            }),
        });
        const result = await handlePushVersion({ projectId: '1', tag: 'v1', contentHash: 'ar://x' }, ctx);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('{}');
    });
});
describe('handleGetProject — description fallback', () => {
    it('shows (none) when description is empty string', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({
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
        const result = await handleGetProject({ projectId: '10' }, ctx);
        expect(result.content[0].text).toContain('(none)');
    });
    it('shows (none) when description is undefined', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({
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
        const result = await handleGetProject({ projectId: '11' }, ctx);
        expect(result.content[0].text).toContain('(none)');
    });
});
describe('handleGetVersions — empty list and date formatting', () => {
    it('handles empty versions list gracefully', async () => {
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({ data: [], total: '0' })),
        });
        const result = await handleGetVersions({ projectId: '99' }, ctx);
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('total: 0');
        const lines = result.content[0].text.split('\n').filter(Boolean);
        expect(lines).toHaveLength(1);
    });
    it('formats pushedAt unix timestamp as ISO date YYYY-MM-DD', async () => {
        // 2024-01-15T00:00:00Z === 1705276800
        const ctx = makeCtx({
            readFetch: vi.fn().mockResolvedValue(mockRes({
                data: [{ tag: 'v2.0.0', contentHash: 'ar://QmZ', pushedAt: '1705276800' }],
                total: '1',
            })),
        });
        const result = await handleGetVersions({ projectId: '1' }, ctx);
        expect(result.content[0].text).toContain('2024-01-15');
    });
});
//# sourceMappingURL=handlers.test.js.map