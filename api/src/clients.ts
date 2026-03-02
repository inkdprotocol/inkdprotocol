/**
 * Inkd API Server — viem client factories
 */

import { createPublicClient, createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { type ApiConfig, getChain } from './config.js'

export function buildPublicClient(cfg: ApiConfig) {
  return createPublicClient({
    chain:     getChain(cfg.network),
    transport: http(cfg.rpcUrl),
  })
}

export function buildWalletClient(cfg: ApiConfig, privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return {
    client: createWalletClient({
      account,
      chain:     getChain(cfg.network),
      transport: http(cfg.rpcUrl),
    }),
    account,
    address: account.address as Address,
  }
}

export function normalizePrivateKey(key: string): `0x${string}` {
  const hex = key.startsWith('0x') ? key : `0x${key}`
  return hex as `0x${string}`
}
