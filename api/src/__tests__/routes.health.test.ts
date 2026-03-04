/**
 * @inkd/api — routes/health.ts tests
 *
 * Tests GET /v1/health and GET /v1/status using supertest + mocked viem clients.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { ApiConfig } from '../config.js'

// ─── Mock viem clients ────────────────────────────────────────────────────────

const mockReadContract = vi.fn()

vi.mock('../clients.js', () => ({
  buildPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
  })),
  buildWalletClient: vi.fn(),
  normalizePrivateKey: (k: string) => (k.startsWith('0x') ? k : `0x${k}`),
}))

// ─── Fixture config ───────────────────────────────────────────────────────────

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

const cfgWithContracts: ApiConfig = {
  ...baseCfg,
}

// Override ADDRESSES for tests
vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>()
  return {
    ...original,
    ADDRESSES: {
      mainnet: {
        token:    '0xTOKEN',
        registry: '0xREGISTRY',
        treasury: '0xTREASURY',
      },
      testnet: {
        token:    '0xTOKEN',
        registry: '0xREGISTRY',
        treasury: '0xTREASURY',
      },
    },
  }
})

// ─── Setup app ────────────────────────────────────────────────────────────────

async function makeApp(cfg = cfgWithContracts) {
  const { healthRouter } = await import('../routes/health.js')
  const app = express()
  app.use(express.json())
  app.use('/v1', healthRouter(cfg))
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /v1/health', () => {
  it('returns 200 with ok: true', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('includes service and version fields', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/health')
    expect(res.body.service).toBe('@inkd/api')
    expect(res.body.version).toBe('0.1.0')
  })

  it('includes uptimeMs', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/health')
    expect(typeof res.body.uptimeMs).toBe('number')
    expect(res.body.uptimeMs).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /v1/status', () => {
  beforeEach(() => {
    mockReadContract.mockReset()
  })

  it('returns rpcReachable: true when contracts are deployed and RPC works', async () => {
    mockReadContract
      .mockResolvedValueOnce(42n)     // projectCount
      .mockResolvedValueOnce(1000000000000000000000n) // totalSupply

    const app = await makeApp()
    const res = await request(app).get('/v1/status')

    expect(res.status).toBe(200)
    expect(res.body.rpcReachable).toBe(true)
    expect(res.body.protocol.projectCount).toBe('42')
    expect(res.body.protocol.totalSupply).toContain('INKD')
  })

  it('returns rpcReachable: false when RPC call throws', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC timeout'))
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.status).toBe(200)
    expect(res.body.rpcReachable).toBe(false)
    expect(res.body.protocol.projectCount).toBeNull()
  })

  it('includes contract addresses in response', async () => {
    mockReadContract.mockResolvedValue(0n)
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.body.contracts.token).toBe('0xTOKEN')
    expect(res.body.contracts.registry).toBe('0xREGISTRY')
  })

  it('returns network and rpcUrl fields in response', async () => {
    mockReadContract.mockResolvedValue(0n)
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.status).toBe(200)
    expect(res.body.network).toBe('testnet')
    expect(res.body.rpcUrl).toBe('http://localhost:8545')
  })

  it('includes server.version', async () => {
    mockReadContract.mockResolvedValue(0n)
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.body.server.version).toBe('0.1.0')
  })

  it('calls sendError when handler throws (outer catch — covers health.ts:90)', async () => {
    // Pass a config whose network key is absent from the mocked ADDRESSES map.
    // healthRouter() sets `addrs = ADDRESSES[cfg.network]` → undefined.
    // Inside the route handler `Boolean(addrs.registry)` throws a TypeError,
    // which is caught by the outer try/catch and forwarded to sendError().
    const brokenCfg: ApiConfig = {
      ...baseCfg,
      network: 'broken' as ApiConfig['network'],
    }
    const { healthRouter } = await import('../routes/health.js')
    const app = express()
    app.use(express.json())
    app.use('/v1', healthRouter(brokenCfg))

    const res = await request(app).get('/v1/status')
    expect(res.status).toBe(500)
    expect(res.body.error).toBeDefined()
  })
})
