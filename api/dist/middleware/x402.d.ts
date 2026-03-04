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
import type { RequestHandler, Request } from 'express';
import type { Address } from 'viem';
export declare const NETWORK_BASE_MAINNET = "eip155:8453";
export declare const NETWORK_BASE_SEPOLIA = "eip155:84532";
export interface X402Config {
    /** Address that receives all payments (treasury/server wallet) */
    payTo: Address;
    /** Coinbase facilitator URL. Default: https://x402.org/facilitator */
    facilitatorUrl: string;
    /** Network to accept payments on */
    network: 'mainnet' | 'testnet';
}
/**
 * Build x402 payment middleware for Inkd write endpoints.
 *
 * Protected routes:
 *   POST /v1/projects              → 0.001 ETH (register project)
 *   POST /v1/projects/:id/versions → 0.001 ETH (push version)
 */
export declare function buildX402Middleware(cfg: X402Config): RequestHandler;
/**
 * Extract the payer's wallet address from x402 payment headers.
 * Returns undefined if no x402 payment was made (e.g. in dev mode).
 */
export declare function getPayerAddress(req: Request): Address | undefined;
//# sourceMappingURL=x402.d.ts.map