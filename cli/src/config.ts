/**
 * Inkd CLI — Config management
 * Reads inkd.config.json from cwd, or falls back to env vars.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Address } from 'viem'

export interface InkdConfig {
  network: 'mainnet' | 'testnet'
  rpcUrl?: string
  /** Private key hex string. Prefer INKD_PRIVATE_KEY env var over storing in file. */
  privateKey?: string
}

export const DEFAULT_CONFIG: InkdConfig = {
  network: 'testnet',
}

const CONFIG_FILE = 'inkd.config.json'

export function loadConfig(): InkdConfig {
  const path = resolve(process.cwd(), CONFIG_FILE)
  let file: Partial<InkdConfig> = {}

  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, 'utf-8')) as Partial<InkdConfig>
    } catch {
      error(`Failed to parse ${CONFIG_FILE}. Is it valid JSON?`)
    }
  }

  // Env var overrides
  const privateKey = process.env['INKD_PRIVATE_KEY'] ?? file.privateKey
  const rpcUrl = process.env['INKD_RPC_URL'] ?? file.rpcUrl
  const network = (process.env['INKD_NETWORK'] ?? file.network ?? 'testnet') as InkdConfig['network']

  return { network, rpcUrl, privateKey }
}

export function writeConfig(cfg: InkdConfig): void {
  const path = resolve(process.cwd(), CONFIG_FILE)
  // Never persist private key to file
  const { privateKey: _pk, ...safe } = cfg
  writeFileSync(path, JSON.stringify(safe, null, 2) + '\n', 'utf-8')
}

export function requirePrivateKey(cfg: InkdConfig): `0x${string}` {
  const key = cfg.privateKey ?? process.env['INKD_PRIVATE_KEY']
  if (!key) {
    error(
      'Private key not found.\n' +
      '  Set INKD_PRIVATE_KEY env var, or add "privateKey" to inkd.config.json\n' +
      '  Example: export INKD_PRIVATE_KEY=0xabc123...'
    )
  }
  const hex = key!.startsWith('0x') ? key! : `0x${key!}`
  return hex as `0x${string}`
}

// ─── Inkd contract addresses ─────────────────────────────────────────────────

export const ADDRESSES = {
  mainnet: {
    token:    '' as Address,   // populated post-launch
    registry: '' as Address,
    treasury: '' as Address,
  },
  testnet: {
    token:    '' as Address,   // populated post-testnet deploy
    registry: '' as Address,
    treasury: '' as Address,
  },
} as const

export type Network = keyof typeof ADDRESSES

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function error(msg: string): never {
  console.error(`\n  ${RED}✗${RESET} ${msg}\n`)
  process.exit(1)
}

export function success(msg: string): void {
  console.log(`\n  ${GREEN}✓${RESET} ${msg}\n`)
}

export function info(msg: string): void {
  console.log(`  ${CYAN}→${RESET} ${msg}`)
}

export function warn(msg: string): void {
  console.warn(`  ${YELLOW}⚠${RESET}  ${msg}`)
}

// ─── ANSI colours ─────────────────────────────────────────────────────────────

const noColor = process.env['NO_COLOR'] !== undefined || !process.stdout.isTTY
export const RED    = noColor ? '' : '\x1b[31m'
export const GREEN  = noColor ? '' : '\x1b[32m'
export const YELLOW = noColor ? '' : '\x1b[33m'
export const CYAN   = noColor ? '' : '\x1b[36m'
export const BOLD   = noColor ? '' : '\x1b[1m'
export const DIM    = noColor ? '' : '\x1b[2m'
export const RESET  = noColor ? '' : '\x1b[0m'
