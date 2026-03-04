/**
 * @inkd/api — routes/agents.ts tests
 *
 * Covers:
 *   GET /v1/agents
 *   GET /v1/agents/by-name/:name
 *   GET /v1/agents/:id
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { ApiConfig } from '../config.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReadContract = vi.fn()

vi.mock('../clients.js', () => ({
  buildPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
  })),
  buildWalletClient: vi.fn(),
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
  serverWalletKey: null,
  serverWalletAddress: null,
  x402FacilitatorUrl: 'https://x402.org/facilitator',
  x402Enabled: false,
    treasuryAddress: null,
}

const rawAgent = {
  id:            1n,
  name:          'smart-agent',
  description:   'A smart AI agent',
  owner:         '0xOWNER0000000000000000000000000000000001' as `0x${string}`,
  agentEndpoint: 'https://smart-agent.example.com',
  isPublic:      true,
  isAgent:       true,
  license:       'MIT',
  readmeHash:    '',
  versionCount:  2n,
  createdAt:     1700000000n,
  exists:        true,
}

async function makeApp() {
  const { agentsRouter } = await import('../routes/agents.js')
  const app = express()
  app.use(express.json())
  app.use('/v1/agents', agentsRouter(baseCfg))
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /v1/agents', () => {
  beforeEach(() => { mockReadContract.mockReset() })

  it('returns list of agents', async () => {
    mockReadContract.mockResolvedValue([rawAgent])
    const app = await makeApp()
    const res = await request(app).get('/v1/agents')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('smart-agent')
  })

  it('returns empty array when no agents', async () => {
    mockReadContract.mockResolvedValue([])
    const app = await makeApp()
    const res = await request(app).get('/v1/agents')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.count).toBe(0)
  })

  it('includes offset, limit, count in response', async () => {
    mockReadContract.mockResolvedValue([rawAgent])
    const app = await makeApp()
    const res = await request(app).get('/v1/agents?offset=5&limit=10')
    expect(res.body.offset).toBe(5)
    expect(res.body.limit).toBe(10)
    expect(res.body.count).toBe(1)
  })

  it('serializes bigint fields as strings', async () => {
    mockReadContract.mockResolvedValue([rawAgent])
    const app = await makeApp()
    const res = await request(app).get('/v1/agents')
    expect(typeof res.body.data[0].id).toBe('string')
    expect(typeof res.body.data[0].versionCount).toBe('string')
    expect(typeof res.body.data[0].createdAt).toBe('string')
  })

  it('returns 502 when RPC fails', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC error'))
    const app = await makeApp()
    const res = await request(app).get('/v1/agents')
    expect(res.status).toBe(502)
  })
})

describe('GET /v1/agents/by-name/:name', () => {
  beforeEach(() => { mockReadContract.mockReset() })

  it('returns agent by name', async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)       // getProjectByName → projectId
      .mockResolvedValueOnce(rawAgent) // getProject

    const app = await makeApp()
    const res = await request(app).get('/v1/agents/by-name/smart-agent')
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('smart-agent')
  })

  it('returns 404 when project id is 0n', async () => {
    mockReadContract.mockResolvedValue(0n) // getProjectByName → not found
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/by-name/unknown-agent')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 when project does not exist', async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce({ ...rawAgent, exists: false })
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/by-name/gone-agent')
    expect(res.status).toBe(404)
  })

  it('returns 404 when project is not an agent', async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce({ ...rawAgent, isAgent: false })
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/by-name/not-an-agent')
    expect(res.status).toBe(404)
  })

  it('returns 502 when RPC fails', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC contract failure'))
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/by-name/some-agent')
    expect(res.status).toBe(502)
  })
})

describe('GET /v1/agents/:id', () => {
  beforeEach(() => { mockReadContract.mockReset() })

  it('returns agent project by id', async () => {
    mockReadContract.mockResolvedValue(rawAgent)
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/1')
    expect(res.status).toBe(200)
    expect(res.body.data.agentEndpoint).toBe('https://smart-agent.example.com')
  })

  it('returns 404 when project does not exist', async () => {
    mockReadContract.mockResolvedValue({ ...rawAgent, exists: false })
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/999')
    expect(res.status).toBe(404)
  })

  it('returns 404 when project is not an agent', async () => {
    mockReadContract.mockResolvedValue({ ...rawAgent, isAgent: false })
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/2')
    expect(res.status).toBe(404)
    expect(res.body.error.message).toContain('not an agent')
  })

  it('returns 400 for invalid id', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/xyz')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 for id=0', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/0')
    expect(res.status).toBe(400)
  })

  it('returns 502 on RPC error', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC failed'))
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/1')
    expect(res.status).toBe(502)
  })
})
