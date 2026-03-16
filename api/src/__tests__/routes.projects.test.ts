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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { ApiConfig } from '../config.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReadContract  = vi.fn()
const mockWriteContract = vi.fn()
const mockWaitForTx     = vi.fn()

vi.mock('../graph.js', () => ({
  getGraphClient: () => null,
  initGraphClient: vi.fn(),
}))

vi.mock('../clients.js', () => ({
  buildPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
    waitForTransactionReceipt: mockWaitForTx,
    getTransactionCount: vi.fn().mockResolvedValue(42),
  })),
  buildWalletClient: vi.fn(() => ({
    client: { writeContract: mockWriteContract },
    address: '0xSERVER000000000000000000000000000000000A',
  })),
  normalizePrivateKey: (k: string) => (k.startsWith('0x') ? k : `0x${k}`),
}))

vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>()
  return {
    ...original,
    ADDRESSES: {
      mainnet: { token: '0xTOKEN', registry: '0xREGISTRY', treasury: '0xTREASURY' },
      testnet: { token: '0xTOKEN', registry: '0xREGISTRY', treasury: '0xTREASURY' },
    },
  }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseCfg: ApiConfig = {
  port: 3000,
  network: 'testnet',
  rpcUrl: 'http://localhost:8545',
  apiKey: null,
  corsOrigin: '*',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 100,
  serverWalletKey: '0xdeadbeef00000000000000000000000000000000000000000000000000000001',
  serverWalletAddress: '0xSERVER000000000000000000000000000000000A' as `0x${string}`,
  x402FacilitatorUrl: 'https://x402.org/facilitator',
  x402Enabled: false,
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  treasuryAddress: null,
}

const rawProject = {
  id:            1n,
  name:          'test-agent',
  description:   'A test agent',
  license:       'MIT',
  readmeHash:    '0xREADME',
  owner:         '0xOWNER1234567890123456789012345678901234' as `0x${string}`,
  isPublic:      true,
  isAgent:       false,
  agentEndpoint: '',
  createdAt:     1700000000n,
  versionCount:  3n,
  exists:        true,
}

// V2 contract Version struct field names
const rawVersion = {
  projectId:   1n,
  arweaveHash: 'ar://abc123',
  versionTag:  'v1.0.0',
  changelog:   'Initial release',
  pushedBy:    '0xPUSHER000000000000000000000000000000000' as `0x${string}`,
  pushedAt:    1700000100n,
}

// Helpers to mock V2 project metadata reads (appended after getProject call)
function mockV2Meta(metadataUri = '', forkOf = 0n, accessManifest = '') {
  mockReadContract
    .mockResolvedValueOnce(metadataUri)   // projectMetadataUri
    .mockResolvedValueOnce(forkOf)        // projectForkOf
    .mockResolvedValueOnce(accessManifest) // projectAccessManifest
}

// Helpers to mock version reads (getVersion + getVersionAgent + versionMetaHash per version)
function mockVersionReads(versions: typeof rawVersion[]) {
  mockReadContract.mockResolvedValueOnce(BigInt(versions.length)) // getVersionCount
  versions.forEach(v => {
    mockReadContract
      .mockResolvedValueOnce(v)    // getVersion(id, idx)
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // getVersionAgent
      .mockResolvedValueOnce('')   // versionMetaHash
  })
}

async function makeApp(cfg = baseCfg) {
  const { projectsRouter } = await import('../routes/projects.js')
  const app = express()
  app.use(express.json())
  app.use('/v1/projects', projectsRouter(cfg))
  return app
}

// ─── GET /v1/projects ─────────────────────────────────────────────────────────

describe('GET /v1/projects', () => {
  beforeEach(() => { mockReadContract.mockReset() })

  it('returns paginated list of projects', async () => {
    mockReadContract
      .mockResolvedValueOnce(2n)             // projectCount
      .mockResolvedValueOnce(rawProject)     // getProject(1)
      .mockResolvedValueOnce({ ...rawProject, id: 2n, name: 'proj2', exists: true }) // getProject(2)

    const app = await makeApp()
    const res = await request(app).get('/v1/projects')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].name).toBe('test-agent')
    expect(res.body.total).toBe('2')
  })

  it('respects offset and limit query params', async () => {
    mockReadContract
      .mockResolvedValueOnce(10n)       // projectCount
      .mockResolvedValueOnce(rawProject) // getProject(3)

    const app = await makeApp()
    const res = await request(app).get('/v1/projects?offset=2&limit=1')
    expect(res.status).toBe(200)
    expect(res.body.offset).toBe(2)
    expect(res.body.limit).toBe(1)
  })

  it('skips projects where exists=false', async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce({ ...rawProject, exists: false })

    const app = await makeApp()
    const res = await request(app).get('/v1/projects')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('returns 503 when registry not configured', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC unreachable'))
    const app = await makeApp()
    const res = await request(app).get('/v1/projects')
    expect([502, 503]).toContain(res.status)
  })

  it('serializes bigint fields as strings', async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(rawProject)

    const app = await makeApp()
    const res = await request(app).get('/v1/projects')
    expect(typeof res.body.data[0].id).toBe('string')
    expect(typeof res.body.data[0].versionCount).toBe('string')
    expect(typeof res.body.data[0].createdAt).toBe('string')
  })
})

// ─── GET /v1/projects/:id ─────────────────────────────────────────────────────

describe('GET /v1/projects/:id', () => {
  beforeEach(() => { mockReadContract.mockReset() })

  it('returns a project by id', async () => {
    mockReadContract.mockResolvedValueOnce(rawProject) // getProject
    mockV2Meta('ar://metadata', 0n, '')

    const app = await makeApp()
    const res = await request(app).get('/v1/projects/1')
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('test-agent')
    expect(res.body.data.metadataUri).toBe('ar://metadata')
    expect(res.body.data.forkOf).toBe('0')
  })

  it('returns 404 when project does not exist', async () => {
    mockReadContract.mockResolvedValue({ ...rawProject, exists: false })
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/99')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 for non-integer id', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/abc')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 for id=0', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/0')
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative id', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/-5')
    expect(res.status).toBe(400)
  })
})

// ─── POST /v1/projects ────────────────────────────────────────────────────────

describe('POST /v1/projects', () => {
  beforeEach(() => {
    mockReadContract.mockReset()
    mockWriteContract.mockReset()
    mockWaitForTx.mockReset()
  })

  const validBody = {
    name: 'new-agent',
    description: 'An agent',
    license: 'MIT',
    isPublic: true,
    readmeHash: '',
    isAgent: true,
    agentEndpoint: 'https://agent.example.com',
  }

  it('creates a project and returns 201', async () => {
    mockWriteContract.mockResolvedValue('0xTXHASH')
    mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 100n })
    mockReadContract.mockResolvedValue(5n) // projectCount

    const app = await makeApp()
    const res = await request(app).post('/v1/projects').send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.txHash).toBe('0xTXHASH')
    expect(res.body.projectId).toBe('5')
  })

  it('returns 400 when name is missing', async () => {
    const app = await makeApp()
    const res = await request(app).post('/v1/projects').send({ description: 'no name' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const app = await makeApp()
    const res = await request(app).post('/v1/projects').send({ ...validBody, name: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when agentEndpoint is not a valid URL', async () => {
    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects')
      .send({ ...validBody, agentEndpoint: 'not-a-url' })
    expect(res.status).toBe(400)
  })

  it('allows empty agentEndpoint string', async () => {
    mockWriteContract.mockResolvedValue('0xTXHASH')
    mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 100n })
    mockReadContract.mockResolvedValue(1n)

    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects')
      .send({ ...validBody, agentEndpoint: '' })
    expect(res.status).toBe(201)
  })

  it('returns 503 when serverWalletKey is null', async () => {
    const cfgNoKey: ApiConfig = { ...baseCfg, serverWalletKey: null }
    const { projectsRouter } = await import('../routes/projects.js')
    const app = express()
    app.use(express.json())
    app.use('/v1/projects', projectsRouter(cfgNoKey))
    const res = await request(app).post('/v1/projects').send(validBody)
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE')
  })

  it('includes signer address in response', async () => {
    mockWriteContract.mockResolvedValue('0xTXHASH')
    mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 100n })
    mockReadContract.mockResolvedValue(1n)

    const app = await makeApp()
    const res = await request(app).post('/v1/projects').send(validBody)
    expect(res.body.signer).toBeDefined()
  })

  it('returns 502 when RPC write fails', async () => {
    mockWriteContract.mockRejectedValue(new Error('RPC call failed'))

    const app = await makeApp()
    const res = await request(app).post('/v1/projects').send(validBody)
    expect(res.status).toBe(502)
  })
})

// ─── GET /v1/projects/:id/versions ───────────────────────────────────────────

describe('GET /v1/projects/:id/versions', () => {
  beforeEach(() => { mockReadContract.mockReset() })

  it('returns versions for a project', async () => {
    mockReadContract.mockResolvedValueOnce(rawProject) // getProject
    mockVersionReads([rawVersion])

    const app = await makeApp()
    const res = await request(app).get('/v1/projects/1/versions')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].versionTag).toBe('v1.0.0')
    expect(res.body.data[0].arweaveHash).toBe('ar://abc123')
  })

  it('returns 404 when project does not exist', async () => {
    mockReadContract.mockResolvedValue({ ...rawProject, exists: false })
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/99/versions')
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-integer id', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/abc/versions')
    expect(res.status).toBe(400)
  })

  it('respects offset and limit', async () => {
    mockReadContract.mockResolvedValueOnce(rawProject) // getProject
    mockVersionReads([rawVersion])
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/1/versions?offset=0&limit=5')
    expect(res.status).toBe(200)
    expect(res.body.limit).toBe(5)
  })

  it('serializes version bigint fields as strings', async () => {
    mockReadContract.mockResolvedValueOnce(rawProject) // getProject
    mockVersionReads([rawVersion])
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/1/versions')
    const v = res.body.data[0]
    expect(typeof v.versionIndex).toBe('string')
    expect(typeof v.pushedAt).toBe('string')
    expect(typeof v.projectId).toBe('string')
  })

  it('returns empty array for project with no versions', async () => {
    mockReadContract.mockResolvedValueOnce(rawProject) // getProject
    mockVersionReads([])
    const app = await makeApp()
    const res = await request(app).get('/v1/projects/1/versions')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })
})

// ─── POST /v1/projects/:id/versions ──────────────────────────────────────────

describe('POST /v1/projects/:id/versions', () => {
  beforeEach(() => {
    mockReadContract.mockReset()
    mockWriteContract.mockReset()
    mockWaitForTx.mockReset()
  })

  // V2 field names: arweaveHash + versionTag instead of contentHash + tag
  const validVersionBody = {
    arweaveHash: 'ar://abc123def456',
    versionTag:  'v2.0.0',
    changelog:   'Major update',
  }

  it('pushes a version and returns 201', async () => {
    mockWriteContract.mockResolvedValue('0xVERSION_TX')
    mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 200n })

    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects/1/versions')
      .send(validVersionBody)
    expect(res.status).toBe(201)
    expect(res.body.txHash).toBe('0xVERSION_TX')
    expect(res.body.versionTag).toBe('v2.0.0')
    expect(res.body.arweaveHash).toBe('ar://abc123def456')
  })

  it('returns 400 when versionTag is empty', async () => {
    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects/1/versions')
      .send({ ...validVersionBody, versionTag: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when arweaveHash is empty', async () => {
    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects/1/versions')
      .send({ ...validVersionBody, arweaveHash: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid project id', async () => {
    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects/bad/versions')
      .send(validVersionBody)
    expect(res.status).toBe(400)
  })

  it('returns 503 when serverWalletKey is null', async () => {
    const cfgNoKey: ApiConfig = { ...baseCfg, serverWalletKey: null }
    const { projectsRouter } = await import('../routes/projects.js')
    const app = express()
    app.use(express.json())
    app.use('/v1/projects', projectsRouter(cfgNoKey))
    const res = await request(app)
      .post('/v1/projects/1/versions')
      .send(validVersionBody)
    expect(res.status).toBe(503)
  })

  it('defaults versionMetadataArweaveHash to empty string when omitted', async () => {
    mockWriteContract.mockResolvedValue('0xTX')
    mockWaitForTx.mockResolvedValue({ status: 'success', blockNumber: 1n })
    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects/1/versions')
      .send({ arweaveHash: 'ar://abc', versionTag: 'v1.0.0' })
    expect(res.status).toBe(201)
  })

  it('returns 502 when writeContract throws RPC error', async () => {
    mockWriteContract.mockRejectedValue(new Error('RPC contract error'))
    const app = await makeApp()
    const res = await request(app)
      .post('/v1/projects/1/versions')
      .send(validVersionBody)
    expect(res.status).toBe(502)
  })
})

// ── GET /v1/projects/by-name/:name ────────────────────────────────────────────

describe('GET /v1/projects/by-name/:name', () => {
  it('returns 404 when project not found via RPC scan', async () => {
    mockReadContract.mockReset()
    mockReadContract.mockResolvedValueOnce(0n)
    const { projectsRouter } = await import('../routes/projects.js')
    const app = express()
    app.use(express.json())
    app.use('/v1/projects', projectsRouter(baseCfg))
    const res = await request(app).get('/v1/projects/by-name/nonexistent')
    expect(res.status).toBe(404)
  })

  it('returns project when found by name via RPC scan', async () => {
    mockReadContract.mockReset()
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce({
        id: 1n, name: 'my-agent', description: 'desc', license: 'MIT',
        readmeHash: '', owner: '0xABC', isPublic: true, isAgent: false,
        agentEndpoint: '', createdAt: 1000n, versionCount: 0n, exists: true,
      })
    const { projectsRouter } = await import('../routes/projects.js')
    const app = express()
    app.use(express.json())
    app.use('/v1/projects', projectsRouter(baseCfg))
    const res = await request(app).get('/v1/projects/by-name/my-agent')
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('my-agent')
    expect(res.body.source).toBe('rpc')
  })
})

// ── GET /v1/projects with filters ─────────────────────────────────────────────

describe('GET /v1/projects with owner/isAgent filters', () => {
  it('returns 503 when owner filter requested but no graph client configured', async () => {
    // owner filter requires Graph — without it, API returns 503 GRAPH_UNAVAILABLE
    const { projectsRouter } = await import('../routes/projects.js')
    const app = express()
    app.use(express.json())
    app.use('/v1/projects', projectsRouter(baseCfg))
    const res = await request(app).get('/v1/projects?owner=0xOWNER')
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('GRAPH_UNAVAILABLE')
  })

  it('passes isAgent=true query param and returns list via RPC', async () => {
    mockReadContract.mockReset()
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce({
        id: 1n, name: 'agent-1', description: '', license: 'MIT',
        readmeHash: '', owner: '0xAGENT', isPublic: true, isAgent: true,
        agentEndpoint: '', createdAt: 1000n, versionCount: 0n, exists: true,
      })
    const { projectsRouter } = await import('../routes/projects.js')
    const app = express()
    app.use(express.json())
    app.use('/v1/projects', projectsRouter(baseCfg))
    const res = await request(app).get('/v1/projects?isAgent=true')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})
