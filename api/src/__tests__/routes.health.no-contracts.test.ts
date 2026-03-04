/**
 * @inkd/api — routes/health.ts — contracts-not-deployed branch
 *
 * Tests the `contractsDeployed = false` path in GET /v1/status.
 * When ADDRESSES has empty token/registry the if(contractsDeployed) block
 * is skipped entirely: rpcReachable stays false, counts stay null.
 *
 * Runs in a separate file so we can use a different vi.mock for config.js
 * without affecting the main routes.health.test.ts mock.
 */
import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { ApiConfig } from '../config.js'

// ─── Mock clients (no RPC calls expected in this scenario) ───────────────────

const mockReadContract = vi.fn()

vi.mock('../clients.js', () => ({
  buildPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
  })),
  buildWalletClient: vi.fn(),
  normalizePrivateKey: (k: string) => (k.startsWith('0x') ? k : `0x${k}`),
}))

// ─── Mock config: no contracts deployed ──────────────────────────────────────

vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>()
  return {
    ...original,
    ADDRESSES: {
      mainnet: { token: '', registry: '', treasury: '' },
      testnet: { token: '', registry: '', treasury: '' },
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
  const { healthRouter } = await import('../routes/health.js')
  const app = express()
  app.use(express.json())
  app.use('/v1', healthRouter(baseCfg))
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /v1/status — contracts not deployed (empty ADDRESSES)', () => {
  it('returns 200 with rpcReachable: false when no contract addresses configured', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.rpcReachable).toBe(false)
  })

  it('returns null protocol counts when contracts not deployed', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.body.protocol.projectCount).toBeNull()
    expect(res.body.protocol.totalSupply).toBeNull()
  })

  it('returns contracts.deployed: false', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.body.contracts.deployed).toBe(false)
  })

  it('returns null contract addresses', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.body.contracts.token).toBeNull()
    expect(res.body.contracts.registry).toBeNull()
    expect(res.body.contracts.treasury).toBeNull()
  })

  it('does NOT call readContract when contracts are not deployed', async () => {
    mockReadContract.mockReset()
    const app = await makeApp()
    await request(app).get('/v1/status')
    // The if(contractsDeployed) block is skipped — no RPC calls
    expect(mockReadContract).not.toHaveBeenCalled()
  })

  it('still returns server uptime and version', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(typeof res.body.server.uptimeMs).toBe('number')
    expect(res.body.server.version).toBe('0.1.0')
  })

  it('still returns network and rpcUrl fields', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/status')
    expect(res.body.network).toBe('testnet')
    expect(res.body.rpcUrl).toBe('http://localhost:8545')
  })
})

describe('GET /v1/health — always 200 regardless of contract state', () => {
  it('returns ok: true even when no contracts deployed', async () => {
    const app = await makeApp()
    const res = await request(app).get('/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.service).toBe('@inkd/api')
  })
})
