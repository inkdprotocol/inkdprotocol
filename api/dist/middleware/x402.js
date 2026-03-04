"use strict";
/**
 * Inkd API — x402 Payment Middleware
 *
 * Replaces Bearer token auth for write endpoints.
 * Agents pay with their wallet — no API keys, no accounts.
 *
 * Flow:
 *   1. Agent sends POST /v1/projects (no payment)
 *   2. Server returns 402 with payment details (0.001 ETH)
 *   3. Agent auto-pays via @x402/fetch
 *   4. Server verifies via Coinbase facilitator
 *   5. Request proceeds — payer address = project owner
 *
 * Docs: https://x402.org / https://docs.cdp.coinbase.com/x402
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NETWORK_BASE_SEPOLIA = exports.NETWORK_BASE_MAINNET = void 0;
exports.buildX402Middleware = buildX402Middleware;
exports.getPayerAddress = getPayerAddress;
const express_1 = require("@x402/express");
const http_1 = require("@x402/core/http");
// Network CAIP-2 identifiers
exports.NETWORK_BASE_MAINNET = 'eip155:8453';
exports.NETWORK_BASE_SEPOLIA = 'eip155:84532';
/**
 * Build x402 payment middleware for Inkd write endpoints.
 *
 * Protected routes:
 *   POST /v1/projects              → 0.001 ETH (register project)
 *   POST /v1/projects/:id/versions → 0.001 ETH (push version)
 */
function buildX402Middleware(cfg) {
    const networkId = cfg.network === 'mainnet'
        ? exports.NETWORK_BASE_MAINNET
        : exports.NETWORK_BASE_SEPOLIA;
    const routes = {
        'POST /v1/projects': {
            accepts: {
                scheme: 'exact',
                payTo: cfg.payTo,
                price: '$0.001',
                network: networkId,
            },
            description: 'Register a project on inkd — locks 1 $INKD on-chain',
        },
        'POST /v1/projects/:id/versions': {
            accepts: {
                scheme: 'exact',
                payTo: cfg.payTo,
                price: '$0.001',
                network: networkId,
            },
            description: 'Push a new version on-chain via inkd Registry',
        },
    };
    // Use Coinbase-hosted facilitator for payment verification + settlement
    // The facilitator handles all EVM payment processing — no local scheme needed
    const facilitatorClient = new http_1.HTTPFacilitatorClient({ url: cfg.facilitatorUrl });
    return (0, express_1.paymentMiddlewareFromConfig)(routes, facilitatorClient);
}
/**
 * Extract the payer's wallet address from x402 payment headers.
 * Returns undefined if no x402 payment was made (e.g. in dev mode).
 */
function getPayerAddress(req) {
    // x402/express attaches payment info to the request after verification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const x402 = req.x402;
    const from = x402?.payment?.payload?.authorization?.from;
    return from;
}
//# sourceMappingURL=x402.js.map