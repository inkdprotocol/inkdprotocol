/**
 * @inkd/api — config.ts unit tests
 *
 * Covers loadConfig() all branches, getChain(), and ADDRESSES shape.
 * loadConfig() reads process.env at call time, so we can mutate env freely.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { base, baseSepolia } from 'viem/chains'
import { loadConfig, getChain, ADDRESSES } from '../config.js'

// Keys mutated by these tests
const WATCHED_KEYS = [
  'INKD_NETWORK',
  'PORT',
  'INKD_RPC_URL',
  'INKD_API_KEY',
  'CORS_ORIGIN',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
  'SERVER_WALLET_KEY',
  'SERVER_WALLET_ADDRESS',
  'X402_FACILITATOR_URL',
  'X402_ENABLED',
] as const

// Snapshot before any test runs
const ORIGINAL_ENV: Partial<Record<string, string>> = {}
for (const k of WATCHED_KEYS) {
  ORIGINAL_ENV[k] = process.env[k]
}

afterEach(() => {
  for (const k of WATCHED_KEYS) {
    if (ORIGINAL_ENV[k] === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = ORIGINAL_ENV[k]
    }
  }
})

// ─── loadConfig() — network ───────────────────────────────────────────────────

describe('loadConfig() — network', () => {
  it('defaults to testnet when INKD_NETWORK is not set', () => {
    delete process.env['INKD_NETWORK']
    expect(loadConfig().network).toBe('testnet')
  })

  it('accepts "mainnet"', () => {
    process.env['INKD_NETWORK'] = 'mainnet'
    expect(loadConfig().network).toBe('mainnet')
  })

  it('accepts "testnet"', () => {
    process.env['INKD_NETWORK'] = 'testnet'
    expect(loadConfig().network).toBe('testnet')
  })

  it('throws on invalid network value', () => {
    process.env['INKD_NETWORK'] = 'polygon'
    expect(() => loadConfig()).toThrow('Invalid INKD_NETWORK')
    expect(() => loadConfig()).toThrow('"polygon"')
  })
})

// ─── loadConfig() — port ──────────────────────────────────────────────────────

describe('loadConfig() — port', () => {
  it('defaults port to 3000', () => {
    delete process.env['PORT']
    expect(loadConfig().port).toBe(3000)
  })

  it('reads PORT from env', () => {
    process.env['PORT'] = '8080'
    expect(loadConfig().port).toBe(8080)
  })
})

// ─── loadConfig() — rpcUrl ───────────────────────────────────────────────────

describe('loadConfig() — rpcUrl', () => {
  it('defaults to sepolia endpoint for testnet', () => {
    delete process.env['INKD_NETWORK']
    delete process.env['INKD_RPC_URL']
    expect(loadConfig().rpcUrl).toBe('https://sepolia.base.org')
  })

  it('defaults to mainnet endpoint when network=mainnet', () => {
    process.env['INKD_NETWORK'] = 'mainnet'
    delete process.env['INKD_RPC_URL']
    expect(loadConfig().rpcUrl).toBe('https://mainnet.base.org')
  })

  it('uses custom INKD_RPC_URL when set', () => {
    process.env['INKD_RPC_URL'] = 'https://custom.rpc.example.com'
    expect(loadConfig().rpcUrl).toBe('https://custom.rpc.example.com')
  })
})

// ─── loadConfig() — apiKey ───────────────────────────────────────────────────

describe('loadConfig() — apiKey', () => {
  it('defaults apiKey to null (dev/open mode)', () => {
    delete process.env['INKD_API_KEY']
    expect(loadConfig().apiKey).toBeNull()
  })

  it('reads INKD_API_KEY from env', () => {
    process.env['INKD_API_KEY'] = 'sk-test-abc123'
    expect(loadConfig().apiKey).toBe('sk-test-abc123')
  })
})

// ─── loadConfig() — CORS ─────────────────────────────────────────────────────

describe('loadConfig() — CORS', () => {
  it('defaults corsOrigin to *', () => {
    delete process.env['CORS_ORIGIN']
    expect(loadConfig().corsOrigin).toBe('*')
  })

  it('reads CORS_ORIGIN from env', () => {
    process.env['CORS_ORIGIN'] = 'https://inkdprotocol.xyz'
    expect(loadConfig().corsOrigin).toBe('https://inkdprotocol.xyz')
  })
})

// ─── loadConfig() — rate limiting ────────────────────────────────────────────

describe('loadConfig() — rate limiting', () => {
  it('defaults rateLimitWindowMs to 60000', () => {
    delete process.env['RATE_LIMIT_WINDOW_MS']
    expect(loadConfig().rateLimitWindowMs).toBe(60_000)
  })

  it('reads RATE_LIMIT_WINDOW_MS from env', () => {
    process.env['RATE_LIMIT_WINDOW_MS'] = '30000'
    expect(loadConfig().rateLimitWindowMs).toBe(30_000)
  })

  it('defaults rateLimitMax to 60', () => {
    delete process.env['RATE_LIMIT_MAX']
    expect(loadConfig().rateLimitMax).toBe(60)
  })

  it('reads RATE_LIMIT_MAX from env', () => {
    process.env['RATE_LIMIT_MAX'] = '120'
    expect(loadConfig().rateLimitMax).toBe(120)
  })
})

// ─── loadConfig() — x402 / server wallet ─────────────────────────────────────

describe('loadConfig() — x402 / server wallet', () => {
  it('serverWalletKey defaults to null', () => {
    delete process.env['SERVER_WALLET_KEY']
    expect(loadConfig().serverWalletKey).toBeNull()
  })

  it('reads SERVER_WALLET_KEY', () => {
    process.env['SERVER_WALLET_KEY'] = '0xdeadbeefdeadbeef'
    expect(loadConfig().serverWalletKey).toBe('0xdeadbeefdeadbeef')
  })

  it('serverWalletAddress defaults to null', () => {
    delete process.env['INKD_TREASURY_ADDRESS']
    expect(loadConfig().serverWalletAddress).toBeNull()
  })

  it('reads SERVER_WALLET_ADDRESS', () => {
    process.env['INKD_TREASURY_ADDRESS'] = '0xABCDEF1234567890ABCDef1234567890AbCdEf01'
    expect(loadConfig().treasuryAddress).toBe('0xABCDEF1234567890ABCDef1234567890AbCdEf01')
  })

  it('x402Enabled is false when treasuryAddress not set', () => {
    delete process.env['INKD_TREASURY_ADDRESS']
    expect(loadConfig().x402Enabled).toBe(false)
  })

  it('x402Enabled is true when treasuryAddress is set', () => {
    process.env['INKD_TREASURY_ADDRESS'] = '0xABCDEF1234567890ABCDef1234567890AbCdEf01'
    delete process.env['X402_ENABLED']
    expect(loadConfig().x402Enabled).toBe(true)
  })

  it('x402Enabled is false when X402_ENABLED=false even with wallet address', () => {
    process.env['INKD_TREASURY_ADDRESS'] = '0xABCDEF1234567890ABCDef1234567890AbCdEf01'
    process.env['X402_ENABLED'] = 'false'
    expect(loadConfig().x402Enabled).toBe(false)
  })

  it('defaults x402FacilitatorUrl to Coinbase endpoint', () => {
    delete process.env['X402_FACILITATOR_URL']
    expect(loadConfig().x402FacilitatorUrl).toBe('https://x402.org/facilitator')
  })

  it('reads X402_FACILITATOR_URL from env', () => {
    process.env['X402_FACILITATOR_URL'] = 'https://my.facilitator.io'
    expect(loadConfig().x402FacilitatorUrl).toBe('https://my.facilitator.io')
  })
})

// ─── getChain() ───────────────────────────────────────────────────────────────

describe('getChain()', () => {
  it('returns base (mainnet chain) for "mainnet"', () => {
    expect(getChain('mainnet')).toEqual(base)
  })

  it('returns baseSepolia for "testnet"', () => {
    expect(getChain('testnet')).toEqual(baseSepolia)
  })
})

// ─── ADDRESSES constant ───────────────────────────────────────────────────────

describe('ADDRESSES', () => {
  it('has mainnet and testnet keys', () => {
    expect(ADDRESSES).toHaveProperty('mainnet')
    expect(ADDRESSES).toHaveProperty('testnet')
  })

  it('mainnet entry has token/registry/treasury fields', () => {
    expect(ADDRESSES.mainnet).toMatchObject({
      token:    expect.any(String),
      registry: expect.any(String),
      treasury: expect.any(String),
    })
  })

  it('testnet entry has token/registry/treasury fields', () => {
    expect(ADDRESSES.testnet).toMatchObject({
      token:    expect.any(String),
      registry: expect.any(String),
      treasury: expect.any(String),
    })
  })
})
