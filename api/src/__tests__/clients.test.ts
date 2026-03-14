/**
 * @inkd/api — clients.ts unit tests
 *
 * Tests normalizePrivateKey() behavior and basic function existence.
 * The viem factory functions are tested indirectly via integration.
 */
import { describe, it, expect } from 'vitest'
import { normalizePrivateKey } from '../clients.js'

describe('normalizePrivateKey()', () => {
  it('adds 0x prefix if missing', () => {
    expect(normalizePrivateKey('abc123')).toBe('0xabc123')
  })

  it('keeps 0x prefix if already present', () => {
    expect(normalizePrivateKey('0xabc123')).toBe('0xabc123')
  })

  it('handles full 64-char hex without prefix', () => {
    const key = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    expect(normalizePrivateKey(key)).toBe(`0x${key}`)
  })

  it('handles full 64-char hex with prefix', () => {
    const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    expect(normalizePrivateKey(key)).toBe(key)
  })
})

describe('buildPublicClient()', () => {
  it('is exported from clients.ts', async () => {
    const { buildPublicClient } = await import('../clients.js')
    expect(typeof buildPublicClient).toBe('function')
  })
})

describe('buildWalletClient()', () => {
  it('is exported from clients.ts', async () => {
    const { buildWalletClient } = await import('../clients.js')
    expect(typeof buildWalletClient).toBe('function')
  })
})
