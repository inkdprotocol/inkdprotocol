/**
 * inkd version <sub-command> — version management
 *
 * Sub-commands:
 *   push  — push a new version to a project
 *   list  — list all versions for a project
 *   show  — show a specific version by index
 */

import { formatEther } from 'viem'
import {
  loadConfig, ADDRESSES,
  error, success, info,
  BOLD, RESET, CYAN, DIM, GREEN,
} from '../config.js'
import { buildClients, buildPublicClient } from '../client.js'
import { REGISTRY_ABI } from '../abi.js'

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

function requireFlag(args: string[], flag: string, hint: string): string {
  const val = parseFlag(args, flag)
  if (!val) error(`Missing required flag ${BOLD}${flag}${RESET}\n  Example: ${DIM}${hint}${RESET}`)
  return val!
}

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

// ─── push ────────────────────────────────────────────────────────────────────

export async function cmdVersionPush(args: string[]): Promise<void> {
  const idStr      = requireFlag(args, '--id',        'inkd version push --id 1 --hash abc123 --tag v0.2.0')
  const arweaveHash = requireFlag(args, '--hash',     'inkd version push --id 1 --hash abc123 --tag v0.2.0')
  const versionTag  = requireFlag(args, '--tag',      'inkd version push --id 1 --hash abc123 --tag v0.2.0')
  const changelog   = parseFlag(args, '--changelog') ?? ''

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured. Deploy contracts first.')

  const { publicClient, walletClient, account, addrs: a } = buildClients(cfg)

  const versionFee = await publicClient.readContract({
    address: a.registry,
    abi: REGISTRY_ABI,
    functionName: 'versionFee',
  }) as bigint

  info(`Version fee: ${formatEther(versionFee)} ETH`)
  info(`Pushing version ${CYAN}${versionTag}${RESET} to project #${idStr}...`)

  const tx = await walletClient.writeContract({
    address: a.registry,
    abi: REGISTRY_ABI,
    functionName: 'pushVersion',
    args: [BigInt(idStr), arweaveHash, versionTag, changelog],
    value: versionFee,
    account,
    chain: walletClient.chain!,
  })

  info(`Tx: ${DIM}${tx}${RESET}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })

  if (receipt.status === 'success') {
    success(`Version ${BOLD}${versionTag}${RESET} pushed! Arweave: ${DIM}${arweaveHash}${RESET}`)
  } else {
    error('Transaction reverted. Verify project ownership and ETH balance.')
  }
}

// ─── list ────────────────────────────────────────────────────────────────────

export async function cmdVersionList(args: string[]): Promise<void> {
  const idStr = args[0]
    ?? requireFlag(args, '--id', 'inkd version list 42')
  const id = BigInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd version list --id 42') : idStr)

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const client = buildPublicClient(cfg)

  const versionCount = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getVersionCount',
    args: [id],
  }) as bigint

  if (versionCount === 0n) {
    info(`No versions found for project #${id}`)
    return
  }

  const versions = await Promise.all(
    Array.from({ length: Number(versionCount) }, (_, i) =>
      client.readContract({
        address: addrs.registry,
        abi: REGISTRY_ABI,
        functionName: 'getVersion',
        args: [id, BigInt(i)],
      })
    )
  ) as Array<{
    projectId: bigint; arweaveHash: string; versionTag: string
    changelog: string; pushedBy: string; pushedAt: bigint
  }>

  console.log()
  console.log(`  ${BOLD}Versions for Project #${id}${RESET} (${versionCount} total)`)
  console.log(`  ${'─'.repeat(55)}`)

  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i]!
    console.log(
      `  ${DIM}#${i}${RESET}  ${CYAN}${v.versionTag.padEnd(12)}${RESET}` +
      `  ${DIM}${v.arweaveHash.slice(0, 12)}…${RESET}` +
      `  ${GREEN}${formatDate(v.pushedAt)}${RESET}`
    )
    if (v.changelog) {
      console.log(`       ${DIM}${v.changelog.slice(0, 72)}${v.changelog.length > 72 ? '…' : ''}${RESET}`)
    }
  }
  console.log()
}

// ─── show ────────────────────────────────────────────────────────────────────

export async function cmdVersionShow(args: string[]): Promise<void> {
  const idStr    = requireFlag(args, '--id',  'inkd version show --id 42 --index 0')
  const indexStr = requireFlag(args, '--index', 'inkd version show --id 42 --index 0')

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const client  = buildPublicClient(cfg)
  const version = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getVersion',
    args: [BigInt(idStr), BigInt(indexStr)],
  }) as {
    projectId: bigint; arweaveHash: string; versionTag: string
    changelog: string; pushedBy: string; pushedAt: bigint
  }

  console.log()
  console.log(`  ${BOLD}Version #${indexStr} of Project #${idStr}${RESET}`)
  console.log(`  ${'─'.repeat(42)}`)
  info(`Tag:           ${CYAN}${version.versionTag}${RESET}`)
  info(`Arweave hash:  ${version.arweaveHash}`)
  info(`Pushed by:     ${version.pushedBy}`)
  info(`Pushed at:     ${GREEN}${formatDate(version.pushedAt)}${RESET}`)
  if (version.changelog) {
    info(`Changelog:     ${version.changelog}`)
  }
  console.log()
}
