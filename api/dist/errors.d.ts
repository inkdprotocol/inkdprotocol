/**
 * Inkd API Server — Error types & helpers
 */
import type { Response } from 'express';
export declare class ApiError extends Error {
    readonly statusCode: number;
    readonly code?: string | undefined;
    constructor(statusCode: number, message: string, code?: string | undefined);
}
export declare class NotFoundError extends ApiError {
    constructor(resource: string);
}
export declare class BadRequestError extends ApiError {
    constructor(message: string);
}
export declare class UnauthorizedError extends ApiError {
    constructor(message?: string);
}
export declare class ServiceUnavailableError extends ApiError {
    constructor(message: string);
}
export interface ErrorResponse {
    error: {
        code: string;
        message: string;
    };
}
export declare function sendError(res: Response, err: unknown): void;
//# sourceMappingURL=errors.d.ts.map