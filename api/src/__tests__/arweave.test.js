"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
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
const vitest_1 = require("vitest");
// ─── Global fetch mock (set before any dynamic imports) ───────────────────────
const mockFetch = vitest_1.vi.fn();
vitest_1.vi.stubGlobal('fetch', mockFetch);
// ─── Pure functions (no network — import once) ────────────────────────────────
const arweave_js_1 = require("../arweave.js");
// ─── calculateCharge ──────────────────────────────────────────────────────────
(0, vitest_1.describe)('calculateCharge', () => {
    (0, vitest_1.it)('applies default 20% markup', () => {
        const cost = 1000000n; // $1.00 USDC
        const { arweaveCost, markup, total } = (0, arweave_js_1.calculateCharge)(cost);
        (0, vitest_1.expect)(arweaveCost).toBe(1000000n);
        (0, vitest_1.expect)(markup).toBe(200000n);
        (0, vitest_1.expect)(total).toBe(1200000n);
    });
    (0, vitest_1.it)('applies custom 50% markup (5000 bps)', () => {
        const cost = 2000000n;
        const { markup, total } = (0, arweave_js_1.calculateCharge)(cost, 5000);
        (0, vitest_1.expect)(markup).toBe(1000000n);
        (0, vitest_1.expect)(total).toBe(3000000n);
    });
    (0, vitest_1.it)('applies 10% markup (1000 bps)', () => {
        const { markup, total } = (0, arweave_js_1.calculateCharge)(1000000n, 1000);
        (0, vitest_1.expect)(markup).toBe(100000n);
        (0, vitest_1.expect)(total).toBe(1100000n);
    });
    (0, vitest_1.it)('handles zero markup (0 bps)', () => {
        const { markup, total } = (0, arweave_js_1.calculateCharge)(500000n, 0);
        (0, vitest_1.expect)(markup).toBe(0n);
        (0, vitest_1.expect)(total).toBe(500000n);
    });
    (0, vitest_1.it)('truncates sub-unit markup to zero for 1 base unit', () => {
        // 1 × 20% = 0.2 → BigInt division truncates to 0
        const { markup, total } = (0, arweave_js_1.calculateCharge)(1n);
        (0, vitest_1.expect)(markup).toBe(0n);
        (0, vitest_1.expect)(total).toBe(1n);
    });
    (0, vitest_1.it)('handles large realistic cost ($5.00 = 5_000_000 base units)', () => {
        const { markup, total } = (0, arweave_js_1.calculateCharge)(5000000n);
        (0, vitest_1.expect)(markup).toBe(1000000n);
        (0, vitest_1.expect)(total).toBe(6000000n);
    });
    (0, vitest_1.it)('returns arweaveCost equal to input', () => {
        const cost = 999999n;
        const { arweaveCost } = (0, arweave_js_1.calculateCharge)(cost, 3000);
        (0, vitest_1.expect)(arweaveCost).toBe(cost);
    });
});
// ─── formatUsdc ───────────────────────────────────────────────────────────────
(0, vitest_1.describe)('formatUsdc', () => {
    (0, vitest_1.it)('formats $1.00 (1_000_000 base units)', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(1000000n)).toBe('$1.00');
    });
    (0, vitest_1.it)('formats $0.00 for zero', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(0n)).toBe('$0.00');
    });
    (0, vitest_1.it)('formats $1.50', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(1500000n)).toBe('$1.50');
    });
    (0, vitest_1.it)('formats $5.00', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(5000000n)).toBe('$5.00');
    });
    (0, vitest_1.it)('rounds tiny fractions to $0.00', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(100n)).toBe('$0.00');
    });
    (0, vitest_1.it)('formats $0.01 (10_000 base units)', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(10000n)).toBe('$0.01');
    });
    (0, vitest_1.it)('formats large amounts ($1000.00)', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(1000000000n)).toBe('$1000.00');
    });
    (0, vitest_1.it)('formats $0.50', () => {
        (0, vitest_1.expect)((0, arweave_js_1.formatUsdc)(500000n)).toBe('$0.50');
    });
});
// ─── getArweaveCostUsdc ───────────────────────────────────────────────────────
// Each test group resets modules to clear the in-memory price cache.
(0, vitest_1.describe)('getArweaveCostUsdc — happy paths', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetModules();
        mockFetch.mockReset();
    });
    (0, vitest_1.it)('returns correct USDC cost for 1 AR = $50, 10% buffer', async () => {
        // Arweave oracle: 1 AR worth of Winston = 1e12
        // CoinGecko: $50/AR
        // Expected: 1 × 50 × 1.10 × 1e6 = 55_000_000
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 50 } }), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        // 1 AR × $50 × 1.10 × 1e6 = 55_000_000; floating-point may add 1 due to ceil
        const result = await getArweaveCostUsdc(1_000_000);
        (0, vitest_1.expect)(result).toBeGreaterThanOrEqual(55000000n);
        (0, vitest_1.expect)(result).toBeLessThanOrEqual(55000002n);
    });
    (0, vitest_1.it)('calls both Arweave and CoinGecko APIs (2 fetches)', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('500000000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 20 } }), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        await getArweaveCostUsdc(512_000);
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)('uses ceil (never returns 0n for positive cost)', async () => {
        // Tiny: 1 Winston at $0.001/AR → near-zero USD → ceil to 1n
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 0.001 } }), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        const result = await getArweaveCostUsdc(1);
        (0, vitest_1.expect)(result).toBeGreaterThanOrEqual(1n);
    });
    (0, vitest_1.it)('result is bigint', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 10 } }), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        const result = await getArweaveCostUsdc(1_000);
        (0, vitest_1.expect)(typeof result).toBe('bigint');
    });
});
(0, vitest_1.describe)('getArweaveCostUsdc — error paths', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetModules();
        mockFetch.mockReset();
    });
    (0, vitest_1.it)('throws CoinGecko error on non-OK response', async () => {
        // Arweave OK, CoinGecko 429
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        await (0, vitest_1.expect)(getArweaveCostUsdc(1_000_000)).rejects.toThrow('CoinGecko error: 429');
    });
    (0, vitest_1.it)('throws Arweave price error on non-OK response', async () => {
        // Arweave 503, CoinGecko OK
        mockFetch
            .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 10 } }), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        await (0, vitest_1.expect)(getArweaveCostUsdc(1_000_000)).rejects.toThrow('Arweave price error: 503');
    });
    (0, vitest_1.it)('throws on CoinGecko 500', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        await (0, vitest_1.expect)(getArweaveCostUsdc(1_000_000)).rejects.toThrow('CoinGecko error: 500');
    });
});
// ─── AR/USD cache behaviour ───────────────────────────────────────────────────
(0, vitest_1.describe)('AR/USD price cache', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetModules();
        mockFetch.mockReset();
        vitest_1.vi.useFakeTimers();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.useRealTimers();
    });
    (0, vitest_1.it)('caches AR/USD price — only 1 CoinGecko call for 2 getArweaveCostUsdc calls', async () => {
        // Call 1: Arweave (mock 0) + CoinGecko (mock 1)
        // Call 2: Arweave (mock 2) only — CoinGecko still in cache
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 25 } }), text: () => Promise.resolve('') })
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('2000000000000'), json: () => Promise.resolve({}) });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        const r1 = await getArweaveCostUsdc(1_000_000);
        const r2 = await getArweaveCostUsdc(2_000_000);
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(3); // 2 + 1 (CoinGecko cached)
        (0, vitest_1.expect)(r2).toBeGreaterThan(r1); // 2× Winston → 2× cost
    });
    (0, vitest_1.it)('re-fetches AR/USD price after 5-minute TTL expires', async () => {
        // Call 1: both fetches
        mockFetch
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 25 } }), text: () => Promise.resolve('') })
            // Advance time past 5 min TTL
            // Call 2: both fetches again (CoinGecko cache expired)
            .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1000000000000'), json: () => Promise.resolve({}) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ arweave: { usd: 30 } }), text: () => Promise.resolve('') });
        const { getArweaveCostUsdc } = await Promise.resolve().then(() => __importStar(require('../arweave.js')));
        await getArweaveCostUsdc(1_000_000);
        // Advance clock by 6 minutes (past 5-min TTL)
        vitest_1.vi.advanceTimersByTime(6 * 60 * 1000);
        await getArweaveCostUsdc(1_000_000);
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(4); // 2 + 2 (cache expired)
    });
});
//# sourceMappingURL=arweave.test.js.map