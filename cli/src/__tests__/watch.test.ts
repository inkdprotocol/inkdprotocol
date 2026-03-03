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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_REGISTRY = '0x1111111111111111111111111111111111111111' as const
const SENTINEL      = '__STOP_LOOP__'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config.js')>()
  return {
    ...actual,
    loadConfig: vi.fn(() => ({ network: 'testnet', rpcUrl: undefined })),
    ADDRESSES: {
      testnet: {
        registry: MOCK_REGISTRY,
        token:    '0x2222222222222222222222222222222222222222',
        treasury: '0x3333333333333333333333333333333333333333',
      },
      mainnet: { registry: '', token: '', treasury: '' },
    },
    error:   vi.fn((msg: string) => { throw new Error(msg) }),
    info:    vi.fn(),
    success: vi.fn(),
    BOLD:   '',
    RESET:  '',
    CYAN:   '',
    DIM:    '',
    GREEN:  '',
    YELLOW: '',
  }
})

let mockGetBlockNumber: Mock
let mockGetLogs:        Mock

vi.mock('../client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client.js')>()
  return {
    ...actual,
    buildPublicClient: vi.fn(() => ({
      getBlockNumber: (...args: unknown[]) => mockGetBlockNumber(...args),
      getLogs:        (...args: unknown[]) => mockGetLogs(...args),
    })),
  }
})

// viem mock — parseAbi (module-level) returns []; decodeEventLog controlled per-test.
const mockDecodeEventLog = vi.fn()

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    parseAbi:       vi.fn(() => []),
    decodeEventLog: (...args: unknown[]) => mockDecodeEventLog(...args),
    formatEther:    actual.formatEther,
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    blockNumber:     9999n,
    transactionHash: '0xdeadbeef' as `0x${string}`,
    data:            '0x' as `0x${string}`,
    topics:          ['0xtopic1'] as [`0x${string}`, ...`0x${string}`[]],
    ...overrides,
  }
}

/**
 * Replace global.setTimeout to terminate the polling loop after `n` calls.
 * Calls < n: invoke the callback synchronously (instant tick).
 * Call  n  : throw the sentinel — escaping the await outside the try/catch.
 */
function breakLoopAfter(n: number) {
  let calls = 0
  vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
    calls++
    if (calls >= n) throw new Error(SENTINEL)
    fn()
    return 0 as unknown as ReturnType<typeof setTimeout>
  })
}

/** Run cmdWatch, swallowing the sentinel (and registry-not-configured) error. */
async function runWatch(args: string[]): Promise<void> {
  const { cmdWatch } = await import('../commands/watch.js')
  await cmdWatch(args).catch((e: Error) => {
    if (!e.message.includes(SENTINEL) && !e.message.includes('Registry address')) throw e
  })
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetBlockNumber = vi.fn().mockResolvedValue(2000n)
  mockGetLogs        = vi.fn().mockResolvedValue([])
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

// ─── parseFlag (tested via cmdWatch args) ─────────────────────────────────────

describe('parseFlag via cmdWatch flags', () => {
  it('default poll interval runs loop (no --poll needed)', async () => {
    breakLoopAfter(1)
    await runWatch([])
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })

  it('honours --poll <ms> flag', async () => {
    breakLoopAfter(1)
    await runWatch(['all', '--poll', '500'])
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })

  it('honours --from <block> flag — skips initial getBlockNumber', async () => {
    // With --from, no initial getBlockNumber call; only loop calls
    mockGetBlockNumber.mockResolvedValueOnce(5000n) // first loop call
    mockGetLogs.mockResolvedValueOnce([])
    breakLoopAfter(2)
    await runWatch(['--from', '4999'])
    expect(mockGetLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 5000n, toBlock: 5000n })
    )
  })

  it('uses latest-1000 as default fromBlock (no --from)', async () => {
    // With no --from: first call = initial block = 5000, lastBlock = 4000
    // Loop: currentBlock = 5001 > 4000 → getLogs(fromBlock=4001, toBlock=5001)
    mockGetBlockNumber
      .mockResolvedValueOnce(5000n) // initial (before loop)
      .mockResolvedValueOnce(5001n) // first loop iteration
    mockGetLogs.mockResolvedValueOnce([])
    breakLoopAfter(2)
    await runWatch([])
    expect(mockGetLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 4001n, toBlock: 5001n })
    )
  })

  it('--from 0 uses 0n as start block', async () => {
    mockGetBlockNumber.mockResolvedValueOnce(100n)
    mockGetLogs.mockResolvedValueOnce([])
    breakLoopAfter(2)
    await runWatch(['--from', '0'])
    expect(mockGetLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 1n, toBlock: 100n })
    )
  })
})

// ─── Filter validation ────────────────────────────────────────────────────────

describe('filter validation', () => {
  it('accepts "all" filter (default)', async () => {
    breakLoopAfter(1)
    await runWatch(['all'])
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })

  it('accepts "projects" filter', async () => {
    breakLoopAfter(1)
    await runWatch(['projects'])
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })

  it('accepts "versions" filter', async () => {
    breakLoopAfter(1)
    await runWatch(['versions'])
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })

  it('accepts "agents" filter', async () => {
    breakLoopAfter(1)
    await runWatch(['agents'])
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })

  it('rejects unknown filter via error()', async () => {
    const { cmdWatch } = await import('../commands/watch.js')
    await expect(cmdWatch(['invalid-filter'])).rejects.toThrow('Unknown filter')
  })

  it('treats first arg starting with -- as "all" (default filter)', async () => {
    breakLoopAfter(1)
    await runWatch(['--json'])
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })
})

// ─── Registry address guard ───────────────────────────────────────────────────

describe('registry address guard', () => {
  it('throws when registry address is empty string', async () => {
    const configMod = await import('../config.js')
    ;(configMod.ADDRESSES as Record<string, Record<string, string>>)['testnet']['registry'] = ''
    const { cmdWatch } = await import('../commands/watch.js')
    await expect(cmdWatch([])).rejects.toThrow('Registry address not configured')
    // restore
    ;(configMod.ADDRESSES as Record<string, Record<string, string>>)['testnet']['registry'] = MOCK_REGISTRY
  })
})

// ─── Header output ────────────────────────────────────────────────────────────

describe('header output', () => {
  it('prints "Inkd Protocol" header in non-JSON mode', async () => {
    breakLoopAfter(1)
    await runWatch([])
    const logged = (console.log as Mock).mock.calls.map(c => String(c[0]))
    expect(logged.some(l => l.includes('Inkd Protocol'))).toBe(true)
  })

  it('prints "Watching" line in non-JSON mode', async () => {
    breakLoopAfter(1)
    await runWatch([])
    const logged = (console.log as Mock).mock.calls.map(c => String(c[0]))
    expect(logged.some(l => l.includes('Watching'))).toBe(true)
  })

  it('does NOT print header in --json mode', async () => {
    breakLoopAfter(1)
    await runWatch(['--json'])
    const logged = (console.log as Mock).mock.calls.map(c => String(c[0]))
    expect(logged.some(l => l.includes('Inkd Protocol'))).toBe(false)
  })

  it('does NOT print "Watching" line in --json mode', async () => {
    breakLoopAfter(1)
    await runWatch(['--json'])
    const logged = (console.log as Mock).mock.calls.map(c => String(c[0]))
    expect(logged.some(l => l.includes('Watching'))).toBe(false)
  })
})

// ─── No new blocks → no getLogs call ─────────────────────────────────────────

describe('polling — no new blocks', () => {
  it('skips getLogs when currentBlock === fromBlock', async () => {
    mockGetBlockNumber.mockResolvedValue(2999n) // loop: same as --from
    breakLoopAfter(2)
    await runWatch(['--from', '2999'])
    expect(mockGetLogs).not.toHaveBeenCalled()
  })

  it('skips getLogs when currentBlock < lastBlock', async () => {
    mockGetBlockNumber.mockResolvedValue(1500n) // loop: less than --from 2000
    breakLoopAfter(2)
    await runWatch(['--from', '2000'])
    expect(mockGetLogs).not.toHaveBeenCalled()
  })
})

// ─── Poll error handling ──────────────────────────────────────────────────────

describe('poll error handling', () => {
  it('catches RPC error in loop and logs to console.error (non-JSON)', async () => {
    // Initial getBlockNumber (--from not set) succeeds, loop call rejects
    mockGetBlockNumber
      .mockResolvedValueOnce(3000n)               // initial pre-loop call
      .mockRejectedValueOnce(new Error('RPC timeout')) // first loop iteration
      .mockResolvedValue(3000n)                   // subsequent calls
    breakLoopAfter(2)
    await runWatch([])
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Poll error')
    )
  })

  it('silences poll errors in --json mode (no console.error)', async () => {
    // With --from, skip initial; loop call rejects
    mockGetBlockNumber
      .mockRejectedValueOnce(new Error('RPC timeout'))
      .mockResolvedValue(2000n)
    breakLoopAfter(2)
    await runWatch(['--json', '--from', '1999'])
    expect(console.error).not.toHaveBeenCalled()
  })

  it('continues polling after a single RPC error', async () => {
    mockGetBlockNumber
      .mockResolvedValueOnce(3000n)               // initial
      .mockRejectedValueOnce(new Error('timeout')) // loop iteration 1: caught
      .mockResolvedValueOnce(3001n)               // loop iteration 2: ok
    mockGetLogs.mockResolvedValue([])
    breakLoopAfter(3)
    await runWatch([])
    // getLogs called on iteration 2 (block advanced)
    expect(mockGetLogs).toHaveBeenCalled()
  })
})

// ─── renderEvent — all event types (non-JSON mode) ───────────────────────────

describe('renderEvent — non-JSON mode', () => {
  /**
   * Set up one log that decodes to `eventName`/`args`.
   * decodeEventLog is called TWICE per log (outer filter check + inside renderEvent),
   * so we use mockReturnValue (persistent) rather than mockReturnValueOnce.
   */
  async function runWithLog(eventName: string, args: Record<string, unknown>) {
    mockGetBlockNumber.mockResolvedValueOnce(3000n)
    mockGetLogs.mockResolvedValueOnce([makeLog()])
    // Persistent mock: both filter-check and renderEvent decode calls succeed
    mockDecodeEventLog.mockReturnValue({ eventName, args })
    breakLoopAfter(2)
    await runWatch(['--from', '2999'])
  }

  /** Collect all args from console.log calls as one joined string */
  function allLogged(): string {
    return (console.log as Mock).mock.calls
      .map(c => c.map(String).join(''))
      .join('\n')
  }

  it('renders ProjectCreated (non-agent)', async () => {
    await runWithLog('ProjectCreated', {
      projectId: 1n, owner: '0xAbCd1234000000000000', name: 'my-app', isAgent: false,
    })
    expect(allLogged()).toContain('ProjectCreated')
    expect(allLogged()).toContain('my-app')
  })

  it('renders ProjectCreated (agent) — shows [agent] badge', async () => {
    await runWithLog('ProjectCreated', {
      projectId: 2n, owner: '0xAbCd1234000000000000', name: 'my-bot', isAgent: true,
    })
    expect(allLogged()).toContain('[agent]')
    expect(allLogged()).toContain('my-bot')
  })

  it('renders VersionPushed', async () => {
    await runWithLog('VersionPushed', {
      projectId: 3n, versionIndex: 0n, arweaveHash: 'arweaveHashABC123', versionTag: 'v0.9.0',
    })
    expect(allLogged()).toContain('VersionPushed')
    expect(allLogged()).toContain('v0.9.0')
    expect(allLogged()).toContain('ar://')
  })

  it('renders ProjectTransferred', async () => {
    await runWithLog('ProjectTransferred', {
      projectId: 4n, from: '0xFromAddress0000000000', to: '0xToAddress00000000000',
    })
    expect(allLogged()).toContain('ProjectTransferred')
  })

  it('renders CollaboratorAdded', async () => {
    await runWithLog('CollaboratorAdded', { projectId: 5n, collaborator: '0xCollabAddress0000000' })
    expect(allLogged()).toContain('CollaboratorAdded')
  })

  it('renders CollaboratorRemoved', async () => {
    await runWithLog('CollaboratorRemoved', { projectId: 6n, collaborator: '0xCollabAddress0000000' })
    expect(allLogged()).toContain('CollaboratorRemoved')
  })

  it('renders VisibilityChanged (public=true)', async () => {
    await runWithLog('VisibilityChanged', { projectId: 7n, isPublic: true })
    expect(allLogged()).toContain('VisibilityChanged')
    expect(allLogged()).toContain('true')
  })

  it('renders VisibilityChanged (public=false)', async () => {
    await runWithLog('VisibilityChanged', { projectId: 7n, isPublic: false })
    expect(allLogged()).toContain('VisibilityChanged')
    expect(allLogged()).toContain('false')
  })

  it('renders ReadmeUpdated', async () => {
    await runWithLog('ReadmeUpdated', { projectId: 8n, arweaveHash: 'readme123abc' })
    expect(allLogged()).toContain('ReadmeUpdated')
    expect(allLogged()).toContain('ar://')
  })

  it('renders AgentEndpointUpdated', async () => {
    await runWithLog('AgentEndpointUpdated', {
      projectId: 9n, endpoint: 'https://agent.inkdprotocol.xyz',
    })
    expect(allLogged()).toContain('AgentEndpointUpdated')
    expect(allLogged()).toContain('https://agent.inkdprotocol.xyz')
  })

  it('renders unknown event via default branch', async () => {
    // The default branch in renderEvent's switch is only reachable when the outer
    // filter-check decode passes (uses a known event name) but the inner
    // renderEvent decode returns a different, unrecognised name.
    mockGetBlockNumber.mockResolvedValueOnce(3000n)
    mockGetLogs.mockResolvedValueOnce([makeLog()])
    mockDecodeEventLog
      // Outer filter check: use a known event so the log passes the FILTER_MAP guard
      .mockReturnValueOnce({ eventName: 'ProjectCreated', args: { projectId: 1n, owner: '0xA', name: 'x', isAgent: false } })
      // renderEvent's own decode: return an unknown event name → default branch
      // Note: default branch calls JSON.stringify(args), so no BigInt values here
      .mockReturnValueOnce({ eventName: 'SomeUnknownEvent', args: { id: '10', extra: 'x' } })
    breakLoopAfter(2)
    await runWatch(['--from', '2999'])
    expect(allLogged()).toContain('SomeUnknownEvent')
  })

  it('silently skips log that fails outer decode (no output, no throw)', async () => {
    mockGetBlockNumber.mockResolvedValueOnce(3000n)
    mockGetLogs.mockResolvedValueOnce([makeLog()])
    // Outer decode throws → log skipped entirely
    mockDecodeEventLog.mockImplementation(() => { throw new Error('decode error') })
    breakLoopAfter(2)
    await runWatch(['--from', '2999'])
    // Nothing event-related logged; header is printed but no event lines
    const lines = (console.log as Mock).mock.calls.map(c => c.map(String).join(''))
    expect(lines.some(l => l.includes('decode error'))).toBe(false)
  })
})

// ─── renderEvent — JSON mode ──────────────────────────────────────────────────

describe('renderEvent — --json mode', () => {
  function jsonLines(): unknown[] {
    return (console.log as Mock).mock.calls
      .map(c => c[0])
      .filter((s: unknown) => {
        if (typeof s !== 'string') return false
        try { JSON.parse(s); return true } catch { return false }
      })
      .map((s: string) => JSON.parse(s))
  }

  async function runWithLogJson(eventName: string, args: Record<string, unknown>) {
    mockGetBlockNumber.mockResolvedValueOnce(3000n)
    mockGetLogs.mockResolvedValueOnce([makeLog()])
    mockDecodeEventLog.mockReturnValue({ eventName, args })
    breakLoopAfter(2)
    await runWatch(['--json', '--from', '2999'])
  }

  it('outputs valid JSON for ProjectCreated', async () => {
    await runWithLogJson('ProjectCreated', {
      projectId: 1n, owner: '0xOwner', name: 'json-app', isAgent: false,
    })
    const lines = jsonLines() as Array<Record<string, unknown>>
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0].event).toBe('ProjectCreated')
    expect(lines[0].block).toBe('9999')
    expect(lines[0].tx).toBe('0xdeadbeef')
  })

  it('includes timestamp field in JSON output', async () => {
    await runWithLogJson('VersionPushed', {
      projectId: 1n, versionIndex: 0n, arweaveHash: 'h', versionTag: 'v1',
    })
    const lines = jsonLines() as Array<Record<string, unknown>>
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]).toHaveProperty('timestamp')
    expect(typeof lines[0].timestamp).toBe('string')
  })

  it('converts bigint args to strings in JSON output', async () => {
    await runWithLogJson('VersionPushed', {
      projectId: 42n, versionIndex: 3n, arweaveHash: 'h', versionTag: 'v1',
    })
    const lines = jsonLines() as Array<Record<string, { projectId: unknown; versionIndex: unknown }>>
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0].args.projectId).toBe('42')
    expect(lines[0].args.versionIndex).toBe('3')
  })

  it('outputs raw fallback JSON (raw+block) when renderEvent decode fails', async () => {
    mockGetBlockNumber.mockResolvedValueOnce(3000n)
    mockGetLogs.mockResolvedValueOnce([makeLog()])
    // First decode (outer filter check) succeeds → renderEvent is called
    // Second decode (inside renderEvent) fails → raw fallback emitted
    mockDecodeEventLog
      .mockReturnValueOnce({ eventName: 'ProjectCreated', args: { projectId: 1n, owner: '0xA', name: 'x', isAgent: false } })
      .mockImplementationOnce(() => { throw new Error('bad abi in render') })
    breakLoopAfter(2)
    await runWatch(['--json', '--from', '2999'])
    const lines = jsonLines() as Array<Record<string, unknown>>
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]).toHaveProperty('raw')
    expect(lines[0]).toHaveProperty('block')
  })

  it('includes args object in JSON output', async () => {
    await runWithLogJson('ProjectCreated', {
      projectId: 5n, owner: '0xOwner', name: 'test', isAgent: true,
    })
    const lines = jsonLines() as Array<Record<string, unknown>>
    expect(lines[0]).toHaveProperty('args')
    expect(typeof lines[0].args).toBe('object')
  })
})

// ─── Filter exclusion ─────────────────────────────────────────────────────────

describe('filter exclusion', () => {
  function allLogged(): string {
    return (console.log as Mock).mock.calls
      .map(c => c.map(String).join(''))
      .join('\n')
  }

  async function runWithFilter(filter: string, eventName: string, args: Record<string, unknown> = { projectId: 1n, arweaveHash: 'x', versionTag: 'v1', versionIndex: 0n }) {
    mockGetBlockNumber.mockResolvedValueOnce(3000n)
    mockGetLogs.mockResolvedValueOnce([makeLog()])
    mockDecodeEventLog.mockReturnValue({ eventName, args })
    breakLoopAfter(2)
    await runWatch([filter, '--from', '2999'])
  }

  it('versions filter: includes VersionPushed', async () => {
    await runWithFilter('versions', 'VersionPushed')
    expect(allLogged()).toContain('VersionPushed')
  })

  it('versions filter: excludes ProjectCreated', async () => {
    await runWithFilter('versions', 'ProjectCreated', { projectId: 1n, owner: '0xA', name: 'p', isAgent: false })
    expect(allLogged()).not.toContain('ProjectCreated')
  })

  it('projects filter: includes ProjectCreated', async () => {
    await runWithFilter('projects', 'ProjectCreated', { projectId: 1n, owner: '0xA', name: 'proj', isAgent: false })
    expect(allLogged()).toContain('ProjectCreated')
  })

  it('projects filter: excludes VersionPushed', async () => {
    await runWithFilter('projects', 'VersionPushed')
    expect(allLogged()).not.toContain('VersionPushed')
  })

  it('agents filter: includes AgentEndpointUpdated', async () => {
    await runWithFilter('agents', 'AgentEndpointUpdated', { projectId: 1n, endpoint: 'https://x.example.com' })
    expect(allLogged()).toContain('AgentEndpointUpdated')
  })

  it('agents filter: excludes CollaboratorAdded', async () => {
    await runWithFilter('agents', 'CollaboratorAdded', { projectId: 1n, collaborator: '0xColl' })
    expect(allLogged()).not.toContain('CollaboratorAdded')
  })

  it('all filter: includes every event type', async () => {
    await runWithFilter('all', 'CollaboratorRemoved', { projectId: 1n, collaborator: '0xColl' })
    expect(allLogged()).toContain('CollaboratorRemoved')
  })
})

// ─── Multiple logs in one poll ────────────────────────────────────────────────

describe('multiple logs per poll block', () => {
  it('renders all 3 logs when they arrive in one batch', async () => {
    mockGetBlockNumber.mockResolvedValueOnce(3010n)
    mockGetLogs.mockResolvedValueOnce([makeLog(), makeLog(), makeLog()])

    // Each log: 2 decodeEventLog calls (filter + render)
    mockDecodeEventLog
      // Log 1
      .mockReturnValueOnce({ eventName: 'ProjectCreated',   args: { projectId: 1n, owner: '0xA', name: 'proj-A', isAgent: false } })
      .mockReturnValueOnce({ eventName: 'ProjectCreated',   args: { projectId: 1n, owner: '0xA', name: 'proj-A', isAgent: false } })
      // Log 2
      .mockReturnValueOnce({ eventName: 'VersionPushed',    args: { projectId: 1n, versionIndex: 0n, arweaveHash: 'hhh', versionTag: 'v1' } })
      .mockReturnValueOnce({ eventName: 'VersionPushed',    args: { projectId: 1n, versionIndex: 0n, arweaveHash: 'hhh', versionTag: 'v1' } })
      // Log 3
      .mockReturnValueOnce({ eventName: 'ReadmeUpdated',    args: { projectId: 1n, arweaveHash: 'rrr' } })
      .mockReturnValueOnce({ eventName: 'ReadmeUpdated',    args: { projectId: 1n, arweaveHash: 'rrr' } })

    breakLoopAfter(2)
    await runWatch(['--from', '3009'])

    const logged = (console.log as Mock).mock.calls.map(c => c.map(String).join('')).join('\n')
    expect(logged).toContain('ProjectCreated')
    expect(logged).toContain('VersionPushed')
    expect(logged).toContain('ReadmeUpdated')
  })
})

// ─── lastBlock advancement ─────────────────────────────────────────────────────

describe('lastBlock advancement across polls', () => {
  it('uses correct fromBlock/toBlock on consecutive iterations', async () => {
    mockGetBlockNumber
      .mockResolvedValueOnce(3001n) // loop iteration 1
      .mockResolvedValueOnce(3005n) // loop iteration 2
    mockGetLogs.mockResolvedValue([])
    breakLoopAfter(3) // allow two full loop iterations
    await runWatch(['--from', '3000'])

    expect(mockGetLogs).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ fromBlock: 3001n, toBlock: 3001n })
    )
    expect(mockGetLogs).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ fromBlock: 3002n, toBlock: 3005n })
    )
  })
})

// ─── getLogs address ──────────────────────────────────────────────────────────

describe('getLogs address', () => {
  it('always passes the registry address to getLogs', async () => {
    mockGetBlockNumber.mockResolvedValueOnce(4000n)
    mockGetLogs.mockResolvedValueOnce([])
    breakLoopAfter(2)
    await runWatch(['--from', '3999'])
    expect(mockGetLogs).toHaveBeenCalledWith(
      expect.objectContaining({ address: MOCK_REGISTRY })
    )
  })
})
