/**
 * inkd agent <sub-command> — AI agent project directory
 *
 * Sub-commands:
 *   list    — paginated list of registered agent projects
 *   lookup  — find agent by name
 */

import {
  loadConfig, ADDRESSES,
  error, info,
  BOLD, RESET, CYAN, DIM, GREEN, YELLOW,
} from '../config.js'
import { buildPublicClient } from '../client.js'
import { REGISTRY_ABI } from '../abi.js'
import type { Address } from 'viem'

type Project = {
  id: bigint; name: string; description: string; license: string
  readmeHash: string; owner: Address; isPublic: boolean; isAgent: boolean
  agentEndpoint: string; createdAt: bigint; versionCount: bigint; exists: boolean
}

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

// ─── list ────────────────────────────────────────────────────────────────────

export async function cmdAgentList(args: string[]): Promise<void> {
  const offsetStr = parseFlag(args, '--offset') ?? '0'
  const limitStr  = parseFlag(args, '--limit')  ?? '25'
  const offset    = BigInt(offsetStr)
  const limit     = BigInt(limitStr)

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) {
    info('Registry not deployed yet. Check back after mainnet launch.')
    return
  }

  const client   = buildPublicClient(cfg)
  const projects = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getAgentProjects',
    args: [offset, limit],
  }) as Project[]

  if (!projects.length) {
    info('No agent projects found.')
    return
  }

  console.log()
  console.log(`  ${BOLD}Agent Directory${RESET}  (offset: ${offset}, limit: ${limit})`)
  console.log(`  ${'─'.repeat(60)}`)

  for (const p of projects) {
    const vis = p.isPublic ? GREEN + '●' + RESET : YELLOW + '○' + RESET
    console.log(
      `  ${vis}  ${BOLD}#${p.id}${RESET}  ${CYAN}${p.name.padEnd(22)}${RESET}` +
      `  v${p.versionCount}  ${DIM}${p.owner.slice(0, 10)}…${RESET}`
    )
    if (p.description) {
      console.log(`       ${DIM}${p.description.slice(0, 70)}${p.description.length > 70 ? '…' : ''}${RESET}`)
    }
    if (p.agentEndpoint) {
      console.log(`       ${DIM}→ ${p.agentEndpoint}${RESET}`)
    }
  }

  if (projects.length === Number(limit)) {
    console.log()
    info(`Showing ${limit} results. Use ${DIM}--offset ${offset + limit} --limit ${limit}${RESET} for next page.`)
  }

  console.log()
}

// ─── lookup ──────────────────────────────────────────────────────────────────

export async function cmdAgentLookup(args: string[]): Promise<void> {
  const name = args[0]
  if (!name) error('Usage: inkd agent lookup <name>')

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) {
    info('Registry not deployed yet.')
    return
  }

  // Scan through projects to find by name (linear scan — acceptable for CLI)
  const client       = buildPublicClient(cfg)
  const projectCount = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'projectCount',
  }) as bigint

  const target = name.toLowerCase()

  for (let i = 1n; i <= projectCount; i++) {
    const p = await client.readContract({
      address: addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'getProject',
      args: [i],
    }) as Project

    if (p.name.toLowerCase() === target) {
      console.log()
      console.log(`  ${BOLD}Agent: ${CYAN}${p.name}${RESET}  (#${p.id})`)
      console.log(`  ${'─'.repeat(42)}`)
      info(`Owner:     ${p.owner}`)
      info(`Endpoint:  ${p.agentEndpoint || DIM + 'none' + RESET}`)
      info(`Versions:  ${GREEN}${p.versionCount}${RESET}`)
      info(`License:   ${p.license}`)
      if (p.description) info(`Desc:      ${p.description}`)
      if (p.readmeHash)   info(`README:    ${DIM}ar://${p.readmeHash}${RESET}`)
      console.log()
      return
    }
  }

  error(`Agent project "${name}" not found.`)
}
