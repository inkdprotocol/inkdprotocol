"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @inkd/api — middleware/auth.ts unit tests
 */
const vitest_1 = require("vitest");
const auth_js_1 = require("../middleware/auth.js");
function makeReqRes(headerValue) {
    const req = {
        headers: {
            authorization: headerValue,
        },
    };
    const json = vitest_1.vi.fn();
    const status = vitest_1.vi.fn().mockReturnValue({ json });
    const res = { status, json };
    const next = vitest_1.vi.fn();
    return { req, res, next, status, json };
}
(0, vitest_1.describe)('authMiddleware', () => {
    (0, vitest_1.describe)('when apiKey is null (dev mode)', () => {
        (0, vitest_1.it)('calls next() without checking headers', () => {
            const { req, res, next } = makeReqRes();
            (0, auth_js_1.authMiddleware)(null)(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalled();
            (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('calls next() even when Authorization header is present', () => {
            const { req, res, next } = makeReqRes('Bearer sometoken');
            (0, auth_js_1.authMiddleware)(null)(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('when apiKey is set', () => {
        const KEY = 'secret-test-key';
        (0, vitest_1.it)('calls next() on valid Bearer token', () => {
            const { req, res, next } = makeReqRes(`Bearer ${KEY}`);
            (0, auth_js_1.authMiddleware)(KEY)(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalled();
        });
        (0, vitest_1.it)('returns 401 when Authorization header is missing', () => {
            const { req, res, next } = makeReqRes(undefined);
            (0, auth_js_1.authMiddleware)(KEY)(req, res, next);
            (0, vitest_1.expect)(next).not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
        });
        (0, vitest_1.it)('returns 401 when Authorization header is empty string', () => {
            const { req, res, next } = makeReqRes('');
            (0, auth_js_1.authMiddleware)(KEY)(req, res, next);
            (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
        });
        (0, vitest_1.it)('returns 401 when token does not match', () => {
            const { req, res, next } = makeReqRes('Bearer wrongkey');
            (0, auth_js_1.authMiddleware)(KEY)(req, res, next);
            (0, vitest_1.expect)(next).not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
        });
        (0, vitest_1.it)('returns 401 when format is not Bearer', () => {
            const { req, res, next } = makeReqRes(`Basic ${KEY}`);
            (0, auth_js_1.authMiddleware)(KEY)(req, res, next);
            (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
        });
        (0, vitest_1.it)('trims whitespace from Bearer token', () => {
            const { req, res, next } = makeReqRes(`Bearer   ${KEY}   `);
            // trim() is applied in middleware
            (0, auth_js_1.authMiddleware)(KEY)(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalled();
        });
        (0, vitest_1.it)('401 response includes error body', () => {
            const { req, res, next, json } = makeReqRes(undefined);
            (0, auth_js_1.authMiddleware)(KEY)(req, res, next);
            (0, vitest_1.expect)(json).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ error: vitest_1.expect.objectContaining({ code: 'UNAUTHORIZED' }) }));
        });
    });
});
//# sourceMappingURL=middleware.auth.test.js.map