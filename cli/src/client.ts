/**
 * Inkd CLI — viem client factory
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  privateKeyToAccount,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { base, baseSepolia } from 'viem/chains'
import type { InkdConfig } from './config.js'
import { ADDRESSES, requirePrivateKey } from './config.js'

export interface Clients {
  publicClient: PublicClient
  walletClient: WalletClient
  account: ReturnType<typeof privateKeyToAccount>
  addrs: typeof ADDRESSES.testnet
}

export function buildPublicClient(cfg: InkdConfig): PublicClient {
  const chain = cfg.network === 'mainnet' ? base : baseSepolia
  return createPublicClient({ chain, transport: http(cfg.rpcUrl) })
}

export function buildClients(cfg: InkdConfig): Clients {
  const pk = requirePrivateKey(cfg)
  const account = privateKeyToAccount(pk)
  const chain = cfg.network === 'mainnet' ? base : baseSepolia

  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) })
  const addrs = ADDRESSES[cfg.network]

  return { publicClient, walletClient, account, addrs }
}
