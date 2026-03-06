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

import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { HTTPFacilitatorClient }                  from '@x402/core/http'
// @ts-ignore — subpath not in package.json exports map but exists in dist
import { ExactEvmScheme }                         from '@x402/evm/exact/server'
import type { RoutesConfig }                      from '@x402/core/server'
import type { RequestHandler, Request }           from 'express'
import type { Address }                           from 'viem'
import { createPrivateKey, sign as cryptoSign, randomBytes } from 'crypto'


// ─── CDP JWT (pure Node.js crypto — no jose/cdp-sdk to avoid ESM issues) ──────

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function buildCdpJwt(
  apiKeyId:      string,
  apiKeySecret:  string,
  method:        string,
  host:          string,
  path:          string,
): string {
  const now     = Math.floor(Date.now() / 1000)
  const nonce   = randomBytes(16).toString('hex')

  // CDP Ed25519 secret: base64-encoded 64 bytes (first 32 = seed, last 32 = public key)
  const decoded = Buffer.from(apiKeySecret, 'base64')
  if (decoded.length !== 64) throw new Error(`CDP key must be 64 bytes, got ${decoded.length}`)
  const seed = decoded.subarray(0, 32)

  // Build PKCS8 DER for Ed25519 private key
  // ASN.1: SEQUENCE { version 0, AlgorithmIdentifier { OID 1.3.101.112 }, OCTET STRING { OCTET STRING { seed } } }
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed])
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })

  const header  = b64url(Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: apiKeyId, typ: 'JWT', nonce })))
  const payload = b64url(Buffer.from(JSON.stringify({
    sub: apiKeyId, iss: 'cdp',
    nbf: now, iat: now, exp: now + 120,
    uris: [`${method} ${host}${path}`],
  })))

  const signingInput = `${header}.${payload}`
  const signature    = cryptoSign(null, Buffer.from(signingInput), privateKey)
  return `${signingInput}.${b64url(signature)}`
}

// CAIP-2 network identifiers
export const NETWORK_BASE_MAINNET = 'eip155:8453'
export const NETWORK_BASE_SEPOLIA = 'eip155:84532'

// USDC contract addresses
export const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address

export interface X402Config {
  /** InkdTreasury contract address — receives all USDC payments */
  treasuryAddress: Address
  /** Coinbase facilitator URL. Default: https://x402.org/facilitator */
  facilitatorUrl:  string
  /** Network to accept payments on */
  network:         'mainnet' | 'testnet'
  /** CDP API Key ID — required for Mainnet CDP facilitator */
  cdpApiKeyId?:     string | null
  /** CDP API Key Secret — required for Mainnet CDP facilitator */
  cdpApiKeySecret?: string | null
}

/**
 * Build x402 USDC payment middleware for Inkd write endpoints.
 *
 * Agents pay with their wallet — USDC goes directly to InkdTreasury.
 * After payment verification, server calls Treasury.settle() to split revenue.
 */
export function buildX402Middleware(cfg: X402Config): RequestHandler {
  const networkId  = cfg.network === 'mainnet' ? NETWORK_BASE_MAINNET : NETWORK_BASE_SEPOLIA
  const usdcAddr   = cfg.network === 'mainnet' ? USDC_BASE_MAINNET    : USDC_BASE_SEPOLIA

  const routes: RoutesConfig = {
    // Register a project — $5 USDC
    'POST /v1/projects': {
      accepts: {
        scheme:  'exact',
        payTo:   cfg.treasuryAddress,
        price:   '$5.00',
        network: networkId,
        extra: {
          token: usdcAddr,
          name:  'USDC',
        },
      },
      description: 'Register an AI agent or project on Inkd Protocol (locks $INKD on-chain)',
    },
    // Push a new version — $2 USDC
    'POST /v1/projects/:id/versions': {
      accepts: {
        scheme:  'exact',
        payTo:   cfg.treasuryAddress,
        price:   '$2.00',
        network: networkId,
        extra: {
          token: usdcAddr,
          name:  'USDC',
        },
      },
      description: 'Push a new version to an Inkd project (permanent Arweave + on-chain)',
    },
  }

  // Build CDP JWT auth if credentials provided (required for Mainnet facilitator)
  // Uses pure Node.js crypto — no jose/cdp-sdk dependency (avoids ESM/CJS conflicts)
  const cdpFacilitatorHost = 'api.cdp.coinbase.com'
  const createAuthHeaders = (cfg.cdpApiKeyId && cfg.cdpApiKeySecret)
    ? () => {
        const makeBearer = (path: string) => `Bearer ${buildCdpJwt(
          cfg.cdpApiKeyId!,
          cfg.cdpApiKeySecret!,
          'POST',
          cdpFacilitatorHost,
          `/platform/v2/x402/${path}`,
        )}`
        return Promise.resolve({
          verify:    { Authorization: makeBearer('verify')    },
          settle:    { Authorization: makeBearer('settle')    },
          supported: { Authorization: makeBearer('supported') },
        })
      }
    : undefined

  const facilitator = new HTTPFacilitatorClient({ url: cfg.facilitatorUrl, createAuthHeaders })
  const server = new x402ResourceServer(facilitator)
    .register(networkId as `${string}:${string}`, new ExactEvmScheme())
  return paymentMiddleware(routes, server)
}

/**
 * Extract the payer's wallet address from x402 payment headers.
 * This address becomes the on-chain owner of the project/version.
 */
export function getPayerAddress(req: Request): Address | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const x402 = (req as any).x402
  return x402?.payment?.payload?.authorization?.from as Address | undefined
}

/**
 * Extract the amount paid (in USDC base units, 6 decimals).
 * Returns 5_000_000 for $5.00, 2_000_000 for $2.00, etc.
 */
export function getPaymentAmount(req: Request): bigint | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const x402 = (req as any).x402
  const amount = x402?.payment?.payload?.authorization?.value
  return amount ? BigInt(amount) : undefined
}
