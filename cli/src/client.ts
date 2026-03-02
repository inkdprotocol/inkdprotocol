/**
 * Inkd CLI — viem client factory
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import type { InkdConfig } from './config.js'
import { ADDRESSES, requirePrivateKey } from './config.js'

export { privateKeyToAccount }

export interface Clients {
  publicClient: PublicClient
  walletClient: WalletClient
  account: ReturnType<typeof privateKeyToAccount>
  addrs: typeof ADDRESSES.testnet
}

export function buildPublicClient(cfg: InkdConfig): PublicClient {
  const chain = cfg.network === 'mainnet' ? base : baseSepolia
  return createPublicClient({ chain, transport: http(cfg.rpcUrl) }) as unknown as PublicClient
}

/** Build a WalletClient. If `account` is provided, use it; otherwise derive from cfg private key. */
export function buildWalletClient(
  cfg: InkdConfig,
  account?: ReturnType<typeof privateKeyToAccount>,
): WalletClient {
  const chain = cfg.network === 'mainnet' ? base : baseSepolia
  const acct = account ?? privateKeyToAccount(requirePrivateKey(cfg))
  return createWalletClient({ account: acct, chain, transport: http(cfg.rpcUrl) }) as unknown as WalletClient
}

export function buildClients(cfg: InkdConfig): Clients {
  const pk = requirePrivateKey(cfg)
  const account = privateKeyToAccount(pk)
  const chain = cfg.network === 'mainnet' ? base : baseSepolia

  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) }) as unknown as PublicClient
  const walletClient = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) }) as unknown as WalletClient
  const addrs = ADDRESSES[cfg.network]

  return { publicClient, walletClient, account, addrs }
}
