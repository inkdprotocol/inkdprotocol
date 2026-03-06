"use strict";
/**
 * Inkd API — x402 Payment Middleware
 *
 * Agents pay in USDC on Base — no API keys, no accounts, no humans.
 *
 * Flow:
 *   1. Agent sends POST /v1/projects (no payment yet)
 *   2. Server returns 402 with payment details ($5 USDC → Treasury Contract)
 *   3. Agent auto-pays via @x402/fetch (EIP-3009 signed transfer)
 *   4. LocalFacilitator verifies the payment signature + amount
 *   5. Request proceeds — server calls Treasury.settle() to split revenue
 *   6. Registry transaction goes on-chain — payer address = owner
 *
 * Pricing:
 *   POST /v1/projects              → $5.00 USDC (create project)
 *   POST /v1/projects/:id/versions → $2.00 USDC (push version)
 *
 * Revenue split (handled by InkdTreasury.settle()):
 *   $1.00 → arweaveWallet   (Arweave storage)
 *   $2.00 → InkdBuyback     (auto-buys $INKD at $50 threshold)
 *   $2.00 → Treasury        (protocol revenue)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_PUSH_VERSION = exports.PRICE_CREATE_PROJECT = exports.USDC_BASE_SEPOLIA = exports.USDC_BASE_MAINNET = exports.NETWORK_BASE_SEPOLIA = exports.NETWORK_BASE_MAINNET = void 0;
exports.buildX402Middleware = buildX402Middleware;
exports.getPayerAddress = getPayerAddress;
exports.getPaymentAmount = getPaymentAmount;
const express_1 = require("@x402/express");
const http_1 = require("@x402/core/http");
// @ts-ignore — subpath exists in dist
const server_1 = require("@x402/evm/exact/server");
const localFacilitator_js_1 = require("./localFacilitator.js");
// ─── Constants ────────────────────────────────────────────────────────────────
exports.NETWORK_BASE_MAINNET = 'eip155:8453';
exports.NETWORK_BASE_SEPOLIA = 'eip155:84532';
exports.USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
exports.USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
/** Fixed payment amounts per route (USDC, 6 decimals) */
exports.PRICE_CREATE_PROJECT = 5000000n; // $5.00
exports.PRICE_PUSH_VERSION = 2000000n; // $2.00
// ─── Middleware builder ───────────────────────────────────────────────────────
/**
 * Build x402 USDC payment middleware.
 * Uses LocalFacilitatorClient — no CDP dependency, no external HTTP calls on startup.
 *
 * Routes are relative to /v1 mount point (app.use('/v1', x402)).
 */
function buildX402Middleware(cfg) {
    const networkId = cfg.network === 'mainnet' ? exports.NETWORK_BASE_MAINNET : exports.NETWORK_BASE_SEPOLIA;
    const usdcAddr = cfg.network === 'mainnet' ? exports.USDC_BASE_MAINNET : exports.USDC_BASE_SEPOLIA;
    const routes = {
        // Paths relative to /v1 mount point
        'POST /projects': {
            accepts: {
                scheme: 'exact',
                payTo: cfg.treasuryAddress,
                price: '$5.00',
                network: networkId,
                extra: { token: usdcAddr, name: 'USDC' },
            },
            description: 'Register an AI agent or project on Inkd Protocol',
        },
        'POST /projects/:id/versions': {
            accepts: {
                scheme: 'exact',
                payTo: cfg.treasuryAddress,
                price: '$2.00',
                network: networkId,
                extra: { token: usdcAddr, name: 'USDC' },
            },
            description: 'Push a new version to an Inkd project (Arweave + on-chain)',
        },
    };
    // Local facilitator — no CDP, no external HTTP calls, no JWT auth issues.
    // Verifies EIP-3009 signatures locally. Settlement handled by Treasury contract.
    const facilitator = new localFacilitator_js_1.LocalFacilitatorClient(cfg.network, usdcAddr, cfg.treasuryAddress);
    const server = new express_1.x402ResourceServer(facilitator)
        .register(networkId, new server_1.ExactEvmScheme());
    return (0, express_1.paymentMiddleware)(routes, server);
}
// ─── Payment info helpers ─────────────────────────────────────────────────────
function decodePaymentHeader(req) {
    try {
        const header = req.header('x-payment') ?? req.header('payment-signature');
        if (!header)
            return null;
        return (0, http_1.decodePaymentSignatureHeader)(header);
    }
    catch {
        return null;
    }
}
/** Extract payer address — becomes on-chain owner of the project/version. */
function getPayerAddress(req) {
    const payload = decodePaymentHeader(req);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return payload?.payload?.authorization?.from;
}
/**
 * Extract USDC amount paid (6 decimals).
 * Falls back to route-hardcoded amounts if header absent.
 */
function getPaymentAmount(req) {
    const payload = decodePaymentHeader(req);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = payload?.payload?.authorization?.value;
    if (raw) {
        try {
            return BigInt(raw);
        }
        catch { /* fall through */ }
    }
    if (req.method === 'POST' && req.path === '/')
        return exports.PRICE_CREATE_PROJECT;
    if (req.method === 'POST' && req.path.includes('/versions'))
        return exports.PRICE_PUSH_VERSION;
    return undefined;
}
//# sourceMappingURL=x402.js.map