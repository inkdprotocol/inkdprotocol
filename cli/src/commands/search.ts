/**
 * inkd search — search projects by name or description
 *
 * Usage:
 *   inkd search <query>
 *   inkd search <query> --agents     (only agent projects)
 *   inkd search <query> --limit <n>  (max results, default 20)
 *   inkd search <query> --json       (JSON output)
 *
 * Performs a case-insensitive substring match across name + description fields.
 * Uses parallel batched reads for speed.
 */

import { type Address } from 'viem'
import {
  loadConfig, ADDRESSES,
  error, info, warn,
  BOLD, RESET, CYAN, DIM, GREEN, YELLOW,
} from '../config.js'
import { buildPublicClient } from '../client.js'
import { REGISTRY_ABI } from '../abi.js'

type Project = {
  id: bigint; name: string; description: string; license: string
  readmeHash: string; owner: Address; isPublic: boolean; isAgent: boolean
  agentEndpoint: string; createdAt: bigint; versionCount: bigint; exists: boolean
}

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

function highlight(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    text.slice(0, idx) +
    BOLD + '\x1b[33m' + text.slice(idx, idx + query.length) + RESET +
    text.slice(idx + query.length)
  )
}

export async function cmdSearch(args: string[]): Promise<void> {
  // First non-flag arg is the query
  const query = args.find(a => !a.startsWith('--'))
  if (!query) error('Usage: inkd search <query> [--agents] [--limit <n>] [--json]')

  const agentsOnly = args.includes('--agents')
  const jsonMode   = args.includes('--json')
  const limitStr   = parseFlag(args, '--limit') ?? '20'
  const maxResults = Math.min(parseInt(limitStr, 10), 100)

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured. Deploy contracts first.')

  const client = buildPublicClient(cfg)

  // Get total count
  const projectCount = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'projectCount',
  }) as bigint

  if (projectCount === 0n) {
    info('No projects registered yet.')
    return
  }

  if (!jsonMode) {
    console.log()
    console.log(`  ${BOLD}Search${RESET}: "${CYAN}${query}${RESET}"  ${DIM}(scanning ${projectCount} projects)${RESET}`)
    console.log(`  ${'─'.repeat(50)}`)
  }

  // Batch reads in groups of 20 for speed
  const BATCH = 20
  const results: Project[] = []
  let scanned = 0n

  outer: for (let i = 1n; i <= projectCount; i += BigInt(BATCH)) {
    const batchEnd = i + BigInt(BATCH) - 1n < projectCount ? i + BigInt(BATCH) - 1n : projectCount
    const ids: bigint[] = []
    for (let j = i; j <= batchEnd; j++) ids.push(j)

    const batch = await Promise.all(
      ids.map(id =>
        client.readContract({
          address: addrs.registry,
          abi: REGISTRY_ABI,
          functionName: 'getProject',
          args: [id],
        })
      )
    ) as Project[]

    scanned += BigInt(ids.length)

    for (const p of batch) {
      if (!p.exists) continue
      if (agentsOnly && !p.isAgent) continue

      const nameMatch = p.name.toLowerCase().includes(query.toLowerCase())
      const descMatch = p.description.toLowerCase().includes(query.toLowerCase())
      if (!nameMatch && !descMatch) continue

      results.push(p)
      if (results.length >= maxResults) break outer
    }
  }

  if (!results.length) {
    if (jsonMode) {
      console.log(JSON.stringify({ query, results: [], scanned: scanned.toString() }))
    } else {
      info(`No results for "${query}"`)
      if (agentsOnly) warn('Tip: remove --agents to search all projects.')
      console.log()
    }
    return
  }

  if (jsonMode) {
    const out = results.map(p => ({
      id: p.id.toString(),
      name: p.name,
      description: p.description,
      owner: p.owner,
      isAgent: p.isAgent,
      isPublic: p.isPublic,
      versions: p.versionCount.toString(),
      license: p.license,
      agentEndpoint: p.agentEndpoint || undefined,
      readmeHash: p.readmeHash || undefined,
    }))
    console.log(JSON.stringify({ query, results: out, scanned: scanned.toString() }, null, 2))
    return
  }

  for (const p of results) {
    const agentBadge = p.isAgent ? CYAN + ' [agent]' + RESET : ''
    const visBadge   = p.isPublic ? GREEN + 'public' + RESET : YELLOW + 'private' + RESET

    console.log(
      `\n  ${BOLD}#${p.id}${RESET}  ${CYAN}${highlight(p.name, query)}${RESET}${agentBadge}  ${visBadge}`
    )
    if (p.description) {
      const desc = p.description.length > 80
        ? p.description.slice(0, 80) + '…'
        : p.description
      console.log(`  ${DIM}${highlight(desc, query)}${RESET}`)
    }
    console.log(
      `  ${DIM}owner: ${p.owner.slice(0, 10)}…  ` +
      `versions: ${p.versionCount}  ` +
      `license: ${p.license}${RESET}`
    )
    if (p.agentEndpoint) {
      console.log(`  ${DIM}→ ${p.agentEndpoint}${RESET}`)
    }
  }

  console.log()
  console.log(
    `  ${DIM}Found ${GREEN}${results.length}${DIM} result(s) in ${scanned} scanned projects.` +
    (results.length >= maxResults ? ` Use ${RESET}--limit <n>${DIM} to see more.` : '') +
    RESET
  )
  console.log()
}
