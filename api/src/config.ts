/**
 * Inkd API Server — Configuration
 *
 * All config is via environment variables. See api/.env.example for defaults.
 */

import type { Address, Chain } from 'viem'
import { base, baseSepolia } from 'viem/chains'

// ─── Network addresses (populated after contract deployment) ──────────────────

export const ADDRESSES: Record<Network, ContractAddresses> = {
  mainnet: {
    token:    (process.env['INKD_TOKEN_ADDRESS']    ?? '') as Address,
    registry: (process.env['INKD_REGISTRY_ADDRESS'] ?? '') as Address,
    treasury: (process.env['INKD_TREASURY_ADDRESS'] ?? '') as Address,
  },
  testnet: {
    token:    (process.env['INKD_TOKEN_ADDRESS']    ?? '') as Address,
    registry: (process.env['INKD_REGISTRY_ADDRESS'] ?? '') as Address,
    treasury: (process.env['INKD_TREASURY_ADDRESS'] ?? '') as Address,
  },
}

export type Network = 'mainnet' | 'testnet'

export interface ContractAddresses {
  token:    Address
  registry: Address
  treasury: Address
}

// ─── Server config ────────────────────────────────────────────────────────────

export interface ApiConfig {
  port:       number
  network:    Network
  rpcUrl:     string
  apiKey:     string | null   // null = auth disabled (dev mode)
  corsOrigin: string
  rateLimitWindowMs: number
  rateLimitMax:      number
  // x402 payment config
  serverWalletKey:    string | null  // server signs on-chain txns
  serverWalletAddress: Address | null // receives x402 payments
  x402FacilitatorUrl: string
  x402Enabled:        boolean
}

export function loadConfig(): ApiConfig {
  const network = (process.env['INKD_NETWORK'] ?? 'testnet') as Network
  if (network !== 'mainnet' && network !== 'testnet') {
    throw new Error(`Invalid INKD_NETWORK: "${network}". Must be "mainnet" or "testnet".`)
  }

  const defaultRpc = network === 'mainnet'
    ? 'https://mainnet.base.org'
    : 'https://sepolia.base.org'

  const serverWalletKey = process.env['SERVER_WALLET_KEY'] ?? null
  const serverWalletAddress = (process.env['SERVER_WALLET_ADDRESS'] ?? null) as Address | null

  return {
    port:    parseInt(process.env['PORT'] ?? '3000', 10),
    network,
    rpcUrl:  process.env['INKD_RPC_URL'] ?? defaultRpc,
    apiKey:  process.env['INKD_API_KEY'] ?? null,  // null = no auth (local dev)
    corsOrigin: process.env['CORS_ORIGIN'] ?? '*',
    rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10),
    rateLimitMax:      parseInt(process.env['RATE_LIMIT_MAX']        ?? '60',    10),
    // x402
    serverWalletKey,
    serverWalletAddress,
    x402FacilitatorUrl: process.env['X402_FACILITATOR_URL'] ?? 'https://x402.org/facilitator',
    x402Enabled: Boolean(serverWalletAddress) && process.env['X402_ENABLED'] !== 'false',
  }
}

// ─── Chain helper ─────────────────────────────────────────────────────────────

export function getChain(network: Network): Chain {
  return network === 'mainnet' ? base : baseSepolia
}
