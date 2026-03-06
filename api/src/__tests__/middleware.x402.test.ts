/**
 * @inkd/api — middleware/x402.ts unit tests
 * Tests buildX402Middleware(), getPayerAddress(), and NETWORK_BASE_* constants.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request } from 'express'
import type { Address } from 'viem'

const mockRegister   = vi.fn().mockReturnThis()
const mockPaymentMw  = vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next())

vi.mock('@x402/express', () => ({
  paymentMiddleware: mockPaymentMw,
  x402ResourceServer: vi.fn(function (this: Record<string, unknown>) {
    this.register = mockRegister
  }),
}))

vi.mock('../middleware/localFacilitator.js', () => ({
  LocalFacilitatorClient: vi.fn(function (this: Record<string, unknown>) {}),
}))

import {
  getPayerAddress,
  buildX402Middleware,
  NETWORK_BASE_MAINNET,
  NETWORK_BASE_SEPOLIA,
} from '../middleware/x402.js'

// ─── buildX402Middleware() ────────────────────────────────────────────────────

describe('buildX402Middleware()', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const baseConfig = {
    treasuryAddress: '0xABCDEF1234567890ABCDef1234567890AbCdEf01' as Address,
    facilitatorUrl:  'https://x402.org/facilitator',
    network:         'testnet' as const,
    usdcAddress:     '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
  }

  it('returns a middleware function', () => {
    const mw = buildX402Middleware(baseConfig)
    expect(typeof mw).toBe('function')
  })

  it('calls paymentMiddleware once', () => {
    buildX402Middleware(baseConfig)
    expect(mockPaymentMw).toHaveBeenCalledTimes(1)
  })

  it('passes routes for POST /v1/projects and POST /v1/projects/:id/versions', () => {
    buildX402Middleware(baseConfig)
    const [routes] = mockPaymentMw.mock.calls[0] as [Record<string, unknown>]
    expect(routes).toHaveProperty('POST /v1/projects')
    expect(routes).toHaveProperty('POST /v1/projects/:id/versions')
  })

  it('registers correct network for testnet', () => {
    buildX402Middleware({ ...baseConfig, network: 'testnet' })
    expect(mockRegister).toHaveBeenCalledWith(NETWORK_BASE_SEPOLIA, expect.anything())
  })

  it('registers correct network for mainnet', () => {
    buildX402Middleware({ ...baseConfig, network: 'mainnet' })
    expect(mockRegister).toHaveBeenCalledWith(NETWORK_BASE_MAINNET, expect.anything())
  })

  it('sets payTo to treasuryAddress in route configs', () => {
    buildX402Middleware(baseConfig)
    const [routes] = mockPaymentMw.mock.calls[0] as [Record<string, { accepts: { payTo: string } }>]
    expect(routes['POST /v1/projects']!.accepts.payTo).toBe(baseConfig.treasuryAddress)
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
  it('returns payer address when x402 payment exists', () => {
    const req = {
      x402Payment: {
        payload: { authorization: { from: '0xABCDEF1234567890ABCDef1234567890AbCdEf01' } }
      }
    } as unknown as Request
    const addr = getPayerAddress(req)
    expect(addr).toBe('0xABCDEF1234567890ABCDef1234567890AbCdEf01')
  })

  it('returns undefined when no x402Payment header', () => {
    const req = {} as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })

  it('returns undefined when payment is malformed', () => {
    const req = { x402Payment: {} } as unknown as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })
})
