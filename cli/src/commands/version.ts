/**
 * inkd version <sub-command> — version management (x402 payment flow)
 *
 * Sub-commands:
 *   push  — upload content to Arweave + push version on-chain ($2 USDC via x402)
 *   list  — list all versions for a project
 *   show  — show a specific version by index
 */

import { readFileSync, existsSync } from 'fs'
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia }   from 'viem/chains'
import { ProjectsClient }      from '@inkd/sdk'
import {
  loadConfig, requirePrivateKey, ADDRESSES,
  error, success, info,
  BOLD, RESET, CYAN, DIM, GREEN,
} from '../config.js'
import { buildPublicClient } from '../client.js'
import { REGISTRY_ABI }      from '../abi.js'

const API_URL = process.env['INKD_API_URL'] ?? 'https://api.inkdprotocol.com'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag)
}

function requireFlag(args: string[], flag: string, hint: string): string {
  const val = parseFlag(args, flag)
  if (!val) error(`Missing required flag ${BOLD}${flag}${RESET}\n  Example: ${DIM}${hint}${RESET}`)
  return val!
}

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function buildPayingClients(cfg: ReturnType<typeof loadConfig>) {
  const key     = requirePrivateKey(cfg)
  const account = privateKeyToAccount(key)
  const chain   = cfg.network === 'mainnet' ? base : baseSepolia
  const rpcUrl  = cfg.rpcUrl ?? (cfg.network === 'mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org')
  const wallet  = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const reader  = createPublicClient({ chain, transport: http(rpcUrl) })
  return { wallet, reader, account }
}

// ─── push ────────────────────────────────────────────────────────────────────

export async function cmdVersionPush(args: string[]): Promise<void> {
  const idStr    = requireFlag(args, '--id',  'inkd version push --id 1 --file ./dist.tar.gz --tag v1.0.0')
  const vTag     = requireFlag(args, '--tag', 'inkd version push --id 1 --file ./dist.tar.gz --tag v1.0.0')
  const isPrivate = hasFlag(args, '--private')

  // Accepts either --file (uploads to Arweave) or --hash (pre-uploaded, public only)
  const filePath  = parseFlag(args, '--file')
  const arHash    = parseFlag(args, '--hash')

  if (!filePath && !arHash) {
    error(
      'Provide either:\n' +
      '  --file <path>      Upload file to Arweave, then push\n' +
      '  --hash <ar://…>    Use existing Arweave hash (public only)\n\n' +
      'Options:\n' +
      '  --private          Encrypt content before upload (AES-256-GCM + ECIES key wrapping)'
    )
  }

  if (isPrivate && arHash) {
    error('--private requires --file (content must be encrypted before upload, not after)')
  }

  const cfg = loadConfig()
  const key  = requirePrivateKey(cfg)
  const { wallet, reader } = buildPayingClients(cfg)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new ProjectsClient({
    wallet:       wallet as any,
    publicClient: reader as any,
    apiUrl:       API_URL,
    privateKey:   key,
  })

  const projectId = parseInt(idStr, 10)

  // ── Private upload path ───────────────────────────────────────────────────
  if (isPrivate && filePath) {
    if (!existsSync(filePath)) error(`File not found: ${filePath}`)
    const data = readFileSync(filePath)
    const ext  = filePath.split('.').pop()?.toLowerCase() ?? ''
    const contentType = {
      json: 'application/json', ts: 'text/plain', js: 'text/javascript',
      md: 'text/markdown', txt: 'text/plain',
    }[ext] ?? 'application/octet-stream'

    info(`🔒 Private upload — content will be encrypted before Arweave storage`)
    info(`Encrypting and uploading ${CYAN}${filePath}${RESET} (${(data.length / 1024).toFixed(1)} KB)...`)

    let result: Awaited<ReturnType<typeof client.pushPrivateVersion>>
    try {
      result = await client.pushPrivateVersion(projectId, {
        content:     data,
        tag:         vTag,
        contentType,
        filename:    filePath.split('/').pop(),
      })
    } catch (err) {
      error(err instanceof Error ? err.message : String(err))
    }

    success(`Version ${BOLD}${vTag}${RESET} pushed! ${GREEN}🔒 Private${RESET}`)
    info(`  Content (encrypted): ${DIM}${result!.contentHash}${RESET}`)
    info(`  Access manifest:     ${DIM}${result!.metadataHash}${RESET}`)
    info(`  TX:                  ${DIM}${result!.txHash}${RESET}`)
    info(`  Basescan:            https://basescan.org/tx/${result!.txHash}`)
    info(`  Decrypt with:        inkd version decrypt --id ${idStr} --index <N> --out ./decrypted`)
    console.log()
    return
  }

  // ── Public upload path ────────────────────────────────────────────────────
  let contentHash: string
  let contentSize = 0

  if (filePath) {
    if (!existsSync(filePath)) error(`File not found: ${filePath}`)
    const data = readFileSync(filePath)
    contentSize = data.length

    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const contentType = {
      json: 'application/json', ts: 'text/plain', js: 'text/javascript',
      md: 'text/markdown', txt: 'text/plain',
    }[ext] ?? 'application/octet-stream'

    info(`Uploading ${CYAN}${filePath}${RESET} to Arweave (${(contentSize / 1024).toFixed(1)} KB)...`)

    let upload: Awaited<ReturnType<typeof client.upload>>
    try {
      upload = await client.upload(data, {
        contentType,
        filename: filePath.split('/').pop(),
      })
    } catch (err) {
      error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    contentHash = upload!.hash
    info(`  Uploaded → ${DIM}${upload!.url}${RESET}`)
    info(`  Hash: ${CYAN}${contentHash}${RESET}`)

  } else {
    contentHash = arHash!
    if (!contentHash.startsWith('ar://') && !contentHash.startsWith('0x')) {
      error('--hash must be an Arweave TxId (ar://...) or hash')
    }
  }

  info(`Pushing version ${CYAN}${vTag}${RESET} to project #${idStr}...`)
  info(`  Paying $2.00 USDC from ${DIM}${wallet.account.address}${RESET}`)

  let result: Awaited<ReturnType<typeof client.pushVersion>>
  try {
    result = await client.pushVersion(projectId, {
      tag: vTag, contentHash, contentSize,
    })
  } catch (err) {
    error(err instanceof Error ? err.message : String(err))
  }

  success(`Version ${BOLD}${vTag}${RESET} pushed!`)
  info(`  Content hash: ${DIM}${result!.contentHash}${RESET}`)
  info(`  TX:           ${DIM}${result!.txHash}${RESET}`)
  info(`  Basescan:     https://basescan.org/tx/${result!.txHash}`)
  console.log()
}

// ─── list ────────────────────────────────────────────────────────────────────

export async function cmdVersionList(args: string[]): Promise<void> {
  const idStr = args[0] ?? requireFlag(args, '--id', 'inkd version list 42')
  const id = BigInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd version list --id 42') : idStr)

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const client       = buildPublicClient(cfg)
  const versionCount = await client.readContract({
    address: addrs.registry, abi: REGISTRY_ABI, functionName: 'getVersionCount', args: [id],
  }) as bigint

  if (versionCount === 0n) { info(`No versions found for project #${id}`); return }

  const versions = await Promise.all(
    Array.from({ length: Number(versionCount) }, (_, i) =>
      client.readContract({
        address: addrs.registry, abi: REGISTRY_ABI, functionName: 'getVersion', args: [id, BigInt(i)],
      })
    )
  ) as unknown as Array<{ projectId: bigint; contentHash: string; arweaveHash?: string; tag: string; versionTag?: string; pushedBy: string; pushedAt: bigint }>

  console.log()
  console.log(`  ${BOLD}Versions for Project #${id}${RESET} (${versionCount} total)`)
  console.log(`  ${'─'.repeat(55)}`)

  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i]!
    const hash = v.contentHash ?? (v as Record<string, unknown>)['arweaveHash'] as string ?? ''
    const tag  = v.tag ?? (v as Record<string, unknown>)['versionTag'] as string ?? ''
    console.log(
      `  ${DIM}#${i}${RESET}  ${CYAN}${tag.padEnd(12)}${RESET}` +
      `  ${DIM}${hash.replace('ar://', '').slice(0, 12)}…${RESET}` +
      `  ${GREEN}${formatDate(v.pushedAt)}${RESET}`
    )
  }
  console.log()
}

// ─── show ────────────────────────────────────────────────────────────────────

export async function cmdVersionShow(args: string[]): Promise<void> {
  const idStr    = requireFlag(args, '--id',    'inkd version show --id 42 --index 0')
  const indexStr = requireFlag(args, '--index', 'inkd version show --id 42 --index 0')

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const client  = buildPublicClient(cfg)
  const version = await client.readContract({
    address: addrs.registry, abi: REGISTRY_ABI, functionName: 'getVersion',
    args: [BigInt(idStr), BigInt(indexStr)],
  }) as Record<string, unknown>

  const hash = version['contentHash'] as string ?? version['arweaveHash'] as string ?? ''
  const tag  = version['tag'] as string ?? version['versionTag'] as string ?? ''

  console.log()
  console.log(`  ${BOLD}Version #${indexStr} of Project #${idStr}${RESET}`)
  console.log(`  ${'─'.repeat(42)}`)
  info(`Tag:           ${CYAN}${tag}${RESET}`)
  info(`Content hash:  ${hash}`)
  if (hash.startsWith('ar://') || hash.length === 43) {
    info(`Arweave URL:   https://arweave.net/${hash.replace('ar://', '')}`)
  }
  info(`Pushed by:     ${version['pushedBy'] as string}`)
  info(`Pushed at:     ${GREEN}${formatDate(version['pushedAt'] as bigint)}${RESET}`)
  const changelog = version['changelog'] as string | undefined
  if (changelog) {
    console.log()
    info(`Changelog:     ${changelog}`)
  }
  console.log()
}
