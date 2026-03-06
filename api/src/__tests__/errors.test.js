"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @inkd/api — errors.ts unit tests
 *
 * Covers: ApiError + subclasses, sendError() routing
 */
const vitest_1 = require("vitest");
const errors_js_1 = require("../errors.js");
// ─── Helper ───────────────────────────────────────────────────────────────────
function makeMockRes() {
    const json = vitest_1.vi.fn();
    const status = vitest_1.vi.fn().mockReturnValue({ json });
    return { res: { status, json }, status, json };
}
// ─── ApiError & subclasses ────────────────────────────────────────────────────
(0, vitest_1.describe)('ApiError', () => {
    (0, vitest_1.it)('stores statusCode, message, and code', () => {
        const e = new errors_js_1.ApiError(418, "I'm a teapot", 'TEAPOT');
        (0, vitest_1.expect)(e.statusCode).toBe(418);
        (0, vitest_1.expect)(e.message).toBe("I'm a teapot");
        (0, vitest_1.expect)(e.code).toBe('TEAPOT');
        (0, vitest_1.expect)(e.name).toBe('ApiError');
    });
    (0, vitest_1.it)('code is optional', () => {
        const e = new errors_js_1.ApiError(500, 'oops');
        (0, vitest_1.expect)(e.code).toBeUndefined();
    });
    (0, vitest_1.it)('instanceof Error', () => {
        (0, vitest_1.expect)(new errors_js_1.ApiError(400, 'bad')).toBeInstanceOf(Error);
    });
});
(0, vitest_1.describe)('NotFoundError', () => {
    (0, vitest_1.it)('formats message and sets 404', () => {
        const e = new errors_js_1.NotFoundError('Project #42');
        (0, vitest_1.expect)(e.statusCode).toBe(404);
        (0, vitest_1.expect)(e.message).toBe('Project #42 not found');
        (0, vitest_1.expect)(e.code).toBe('NOT_FOUND');
    });
});
(0, vitest_1.describe)('BadRequestError', () => {
    (0, vitest_1.it)('uses custom message and sets 400', () => {
        const e = new errors_js_1.BadRequestError('name is required');
        (0, vitest_1.expect)(e.statusCode).toBe(400);
        (0, vitest_1.expect)(e.message).toBe('name is required');
        (0, vitest_1.expect)(e.code).toBe('BAD_REQUEST');
    });
});
(0, vitest_1.describe)('UnauthorizedError', () => {
    (0, vitest_1.it)('uses default message', () => {
        const e = new errors_js_1.UnauthorizedError();
        (0, vitest_1.expect)(e.statusCode).toBe(401);
        (0, vitest_1.expect)(e.message).toBe('Invalid or missing API key');
        (0, vitest_1.expect)(e.code).toBe('UNAUTHORIZED');
    });
    (0, vitest_1.it)('accepts custom message', () => {
        const e = new errors_js_1.UnauthorizedError('Bearer token required');
        (0, vitest_1.expect)(e.message).toBe('Bearer token required');
    });
});
(0, vitest_1.describe)('ServiceUnavailableError', () => {
    (0, vitest_1.it)('uses custom message and sets 503', () => {
        const e = new errors_js_1.ServiceUnavailableError('RPC unavailable');
        (0, vitest_1.expect)(e.statusCode).toBe(503);
        (0, vitest_1.expect)(e.message).toBe('RPC unavailable');
        (0, vitest_1.expect)(e.code).toBe('SERVICE_UNAVAILABLE');
    });
});
// ─── sendError ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('sendError()', () => {
    (0, vitest_1.it)('sends ApiError status + body', () => {
        const { res, status, json } = makeMockRes();
        (0, errors_js_1.sendError)(res, new errors_js_1.BadRequestError('missing name'));
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(400);
        (0, vitest_1.expect)(json).toHaveBeenCalledWith({
            error: { code: 'BAD_REQUEST', message: 'missing name' },
        });
    });
    (0, vitest_1.it)('sends 404 for NotFoundError', () => {
        const { res, status, json } = makeMockRes();
        (0, errors_js_1.sendError)(res, new errors_js_1.NotFoundError('Agent #5'));
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(404);
        (0, vitest_1.expect)(json).toHaveBeenCalledWith({
            error: { code: 'NOT_FOUND', message: 'Agent #5 not found' },
        });
    });
    (0, vitest_1.it)('sends 401 for UnauthorizedError', () => {
        const { res, status } = makeMockRes();
        (0, errors_js_1.sendError)(res, new errors_js_1.UnauthorizedError());
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(401);
    });
    (0, vitest_1.it)('falls back to ERROR when code is undefined', () => {
        const { res, status, json } = makeMockRes();
        (0, errors_js_1.sendError)(res, new errors_js_1.ApiError(418, 'teapot'));
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(418);
        (0, vitest_1.expect)(json).toHaveBeenCalledWith({
            error: { code: 'ERROR', message: 'teapot' },
        });
    });
    (0, vitest_1.it)('routes RPC errors to 502', () => {
        const { res, status, json } = makeMockRes();
        (0, errors_js_1.sendError)(res, new Error('RPC call timed out'));
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(502);
        (0, vitest_1.expect)(json).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ error: vitest_1.expect.objectContaining({ code: 'RPC_ERROR' }) }));
    });
    (0, vitest_1.it)('routes contract errors to 502', () => {
        const { res, status } = makeMockRes();
        (0, errors_js_1.sendError)(res, new Error('contract execution reverted'));
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(502);
    });
    (0, vitest_1.it)('routes unknown errors to 500', () => {
        const { res, status, json } = makeMockRes();
        (0, errors_js_1.sendError)(res, new Error('something exploded'));
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(json).toHaveBeenCalledWith({
            error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
    });
    (0, vitest_1.it)('handles non-Error objects as 500', () => {
        const { res, status } = makeMockRes();
        (0, errors_js_1.sendError)(res, 'string error');
        (0, vitest_1.expect)(status).toHaveBeenCalledWith(500);
    });
});
//# sourceMappingURL=errors.test.js.map