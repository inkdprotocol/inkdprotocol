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

import { paymentMiddlewareFromConfig } from '@x402/express'
import { HTTPFacilitatorClient }        from '@x402/core/http'
import type { RoutesConfig }            from '@x402/core/server'
import type { RequestHandler, Request } from 'express'
import type { Address }                 from 'viem'

// Network CAIP-2 identifiers
export const NETWORK_BASE_MAINNET = 'eip155:8453'
export const NETWORK_BASE_SEPOLIA = 'eip155:84532'

export interface X402Config {
  /** Address that receives all payments (treasury/server wallet) */
  payTo:          Address
  /** Coinbase facilitator URL. Default: https://x402.org/facilitator */
  facilitatorUrl: string
  /** Network to accept payments on */
  network:        'mainnet' | 'testnet'
}

/**
 * Build x402 payment middleware for Inkd write endpoints.
 *
 * Protected routes:
 *   POST /v1/projects              → 0.001 ETH (register project)
 *   POST /v1/projects/:id/versions → 0.001 ETH (push version)
 */
export function buildX402Middleware(cfg: X402Config): RequestHandler {
  const networkId = cfg.network === 'mainnet'
    ? NETWORK_BASE_MAINNET
    : NETWORK_BASE_SEPOLIA

  const routes: RoutesConfig = {
    'POST /v1/projects': {
      accepts: {
        scheme:  'exact',
        payTo:   cfg.payTo,
        price:   '$0.001',
        network: networkId,
      },
      description: 'Register a project on inkd — locks 1 $INKD on-chain',
    },
    'POST /v1/projects/:id/versions': {
      accepts: {
        scheme:  'exact',
        payTo:   cfg.payTo,
        price:   '$0.001',
        network: networkId,
      },
      description: 'Push a new version on-chain via inkd Registry',
    },
  }

  // Use Coinbase-hosted facilitator for payment verification + settlement
  // The facilitator handles all EVM payment processing — no local scheme needed
  const facilitatorClient = new HTTPFacilitatorClient({ url: cfg.facilitatorUrl })

  return paymentMiddlewareFromConfig(routes, facilitatorClient)
}

/**
 * Extract the payer's wallet address from x402 payment headers.
 * Returns undefined if no x402 payment was made (e.g. in dev mode).
 */
export function getPayerAddress(req: Request): Address | undefined {
  // x402/express attaches payment info to the request after verification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const x402 = (req as any).x402
  const from  = x402?.payment?.payload?.authorization?.from as Address | undefined
  return from
}
