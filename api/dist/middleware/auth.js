"use strict";
/**
 * Inkd API Server — Bearer token authentication middleware
 *
 * If INKD_API_KEY is set, every request must include:
 *   Authorization: Bearer <key>
 *
 * If INKD_API_KEY is NOT set (local dev), auth is skipped entirely.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const errors_js_1 = require("../errors.js");
function authMiddleware(apiKey) {
    return (req, res, next) => {
        // No API key configured — open access (dev mode)
        if (apiKey === null) {
            next();
            return;
        }
        const header = req.headers['authorization'] ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        if (!token) {
            (0, errors_js_1.sendError)(res, new errors_js_1.UnauthorizedError('Authorization header required: Bearer <key>'));
            return;
        }
        if (token !== apiKey) {
            (0, errors_js_1.sendError)(res, new errors_js_1.UnauthorizedError());
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map