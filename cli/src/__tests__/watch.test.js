"use strict";
/**
 * @file watch.test.ts
 * Unit tests for `inkd watch` — real-time event streaming command.
 *
 * Key design notes:
 *  1. `cmdWatch` has an infinite `while(true)` polling loop.
 *     We break it by spying on global.setTimeout and throwing a sentinel
 *     error (`__STOP_LOOP__`) after a controlled number of setTimeout calls.
 *     The delay line `await new Promise(r => setTimeout(r, ms))` is the only
 *     setTimeout call in the module; it sits outside the loop's inner try/catch,
 *     so the sentinel always propagates and terminates the promise.
 *
 *  2. `decodeEventLog` is called TWICE per log:
 *      – once in the outer `for` loop for the filter check
 *      – once inside `renderEvent` to decode for display
 *     Persistent mocks (.mockReturnValue) are used so both calls succeed.
 *
 *  3. `getBlockNumber` is called once BEFORE the loop (to compute default
 *     fromBlock) when `--from` is NOT supplied.  `--from` is used in most
 *     render/filter tests to skip that initial call.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ─── Constants ────────────────────────────────────────────────────────────────
const MOCK_REGISTRY = '0x1111111111111111111111111111111111111111';
const SENTINEL = '__STOP_LOOP__';
// ─── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../config.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        loadConfig: vitest_1.vi.fn(() => ({ network: 'testnet', rpcUrl: undefined })),
        ADDRESSES: {
            testnet: {
                registry: MOCK_REGISTRY,
                token: '0x2222222222222222222222222222222222222222',
                treasury: '0x3333333333333333333333333333333333333333',
            },
            mainnet: { registry: '', token: '', treasury: '' },
        },
        error: vitest_1.vi.fn((msg) => { throw new Error(msg); }),
        info: vitest_1.vi.fn(),
        success: vitest_1.vi.fn(),
        BOLD: '',
        RESET: '',
        CYAN: '',
        DIM: '',
        GREEN: '',
        YELLOW: '',
    };
});
let mockGetBlockNumber;
let mockGetLogs;
vitest_1.vi.mock('../client.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildPublicClient: vitest_1.vi.fn(() => ({
            getBlockNumber: (...args) => mockGetBlockNumber(...args),
            getLogs: (...args) => mockGetLogs(...args),
        })),
    };
});
// viem mock — parseAbi (module-level) returns []; decodeEventLog controlled per-test.
const mockDecodeEventLog = vitest_1.vi.fn();
vitest_1.vi.mock('viem', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        parseAbi: vitest_1.vi.fn(() => []),
        decodeEventLog: (...args) => mockDecodeEventLog(...args),
        formatEther: actual.formatEther,
    };
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeLog(overrides = {}) {
    return {
        blockNumber: 9999n,
        transactionHash: '0xdeadbeef',
        data: '0x',
        topics: ['0xtopic1'],
        ...overrides,
    };
}
/**
 * Replace global.setTimeout to terminate the polling loop after `n` calls.
 * Calls < n: invoke the callback synchronously (instant tick).
 * Call  n  : throw the sentinel — escaping the await outside the try/catch.
 */
function breakLoopAfter(n) {
    let calls = 0;
    vitest_1.vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        calls++;
        if (calls >= n)
            throw new Error(SENTINEL);
        fn();
        return 0;
    });
}
/** Run cmdWatch, swallowing the sentinel (and registry-not-configured) error. */
async function runWatch(args) {
    const { cmdWatch } = await Promise.resolve().then(() => __importStar(require('../commands/watch.js')));
    await cmdWatch(args).catch((e) => {
        if (!e.message.includes(SENTINEL) && !e.message.includes('Registry address'))
            throw e;
    });
}
// ─── Setup ────────────────────────────────────────────────────────────────────
(0, vitest_1.beforeEach)(() => {
    mockGetBlockNumber = vitest_1.vi.fn().mockResolvedValue(2000n);
    mockGetLogs = vitest_1.vi.fn().mockResolvedValue([]);
    vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
    vitest_1.vi.spyOn(console, 'error').mockImplementation(() => { });
});
(0, vitest_1.afterEach)(() => {
    vitest_1.vi.restoreAllMocks();
    vitest_1.vi.resetModules();
});
// ─── parseFlag (tested via cmdWatch args) ─────────────────────────────────────
(0, vitest_1.describe)('parseFlag via cmdWatch flags', () => {
    (0, vitest_1.it)('default poll interval runs loop (no --poll needed)', async () => {
        breakLoopAfter(1);
        await runWatch([]);
        (0, vitest_1.expect)(mockGetBlockNumber).toHaveBeenCalled();
    });
    (0, vitest_1.it)('honours --poll <ms> flag', async () => {
        breakLoopAfter(1);
        await runWatch(['all', '--poll', '500']);
        (0, vitest_1.expect)(mockGetBlockNumber).toHaveBeenCalled();
    });
    (0, vitest_1.it)('honours --from <block> flag — skips initial getBlockNumber', async () => {
        // With --from, no initial getBlockNumber call; only loop calls
        mockGetBlockNumber.mockResolvedValueOnce(5000n); // first loop call
        mockGetLogs.mockResolvedValueOnce([]);
        breakLoopAfter(2);
        await runWatch(['--from', '4999']);
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ fromBlock: 5000n, toBlock: 5000n }));
    });
    (0, vitest_1.it)('uses latest-1000 as default fromBlock (no --from)', async () => {
        // With no --from: first call = initial block = 5000, lastBlock = 4000
        // Loop: currentBlock = 5001 > 4000 → getLogs(fromBlock=4001, toBlock=5001)
        mockGetBlockNumber
            .mockResolvedValueOnce(5000n) // initial (before loop)
            .mockResolvedValueOnce(5001n); // first loop iteration
        mockGetLogs.mockResolvedValueOnce([]);
        breakLoopAfter(2);
        await runWatch([]);
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ fromBlock: 4001n, toBlock: 5001n }));
    });
    (0, vitest_1.it)('--from 0 uses 0n as start block', async () => {
        mockGetBlockNumber.mockResolvedValueOnce(100n);
        mockGetLogs.mockResolvedValueOnce([]);
        breakLoopAfter(2);
        await runWatch(['--from', '0']);
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ fromBlock: 1n, toBlock: 100n }));
    });
});
// ─── Filter validation ────────────────────────────────────────────────────────
(0, vitest_1.describe)('filter validation', () => {
    (0, vitest_1.it)('accepts "all" filter (default)', async () => {
        breakLoopAfter(1);
        await runWatch(['all']);
        (0, vitest_1.expect)(mockGetBlockNumber).toHaveBeenCalled();
    });
    (0, vitest_1.it)('accepts "projects" filter', async () => {
        breakLoopAfter(1);
        await runWatch(['projects']);
        (0, vitest_1.expect)(mockGetBlockNumber).toHaveBeenCalled();
    });
    (0, vitest_1.it)('accepts "versions" filter', async () => {
        breakLoopAfter(1);
        await runWatch(['versions']);
        (0, vitest_1.expect)(mockGetBlockNumber).toHaveBeenCalled();
    });
    (0, vitest_1.it)('accepts "agents" filter', async () => {
        breakLoopAfter(1);
        await runWatch(['agents']);
        (0, vitest_1.expect)(mockGetBlockNumber).toHaveBeenCalled();
    });
    (0, vitest_1.it)('rejects unknown filter via error()', async () => {
        const { cmdWatch } = await Promise.resolve().then(() => __importStar(require('../commands/watch.js')));
        await (0, vitest_1.expect)(cmdWatch(['invalid-filter'])).rejects.toThrow('Unknown filter');
    });
    (0, vitest_1.it)('treats first arg starting with -- as "all" (default filter)', async () => {
        breakLoopAfter(1);
        await runWatch(['--json']);
        (0, vitest_1.expect)(mockGetBlockNumber).toHaveBeenCalled();
    });
});
// ─── Registry address guard ───────────────────────────────────────────────────
(0, vitest_1.describe)('registry address guard', () => {
    (0, vitest_1.it)('throws when registry address is empty string', async () => {
        const configMod = await Promise.resolve().then(() => __importStar(require('../config.js')));
        configMod.ADDRESSES['testnet']['registry'] = '';
        const { cmdWatch } = await Promise.resolve().then(() => __importStar(require('../commands/watch.js')));
        await (0, vitest_1.expect)(cmdWatch([])).rejects.toThrow('Registry address not configured');
        configMod.ADDRESSES['testnet']['registry'] = MOCK_REGISTRY;
    });
});
// ─── Header output ────────────────────────────────────────────────────────────
(0, vitest_1.describe)('header output', () => {
    (0, vitest_1.it)('prints "Inkd Protocol" header in non-JSON mode', async () => {
        breakLoopAfter(1);
        await runWatch([]);
        const logged = console.log.mock.calls.map(c => String(c[0]));
        (0, vitest_1.expect)(logged.some(l => l.includes('Inkd Protocol'))).toBe(true);
    });
    (0, vitest_1.it)('prints "Watching" line in non-JSON mode', async () => {
        breakLoopAfter(1);
        await runWatch([]);
        const logged = console.log.mock.calls.map(c => String(c[0]));
        (0, vitest_1.expect)(logged.some(l => l.includes('Watching'))).toBe(true);
    });
    (0, vitest_1.it)('does NOT print header in --json mode', async () => {
        breakLoopAfter(1);
        await runWatch(['--json']);
        const logged = console.log.mock.calls.map(c => String(c[0]));
        (0, vitest_1.expect)(logged.some(l => l.includes('Inkd Protocol'))).toBe(false);
    });
    (0, vitest_1.it)('does NOT print "Watching" line in --json mode', async () => {
        breakLoopAfter(1);
        await runWatch(['--json']);
        const logged = console.log.mock.calls.map(c => String(c[0]));
        (0, vitest_1.expect)(logged.some(l => l.includes('Watching'))).toBe(false);
    });
});
// ─── No new blocks → no getLogs call ─────────────────────────────────────────
(0, vitest_1.describe)('polling — no new blocks', () => {
    (0, vitest_1.it)('skips getLogs when currentBlock === fromBlock', async () => {
        mockGetBlockNumber.mockResolvedValue(2999n); // loop: same as --from
        breakLoopAfter(2);
        await runWatch(['--from', '2999']);
        (0, vitest_1.expect)(mockGetLogs).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('skips getLogs when currentBlock < lastBlock', async () => {
        mockGetBlockNumber.mockResolvedValue(1500n); // loop: less than --from 2000
        breakLoopAfter(2);
        await runWatch(['--from', '2000']);
        (0, vitest_1.expect)(mockGetLogs).not.toHaveBeenCalled();
    });
});
// ─── Poll error handling ──────────────────────────────────────────────────────
(0, vitest_1.describe)('poll error handling', () => {
    (0, vitest_1.it)('catches RPC error in loop and logs to console.error (non-JSON)', async () => {
        // Initial getBlockNumber (--from not set) succeeds, loop call rejects
        mockGetBlockNumber
            .mockResolvedValueOnce(3000n) // initial pre-loop call
            .mockRejectedValueOnce(new Error('RPC timeout')) // first loop iteration
            .mockResolvedValue(3000n); // subsequent calls
        breakLoopAfter(2);
        await runWatch([]);
        (0, vitest_1.expect)(console.error).toHaveBeenCalledWith(vitest_1.expect.stringContaining('Poll error'));
    });
    (0, vitest_1.it)('silences poll errors in --json mode (no console.error)', async () => {
        // With --from, skip initial; loop call rejects
        mockGetBlockNumber
            .mockRejectedValueOnce(new Error('RPC timeout'))
            .mockResolvedValue(2000n);
        breakLoopAfter(2);
        await runWatch(['--json', '--from', '1999']);
        (0, vitest_1.expect)(console.error).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('continues polling after a single RPC error', async () => {
        mockGetBlockNumber
            .mockResolvedValueOnce(3000n) // initial
            .mockRejectedValueOnce(new Error('timeout')) // loop iteration 1: caught
            .mockResolvedValueOnce(3001n); // loop iteration 2: ok
        mockGetLogs.mockResolvedValue([]);
        breakLoopAfter(3);
        await runWatch([]);
        // getLogs called on iteration 2 (block advanced)
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenCalled();
    });
});
// ─── renderEvent — all event types (non-JSON mode) ───────────────────────────
(0, vitest_1.describe)('renderEvent — non-JSON mode', () => {
    /**
     * Set up one log that decodes to `eventName`/`args`.
     * decodeEventLog is called TWICE per log (outer filter check + inside renderEvent),
     * so we use mockReturnValue (persistent) rather than mockReturnValueOnce.
     */
    async function runWithLog(eventName, args) {
        mockGetBlockNumber.mockResolvedValueOnce(3000n);
        mockGetLogs.mockResolvedValueOnce([makeLog()]);
        // Persistent mock: both filter-check and renderEvent decode calls succeed
        mockDecodeEventLog.mockReturnValue({ eventName, args });
        breakLoopAfter(2);
        await runWatch(['--from', '2999']);
    }
    /** Collect all args from console.log calls as one joined string */
    function allLogged() {
        return console.log.mock.calls
            .map(c => c.map(String).join(''))
            .join('\n');
    }
    (0, vitest_1.it)('renders ProjectCreated (non-agent)', async () => {
        await runWithLog('ProjectCreated', {
            projectId: 1n, owner: '0xAbCd1234000000000000', name: 'my-app', isAgent: false,
        });
        (0, vitest_1.expect)(allLogged()).toContain('ProjectCreated');
        (0, vitest_1.expect)(allLogged()).toContain('my-app');
    });
    (0, vitest_1.it)('renders ProjectCreated (agent) — shows [agent] badge', async () => {
        await runWithLog('ProjectCreated', {
            projectId: 2n, owner: '0xAbCd1234000000000000', name: 'my-bot', isAgent: true,
        });
        (0, vitest_1.expect)(allLogged()).toContain('[agent]');
        (0, vitest_1.expect)(allLogged()).toContain('my-bot');
    });
    (0, vitest_1.it)('renders VersionPushed', async () => {
        await runWithLog('VersionPushed', {
            projectId: 3n, versionIndex: 0n, arweaveHash: 'arweaveHashABC123', versionTag: 'v0.9.0',
        });
        (0, vitest_1.expect)(allLogged()).toContain('VersionPushed');
        (0, vitest_1.expect)(allLogged()).toContain('v0.9.0');
        (0, vitest_1.expect)(allLogged()).toContain('ar://');
    });
    (0, vitest_1.it)('renders ProjectTransferred', async () => {
        await runWithLog('ProjectTransferred', {
            projectId: 4n, from: '0xFromAddress0000000000', to: '0xToAddress00000000000',
        });
        (0, vitest_1.expect)(allLogged()).toContain('ProjectTransferred');
    });
    (0, vitest_1.it)('renders CollaboratorAdded', async () => {
        await runWithLog('CollaboratorAdded', { projectId: 5n, collaborator: '0xCollabAddress0000000' });
        (0, vitest_1.expect)(allLogged()).toContain('CollaboratorAdded');
    });
    (0, vitest_1.it)('renders CollaboratorRemoved', async () => {
        await runWithLog('CollaboratorRemoved', { projectId: 6n, collaborator: '0xCollabAddress0000000' });
        (0, vitest_1.expect)(allLogged()).toContain('CollaboratorRemoved');
    });
    (0, vitest_1.it)('renders VisibilityChanged (public=true)', async () => {
        await runWithLog('VisibilityChanged', { projectId: 7n, isPublic: true });
        (0, vitest_1.expect)(allLogged()).toContain('VisibilityChanged');
        (0, vitest_1.expect)(allLogged()).toContain('true');
    });
    (0, vitest_1.it)('renders VisibilityChanged (public=false)', async () => {
        await runWithLog('VisibilityChanged', { projectId: 7n, isPublic: false });
        (0, vitest_1.expect)(allLogged()).toContain('VisibilityChanged');
        (0, vitest_1.expect)(allLogged()).toContain('false');
    });
    (0, vitest_1.it)('renders ReadmeUpdated', async () => {
        await runWithLog('ReadmeUpdated', { projectId: 8n, arweaveHash: 'readme123abc' });
        (0, vitest_1.expect)(allLogged()).toContain('ReadmeUpdated');
        (0, vitest_1.expect)(allLogged()).toContain('ar://');
    });
    (0, vitest_1.it)('renders AgentEndpointUpdated', async () => {
        await runWithLog('AgentEndpointUpdated', {
            projectId: 9n, endpoint: 'https://agent.inkdprotocol.xyz',
        });
        (0, vitest_1.expect)(allLogged()).toContain('AgentEndpointUpdated');
        (0, vitest_1.expect)(allLogged()).toContain('https://agent.inkdprotocol.xyz');
    });
    (0, vitest_1.it)('renders unknown event via default branch', async () => {
        // The default branch in renderEvent's switch is only reachable when the outer
        // filter-check decode passes (uses a known event name) but the inner
        // renderEvent decode returns a different, unrecognised name.
        mockGetBlockNumber.mockResolvedValueOnce(3000n);
        mockGetLogs.mockResolvedValueOnce([makeLog()]);
        mockDecodeEventLog
            // Outer filter check: use a known event so the log passes the FILTER_MAP guard
            .mockReturnValueOnce({ eventName: 'ProjectCreated', args: { projectId: 1n, owner: '0xA', name: 'x', isAgent: false } })
            // renderEvent's own decode: return an unknown event name → default branch
            // Note: default branch calls JSON.stringify(args), so no BigInt values here
            .mockReturnValueOnce({ eventName: 'SomeUnknownEvent', args: { id: '10', extra: 'x' } });
        breakLoopAfter(2);
        await runWatch(['--from', '2999']);
        (0, vitest_1.expect)(allLogged()).toContain('SomeUnknownEvent');
    });
    (0, vitest_1.it)('silently skips log that fails outer decode (no output, no throw)', async () => {
        mockGetBlockNumber.mockResolvedValueOnce(3000n);
        mockGetLogs.mockResolvedValueOnce([makeLog()]);
        // Outer decode throws → log skipped entirely
        mockDecodeEventLog.mockImplementation(() => { throw new Error('decode error'); });
        breakLoopAfter(2);
        await runWatch(['--from', '2999']);
        // Nothing event-related logged; header is printed but no event lines
        const lines = console.log.mock.calls.map(c => c.map(String).join(''));
        (0, vitest_1.expect)(lines.some(l => l.includes('decode error'))).toBe(false);
    });
});
// ─── renderEvent — JSON mode ──────────────────────────────────────────────────
(0, vitest_1.describe)('renderEvent — --json mode', () => {
    function jsonLines() {
        return console.log.mock.calls
            .map(c => c[0])
            .filter((s) => {
            if (typeof s !== 'string')
                return false;
            try {
                JSON.parse(s);
                return true;
            }
            catch {
                return false;
            }
        })
            .map((s) => JSON.parse(s));
    }
    async function runWithLogJson(eventName, args) {
        mockGetBlockNumber.mockResolvedValueOnce(3000n);
        mockGetLogs.mockResolvedValueOnce([makeLog()]);
        mockDecodeEventLog.mockReturnValue({ eventName, args });
        breakLoopAfter(2);
        await runWatch(['--json', '--from', '2999']);
    }
    (0, vitest_1.it)('outputs valid JSON for ProjectCreated', async () => {
        await runWithLogJson('ProjectCreated', {
            projectId: 1n, owner: '0xOwner', name: 'json-app', isAgent: false,
        });
        const lines = jsonLines();
        (0, vitest_1.expect)(lines.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(lines[0].event).toBe('ProjectCreated');
        (0, vitest_1.expect)(lines[0].block).toBe('9999');
        (0, vitest_1.expect)(lines[0].tx).toBe('0xdeadbeef');
    });
    (0, vitest_1.it)('includes timestamp field in JSON output', async () => {
        await runWithLogJson('VersionPushed', {
            projectId: 1n, versionIndex: 0n, arweaveHash: 'h', versionTag: 'v1',
        });
        const lines = jsonLines();
        (0, vitest_1.expect)(lines.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(lines[0]).toHaveProperty('timestamp');
        (0, vitest_1.expect)(typeof lines[0].timestamp).toBe('string');
    });
    (0, vitest_1.it)('converts bigint args to strings in JSON output', async () => {
        await runWithLogJson('VersionPushed', {
            projectId: 42n, versionIndex: 3n, arweaveHash: 'h', versionTag: 'v1',
        });
        const lines = jsonLines();
        (0, vitest_1.expect)(lines.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(lines[0].args.projectId).toBe('42');
        (0, vitest_1.expect)(lines[0].args.versionIndex).toBe('3');
    });
    (0, vitest_1.it)('outputs raw fallback JSON (raw+block) when renderEvent decode fails', async () => {
        mockGetBlockNumber.mockResolvedValueOnce(3000n);
        mockGetLogs.mockResolvedValueOnce([makeLog()]);
        // First decode (outer filter check) succeeds → renderEvent is called
        // Second decode (inside renderEvent) fails → raw fallback emitted
        mockDecodeEventLog
            .mockReturnValueOnce({ eventName: 'ProjectCreated', args: { projectId: 1n, owner: '0xA', name: 'x', isAgent: false } })
            .mockImplementationOnce(() => { throw new Error('bad abi in render'); });
        breakLoopAfter(2);
        await runWatch(['--json', '--from', '2999']);
        const lines = jsonLines();
        (0, vitest_1.expect)(lines.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(lines[0]).toHaveProperty('raw');
        (0, vitest_1.expect)(lines[0]).toHaveProperty('block');
    });
    (0, vitest_1.it)('includes args object in JSON output', async () => {
        await runWithLogJson('ProjectCreated', {
            projectId: 5n, owner: '0xOwner', name: 'test', isAgent: true,
        });
        const lines = jsonLines();
        (0, vitest_1.expect)(lines[0]).toHaveProperty('args');
        (0, vitest_1.expect)(typeof lines[0].args).toBe('object');
    });
});
// ─── Filter exclusion ─────────────────────────────────────────────────────────
(0, vitest_1.describe)('filter exclusion', () => {
    function allLogged() {
        return console.log.mock.calls
            .map(c => c.map(String).join(''))
            .join('\n');
    }
    async function runWithFilter(filter, eventName, args = { projectId: 1n, arweaveHash: 'x', versionTag: 'v1', versionIndex: 0n }) {
        mockGetBlockNumber.mockResolvedValueOnce(3000n);
        mockGetLogs.mockResolvedValueOnce([makeLog()]);
        mockDecodeEventLog.mockReturnValue({ eventName, args });
        breakLoopAfter(2);
        await runWatch([filter, '--from', '2999']);
    }
    (0, vitest_1.it)('versions filter: includes VersionPushed', async () => {
        await runWithFilter('versions', 'VersionPushed');
        (0, vitest_1.expect)(allLogged()).toContain('VersionPushed');
    });
    (0, vitest_1.it)('versions filter: excludes ProjectCreated', async () => {
        await runWithFilter('versions', 'ProjectCreated', { projectId: 1n, owner: '0xA', name: 'p', isAgent: false });
        (0, vitest_1.expect)(allLogged()).not.toContain('ProjectCreated');
    });
    (0, vitest_1.it)('projects filter: includes ProjectCreated', async () => {
        await runWithFilter('projects', 'ProjectCreated', { projectId: 1n, owner: '0xA', name: 'proj', isAgent: false });
        (0, vitest_1.expect)(allLogged()).toContain('ProjectCreated');
    });
    (0, vitest_1.it)('projects filter: excludes VersionPushed', async () => {
        await runWithFilter('projects', 'VersionPushed');
        (0, vitest_1.expect)(allLogged()).not.toContain('VersionPushed');
    });
    (0, vitest_1.it)('agents filter: includes AgentEndpointUpdated', async () => {
        await runWithFilter('agents', 'AgentEndpointUpdated', { projectId: 1n, endpoint: 'https://x.example.com' });
        (0, vitest_1.expect)(allLogged()).toContain('AgentEndpointUpdated');
    });
    (0, vitest_1.it)('agents filter: excludes CollaboratorAdded', async () => {
        await runWithFilter('agents', 'CollaboratorAdded', { projectId: 1n, collaborator: '0xColl' });
        (0, vitest_1.expect)(allLogged()).not.toContain('CollaboratorAdded');
    });
    (0, vitest_1.it)('all filter: includes every event type', async () => {
        await runWithFilter('all', 'CollaboratorRemoved', { projectId: 1n, collaborator: '0xColl' });
        (0, vitest_1.expect)(allLogged()).toContain('CollaboratorRemoved');
    });
});
// ─── Multiple logs in one poll ────────────────────────────────────────────────
(0, vitest_1.describe)('multiple logs per poll block', () => {
    (0, vitest_1.it)('renders all 3 logs when they arrive in one batch', async () => {
        mockGetBlockNumber.mockResolvedValueOnce(3010n);
        mockGetLogs.mockResolvedValueOnce([makeLog(), makeLog(), makeLog()]);
        // Each log: 2 decodeEventLog calls (filter + render)
        mockDecodeEventLog
            // Log 1
            .mockReturnValueOnce({ eventName: 'ProjectCreated', args: { projectId: 1n, owner: '0xA', name: 'proj-A', isAgent: false } })
            .mockReturnValueOnce({ eventName: 'ProjectCreated', args: { projectId: 1n, owner: '0xA', name: 'proj-A', isAgent: false } })
            // Log 2
            .mockReturnValueOnce({ eventName: 'VersionPushed', args: { projectId: 1n, versionIndex: 0n, arweaveHash: 'hhh', versionTag: 'v1' } })
            .mockReturnValueOnce({ eventName: 'VersionPushed', args: { projectId: 1n, versionIndex: 0n, arweaveHash: 'hhh', versionTag: 'v1' } })
            // Log 3
            .mockReturnValueOnce({ eventName: 'ReadmeUpdated', args: { projectId: 1n, arweaveHash: 'rrr' } })
            .mockReturnValueOnce({ eventName: 'ReadmeUpdated', args: { projectId: 1n, arweaveHash: 'rrr' } });
        breakLoopAfter(2);
        await runWatch(['--from', '3009']);
        const logged = console.log.mock.calls.map(c => c.map(String).join('')).join('\n');
        (0, vitest_1.expect)(logged).toContain('ProjectCreated');
        (0, vitest_1.expect)(logged).toContain('VersionPushed');
        (0, vitest_1.expect)(logged).toContain('ReadmeUpdated');
    });
});
// ─── lastBlock advancement ─────────────────────────────────────────────────────
(0, vitest_1.describe)('lastBlock advancement across polls', () => {
    (0, vitest_1.it)('uses correct fromBlock/toBlock on consecutive iterations', async () => {
        mockGetBlockNumber
            .mockResolvedValueOnce(3001n) // loop iteration 1
            .mockResolvedValueOnce(3005n); // loop iteration 2
        mockGetLogs.mockResolvedValue([]);
        breakLoopAfter(3); // allow two full loop iterations
        await runWatch(['--from', '3000']);
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenNthCalledWith(1, vitest_1.expect.objectContaining({ fromBlock: 3001n, toBlock: 3001n }));
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenNthCalledWith(2, vitest_1.expect.objectContaining({ fromBlock: 3002n, toBlock: 3005n }));
    });
});
// ─── getLogs address ──────────────────────────────────────────────────────────
(0, vitest_1.describe)('getLogs address', () => {
    (0, vitest_1.it)('always passes the registry address to getLogs', async () => {
        mockGetBlockNumber.mockResolvedValueOnce(4000n);
        mockGetLogs.mockResolvedValueOnce([]);
        breakLoopAfter(2);
        await runWatch(['--from', '3999']);
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ address: MOCK_REGISTRY }));
    });
});
// ─── Branch-coverage gap-fills ────────────────────────────────────────────────
(0, vitest_1.describe)('cmdWatch — fromBlock = 0n when latest <= 1000n (branch coverage)', () => {
    (0, vitest_1.it)('sets fromBlock to 0n when latest block is <= 1000n and no --from supplied', async () => {
        // latest = 500n <= 1000n → fromBlock = 0n (false branch of `latest > 1000n`)
        // Loop: currentBlock = 600n > 0n → getLogs(fromBlock=1n, toBlock=600n)
        mockGetBlockNumber
            .mockResolvedValueOnce(500n) // initial call (no --from)
            .mockResolvedValueOnce(600n); // first loop iteration
        mockGetLogs.mockResolvedValueOnce([]);
        breakLoopAfter(2);
        await runWatch([]);
        (0, vitest_1.expect)(mockGetLogs).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ fromBlock: 1n, toBlock: 600n }));
    });
});
(0, vitest_1.describe)('renderEvent — non-JSON catch branch (branch coverage)', () => {
    (0, vitest_1.it)('emits nothing (no raw line) when inner decode fails in non-JSON mode', async () => {
        // Outer decode succeeds (filter passes), inner decode throws → catch; !jsonMode → no output
        mockGetBlockNumber.mockResolvedValueOnce(3000n);
        mockGetLogs.mockResolvedValueOnce([makeLog()]);
        mockDecodeEventLog
            .mockReturnValueOnce({ eventName: 'ProjectCreated', args: { projectId: 1n, owner: '0xA', name: 'x', isAgent: false } })
            .mockImplementationOnce(() => { throw new Error('render decode failed'); });
        breakLoopAfter(2);
        await runWatch(['--from', '2999']); // non-JSON mode (no --json)
        // No raw/JSON line should have been emitted for the failed decode
        const logged = console.log.mock.calls
            .map(c => c.map(String).join(''))
            .join('\n');
        (0, vitest_1.expect)(logged).not.toContain('"raw"');
        (0, vitest_1.expect)(logged).not.toContain('render decode failed');
    });
});
//# sourceMappingURL=watch.test.js.map