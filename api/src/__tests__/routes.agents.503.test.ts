/**
 * @inkd/api — routes/agents.ts — requireRegistry() 503 branch
 *
 * Tests the `ServiceUnavailableError` path thrown by `requireRegistry()`
 * when ADDRESSES[network].registry is empty/unset.
 *
 * Runs in a separate file so it can use its own vi.mock for config.js
 * (empty registry address) without interfering with routes.agents.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { ApiConfig } from '../config.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../clients.js', () => ({
  buildPublicClient: vi.fn(() => ({
    readContract: vi.fn(),
  })),
  buildWalletClient: vi.fn(),
  normalizePrivateKey: (k: string) => (k.startsWith('0x') ? k : `0x${k}`),
}))

// Empty registry address → requireRegistry() throws ServiceUnavailableError
vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>()
  return {
    ...original,
    ADDRESSES: {
      mainnet: { token: '0xTOKEN', registry: '',        treasury: '0xTREASURY' },
      testnet: { token: '0xTOKEN', registry: '',        treasury: '0xTREASURY' },
    },
  }
})

// ─── Fixture ──────────────────────────────────────────────────────────────────

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

async function makeApp() {
  const { agentsRouter } = await import('../routes/agents.js')
  const app = express()
  app.use(express.json())
  app.use('/v1/agents', agentsRouter(baseCfg))
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /v1/agents — requireRegistry() ServiceUnavailable (503)', () => {
  it('returns 503 when registry address is not configured', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/agents')
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE')
    expect(res.body.error.message).toContain('Registry contract not deployed')
  })
})

describe('GET /v1/agents/by-name/:name — requireRegistry() ServiceUnavailable (503)', () => {
  it('returns 503 when registry address is not configured', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/by-name/my-agent')
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE')
  })
})

describe('GET /v1/agents/:id — requireRegistry() ServiceUnavailable (503)', () => {
  it('returns 503 when registry address is not configured', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/agents/1')
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE')
  })
})
