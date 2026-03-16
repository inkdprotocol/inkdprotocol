/**
 * inkd project <sub-command> — project management (x402 payment flow)
 *
 * Sub-commands:
 *   create   — register a new project ($5 USDC via x402)
 *   get      — fetch project details by ID
 *   list     — list projects owned by an address
 */

import { isAddress, createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia }   from 'viem/chains'
import { ProjectsClient }      from '@inkd/sdk'
import {
  loadConfig, requirePrivateKey,
  error, success, info,
  BOLD, RESET, CYAN, DIM, GREEN, YELLOW,
} from '../config.js'
import { buildPublicClient } from '../client.js'
import { REGISTRY_ABI } from '../abi.js'
import { ADDRESSES } from '../config.js'

const API_URL = process.env['INKD_API_URL'] ?? 'https://api.inkdprotocol.com'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

function requireFlag(args: string[], flag: string, hint: string): string {
  const val = parseFlag(args, flag)
  if (!val) error(`Missing required flag ${BOLD}${flag}${RESET}\n  Example: ${DIM}${hint}${RESET}`)
  return val!
}

function formatDate(ts: number | bigint): string {
  return new Date(Number(ts) * 1000).toISOString().slice(0, 10)
}

function buildPayingClients(cfg: ReturnType<typeof loadConfig>) {
  const key     = requirePrivateKey(cfg)
  const account = privateKeyToAccount(key)
  const chain   = cfg.network === 'mainnet' ? base : baseSepolia
  const rpcUrl  = cfg.rpcUrl ?? (cfg.network === 'mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org')

  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const reader = createPublicClient({ chain, transport: http(rpcUrl) })

  return { wallet, reader, account }
}

// ─── create ──────────────────────────────────────────────────────────────────

export async function cmdProjectCreate(args: string[]): Promise<void> {
  const name          = requireFlag(args, '--name',        'inkd project create --name my-agent')
  const description   = parseFlag(args, '--description') ?? ''
  const license       = parseFlag(args, '--license')     ?? 'MIT'
  const readmeHash    = parseFlag(args, '--readme')      ?? ''
  const agentEndpoint = parseFlag(args, '--endpoint')    ?? ''
  const isPublic      = !args.includes('--private')
  const isAgent       = args.includes('--agent')

  const cfg = loadConfig()
  const { wallet, reader } = buildPayingClients(cfg)

  info(`Creating project ${CYAN}${name}${RESET} via x402...`)
  info(`  Paying $5.00 USDC from ${DIM}${wallet.account.address}${RESET}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new ProjectsClient({ wallet: wallet as any, publicClient: reader as any, apiUrl: API_URL })

  let result: Awaited<ReturnType<typeof client.createProject>>
  try {
    result = await client.createProject({
      name, description, license, isPublic, readmeHash, isAgent, agentEndpoint,
    })
  } catch (err) {
    error(err instanceof Error ? err.message : String(err))
  }

  success(`Project ${BOLD}${name}${RESET} created!`)
  info(`  Project ID: ${CYAN}${result!.projectId}${RESET}`)
  info(`  Owner:      ${result!.owner}`)
  info(`  TX:         ${DIM}${result!.txHash}${RESET}`)
  info(`  Basescan:   https://basescan.org/tx/${result!.txHash}`)
  console.log()
}

// ─── get ─────────────────────────────────────────────────────────────────────

export async function cmdProjectGet(args: string[]): Promise<void> {
  const idStr = args[0] ?? requireFlag(args, '--id', 'inkd project get 42')
  const id    = parseInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd project get --id 42') : idStr, 10)

  const cfg    = loadConfig()
  const addrs  = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured. Deploy contracts first.')

  const client   = buildPublicClient(cfg)
  const project  = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getProject',
    args: [BigInt(id)],
  }) as {
    id: bigint; name: string; description: string; license: string
    readmeHash: string; owner: string; isPublic: boolean; isAgent: boolean
    agentEndpoint: string; createdAt: bigint; versionCount: bigint; exists: boolean
  }

  if (!project.exists) error(`Project #${id} not found.`)

  const collaborators = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getCollaborators',
    args: [BigInt(id)],
  }) as string[]

  console.log()
  console.log(`  ${BOLD}Project #${project.id}${RESET}  ${project.isAgent ? CYAN + '[agent]' + RESET : ''}`)
  console.log(`  ${'─'.repeat(42)}`)
  info(`Name:          ${CYAN}${project.name}${RESET}`)
  info(`Description:   ${project.description || DIM + 'none' + RESET}`)
  info(`License:       ${project.license}`)
  info(`Owner:         ${project.owner}`)
  info(`Created:       ${formatDate(project.createdAt)}`)
  info(`Versions:      ${GREEN}${project.versionCount}${RESET}`)
  info(`Visibility:    ${project.isPublic ? GREEN + 'public' : YELLOW + 'private'}${RESET}`)
  if (project.readmeHash)    info(`README hash:   ${DIM}${project.readmeHash}${RESET}`)
  if (project.agentEndpoint) info(`Agent endpoint: ${project.agentEndpoint}`)
  if (collaborators.length)  info(`Collaborators: ${collaborators.join(', ')}`)
  console.log()
}

// ─── list ────────────────────────────────────────────────────────────────────

export async function cmdProjectList(args: string[]): Promise<void> {
  const addressArg = args[0]
  if (!addressArg || !isAddress(addressArg)) {
    error('Usage: inkd project list <address>\n  Example: inkd project list 0xDead...')
  }

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const client     = buildPublicClient(cfg)
  const projectIds = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getOwnerProjects',
    args: [addressArg as `0x${string}`],
  }) as bigint[]

  if (!projectIds.length) { info(`No projects found for ${addressArg}`); return }

  console.log()
  console.log(`  ${BOLD}Projects owned by ${DIM}${addressArg}${RESET}`)
  console.log(`  ${'─'.repeat(50)}`)

  const projects = await Promise.all(
    projectIds.map(id => client.readContract({
      address: addrs.registry, abi: REGISTRY_ABI, functionName: 'getProject', args: [id],
    }))
  ) as Array<{ id: bigint; name: string; isAgent: boolean; isPublic: boolean; versionCount: bigint; createdAt: bigint }>

  for (const p of projects) {
    const badges = [
      p.isAgent  ? CYAN + 'agent'   + RESET : '',
      p.isPublic ? GREEN + 'public' + RESET : YELLOW + 'private' + RESET,
    ].filter(Boolean).join(' ')
    console.log(
      `  ${BOLD}#${p.id}${RESET}  ${CYAN}${p.name.padEnd(24)}${RESET}` +
      `  v${p.versionCount}  ${badges}  ${DIM}${formatDate(p.createdAt)}${RESET}`
    )
  }
  console.log()
}

// ─── fork ────────────────────────────────────────────────────────────────────

export async function cmdProjectFork(args: string[]): Promise<void> {
  const cfg     = loadConfig()
  const idStr   = parseFlag(args, '--id') ?? args.find(a => /^\d+$/.test(a))
  const name    = requireFlag(args, '--name', 'inkd project fork --id 42 --name my-fork')

  if (!idStr) error(`Missing project ID\n  Example: ${DIM}inkd project fork --id 42 --name my-fork${RESET}`)
  const forkOfId = parseInt(idStr!, 10)

  // Fetch source project
  const sourceRes = await fetch(`${API_URL}/v1/projects/${forkOfId}`)
  if (!sourceRes.ok) error(`Project #${forkOfId} not found`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const source = (await sourceRes.json() as any).data

  info(`Forking ${BOLD}${source.name}${RESET} (${forkOfId}) → ${CYAN}${name}${RESET}`)

  const description = parseFlag(args, '--description') ?? `Fork of ${source.name}`
  const isPublic    = !args.includes('--private')
  const isAgent     = args.includes('--agent') || source.isAgent

  const { wallet, reader } = buildPayingClients(cfg)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new ProjectsClient({ wallet: wallet as any, publicClient: reader as any, apiUrl: API_URL })

  const result = await client.createProject({
    name,
    description,
    license:       source.license ?? 'MIT',
    isPublic,
    isAgent,
    agentEndpoint: source.agentEndpoint ?? '',
    forkOf:        forkOfId,
  })

  success(`Forked! New project ID: ${BOLD}${result.projectId}${RESET}`)
  console.log(`  ${DIM}Fork lineage recorded on-chain: ${forkOfId} → ${result.projectId}${RESET}`)
  console.log()
  info(`Push your changes:  ${DIM}inkd version push --id ${result.projectId} --file ./agent.json --tag v1.0.0${RESET}`)
}
