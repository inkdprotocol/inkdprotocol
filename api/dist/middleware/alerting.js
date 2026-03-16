"use strict";
/**
 * Telegram alerting for 5xx errors
 *
 * Rate-limited to max 1 alert per minute per unique method:path:status combo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlert = sendAlert;
const ALERT_COOLDOWN_MS = 60_000; // 1 minute
const alertTimestamps = new Map();
/**
 * Send a Telegram alert for server errors.
 * Respects rate limiting: max 1 alert per minute per unique error signature.
 */
async function sendAlert(method, path, status, message) {
    const botToken = process.env['ALERT_BOT_TOKEN'];
    const chatId = process.env['ALERT_CHAT_ID'];
    if (!botToken || !chatId) {
        // Alerting not configured — silently skip
        return;
    }
    // Rate limiting: 1 alert per minute per unique signature
    const key = `${method}:${path}:${status}`;
    const now = Date.now();
    const lastSent = alertTimestamps.get(key);
    if (lastSent && now - lastSent < ALERT_COOLDOWN_MS) {
        // Skip — too soon since last alert for this error
        return;
    }
    alertTimestamps.set(key, now);
    const text = [
        `🚨 *API Error ${status}*`,
        '',
        `\`${method} ${path}\``,
        '',
        `Message: ${escapeMarkdown(message)}`,
        '',
        `Time: ${new Date().toISOString()}`,
    ].join('\n');
    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown',
            }),
        });
    }
    catch (err) {
        // Don't let alerting failures crash the app
        console.error('[alerting] Failed to send Telegram alert:', err);
    }
}
function escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
//# sourceMappingURL=alerting.js.map