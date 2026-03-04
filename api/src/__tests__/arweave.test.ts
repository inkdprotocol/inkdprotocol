/**
 * @inkd/api — arweave.ts tests
 *
 * Covers:
 *   calculateCharge(cost, bps)  — pure markup math (default 20%, custom bps)
 *   formatUsdc(amount)           — pretty-print USDC base units
 *   getArweaveCostUsdc(bytes)   — combined fetch (Winston × AR/USD × 1.10 buffer)
 *   AR/USD cache behaviour       — 5-minute TTL, no double-fetch within TTL
 *
 * Strategy for module-level cache: vi.resetModules() + dynamic import per group,
 * fake timers for cache expiry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Global fetch mock (set before any dynamic imports) ───────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Pure functions (no network — import once) ────────────────────────────────

import { calculateCharge, formatUsdc } from '../arweave.js'

// ─── calculateCharge ──────────────────────────────────────────────────────────

describe('calculateCharge', () => {
  it('applies default 20% markup', () => {
    const cost = 1_000_000n  // $1.00 USDC
    const { arweaveCost, markup, total } = calculateCharge(cost)
    expect(arweaveCost).toBe(1_000_000n)
    expect(markup).toBe(200_000n)
    expect(total).toBe(1_200_000n)
  })

  it('applies custom 50% markup (5000 bps)', () => {
    const cost = 2_000_000n
    const { markup, total } = calculateCharge(cost, 5000)
    expect(markup).toBe(1_000_000n)
    expect(total).toBe(3_000_000n)
  })

  it('applies 10% markup (1000 bps)', () => {
    const { markup, total } = calculateCharge(1_000_000n, 1000)
    expect(markup).toBe(100_000n)
    expect(total).toBe(1_100_000n)
  })

  it('handles zero markup (0 bps)', () => {
    const { markup, total } = calculateCharge(500_000n, 0)
    expect(markup).toBe(0n)
    expect(total).toBe(500_000n)
  })

  it('truncates sub-unit markup to zero for 1 base unit', () => {
    // 1 × 20% = 0.2 → BigInt division truncates to 0
    const { markup, total } = calculateCharge(1n)
    expect(markup).toBe(0n)
    expect(total).toBe(1n)
  })

  it('handles large realistic cost ($5.00 = 5_000_000 base units)', () => {
    const { markup, total } = calculateCharge(5_000_000n)
    expect(markup).toBe(1_000_000n)
    expect(total).toBe(6_000_000n)
  })

  it('returns arweaveCost equal to input', () => {
    const cost = 999_999n
    const { arweaveCost } = calculateCharge(cost, 3000)
    expect(arweaveCost).toBe(cost)
  })
})

// ─── formatUsdc ───────────────────────────────────────────────────────────────

describe('formatUsdc', () => {
  it('formats $1.00 (1_000_000 base units)', () => {
    expect(formatUsdc(1_000_000n)).toBe('$1.00')
  })

  it('formats $0.00 for zero', () => {
    expect(formatUsdc(0n)).toBe('$0.00')
  })

  it('formats $1.50', () => {
    expect(formatUsdc(1_500_000n)).toBe('$1.50')
  })

  it('formats $5.00', () => {
    expect(formatUsdc(5_000_000n)).toBe('$5.00')
  })

  it('rounds tiny fractions to $0.00', () => {
    expect(formatUsdc(100n)).toBe('$0.00')
  })

  it('formats $0.01 (10_000 base units)', () => {
    expect(formatUsdc(10_000n)).toBe('$0.01')
  })

  it('formats large amounts ($1000.00)', () => {
    expect(formatUsdc(1_000_000_000n)).toBe('$1000.00')
  })

  it('formats $0.50', () => {
    expect(formatUsdc(500_000n)).toBe('$0.50')
  })
})

// ─── getArweaveCostUsdc ───────────────────────────────────────────────────────
// Each test group resets modules to clear the in-memory price cache.

describe('getArweaveCostUsdc — happy paths', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it('returns correct USDC cost for 1 AR = $50, 10% buffer', async () => {
    // Arweave oracle: 1 AR worth of Winston = 1e12
    // CoinGecko: $50/AR
    // Expected: 1 × 50 × 1.10 × 1e6 = 55_000_000
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 50 } }), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    // 1 AR × $50 × 1.10 × 1e6 = 55_000_000; floating-point may add 1 due to ceil
    const result = await getArweaveCostUsdc(1_000_000)
    expect(result).toBeGreaterThanOrEqual(55_000_000n)
    expect(result).toBeLessThanOrEqual(55_000_002n)
  })

  it('calls both Arweave and CoinGecko APIs (2 fetches)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('500000000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 20 } }), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    await getArweaveCostUsdc(512_000)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('uses ceil (never returns 0n for positive cost)', async () => {
    // Tiny: 1 Winston at $0.001/AR → near-zero USD → ceil to 1n
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 0.001 } }), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    const result = await getArweaveCostUsdc(1)
    expect(result).toBeGreaterThanOrEqual(1n)
  })

  it('result is bigint', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 10 } }), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    const result = await getArweaveCostUsdc(1_000)
    expect(typeof result).toBe('bigint')
  })
})

describe('getArweaveCostUsdc — error paths', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it('throws CoinGecko error on non-OK response', async () => {
    // Arweave OK, CoinGecko 429
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({}), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    await expect(getArweaveCostUsdc(1_000_000)).rejects.toThrow('CoinGecko error: 429')
  })

  it('throws Arweave price error on non-OK response', async () => {
    // Arweave 503, CoinGecko OK
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 10 } }), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    await expect(getArweaveCostUsdc(1_000_000)).rejects.toThrow('Arweave price error: 503')
  })

  it('throws on CoinGecko 500', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    await expect(getArweaveCostUsdc(1_000_000)).rejects.toThrow('CoinGecko error: 500')
  })
})

// ─── AR/USD cache behaviour ───────────────────────────────────────────────────

describe('AR/USD price cache', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('caches AR/USD price — only 1 CoinGecko call for 2 getArweaveCostUsdc calls', async () => {
    // Call 1: Arweave (mock 0) + CoinGecko (mock 1)
    // Call 2: Arweave (mock 2) only — CoinGecko still in cache
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 25 } }), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('2000000000000'), json: () => Promise.resolve({}) })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    const r1 = await getArweaveCostUsdc(1_000_000)
    const r2 = await getArweaveCostUsdc(2_000_000)

    expect(mockFetch).toHaveBeenCalledTimes(3)   // 2 + 1 (CoinGecko cached)
    expect(r2).toBeGreaterThan(r1)               // 2× Winston → 2× cost
  })

  it('re-fetches AR/USD price after 5-minute TTL expires', async () => {
    // Call 1: both fetches
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 25 } }), text: () => Promise.resolve('') })
      // Advance time past 5 min TTL
      // Call 2: both fetches again (CoinGecko cache expired)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 30 } }), text: () => Promise.resolve('') })

    const { getArweaveCostUsdc } = await import('../arweave.js')
    await getArweaveCostUsdc(1_000_000)

    // Advance clock by 6 minutes (past 5-min TTL)
    vi.advanceTimersByTime(6 * 60 * 1000)

    await getArweaveCostUsdc(1_000_000)
    expect(mockFetch).toHaveBeenCalledTimes(4)   // 2 + 2 (cache expired)
  })
})
