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

import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { decodePaymentSignatureHeader }           from '@x402/core/http'
// @ts-ignore — subpath exists in dist
import { ExactEvmScheme }                         from '@x402/evm/exact/server'
import type { RoutesConfig }                      from '@x402/core/server'
import type { RequestHandler, Request, Response, NextFunction } from 'express'
import type { Address }                           from 'viem'
import { LocalFacilitatorClient }                 from './localFacilitator.js'
import { getArweaveCostUsdc, calculateCharge }    from '../arweave.js'

// ─── Constants ────────────────────────────────────────────────────────────────

export const NETWORK_BASE_MAINNET = 'eip155:8453'
export const NETWORK_BASE_SEPOLIA = 'eip155:84532'

export const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address

/** Minimum / fallback payment amounts per route (USDC, 6 decimals).
 *  createProject = $0.10 flat (spam prevention + gas coverage)
 *  pushVersion   = dynamic (Arweave cost + 20% markup), floor $0.10
 */
export const PRICE_CREATE_PROJECT  = 100_000n   // $0.10
export const PRICE_PUSH_VERSION_MIN = 100_000n  // $0.10 floor

// ─── Config ──────────────────────────────────────────────────────────────────

export interface X402Config {
  treasuryAddress:  Address
  facilitatorUrl:   string
  network:          'mainnet' | 'testnet'
  cdpApiKeyId?:     string | null
  cdpApiKeySecret?: string | null
}

// ─── Middleware builder ───────────────────────────────────────────────────────

/**
 * Build x402 USDC payment middleware.
 * Uses LocalFacilitatorClient — no CDP dependency, no external HTTP calls on startup.
 *
 * Routes are relative to /v1 mount point (app.use('/v1', x402)).
 */
export function buildX402Middleware(cfg: X402Config): RequestHandler {
  const networkId = cfg.network === 'mainnet' ? NETWORK_BASE_MAINNET : NETWORK_BASE_SEPOLIA
  const usdcAddr  = cfg.network === 'mainnet' ? USDC_BASE_MAINNET    : USDC_BASE_SEPOLIA

  const routes: RoutesConfig = {
    // Paths relative to /v1 mount point
    'POST /projects': {
      accepts: {
        scheme:  'exact',
        payTo:   cfg.treasuryAddress,
        price:   '$0.10',
        network: networkId,
        // name/version must match USDC's EIP-712 domain exactly (used for EIP-3009 sig)
        extra:   { token: usdcAddr, name: 'USD Coin', version: '2' },
      },
      description: 'Register an AI agent or project on Inkd Protocol',
    },
    // x402 uses [segment] wildcard syntax, NOT Express :param syntax
    'POST /projects/[id]/versions': {
      accepts: {
        scheme:  'exact',
        payTo:   cfg.treasuryAddress,
        price:   '$0.10',
        network: networkId,
        extra:   { token: usdcAddr, name: 'USD Coin', version: '2' },
      },
      description: 'Push a new version to an Inkd project (Arweave + on-chain)',
    },
  }

  // Local facilitator — no CDP, no external HTTP calls, no JWT auth issues.
  // Verifies EIP-3009 signatures locally. Settlement handled by Treasury contract.
  const facilitator = new LocalFacilitatorClient(cfg.network, usdcAddr, cfg.treasuryAddress)

  const server = new x402ResourceServer(facilitator as any)
    .register(networkId as `${string}:${string}`, new ExactEvmScheme())

  return paymentMiddleware(routes, server)
}

// ─── Payment info helpers ─────────────────────────────────────────────────────

function decodePaymentHeader(req: Request) {
  try {
    const header = req.header('x-payment') ?? req.header('payment-signature')
    if (!header) return null
    return decodePaymentSignatureHeader(header)
  } catch {
    return null
  }
}

/** Extract payer address — becomes on-chain owner of the project/version. */
export function getPayerAddress(req: Request): Address | undefined {
  const payload = decodePaymentHeader(req)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (payload?.payload as any)?.authorization?.from as Address | undefined
}

/**
 * Extract USDC amount paid (6 decimals).
 * Falls back to route-hardcoded amounts if header absent.
 */
export function getPaymentAmount(req: Request): bigint | undefined {
  const payload = decodePaymentHeader(req)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (payload?.payload as any)?.authorization?.value
  if (raw) {
    try { return BigInt(raw) } catch { /* fall through */ }
  }
  if (req.method === 'POST' && req.path === '/') return PRICE_CREATE_PROJECT
  if (req.method === 'POST' && req.path.includes('/versions')) return PRICE_PUSH_VERSION_MIN
  return undefined
}

// ─── Dynamic price middleware for pushVersion ─────────────────────────────────

/**
 * Intercepts POST /projects/:id/versions BEFORE x402 middleware.
 * If no X-PAYMENT header: computes dynamic price (Arweave cost + 20%) from
 * req.body.contentSize and returns a 402 with the correct amount.
 * If X-PAYMENT header is present: passes through to x402 for verification.
 *
 * This is needed because x402 RoutesConfig only supports static prices,
 * but Arweave upload cost depends on content size.
 */
export function buildDynamicVersionPriceMiddleware(cfg: X402Config): RequestHandler {
  const networkId = cfg.network === 'mainnet' ? NETWORK_BASE_MAINNET : NETWORK_BASE_SEPOLIA
  const usdcAddr  = cfg.network === 'mainnet' ? USDC_BASE_MAINNET    : USDC_BASE_SEPOLIA

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only intercept POST /:id/versions
    if (req.method !== 'POST' || !req.path.match(/^\/\d+\/versions$/)) {
      next(); return
    }

    // If X-PAYMENT header is present → let x402 middleware handle verification
    const hasPayment = !!(req.header('x-payment') ?? req.header('payment-signature'))
    if (hasPayment) { next(); return }

    // No payment yet — compute dynamic price and return 402
    const contentSize: number = typeof req.body === 'object' ? (req.body?.contentSize ?? 0) : 0

    let price: bigint = PRICE_PUSH_VERSION_MIN
    if (contentSize > 0) {
      try {
        const arweaveCost = await getArweaveCostUsdc(contentSize)
        const { total }   = calculateCharge(arweaveCost)
        price = total > PRICE_PUSH_VERSION_MIN ? total : PRICE_PUSH_VERSION_MIN
      } catch { /* keep minimum */ }
    }

    // x402 v2 format — payload goes in `payment-required` header as base64 JSON
    const resource = `${req.protocol}://${req.hostname}${req.originalUrl}`
    const payload = {
      x402Version: 2,
      error:       'Payment required',
      resource:    { url: resource, description: 'Push a new version (Arweave storage + protocol fee)', mimeType: 'application/json' },
      accepts: [{
        scheme:            'exact',
        network:           networkId,
        amount:            price.toString(),
        asset:             usdcAddr,
        payTo:             cfg.treasuryAddress,
        maxTimeoutSeconds: 300,
        extra:             { name: 'USD Coin', version: '2', token: usdcAddr },
      }],
    }

    res
      .status(402)
      .set('payment-required', Buffer.from(JSON.stringify(payload)).toString('base64'))
      .json({})
  }
}
