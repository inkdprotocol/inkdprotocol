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
exports.USDC_BASE_SEPOLIA = exports.USDC_BASE_MAINNET = exports.NETWORK_BASE_SEPOLIA = exports.NETWORK_BASE_MAINNET = void 0;
exports.buildX402Middleware = buildX402Middleware;
exports.getPayerAddress = getPayerAddress;
exports.getPaymentAmount = getPaymentAmount;
const express_1 = require("@x402/express");
const http_1 = require("@x402/core/http");
// @ts-ignore — subpath not in package.json exports map but exists in dist
const server_1 = require("@x402/evm/exact/server");
// CAIP-2 network identifiers
exports.NETWORK_BASE_MAINNET = 'eip155:8453';
exports.NETWORK_BASE_SEPOLIA = 'eip155:84532';
// USDC contract addresses
exports.USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
exports.USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
/**
 * Build x402 USDC payment middleware for Inkd write endpoints.
 *
 * Agents pay with their wallet — USDC goes directly to InkdTreasury.
 * After payment verification, server calls Treasury.settle() to split revenue.
 */
function buildX402Middleware(cfg) {
    const networkId = cfg.network === 'mainnet' ? exports.NETWORK_BASE_MAINNET : exports.NETWORK_BASE_SEPOLIA;
    const usdcAddr = cfg.network === 'mainnet' ? exports.USDC_BASE_MAINNET : exports.USDC_BASE_SEPOLIA;
    const routes = {
        // Register a project — $5 USDC
        'POST /v1/projects': {
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
            description: 'Register an AI agent or project on Inkd Protocol (locks $INKD on-chain)',
        },
        // Push a new version — $2 USDC
        'POST /v1/projects/:id/versions': {
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
    // Build CDP JWT auth if credentials provided (required for Mainnet facilitator)
    // The HTTPFacilitatorClient expects: () => Promise<{ verify, settle, supported }>
    // where each key is a Record<string, string> of headers for that endpoint.
    const cdpFacilitatorHost = 'api.cdp.coinbase.com';
    const createAuthHeaders = (cfg.cdpApiKeyId && cfg.cdpApiKeySecret)
        ? async () => {
            const { generateJwt } = await import('@coinbase/cdp-sdk/auth');
            const makeJwt = (path) => generateJwt({
                apiKeyId: cfg.cdpApiKeyId,
                apiKeySecret: cfg.cdpApiKeySecret,
                requestMethod: 'POST',
                requestHost: cdpFacilitatorHost,
                requestPath: `/platform/v2/x402/${path}`,
            });
            const [verifyJwt, settleJwt, supportedJwt] = await Promise.all([
                makeJwt('verify'),
                makeJwt('settle'),
                makeJwt('supported'),
            ]);
            return {
                verify: { Authorization: `Bearer ${verifyJwt}` },
                settle: { Authorization: `Bearer ${settleJwt}` },
                supported: { Authorization: `Bearer ${supportedJwt}` },
            };
        }
        : undefined;
    const facilitator = new http_1.HTTPFacilitatorClient({ url: cfg.facilitatorUrl, createAuthHeaders });
    const server = new express_1.x402ResourceServer(facilitator)
        .register(networkId, new server_1.ExactEvmScheme());
    return (0, express_1.paymentMiddleware)(routes, server);
}
/**
 * Extract the payer's wallet address from x402 payment headers.
 * This address becomes the on-chain owner of the project/version.
 */
function getPayerAddress(req) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const x402 = req.x402;
    return x402?.payment?.payload?.authorization?.from;
}
/**
 * Extract the amount paid (in USDC base units, 6 decimals).
 * Returns 5_000_000 for $5.00, 2_000_000 for $2.00, etc.
 */
function getPaymentAmount(req) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const x402 = req.x402;
    const amount = x402?.payment?.payload?.authorization?.value;
    return amount ? BigInt(amount) : undefined;
}
//# sourceMappingURL=x402.js.map