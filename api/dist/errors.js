"use strict";
/**
 * Inkd API Server — Error types & helpers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.UnauthorizedError = exports.BadRequestError = exports.NotFoundError = exports.ApiError = void 0;
exports.sendError = sendError;
class ApiError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
class NotFoundError extends ApiError {
    constructor(resource) {
        super(404, `${resource} not found`, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class BadRequestError extends ApiError {
    constructor(message) {
        super(400, message, 'BAD_REQUEST');
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends ApiError {
    constructor(message = 'Invalid or missing API key') {
        super(401, message, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ServiceUnavailableError extends ApiError {
    constructor(message) {
        super(503, message, 'SERVICE_UNAVAILABLE');
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
function sendError(res, err) {
    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            error: {
                code: err.code ?? 'ERROR',
                message: err.message,
            },
        });
        return;
    }
    // Unknown / RPC errors
    const message = err instanceof Error ? err.message : String(err);
    const isRpc = message.toLowerCase().includes('rpc') ||
        message.toLowerCase().includes('contract');
    if (isRpc) {
        res.status(502).json({
            error: { code: 'RPC_ERROR', message: `RPC call failed: ${message}` },
        });
        return;
    }
    console.error('[inkd-api] Unhandled error:', err);
    res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
}
//# sourceMappingURL=errors.js.map