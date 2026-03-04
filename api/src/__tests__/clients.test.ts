/**
 * @inkd/api — clients.ts unit tests
 *
 * Covers buildPublicClient(), buildWalletClient(), and normalizePrivateKey()
 * without touching the network — viem client factories are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { base, baseSepolia } from 'viem/chains'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPublicClient  = { type: 'publicClient',  readContract: vi.fn() }
const mockWalletClient  = { type: 'walletClient',  writeContract: vi.fn() }
const mockAccount       = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`,
  type: 'local',
}

vi.mock('viem', () => ({
  createPublicClient:  vi.fn(() => mockPublicClient),
  createWalletClient:  vi.fn(() => mockWalletClient),
  http:                vi.fn((url?: string) => ({ type: 'http', url })),
}))

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => mockAccount),
}))

// import AFTER mocks are hoisted
import { buildPublicClient, buildWalletClient, normalizePrivateKey } from '../clients.js'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { ApiConfig } from '../config.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function testnetConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    network:   'testnet',
    port:      3000,
    rpcUrl:    undefined,
    apiKey:    null,
    corsOrigin: '*',
    rateLimitWindowMs: 60_000,
    rateLimitMax: 100,
    serverWalletKey: undefined,
    serverWalletAddress: undefined,
    x402FacilitatorUrl: undefined,
    x402Enabled: false,
    contractsDeployed: false,
    ...overrides,
  }
}

function mainnetConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return testnetConfig({ network: 'mainnet', ...overrides })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── buildPublicClient() ──────────────────────────────────────────────────────

describe('buildPublicClient()', () => {
  it('calls createPublicClient with testnet chain (baseSepolia)', () => {
    buildPublicClient(testnetConfig())

    expect(createPublicClient).toHaveBeenCalledOnce()
    expect(createPublicClient).toHaveBeenCalledWith(
      expect.objectContaining({ chain: baseSepolia })
    )
  })

  it('calls createPublicClient with mainnet chain (base)', () => {
    buildPublicClient(mainnetConfig())

    expect(createPublicClient).toHaveBeenCalledOnce()
    expect(createPublicClient).toHaveBeenCalledWith(
      expect.objectContaining({ chain: base })
    )
  })

  it('passes rpcUrl to http() transport when provided', () => {
    const rpcUrl = 'https://my-rpc.example.com'
    buildPublicClient(testnetConfig({ rpcUrl }))

    expect(http).toHaveBeenCalledWith(rpcUrl)
    expect(createPublicClient).toHaveBeenCalledWith(
      expect.objectContaining({ transport: expect.objectContaining({ url: rpcUrl }) })
    )
  })

  it('passes undefined to http() when rpcUrl is not set', () => {
    buildPublicClient(testnetConfig({ rpcUrl: undefined }))

    expect(http).toHaveBeenCalledWith(undefined)
  })

  it('returns the mocked public client', () => {
    const client = buildPublicClient(testnetConfig())
    expect(client).toBe(mockPublicClient)
  })
})

// ─── buildWalletClient() ──────────────────────────────────────────────────────

describe('buildWalletClient()', () => {
  const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`

  it('calls privateKeyToAccount with the supplied private key', () => {
    buildWalletClient(testnetConfig(), PRIVATE_KEY)
    expect(privateKeyToAccount).toHaveBeenCalledWith(PRIVATE_KEY)
  })

  it('calls createWalletClient with testnet chain', () => {
    buildWalletClient(testnetConfig(), PRIVATE_KEY)
    expect(createWalletClient).toHaveBeenCalledWith(
      expect.objectContaining({ chain: baseSepolia })
    )
  })

  it('calls createWalletClient with mainnet chain', () => {
    buildWalletClient(mainnetConfig(), PRIVATE_KEY)
    expect(createWalletClient).toHaveBeenCalledWith(
      expect.objectContaining({ chain: base })
    )
  })

  it('passes the derived account to createWalletClient', () => {
    buildWalletClient(testnetConfig(), PRIVATE_KEY)
    expect(createWalletClient).toHaveBeenCalledWith(
      expect.objectContaining({ account: mockAccount })
    )
  })

  it('passes rpcUrl to http() transport when provided', () => {
    const rpcUrl = 'https://base-mainnet.example.com'
    buildWalletClient(mainnetConfig({ rpcUrl }), PRIVATE_KEY)
    expect(http).toHaveBeenCalledWith(rpcUrl)
  })

  it('returns { client, account, address } shape', () => {
    const result = buildWalletClient(testnetConfig(), PRIVATE_KEY)

    expect(result).toMatchObject({
      client:  mockWalletClient,
      account: mockAccount,
      address: mockAccount.address,
    })
  })

  it('returns correct address from derived account', () => {
    const result = buildWalletClient(testnetConfig(), PRIVATE_KEY)
    expect(result.address).toBe(mockAccount.address)
  })
})

// ─── normalizePrivateKey() ────────────────────────────────────────────────────

describe('normalizePrivateKey()', () => {
  it('returns key unchanged when it already has 0x prefix', () => {
    const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    expect(normalizePrivateKey(key)).toBe(key)
  })

  it('prepends 0x when key is missing the prefix', () => {
    const raw    = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const result = normalizePrivateKey(raw)
    expect(result).toBe(`0x${raw}`)
  })

  it('does not double-prefix a key that already starts with 0x', () => {
    const key = '0xdeadbeef'
    expect(normalizePrivateKey(key)).not.toMatch(/^0x0x/)
  })

  it('returns a string starting with 0x in all cases', () => {
    expect(normalizePrivateKey('abc')).toMatch(/^0x/)
    expect(normalizePrivateKey('0xabc')).toMatch(/^0x/)
  })

  it('handles empty string input by prepending 0x', () => {
    expect(normalizePrivateKey('')).toBe('0x')
  })

  it('casts return type as `0x${string}`', () => {
    const result = normalizePrivateKey('test')
    // TypeScript-level: result should be assignable to `0x${string}`
    const typed: `0x${string}` = result
    expect(typed).toBe('0xtest')
  })
})
