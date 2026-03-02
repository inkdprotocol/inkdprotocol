/**
 * inkd watch — stream on-chain Inkd Protocol events in real-time
 *
 * Sub-commands:
 *   all      — all events (default)
 *   projects — ProjectCreated + ProjectUpdated events only
 *   versions — VersionPushed events only
 *   agents   — agent-related events only
 *
 * Flags:
 *   --poll <ms>    Polling interval in ms (default: 3000)
 *   --from <block> Start block (default: latest - 1000)
 *   --json         Output raw JSON (for piping)
 */

import { type Log, type Hex, formatEther, decodeEventLog, parseAbi } from 'viem'
import {
  loadConfig, ADDRESSES,
  error, info, success,
  BOLD, RESET, CYAN, DIM, GREEN, YELLOW,
} from '../config.js'
import { buildPublicClient } from '../client.js'

// ─── Event signatures ─────────────────────────────────────────────────────────

const WATCH_ABI = parseAbi([
  'event ProjectCreated(uint256 indexed projectId, address indexed owner, string name, bool isAgent)',
  'event VersionPushed(uint256 indexed projectId, uint256 indexed versionIndex, string arweaveHash, string versionTag)',
  'event ProjectTransferred(uint256 indexed projectId, address indexed from, address indexed to)',
  'event CollaboratorAdded(uint256 indexed projectId, address indexed collaborator)',
  'event CollaboratorRemoved(uint256 indexed projectId, address indexed collaborator)',
  'event VisibilityChanged(uint256 indexed projectId, bool isPublic)',
  'event ReadmeUpdated(uint256 indexed projectId, string arweaveHash)',
  'event AgentEndpointUpdated(uint256 indexed projectId, string endpoint)',
])

type WatchFilter = 'all' | 'projects' | 'versions' | 'agents'

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

function formatTs(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function renderEvent(log: Log, jsonMode: boolean): void {
  try {
    const decoded = decodeEventLog({ abi: WATCH_ABI, data: log.data, topics: log.topics as [Hex, ...Hex[]] })
    const name = decoded.eventName
    const args = decoded.args as Record<string, unknown>

    if (jsonMode) {
      console.log(JSON.stringify({
        event: name,
        block: log.blockNumber?.toString(),
        tx: log.transactionHash,
        args: Object.fromEntries(
          Object.entries(args).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])
        ),
        timestamp: formatTs(),
      }))
      return
    }

    const ts = DIM + formatTs() + RESET
    const block = DIM + `#${log.blockNumber}` + RESET

    switch (name) {
      case 'ProjectCreated': {
        const badge = args['isAgent'] ? CYAN + ' [agent]' + RESET : ''
        console.log(`${ts}  ${GREEN}✦ ProjectCreated${RESET}${badge}  ${block}`)
        console.log(`    id=${CYAN}${args['projectId']}${RESET}  owner=${DIM}${String(args['owner']).slice(0, 10)}…${RESET}  name=${BOLD}${args['name']}${RESET}`)
        break
      }
      case 'VersionPushed':
        console.log(`${ts}  ${CYAN}↑ VersionPushed${RESET}  ${block}`)
        console.log(`    project=${CYAN}#${args['projectId']}${RESET}  tag=${BOLD}${args['versionTag']}${RESET}  hash=${DIM}ar://${String(args['arweaveHash']).slice(0, 12)}…${RESET}`)
        break
      case 'ProjectTransferred':
        console.log(`${ts}  ${YELLOW}⇄ ProjectTransferred${RESET}  ${block}`)
        console.log(`    project=${CYAN}#${args['projectId']}${RESET}  from=${DIM}${String(args['from']).slice(0, 10)}…${RESET}  to=${String(args['to']).slice(0, 10)}…`)
        break
      case 'CollaboratorAdded':
        console.log(`${ts}  ${GREEN}+ CollaboratorAdded${RESET}  ${block}  project=${CYAN}#${args['projectId']}${RESET}  ${DIM}${String(args['collaborator']).slice(0, 10)}…${RESET}`)
        break
      case 'CollaboratorRemoved':
        console.log(`${ts}  ${YELLOW}- CollaboratorRemoved${RESET}  ${block}  project=${CYAN}#${args['projectId']}${RESET}  ${DIM}${String(args['collaborator']).slice(0, 10)}…${RESET}`)
        break
      case 'VisibilityChanged':
        console.log(`${ts}  ${CYAN}◎ VisibilityChanged${RESET}  ${block}  project=${CYAN}#${args['projectId']}${RESET}  public=${args['isPublic'] ? GREEN + 'true' : YELLOW + 'false'}${RESET}`)
        break
      case 'ReadmeUpdated':
        console.log(`${ts}  ${DIM}📄 ReadmeUpdated${RESET}  project=${CYAN}#${args['projectId']}${RESET}  hash=${DIM}ar://${String(args['arweaveHash']).slice(0, 12)}…${RESET}`)
        break
      case 'AgentEndpointUpdated':
        console.log(`${ts}  ${CYAN}⚡ AgentEndpointUpdated${RESET}  project=${CYAN}#${args['projectId']}${RESET}  endpoint=${args['endpoint']}`)
        break
      default:
        console.log(`${ts}  ${name}  ${block}  ${DIM}${JSON.stringify(args)}${RESET}`)
    }
  } catch {
    // unknown log — show raw
    if (jsonMode) {
      console.log(JSON.stringify({ raw: log.transactionHash, block: log.blockNumber?.toString() }))
    }
  }
}

// ─── Determine which events to include ───────────────────────────────────────

const FILTER_MAP: Record<WatchFilter, string[]> = {
  all:      ['ProjectCreated', 'VersionPushed', 'ProjectTransferred', 'CollaboratorAdded', 'CollaboratorRemoved', 'VisibilityChanged', 'ReadmeUpdated', 'AgentEndpointUpdated'],
  projects: ['ProjectCreated', 'ProjectTransferred', 'VisibilityChanged', 'ReadmeUpdated'],
  versions: ['VersionPushed'],
  agents:   ['ProjectCreated', 'AgentEndpointUpdated'],
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function cmdWatch(args: string[]): Promise<void> {
  const filterArg = (args[0] && !args[0].startsWith('--') ? args[0] : 'all') as WatchFilter
  if (!FILTER_MAP[filterArg]) {
    error(`Unknown filter "${filterArg}". Use: all | projects | versions | agents`)
  }

  const pollMs   = parseInt(parseFlag(args, '--poll') ?? '3000', 10)
  const fromArg  = parseFlag(args, '--from')
  const jsonMode = args.includes('--json')

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured. Deploy contracts first.')

  const client = buildPublicClient(cfg)

  // Determine starting block
  let fromBlock: bigint
  if (fromArg) {
    fromBlock = BigInt(fromArg)
  } else {
    const latest = await client.getBlockNumber()
    fromBlock = latest > 1000n ? latest - 1000n : 0n
  }

  if (!jsonMode) {
    console.log()
    console.log(`  ${BOLD}Inkd Protocol — Live Event Feed${RESET}`)
    console.log(`  ${'─'.repeat(50)}`)
    info(`Network:  ${CYAN}${cfg.network}${RESET}`)
    info(`Registry: ${DIM}${addrs.registry}${RESET}`)
    info(`Filter:   ${CYAN}${filterArg}${RESET}  (${FILTER_MAP[filterArg].join(', ')})`)
    info(`Polling:  every ${pollMs}ms`)
    info(`From:     block #${fromBlock}`)
    console.log()
    console.log(`  ${DIM}Watching… (Ctrl+C to stop)${RESET}`)
    console.log()
  }

  let lastBlock = fromBlock
  let seenCount = 0

  while (true) {
    try {
      const currentBlock = await client.getBlockNumber()
      if (currentBlock > lastBlock) {
        const logs = await client.getLogs({
          address: addrs.registry as Hex,
          fromBlock: lastBlock + 1n,
          toBlock: currentBlock,
        })

        for (const log of logs) {
          // Attempt to decode and filter by event name
          try {
            const decoded = decodeEventLog({ abi: WATCH_ABI, data: log.data, topics: log.topics as [Hex, ...Hex[]] })
            if (FILTER_MAP[filterArg].includes(decoded.eventName)) {
              renderEvent(log, jsonMode)
              seenCount++
            }
          } catch {
            // not one of our events
          }
        }

        lastBlock = currentBlock
      }
    } catch (e) {
      if (!jsonMode) {
        console.error(`${DIM}[${formatTs()}] Poll error: ${(e as Error).message}${RESET}`)
      }
    }

    await new Promise(r => setTimeout(r, pollMs))
  }
}
