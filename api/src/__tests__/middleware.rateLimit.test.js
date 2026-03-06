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
 * @inkd/api — middleware/rateLimit.ts unit tests
 */
const vitest_1 = require("vitest");
function makeReqRes(ip = '127.0.0.1') {
    const req = {
        ip,
        socket: { remoteAddress: ip },
    };
    const headers = {};
    const setHeader = vitest_1.vi.fn((k, v) => { headers[k] = v; });
    const json = vitest_1.vi.fn();
    const status = vitest_1.vi.fn().mockReturnValue({ json });
    const res = { status, json, setHeader };
    const next = vitest_1.vi.fn();
    return { req, res, next, status, json, headers, setHeader };
}
(0, vitest_1.describe)('rateLimitMiddleware', () => {
    (0, vitest_1.beforeEach)(() => {
        // Reset module to clear the windows Map between tests
        vitest_1.vi.resetModules();
    });
    (0, vitest_1.it)('calls next() for first request under limit', async () => {
        const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
        const { req, res, next } = makeReqRes('10.0.0.1');
        rl(60_000, 10)(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)('sets X-RateLimit-Limit header', async () => {
        const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
        const { req, res, next, setHeader } = makeReqRes('10.0.0.2');
        rl(60_000, 5)(req, res, next);
        (0, vitest_1.expect)(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    });
    (0, vitest_1.it)('sets X-RateLimit-Remaining header', async () => {
        const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
        const { req, res, next, setHeader } = makeReqRes('10.0.0.3');
        rl(60_000, 5)(req, res, next);
        (0, vitest_1.expect)(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    });
    (0, vitest_1.it)('returns 429 when limit exceeded', async () => {
        const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
        const ip = '10.0.0.4';
        const mw = rl(60_000, 2);
        // Hit limit
        for (let i = 0; i < 2; i++) {
            const { req, res, next } = makeReqRes(ip);
            mw(req, res, next);
        }
        // One more — should 429
        const { req, res, next, status, json } = makeReqRes(ip);
        mw(req, res, next);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(429);
        (0, vitest_1.expect)(json).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ error: vitest_1.expect.objectContaining({ code: 'RATE_LIMITED' }) }));
    });
    (0, vitest_1.it)('different IPs have independent windows', async () => {
        const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
        const mw = rl(60_000, 1);
        // IP A hits limit
        for (let i = 0; i < 2; i++) {
            const { req, res, next } = makeReqRes('10.1.0.1');
            mw(req, res, next);
        }
        // IP B should still pass
        const { req, res, next } = makeReqRes('10.1.0.2');
        mw(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)('uses socket.remoteAddress as fallback when req.ip is undefined', async () => {
        const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
        const req = {
            ip: undefined,
            socket: { remoteAddress: '10.2.0.1' },
        };
        const { res, next } = makeReqRes();
        rl(60_000, 10)(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)('uses "unknown" when both req.ip and socket.remoteAddress are undefined', async () => {
        const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
        const req = {
            ip: undefined,
            socket: { remoteAddress: undefined },
        };
        const { res, next } = makeReqRes();
        rl(60_000, 10)(req, res, next);
        // Should still proceed without error
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)('cleans up expired entries via setInterval (fake timers)', async () => {
        vitest_1.vi.useFakeTimers();
        try {
            const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
            const ip = '10.5.0.1';
            // Use a very short 50ms window so the entry expires quickly
            const mw = rl(50, 5);
            // First request — creates an entry, consumes 1 of 5
            const { req, res, next } = makeReqRes(ip);
            mw(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledTimes(1);
            // Advance past the window (50ms) AND past the cleanup interval (60_000ms)
            vitest_1.vi.advanceTimersByTime(70_000);
            // After cleanup the old entry is deleted; next request gets a fresh window
            const { req: req2, res: res2, next: next2, setHeader } = makeReqRes(ip);
            mw(req2, res2, next2);
            (0, vitest_1.expect)(next2).toHaveBeenCalled();
            // Remaining should be max-1 = 4, proving the entry was reset by cleanup
            (0, vitest_1.expect)(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
        }
        finally {
            vitest_1.vi.useRealTimers();
        }
    });
    (0, vitest_1.it)('cleanup keeps non-expired entries while removing expired ones (covers line-21 else branch)', async () => {
        vitest_1.vi.useFakeTimers();
        try {
            const { rateLimitMiddleware: rl } = await Promise.resolve().then(() => __importStar(require('../middleware/rateLimit.js')));
            // Two middleware instances sharing the same internal Map
            // Short window: expires within the cleanup interval
            const shortMw = rl(50, 5);
            // Long window: still alive when cleanup fires at 60_000ms
            const longMw = rl(120_000, 5);
            // Create both entries at t=0
            const { req: reqA, res: resA, next: nextA } = makeReqRes('10.6.0.1');
            shortMw(reqA, resA, nextA);
            (0, vitest_1.expect)(nextA).toHaveBeenCalledTimes(1);
            const { req: reqB, res: resB, next: nextB } = makeReqRes('10.6.0.2');
            longMw(reqB, resB, nextB);
            (0, vitest_1.expect)(nextB).toHaveBeenCalledTimes(1);
            // Advance past cleanup interval (60_000ms); short entry (resetAt=+50ms) expires,
            // long entry (resetAt=+120_000ms) does NOT → cleanup loop exercises both branches.
            vitest_1.vi.advanceTimersByTime(70_000);
            // Short-window IP: entry was deleted → fresh window, remaining = max-1 = 4
            const { req: reqA2, res: resA2, next: nextA2, setHeader: shA } = makeReqRes('10.6.0.1');
            shortMw(reqA2, resA2, nextA2);
            (0, vitest_1.expect)(nextA2).toHaveBeenCalled();
            (0, vitest_1.expect)(shA).toHaveBeenCalledWith('X-RateLimit-Remaining', 4); // reset, used 1 of 5
            // Long-window IP: entry persisted → count was 1, now incremented to 2 → remaining = 3
            const { req: reqB2, res: resB2, next: nextB2, setHeader: shB } = makeReqRes('10.6.0.2');
            longMw(reqB2, resB2, nextB2);
            (0, vitest_1.expect)(nextB2).toHaveBeenCalled();
            (0, vitest_1.expect)(shB).toHaveBeenCalledWith('X-RateLimit-Remaining', 3); // persisted: 2 of 5 used
        }
        finally {
            vitest_1.vi.useRealTimers();
        }
    });
});
//# sourceMappingURL=middleware.rateLimit.test.js.map