/**
 * @inkd/api — GET /v1/projects/estimate route tests
 *
 * Tests the dynamic-pricing estimate endpoint end-to-end:
 *   - Happy path: valid bytes → JSON with arweaveCost, markup, total, human-readable fields
 *   - Validation: missing/zero/negative bytes → 400
 *   - Validation: bytes > 500MB → 400
 *   - Upstream failure: Arweave/CoinGecko fetch throws → 500
 *
 * Uses fetch mock (like arweave.test.ts) so getArweaveCostUsdc works
 * through the real implementation without hitting the network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { ApiConfig } from '../config.js'

// ─── Global fetch mock ────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Mock other dependencies ──────────────────────────────────────────────────

vi.mock('../clients.js', () => ({
  buildPublicClient: vi.fn(() => ({ readContract: vi.fn(), waitForTransactionReceipt: vi.fn() })),
  buildWalletClient: vi.fn(() => ({
    client: { writeContract: vi.fn() },
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

// ─── App factory ──────────────────────────────────────────────────────────────

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
  treasuryAddress: null,
}

let app: Express.Application

// Import router once; arweave module is not mocked so fetch mock controls pricing
import { projectsRouter } from '../routes/projects.js'
beforeEach(() => {
  mockFetch.mockReset()
  const freshApp = express()
  freshApp.use(express.json())
  freshApp.use('/v1/projects', projectsRouter(baseCfg))
  app = freshApp
})

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** Set up fetch to return: arweave oracle → winstonStr, CoinGecko → arUsd  */
function mockPriceFetches(winstonStr: string, arUsd: number) {
  mockFetch
    .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(winstonStr), json: () => Promise.resolve({}) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: arUsd } }), text: () => Promise.resolve('') })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /v1/projects/estimate', () => {
  it('returns correct estimate shape for a 1MB upload', async () => {
    // 1 AR in Winston at $10/AR → cost = $10, with 10% buffer → $11, 20% markup → $13.20
    mockPriceFetches('1000000000000', 10)

    const res = await request(app).get('/v1/projects/estimate?bytes=1048576')

    expect(res.status).toBe(200)
    // All required fields present
    expect(res.body).toHaveProperty('bytes', 1_048_576)
    expect(res.body).toHaveProperty('arweaveCost')
    expect(res.body).toHaveProperty('markup')
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('markupPct', '20%')
    expect(res.body).toHaveProperty('arweaveCostUsd')
    expect(res.body).toHaveProperty('totalUsd')
  })

  it('markup = 20% of arweaveCost, total = arweaveCost + markup', async () => {
    mockPriceFetches('1000000000000', 10)  // 1 AR × $10 × 1.10 = $11 = 11_000_000 base units

    const res = await request(app).get('/v1/projects/estimate?bytes=1048576')

    expect(res.status).toBe(200)
    const { arweaveCost, markup, total } = res.body
    const cost = BigInt(arweaveCost)
    const m    = BigInt(markup)
    const t    = BigInt(total)
    expect(m).toBe(cost * 2000n / 10000n)
    expect(t).toBe(cost + m)
  })

  it('human-readable USD fields start with $', async () => {
    mockPriceFetches('500000000000', 20)  // 0.5 AR × $20 × 1.10

    const res = await request(app).get('/v1/projects/estimate?bytes=512000')

    expect(res.status).toBe(200)
    expect(res.body.arweaveCostUsd).toMatch(/^\$/)
    expect(res.body.totalUsd).toMatch(/^\$/)
  })

  it('returns numeric string for arweaveCost, markup, total (USDC bigint serialized)', async () => {
    mockPriceFetches('1000000000000', 5)

    const res = await request(app).get('/v1/projects/estimate?bytes=100000')

    expect(res.status).toBe(200)
    expect(res.body.arweaveCost).toMatch(/^\d+$/)
    expect(res.body.markup).toMatch(/^\d+$/)
    expect(res.body.total).toMatch(/^\d+$/)
  })

  it('reflects correct bytes value in response', async () => {
    mockPriceFetches('1000000000000', 5)

    const res = await request(app).get('/v1/projects/estimate?bytes=250000')

    expect(res.status).toBe(200)
    expect(res.body.bytes).toBe(250_000)
  })

  // ─── Validation ────────────────────────────────────────────────────────────

  it('returns 400 when bytes param is missing', async () => {
    const res = await request(app).get('/v1/projects/estimate')

    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 when bytes=0', async () => {
    const res = await request(app).get('/v1/projects/estimate?bytes=0')

    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 when bytes is negative', async () => {
    const res = await request(app).get('/v1/projects/estimate?bytes=-100')

    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 for non-numeric bytes', async () => {
    const res = await request(app).get('/v1/projects/estimate?bytes=foo')

    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 when bytes exceeds 500MB', async () => {
    const overLimit = 500 * 1024 * 1024 + 1
    const res = await request(app).get(`/v1/projects/estimate?bytes=${overLimit}`)

    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('accepts exactly 500MB as boundary', async () => {
    mockPriceFetches('1000000000000', 5)

    const boundary = 500 * 1024 * 1024
    const res = await request(app).get(`/v1/projects/estimate?bytes=${boundary}`)

    expect(res.status).toBe(200)
  })

  // ─── Upstream errors ───────────────────────────────────────────────────────

  it('returns 500 when Arweave price oracle fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 10 } }), text: () => Promise.resolve('') })

    const res = await request(app).get('/v1/projects/estimate?bytes=1048576')

    expect(res.status).toBe(500)
  })
})
