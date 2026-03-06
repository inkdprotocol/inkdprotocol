/**
 * @inkd/api — middleware/x402.ts unit tests
 *
 * Tests buildX402Middleware(), getPayerAddress(), and NETWORK_BASE_* constants.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request } from 'express'
import type { Address } from 'viem'

// ── Mocks (self-contained factories — hoisted to top of file) ─────────────────

vi.mock('@x402/express', () => {
  const paymentMiddleware = vi.fn((_routes: unknown, _server: unknown) => {
    return (_req: unknown, _res: unknown, next: () => void) => next()
  })
  const x402ResourceServer = vi.fn(function (this: object) {
    (this as { register: () => typeof this }).register = vi.fn().mockReturnThis()
  })
  return { paymentMiddleware, x402ResourceServer }
})

vi.mock('@x402/evm/exact/server', () => ({
  ExactEvmScheme: vi.fn(function () {}),
}))

// LocalFacilitatorClient is used instead of HTTPFacilitatorClient
vi.mock('../middleware/localFacilitator.js', () => {
  const LocalFacilitatorClient = vi.fn(function (this: object) {})
  return { LocalFacilitatorClient }
})

import {
  getPayerAddress,
  buildX402Middleware,
  NETWORK_BASE_MAINNET,
  NETWORK_BASE_SEPOLIA,
} from '../middleware/x402.js'
import { paymentMiddleware as _paymentMiddleware } from '@x402/express'
import { LocalFacilitatorClient } from '../middleware/localFacilitator.js'

const paymentMiddleware = _paymentMiddleware as ReturnType<typeof vi.fn>
const MockLocalFacilitatorClient = LocalFacilitatorClient as ReturnType<typeof vi.fn>

// ─── buildX402Middleware() ────────────────────────────────────────────────────

describe('buildX402Middleware()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paymentMiddleware.mockImplementation((_routes: unknown, _server: unknown) =>
      (_req: unknown, _res: unknown, next: () => void) => next()
    )
  })

  const baseConfig = {
    treasuryAddress: '0xABCDEF1234567890ABCDef1234567890AbCdEf01' as Address,
    facilitatorUrl:  'https://x402.org/facilitator',
    network:         'testnet' as const,
  }

  it('returns a middleware function', () => {
    const mw = buildX402Middleware(baseConfig)
    expect(typeof mw).toBe('function')
  })

  it('instantiates LocalFacilitatorClient (no external HTTP dependency)', () => {
    buildX402Middleware(baseConfig)
    expect(MockLocalFacilitatorClient).toHaveBeenCalledTimes(1)
  })

  it('calls paymentMiddleware with routes containing both endpoints', () => {
    buildX402Middleware(baseConfig)
    expect(paymentMiddleware).toHaveBeenCalledTimes(1)
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, unknown>]
    expect(routes).toHaveProperty('POST /projects')
    // x402 uses [id] wildcard syntax, not Express :id
    expect(routes).toHaveProperty('POST /projects/[id]/versions')
  })

  it('uses NETWORK_BASE_SEPOLIA for testnet', () => {
    buildX402Middleware({ ...baseConfig, network: 'testnet' })
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { network: string } }>]
    expect(routes['POST /projects']!.accepts.network).toBe(NETWORK_BASE_SEPOLIA)
  })

  it('uses NETWORK_BASE_MAINNET for mainnet', () => {
    buildX402Middleware({ ...baseConfig, network: 'mainnet' })
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { network: string } }>]
    expect(routes['POST /projects']!.accepts.network).toBe(NETWORK_BASE_MAINNET)
  })

  it('sets treasuryAddress (payTo) in both route configs', () => {
    buildX402Middleware(baseConfig)
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { payTo: string } }>]
    expect(routes['POST /projects']!.accepts.payTo).toBe(baseConfig.treasuryAddress)
    expect(routes['POST /projects/[id]/versions']!.accepts.payTo).toBe(baseConfig.treasuryAddress)
  })

  it('sets a price in both route configs', () => {
    buildX402Middleware(baseConfig)
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { price: string } }>]
    expect(routes['POST /projects']!.accepts.price).toMatch(/^\$[\d.]+$/)
    expect(routes['POST /projects/[id]/versions']!.accepts.price).toMatch(/^\$[\d.]+$/)
  })
})

// ─── NETWORK constants ────────────────────────────────────────────────────────

describe('NETWORK constants', () => {
  it('NETWORK_BASE_MAINNET is correct CAIP-2', () => {
    expect(NETWORK_BASE_MAINNET).toBe('eip155:8453')
  })
  it('NETWORK_BASE_SEPOLIA is correct CAIP-2', () => {
    expect(NETWORK_BASE_SEPOLIA).toBe('eip155:84532')
  })
})

// ─── getPayerAddress() ────────────────────────────────────────────────────────

describe('getPayerAddress()', () => {
  it('returns undefined when no payment header is present', () => {
    const req = {} as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })

  it('returns undefined when x402 is present but no payment header', () => {
    const req = { x402: {} } as unknown as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })

  it('returns undefined for a request with no headers', () => {
    const req = { headers: {} } as unknown as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })
})
