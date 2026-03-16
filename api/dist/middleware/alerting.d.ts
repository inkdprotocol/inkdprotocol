/**
 * Telegram alerting for 5xx errors
 *
 * Rate-limited to max 1 alert per minute per unique method:path:status combo.
 */
/**
 * Send a Telegram alert for server errors.
 * Respects rate limiting: max 1 alert per minute per unique error signature.
 */
export declare function sendAlert(method: string, path: string, status: number, message: string): Promise<void>;
//# sourceMappingURL=alerting.d.ts.map