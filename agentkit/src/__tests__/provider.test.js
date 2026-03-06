"use strict";
/**
 * @inkd/agentkit — InkdActionProvider test suite
 *
 * Tests all four actions:
 *   inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
 *
 * Coverage:
 *   - Happy paths (success responses)
 *   - Error paths (non-ok responses, 404s, thrown errors)
 *   - Constructor defaults vs config overrides
 *   - getActions() registration shape
 *   - buildFetch fallback (no walletProvider, no @x402/fetch)
 *   - getWalletAddress (with/without context)
 *
 * IMPORTANT: InkdActionProvider captures globalThis.fetch at constructor time
 * (this.fetch = globalThis.fetch). Each test must stub BEFORE constructing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const provider_js_1 = require("../provider.js");
const actions_js_1 = require("../actions.js");
// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Build a mock fetch response. Must stub BEFORE constructing InkdActionProvider. */
function stubFetch(body, status = 200) {
    const mock = vitest_1.vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
        json: () => Promise.resolve(body),
    });
    vitest_1.vi.stubGlobal('fetch', mock);
    return mock;
}
/** Construct a fresh provider AFTER the global fetch stub is in place. */
function makeProvider(apiUrl) {
    return new provider_js_1.InkdActionProvider(apiUrl ? { apiUrl } : undefined);
}
function getAction(provider, name) {
    return provider.getActions().find(a => a.name === name);
}
(0, vitest_1.afterEach)(() => vitest_1.vi.unstubAllGlobals());
// ─── Constructor / getActions ─────────────────────────────────────────────────
(0, vitest_1.describe)('InkdActionProvider — constructor & getActions', () => {
    (0, vitest_1.it)('has name = "inkd"', () => {
        stubFetch({});
        (0, vitest_1.expect)(makeProvider().name).toBe('inkd');
    });
    (0, vitest_1.it)('exposes 4 actions', () => {
        stubFetch({});
        (0, vitest_1.expect)(makeProvider().getActions()).toHaveLength(4);
    });
    (0, vitest_1.it)('action names match INKD_ACTIONS constants', () => {
        stubFetch({});
        const names = makeProvider().getActions().map(a => a.name);
        (0, vitest_1.expect)(names).toContain(actions_js_1.INKD_ACTIONS.CREATE_PROJECT);
        (0, vitest_1.expect)(names).toContain(actions_js_1.INKD_ACTIONS.PUSH_VERSION);
        (0, vitest_1.expect)(names).toContain(actions_js_1.INKD_ACTIONS.GET_PROJECT);
        (0, vitest_1.expect)(names).toContain(actions_js_1.INKD_ACTIONS.LIST_AGENTS);
    });
    (0, vitest_1.it)('each action has name, description, schema, invoke', () => {
        stubFetch({});
        for (const action of makeProvider().getActions()) {
            (0, vitest_1.expect)(action.name).toBeTypeOf('string');
            (0, vitest_1.expect)(action.description).toBeTypeOf('string');
            (0, vitest_1.expect)(action.schema).toBeDefined();
            (0, vitest_1.expect)(action.invoke).toBeTypeOf('function');
        }
    });
    (0, vitest_1.it)('uses default API URL (api.inkdprotocol.com) for fetch calls', async () => {
        const mock = stubFetch({ projectId: '1', txHash: '0xabc', owner: '0x123' });
        const action = getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT);
        await action.invoke({ name: 'test' });
        (0, vitest_1.expect)(mock.mock.calls[0][0]).toContain('api.inkdprotocol.com');
    });
    (0, vitest_1.it)('uses custom apiUrl from config', async () => {
        const mock = stubFetch({ projectId: '2', txHash: '0xdef', owner: '0x456' });
        const action = getAction(makeProvider('https://staging.inkdprotocol.com'), actions_js_1.INKD_ACTIONS.CREATE_PROJECT);
        await action.invoke({ name: 'x' });
        (0, vitest_1.expect)(mock.mock.calls[0][0]).toContain('staging.inkdprotocol.com');
    });
});
// ─── inkd_create_project ──────────────────────────────────────────────────────
(0, vitest_1.describe)('inkd_create_project', () => {
    (0, vitest_1.it)('returns success with projectId, txHash, owner', async () => {
        stubFetch({ projectId: '42', txHash: '0xTX', owner: '0xOWNER' });
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT)
            .invoke({ name: 'my-tool', license: 'MIT' });
        (0, vitest_1.expect)(res).toMatchObject({ success: true, projectId: '42', txHash: '0xTX', owner: '0xOWNER' });
        (0, vitest_1.expect)(res.message).toContain('my-tool');
        (0, vitest_1.expect)(res.message).toContain('#42');
    });
    (0, vitest_1.it)('sends correct JSON body with all fields', async () => {
        const mock = stubFetch({ projectId: '5', txHash: '0xHASH', owner: '0xW' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT).invoke({
            name: 'agent-x',
            description: 'an AI agent',
            license: 'Apache-2.0',
            isPublic: false,
            isAgent: true,
            agentEndpoint: 'https://agent.example.com',
        });
        const body = JSON.parse(mock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body).toMatchObject({
            name: 'agent-x',
            description: 'an AI agent',
            license: 'Apache-2.0',
            isPublic: false,
            isAgent: true,
            agentEndpoint: 'https://agent.example.com',
        });
    });
    (0, vitest_1.it)('applies defaults for optional fields', async () => {
        const mock = stubFetch({ projectId: '3', txHash: '0xH', owner: '0xW' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'minimal' });
        const body = JSON.parse(mock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.description).toBe('');
        (0, vitest_1.expect)(body.license).toBe('MIT');
        (0, vitest_1.expect)(body.isPublic).toBe(true);
        (0, vitest_1.expect)(body.isAgent).toBe(false);
        (0, vitest_1.expect)(body.agentEndpoint).toBe('');
    });
    (0, vitest_1.it)('throws when API returns non-ok status', async () => {
        stubFetch({ error: { message: 'Name taken' } }, 409);
        await (0, vitest_1.expect)(getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'dup' })).rejects.toThrow('inkd createProject failed');
    });
    (0, vitest_1.it)('throws with fallback message when json parse fails on error', async () => {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn().mockResolvedValue({
            ok: false, status: 500, statusText: 'Internal Server Error',
            json: () => Promise.reject(new Error('no json')),
        }));
        await (0, vitest_1.expect)(getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'err' })).rejects.toThrow('inkd createProject failed');
    });
    (0, vitest_1.it)('uses POST method with Content-Type application/json', async () => {
        const mock = stubFetch({ projectId: '1', txHash: '0x', owner: '0x' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'test' });
        const opts = mock.mock.calls[0][1];
        (0, vitest_1.expect)(opts.method).toBe('POST');
        (0, vitest_1.expect)(opts.headers['Content-Type']).toBe('application/json');
    });
    (0, vitest_1.it)('falls back owner to walletAddress from context when API omits owner', async () => {
        stubFetch({ projectId: '7', txHash: '0xTX' /* no owner */ });
        const context = { walletProvider: { getAddress: async () => '0xWALLET' } };
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT)
            .invoke({ name: 'test' }, context);
        (0, vitest_1.expect)(res.owner).toBe('0xWALLET');
    });
    (0, vitest_1.it)('handles walletProvider.getAddress throwing gracefully', async () => {
        stubFetch({ projectId: '8', txHash: '0xTX', owner: '0xOWN' });
        const context = { walletProvider: { getAddress: async () => { throw new Error('wallet error'); } } };
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT)
            .invoke({ name: 'test' }, context);
        (0, vitest_1.expect)(res.success).toBe(true);
    });
    (0, vitest_1.it)('falls back to plain fetch when x402 unavailable (no privateKey)', async () => {
        stubFetch({ projectId: '9', txHash: '0xTX', owner: '0xOWN' });
        // walletProvider present but no privateKey → buildFetch falls back to this.fetch
        const context = { walletProvider: { someOtherProp: true } };
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT)
            .invoke({ name: 'fallback' }, context);
        (0, vitest_1.expect)(res.success).toBe(true);
    });
    (0, vitest_1.it)('posts to correct endpoint path', async () => {
        const mock = stubFetch({ projectId: '10', txHash: '0xT', owner: '0xO' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'test' });
        (0, vitest_1.expect)(mock.mock.calls[0][0]).toContain('/v1/projects');
    });
});
// ─── inkd_push_version ────────────────────────────────────────────────────────
(0, vitest_1.describe)('inkd_push_version', () => {
    (0, vitest_1.it)('returns success with txHash, projectId, tag', async () => {
        stubFetch({ txHash: '0xVERSION_TX' });
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.PUSH_VERSION)
            .invoke({ projectId: '42', tag: 'v1.0.0', contentHash: 'ar://Qmabc123' });
        (0, vitest_1.expect)(res).toMatchObject({ success: true, txHash: '0xVERSION_TX', projectId: '42', tag: 'v1.0.0' });
        (0, vitest_1.expect)(res.message).toContain('v1.0.0');
        (0, vitest_1.expect)(res.message).toContain('#42');
    });
    (0, vitest_1.it)('sends correct URL and body', async () => {
        const mock = stubFetch({ txHash: '0xV' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.PUSH_VERSION).invoke({
            projectId: '5', tag: 'alpha', contentHash: 'ipfs://QmFoo', metadataHash: 'ipfs://QmBar'
        });
        (0, vitest_1.expect)(mock.mock.calls[0][0]).toContain('/v1/projects/5/versions');
        const body = JSON.parse(mock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body).toMatchObject({ tag: 'alpha', contentHash: 'ipfs://QmFoo', metadataHash: 'ipfs://QmBar' });
    });
    (0, vitest_1.it)('defaults metadataHash to empty string when not provided', async () => {
        const mock = stubFetch({ txHash: '0xV' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.PUSH_VERSION)
            .invoke({ projectId: '1', tag: 'v0.1.0', contentHash: 'ar://Qm' });
        const body = JSON.parse(mock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.metadataHash).toBe('');
    });
    (0, vitest_1.it)('throws when API returns non-ok status', async () => {
        stubFetch({ error: 'Not found' }, 404);
        await (0, vitest_1.expect)(getAction(makeProvider(), actions_js_1.INKD_ACTIONS.PUSH_VERSION)
            .invoke({ projectId: '99', tag: 'v1', contentHash: 'ar://x' })).rejects.toThrow('inkd pushVersion failed');
    });
    (0, vitest_1.it)('throws with fallback message when json fails on error', async () => {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn().mockResolvedValue({
            ok: false, status: 500, statusText: 'Server Error',
            json: () => Promise.reject(new Error('not json')),
        }));
        await (0, vitest_1.expect)(getAction(makeProvider(), actions_js_1.INKD_ACTIONS.PUSH_VERSION)
            .invoke({ projectId: '1', tag: 'x', contentHash: 'ar://x' })).rejects.toThrow('inkd pushVersion failed');
    });
    (0, vitest_1.it)('uses POST method', async () => {
        const mock = stubFetch({ txHash: '0xV' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.PUSH_VERSION)
            .invoke({ projectId: '1', tag: 'v1', contentHash: 'ar://h' });
        (0, vitest_1.expect)(mock.mock.calls[0][1].method).toBe('POST');
    });
});
// ─── inkd_get_project ─────────────────────────────────────────────────────────
const sampleProject = {
    id: '42',
    name: 'my-ai-tool',
    description: 'A tool',
    license: 'MIT',
    owner: '0xOWNER',
    isPublic: true,
    isAgent: false,
    agentEndpoint: '',
    createdAt: '2025-01-01',
    versionCount: '3',
};
(0, vitest_1.describe)('inkd_get_project', () => {
    (0, vitest_1.it)('returns success with project data', async () => {
        stubFetch({ data: sampleProject });
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.GET_PROJECT)
            .invoke({ projectId: '42' });
        (0, vitest_1.expect)(res.success).toBe(true);
        (0, vitest_1.expect)(res.project).toMatchObject({ id: '42', name: 'my-ai-tool' });
        (0, vitest_1.expect)(res.message).toContain('#42');
        (0, vitest_1.expect)(res.message).toContain('my-ai-tool');
    });
    (0, vitest_1.it)('returns failure for 404', async () => {
        stubFetch({}, 404);
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.GET_PROJECT)
            .invoke({ projectId: '999' });
        (0, vitest_1.expect)(res.success).toBe(false);
        (0, vitest_1.expect)(res.message).toContain('#999');
        (0, vitest_1.expect)(res.message).toContain('not found');
    });
    (0, vitest_1.it)('throws on other non-ok statuses', async () => {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn().mockResolvedValue({
            ok: false, status: 500, statusText: 'Internal Error',
            json: () => Promise.resolve({}),
        }));
        await (0, vitest_1.expect)(getAction(makeProvider(), actions_js_1.INKD_ACTIONS.GET_PROJECT).invoke({ projectId: '1' })).rejects.toThrow('inkd getProject failed');
    });
    (0, vitest_1.it)('calls correct URL', async () => {
        const mock = stubFetch({ data: sampleProject });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.GET_PROJECT).invoke({ projectId: '7' });
        (0, vitest_1.expect)(mock.mock.calls[0][0]).toContain('/v1/projects/7');
    });
    (0, vitest_1.it)('message includes owner, version count, and license', async () => {
        stubFetch({ data: sampleProject });
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.GET_PROJECT)
            .invoke({ projectId: '42' });
        (0, vitest_1.expect)(res.message).toContain('0xOWNER');
        (0, vitest_1.expect)(res.message).toContain('3 versions');
        (0, vitest_1.expect)(res.message).toContain('MIT');
    });
});
// ─── inkd_list_agents ─────────────────────────────────────────────────────────
const sampleAgents = [
    { id: '1', name: 'agent-alpha', owner: '0xA1', agentEndpoint: 'https://alpha.ai', isAgent: true },
    { id: '2', name: 'agent-beta', owner: '0xA2', agentEndpoint: '', isAgent: true },
];
(0, vitest_1.describe)('inkd_list_agents', () => {
    (0, vitest_1.it)('returns success with agents list', async () => {
        stubFetch({ data: sampleAgents, total: '2' });
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({});
        (0, vitest_1.expect)(res.success).toBe(true);
        (0, vitest_1.expect)(res.agents).toHaveLength(2);
        (0, vitest_1.expect)(res.total).toBe('2');
        (0, vitest_1.expect)(res.message).toContain('2');
    });
    (0, vitest_1.it)('sends default limit=20 and offset=0', async () => {
        const mock = stubFetch({ data: [], total: '0' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({});
        const url = mock.mock.calls[0][0];
        (0, vitest_1.expect)(url).toContain('limit=20');
        (0, vitest_1.expect)(url).toContain('offset=0');
    });
    (0, vitest_1.it)('sends custom limit and offset', async () => {
        const mock = stubFetch({ data: [], total: '0' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({ limit: 5, offset: 10 });
        const url = mock.mock.calls[0][0];
        (0, vitest_1.expect)(url).toContain('limit=5');
        (0, vitest_1.expect)(url).toContain('offset=10');
    });
    (0, vitest_1.it)('calls /v1/agents endpoint', async () => {
        const mock = stubFetch({ data: [], total: '0' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({});
        (0, vitest_1.expect)(mock.mock.calls[0][0]).toContain('/v1/agents');
    });
    (0, vitest_1.it)('throws when API returns non-ok status', async () => {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn().mockResolvedValue({
            ok: false, status: 503, statusText: 'Service Unavailable',
            json: () => Promise.resolve({}),
        }));
        await (0, vitest_1.expect)(getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({})).rejects.toThrow('inkd listAgents failed');
    });
    (0, vitest_1.it)('returns empty agents array for empty response', async () => {
        stubFetch({ data: [], total: '0' });
        const res = await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({});
        (0, vitest_1.expect)(res.agents).toEqual([]);
        (0, vitest_1.expect)(res.total).toBe('0');
    });
    (0, vitest_1.it)('uses limit=1 edge case', async () => {
        const mock = stubFetch({ data: [sampleAgents[0]], total: '100' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({ limit: 1 });
        (0, vitest_1.expect)(mock.mock.calls[0][0]).toContain('limit=1');
    });
});
// ─── Zod Schema validation ────────────────────────────────────────────────────
(0, vitest_1.describe)('Action schemas', () => {
    (0, vitest_1.describe)('CreateProjectSchema', () => {
        (0, vitest_1.it)('rejects empty name', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: '' })).toThrow();
        });
        (0, vitest_1.it)('rejects name > 64 chars', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'a'.repeat(65) })).toThrow();
        });
        (0, vitest_1.it)('accepts valid minimal name', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'my-tool' })).not.toThrow();
        });
        (0, vitest_1.it)('rejects description > 256 chars', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'x', description: 'a'.repeat(257) })).toThrow();
        });
        (0, vitest_1.it)('accepts description at 256 chars', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'x', description: 'a'.repeat(256) })).not.toThrow();
        });
        (0, vitest_1.it)('rejects invalid license', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'x', license: 'BSD' })).toThrow();
        });
        vitest_1.it.each(['MIT', 'Apache-2.0', 'GPL-3.0', 'Proprietary', 'UNLICENSED'])('accepts license=%s', (lic) => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'x', license: lic })).not.toThrow();
        });
        (0, vitest_1.it)('rejects invalid agentEndpoint URL', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'x', agentEndpoint: 'not-a-url' })).toThrow();
        });
        (0, vitest_1.it)('accepts valid agentEndpoint URL', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'x', agentEndpoint: 'https://agent.example.com' })).not.toThrow();
        });
        (0, vitest_1.it)('accepts name at max length (64 chars)', () => {
            (0, vitest_1.expect)(() => actions_js_1.CreateProjectSchema.parse({ name: 'a'.repeat(64) })).not.toThrow();
        });
    });
    (0, vitest_1.describe)('PushVersionSchema', () => {
        (0, vitest_1.it)('requires projectId', () => {
            (0, vitest_1.expect)(() => actions_js_1.PushVersionSchema.parse({ tag: 'v1', contentHash: 'ar://x' })).toThrow();
        });
        (0, vitest_1.it)('requires tag', () => {
            (0, vitest_1.expect)(() => actions_js_1.PushVersionSchema.parse({ projectId: '1', contentHash: 'ar://x' })).toThrow();
        });
        (0, vitest_1.it)('requires contentHash', () => {
            (0, vitest_1.expect)(() => actions_js_1.PushVersionSchema.parse({ projectId: '1', tag: 'v1' })).toThrow();
        });
        (0, vitest_1.it)('accepts valid params', () => {
            (0, vitest_1.expect)(() => actions_js_1.PushVersionSchema.parse({ projectId: '1', tag: 'v1.0.0', contentHash: 'ar://QmAbc' })).not.toThrow();
        });
        (0, vitest_1.it)('rejects empty tag', () => {
            (0, vitest_1.expect)(() => actions_js_1.PushVersionSchema.parse({ projectId: '1', tag: '', contentHash: 'ar://x' })).toThrow();
        });
        (0, vitest_1.it)('rejects empty contentHash', () => {
            (0, vitest_1.expect)(() => actions_js_1.PushVersionSchema.parse({ projectId: '1', tag: 'v1', contentHash: '' })).toThrow();
        });
        (0, vitest_1.it)('accepts optional metadataHash', () => {
            (0, vitest_1.expect)(() => actions_js_1.PushVersionSchema.parse({
                projectId: '1', tag: 'v1', contentHash: 'ar://x', metadataHash: 'ar://meta'
            })).not.toThrow();
        });
    });
    (0, vitest_1.describe)('GetProjectSchema', () => {
        (0, vitest_1.it)('requires projectId', () => {
            (0, vitest_1.expect)(() => actions_js_1.GetProjectSchema.parse({})).toThrow();
        });
        (0, vitest_1.it)('accepts projectId string', () => {
            (0, vitest_1.expect)(() => actions_js_1.GetProjectSchema.parse({ projectId: '42' })).not.toThrow();
        });
    });
    (0, vitest_1.describe)('ListAgentsSchema', () => {
        (0, vitest_1.it)('accepts empty object', () => {
            (0, vitest_1.expect)(() => actions_js_1.ListAgentsSchema.parse({})).not.toThrow();
        });
        (0, vitest_1.it)('rejects limit < 1', () => {
            (0, vitest_1.expect)(() => actions_js_1.ListAgentsSchema.parse({ limit: 0 })).toThrow();
        });
        (0, vitest_1.it)('rejects limit > 100', () => {
            (0, vitest_1.expect)(() => actions_js_1.ListAgentsSchema.parse({ limit: 101 })).toThrow();
        });
        (0, vitest_1.it)('rejects negative offset', () => {
            (0, vitest_1.expect)(() => actions_js_1.ListAgentsSchema.parse({ offset: -1 })).toThrow();
        });
        (0, vitest_1.it)('accepts limit=1 (min)', () => {
            (0, vitest_1.expect)(() => actions_js_1.ListAgentsSchema.parse({ limit: 1 })).not.toThrow();
        });
        (0, vitest_1.it)('accepts limit=100 (max)', () => {
            (0, vitest_1.expect)(() => actions_js_1.ListAgentsSchema.parse({ limit: 100 })).not.toThrow();
        });
        (0, vitest_1.it)('accepts limit=50, offset=20', () => {
            (0, vitest_1.expect)(() => actions_js_1.ListAgentsSchema.parse({ limit: 50, offset: 20 })).not.toThrow();
        });
    });
});
// ─── INKD_ACTIONS constants ───────────────────────────────────────────────────
(0, vitest_1.describe)('INKD_ACTIONS', () => {
    (0, vitest_1.it)('has correct string values', () => {
        (0, vitest_1.expect)(actions_js_1.INKD_ACTIONS.CREATE_PROJECT).toBe('inkd_create_project');
        (0, vitest_1.expect)(actions_js_1.INKD_ACTIONS.PUSH_VERSION).toBe('inkd_push_version');
        (0, vitest_1.expect)(actions_js_1.INKD_ACTIONS.GET_PROJECT).toBe('inkd_get_project');
        (0, vitest_1.expect)(actions_js_1.INKD_ACTIONS.LIST_AGENTS).toBe('inkd_list_agents');
    });
    (0, vitest_1.it)('has 4 keys', () => {
        (0, vitest_1.expect)(Object.keys(actions_js_1.INKD_ACTIONS)).toHaveLength(4);
    });
});
// ─── buildFetch / no wallet context paths ────────────────────────────────────
(0, vitest_1.describe)('buildFetch — no wallet context', () => {
    (0, vitest_1.it)('uses globalThis.fetch when no context provided', async () => {
        const mock = stubFetch({ projectId: '1', txHash: '0xT', owner: '0xO' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'no-context' });
        (0, vitest_1.expect)(mock).toHaveBeenCalled();
    });
    (0, vitest_1.it)('uses globalThis.fetch when context has no walletProvider', async () => {
        const mock = stubFetch({ projectId: '2', txHash: '0xT', owner: '0xO' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.CREATE_PROJECT)
            .invoke({ name: 'no-wallet' }, { someOtherContext: true });
        (0, vitest_1.expect)(mock).toHaveBeenCalled();
    });
    (0, vitest_1.it)('still calls fetch for read-only listAgents with no context', async () => {
        const mock = stubFetch({ data: sampleAgents, total: '2' });
        await getAction(makeProvider(), actions_js_1.INKD_ACTIONS.LIST_AGENTS).invoke({});
        (0, vitest_1.expect)(mock).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=provider.test.js.map