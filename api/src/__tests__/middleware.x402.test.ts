/**
 * @inkd/api — middleware/x402.ts unit tests
 *
 * Tests getPayerAddress() and NETWORK_BASE_* constants.
 * buildX402Middleware() is an integration-level concern (wraps @x402/express)
 * so we test the exported helper and constants instead.
 */
import { describe, it, expect } from 'vitest'
import {
  getPayerAddress,
  NETWORK_BASE_MAINNET,
  NETWORK_BASE_SEPOLIA,
} from '../middleware/x402.js'
import type { Request } from 'express'

describe('NETWORK constants', () => {
  it('NETWORK_BASE_MAINNET is correct CAIP-2', () => {
    expect(NETWORK_BASE_MAINNET).toBe('eip155:8453')
  })
  it('NETWORK_BASE_SEPOLIA is correct CAIP-2', () => {
    expect(NETWORK_BASE_SEPOLIA).toBe('eip155:84532')
  })
})

describe('getPayerAddress()', () => {
  it('returns payer address when x402 payment exists', () => {
    const req = {
      x402: {
        payment: {
          payload: {
            authorization: {
              from: '0xABCDEF1234567890ABCDef1234567890AbCdEf01',
            },
          },
        },
      },
    } as unknown as Request

    expect(getPayerAddress(req)).toBe('0xABCDEF1234567890ABCDef1234567890AbCdEf01')
  })

  it('returns undefined when no x402 payment', () => {
    const req = {} as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })

  it('returns undefined when x402 is present but payment is missing', () => {
    const req = { x402: {} } as unknown as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })

  it('returns undefined when authorization.from is missing', () => {
    const req = {
      x402: { payment: { payload: { authorization: {} } } },
    } as unknown as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })
})
