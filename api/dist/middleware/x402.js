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
 *   4. Coinbase facilitator verifies USDC landed in Treasury
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
 *
 * Docs: https://x402.org | https://docs.cdp.coinbase.com/x402
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_PUSH_VERSION = exports.PRICE_CREATE_PROJECT = exports.USDC_BASE_SEPOLIA = exports.USDC_BASE_MAINNET = exports.NETWORK_BASE_SEPOLIA = exports.NETWORK_BASE_MAINNET = void 0;
exports.buildX402Middleware = buildX402Middleware;
exports.getPayerAddress = getPayerAddress;
exports.getPaymentAmount = getPaymentAmount;
const express_1 = require("@x402/express");
const http_1 = require("@x402/core/http");
const http_2 = require("@x402/core/http");
// @ts-ignore — subpath exists in dist but not declared in package.json exports map
const server_1 = require("@x402/evm/exact/server");
// CAIP-2 network identifiers
exports.NETWORK_BASE_MAINNET = 'eip155:8453';
exports.NETWORK_BASE_SEPOLIA = 'eip155:84532';
// USDC contract addresses
exports.USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
exports.USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
// Fixed payment amounts per route (USDC, 6 decimals)
exports.PRICE_CREATE_PROJECT = 5000000n; // $5.00
exports.PRICE_PUSH_VERSION = 2000000n; // $2.00
/**
 * Build x402 USDC payment middleware for Inkd write endpoints.
 *
 * NOTE: Routes are relative to /v1 mount point — no /v1 prefix here.
 * NOTE: syncFacilitatorOnStart=false — avoids blocking cold starts on Vercel.
 */
function buildX402Middleware(cfg) {
    const networkId = cfg.network === 'mainnet' ? exports.NETWORK_BASE_MAINNET : exports.NETWORK_BASE_SEPOLIA;
    const usdcAddr = cfg.network === 'mainnet' ? exports.USDC_BASE_MAINNET : exports.USDC_BASE_SEPOLIA;
    const routes = {
        // Routes are relative to /v1 mount (app.use('/v1', x402))
        'POST /projects': {
            accepts: {
                scheme: 'exact',
                payTo: cfg.treasuryAddress,
                price: '$5.00',
                network: networkId,
                extra: {
                    token: usdcAddr,
                    name: 'USDC',
                },
            },
            description: 'Register an AI agent or project on Inkd Protocol',
        },
        'POST /projects/:id/versions': {
            accepts: {
                scheme: 'exact',
                payTo: cfg.treasuryAddress,
                price: '$2.00',
                network: networkId,
                extra: {
                    token: usdcAddr,
                    name: 'USDC',
                },
            },
            description: 'Push a new version to an Inkd project (permanent Arweave + on-chain)',
        },
    };
    const facilitator = new http_1.HTTPFacilitatorClient({ url: cfg.facilitatorUrl });
    // Register ExactEvmScheme server-side so the resource server can build
    // payment requirements (accepts[]) without needing a facilitator handshake.
    // This allows syncFacilitatorOnStart=false (no cold-start blocking on Vercel).
    const schemes = [
        { network: networkId, server: new server_1.ExactEvmScheme() },
    ];
    // syncFacilitatorOnStart=false: skip facilitator handshake on startup.
    // Scheme server is pre-registered above — accepts[] will be populated correctly.
    return (0, express_1.paymentMiddlewareFromConfig)(routes, facilitator, schemes, undefined, undefined, false);
}
/**
 * Decode the x402 payment payload from the X-PAYMENT request header.
 * Returns null if header is absent or malformed.
 */
function decodePaymentHeader(req) {
    try {
        const header = req.header('x-payment') ?? req.header('payment-signature');
        if (!header)
            return null;
        return (0, http_2.decodePaymentSignatureHeader)(header);
    }
    catch {
        return null;
    }
}
/**
 * Extract the payer's wallet address from x402 payment headers.
 * This address becomes the on-chain owner of the project/version.
 *
 * EIP-3009 exact scheme: payload.authorization.from
 */
function getPayerAddress(req) {
    const payload = decodePaymentHeader(req);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = payload?.payload?.authorization?.from;
    return from;
}
/**
 * Extract the amount paid (in USDC base units, 6 decimals).
 *
 * Falls back to route-hardcoded amounts if header is absent:
 *   POST /projects          → 5_000_000 ($5.00)
 *   POST /projects/.../versions → 2_000_000 ($2.00)
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
    // Fallback: derive amount from route shape
    if (req.method === 'POST' && req.path === '/')
        return exports.PRICE_CREATE_PROJECT;
    if (req.method === 'POST' && req.path.includes('/versions'))
        return exports.PRICE_PUSH_VERSION;
    return undefined;
}
//# sourceMappingURL=x402.js.map