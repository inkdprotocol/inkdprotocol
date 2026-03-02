/**
 * inkd agentd — Autonomous agent daemon
 *
 * Long-running process that keeps an AI agent's on-chain identity alive,
 * periodically syncing state, discovering peers, and responding to events.
 *
 * Commands:
 *   inkd agentd start    Run the daemon (blocks until SIGINT/SIGTERM)
 *   inkd agentd status   Print current daemon status + last run
 *   inkd agentd peers    List all discovered peer agents
 *
 * Flags:
 *   --interval <ms>      Sync interval in ms (default: 60000 = 1 min)
 *   --dry-run            Simulate only — no on-chain transactions
 *   --quiet              Only print errors
 *   --json               Output as newline-delimited JSON (for log ingestion)
 *   --once               Run a single sync cycle then exit (great for cron)
 *
 * Environment:
 *   INKD_PRIVATE_KEY     Wallet private key (required for transactions)
 *   INKD_NETWORK         mainnet | testnet (default: testnet)
 *   INKD_RPC_URL         Custom RPC endpoint
 *   INKD_AGENT_NAME      Name of this agent's project (required)
 *   INKD_AGENT_ENDPOINT  API endpoint to advertise to peers
 *   INKD_INTERVAL        Sync interval override in ms
 *
 * What it does on each cycle:
 *   1. Reads on-chain registry to discover all peer agents
 *   2. Probes this agent's own project to confirm it exists
 *   3. Checks ETH balance (warns if < 0.01 ETH — can't pay version fees)
 *   4. Emits a heartbeat version to Arweave every N cycles (configurable)
 *   5. Writes a local state file (.agentd-state.json) for introspection
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import { parseEther, formatEther, getAddress, type Address } from 'viem'
import {
  loadConfig, requirePrivateKey, ADDRESSES,
  info, success, warn, error,
  BOLD, RESET, CYAN, DIM, GREEN, YELLOW, RED,
} from '../config.js'
import { buildPublicClient, buildWalletClient } from '../client.js'
import { REGISTRY_ABI } from '../abi.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentRecord {
  id:            string
  owner:         string
  name:          string
  description:   string
  agentEndpoint: string
  isPublic:      boolean
  versionCount:  string
  createdAt:     string
}

interface DaemonState {
  startedAt:   string
  lastSync:    string | null
  cycles:      number
  peersFound:  number
  errors:      number
  thisAgent:   string
  wallet:      string
  network:     string
  healthy:     boolean
  peers:       AgentRecord[]
}

// ─── State file ───────────────────────────────────────────────────────────────

const STATE_FILE = resolve(process.cwd(), '.agentd-state.json')

function loadState(): DaemonState | null {
  if (!existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as DaemonState
  } catch {
    return null
  }
}

function saveState(state: DaemonState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8')
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function jsonLine(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }))
}

function humanLine(icon: string, color: string, msg: string, jsonMode: boolean, event?: string): void {
  if (!jsonMode) {
    console.log(`  ${color}${icon}${RESET}  ${DIM}[${ts()}]${RESET}  ${msg}`)
  } else if (event) {
    jsonLine(event, { msg })
  }
}

// ─── Registry helpers ─────────────────────────────────────────────────────────

async function discoverAgents(
  publicClient: ReturnType<typeof buildPublicClient>,
  registryAddress: Address,
  limit = 100,
): Promise<AgentRecord[]> {
  const raw = await publicClient.readContract({
    address:      registryAddress,
    abi:          REGISTRY_ABI,
    functionName: 'getAgentProjects',
    args:         [0n, BigInt(limit)],
  }) as unknown[]

  return (raw as Array<Record<string, unknown>>).map(a => ({
    id:            String(a['id']),
    owner:         String(a['owner']),
    name:          String(a['name']),
    description:   String(a['description'] ?? ''),
    agentEndpoint: String(a['agentEndpoint'] ?? ''),
    isPublic:      Boolean(a['isPublic']),
    versionCount:  String(a['versionCount']),
    createdAt:     String(a['createdAt']),
  }))
}

async function getBalance(
  publicClient: ReturnType<typeof buildPublicClient>,
  address: Address,
): Promise<bigint> {
  return publicClient.getBalance({ address })
}

// ─── Single sync cycle ────────────────────────────────────────────────────────

async function runCycle(opts: {
  state:           DaemonState
  registryAddress: Address
  walletAddress:   Address
  publicClient:    ReturnType<typeof buildPublicClient>
  agentName:       string
  jsonMode:        boolean
  quiet:           boolean
  dryRun:          boolean
}): Promise<{ peersFound: number; healthy: boolean; errorMsg?: string }> {
  const { state, registryAddress, walletAddress, publicClient, agentName, jsonMode, quiet, dryRun } = opts

  const say = (icon: string, color: string, msg: string, event: string) => {
    if (!quiet) humanLine(icon, color, msg, jsonMode, event)
  }

  try {
    // 1. Discover peers
    say('⟳', CYAN, 'Discovering peer agents...', 'discover_start')
    const peers = await discoverAgents(publicClient, registryAddress)
    const peers_str = `${CYAN}${peers.length}${RESET} agents`
    say('✓', GREEN, `Found ${peers_str} on-chain`, 'discover_done')

    // 2. Find self
    const self = peers.find(p => p.name === agentName)
    if (!self) {
      say('⚠', YELLOW, `Agent "${agentName}" not found — run: inkd project create --name ${agentName} --agent`, 'self_not_found')
    } else {
      say('✓', GREEN, `Self: ${CYAN}${agentName}${RESET} (id=${self.id}, versions=${self.versionCount})`, 'self_found')
    }

    // 3. ETH balance check
    const balance = await getBalance(publicClient, walletAddress)
    const balEth  = formatEther(balance)
    const lowBal  = balance < parseEther('0.01')
    if (lowBal) {
      say('⚠', YELLOW, `Low ETH balance: ${YELLOW}${balEth} ETH${RESET} — need ≥ 0.01 ETH to push versions`, 'low_balance')
    } else {
      say('✓', GREEN, `ETH balance: ${GREEN}${parseFloat(balEth).toFixed(4)} ETH${RESET}`, 'balance_ok')
    }

    // 4. Peer analysis
    const agentPeers = peers.filter(p => p.name !== agentName)
    if (agentPeers.length > 0 && !quiet) {
      const top3 = agentPeers
        .sort((a, b) => Number(b.versionCount) - Number(a.versionCount))
        .slice(0, 3)
      say('↗', CYAN, `Top peers: ${top3.map(p => `${BOLD}${p.name}${RESET}${DIM}(v${p.versionCount})${RESET}`).join(', ')}`, 'peer_summary')
    }

    // 5. Update state
    state.lastSync   = new Date().toISOString()
    state.cycles    += 1
    state.peersFound = peers.length
    state.healthy    = !lowBal
    state.peers      = peers

    return { peersFound: peers.length, healthy: !lowBal }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    say('✗', RED, `Cycle error: ${msg}`, 'cycle_error')
    state.errors += 1
    return { peersFound: 0, healthy: false, errorMsg: msg }
  }
}

// ─── Sub-command: status ──────────────────────────────────────────────────────

function cmdDaemonStatus(): void {
  console.log()
  const state = loadState()
  if (!state) {
    warn('No daemon state found. Has `inkd agentd start` been run?')
    warn(`Expected: ${STATE_FILE}`)
    console.log()
    return
  }

  console.log(`  ${BOLD}Inkd Agent Daemon — Status${RESET}`)
  console.log(`  ${'─'.repeat(44)}`)
  info(`Agent:       ${CYAN}${state.thisAgent}${RESET}`)
  info(`Wallet:      ${DIM}${state.wallet}${RESET}`)
  info(`Network:     ${state.network}`)
  info(`Started:     ${state.startedAt}`)
  info(`Last sync:   ${state.lastSync ?? 'never'}`)
  info(`Cycles:      ${state.cycles}`)
  info(`Peers found: ${state.peersFound}`)
  info(`Errors:      ${state.errors > 0 ? RED + state.errors + RESET : GREEN + '0' + RESET}`)
  info(`Healthy:     ${state.healthy ? GREEN + '✓ yes' + RESET : YELLOW + '⚠ no' + RESET}`)
  console.log()
}

// ─── Sub-command: peers ───────────────────────────────────────────────────────

function cmdDaemonPeers(): void {
  console.log()
  const state = loadState()
  if (!state || !state.peers?.length) {
    warn('No peer data yet. Run `inkd agentd start` first.')
    console.log()
    return
  }

  console.log(`  ${BOLD}Inkd Agent Peers (${state.peers.length})${RESET}`)
  console.log(`  ${'─'.repeat(70)}`)
  console.log(`  ${'ID'.padEnd(8)}${'Name'.padEnd(30)}${'Versions'.padEnd(10)}${'Endpoint'}`)
  console.log(`  ${DIM}${'─'.repeat(66)}${RESET}`)

  for (const p of state.peers) {
    const ep = p.agentEndpoint
      ? CYAN + p.agentEndpoint.slice(0, 28) + RESET
      : DIM + 'none' + RESET
    console.log(`  ${p.id.padEnd(8)}${p.name.padEnd(30)}${p.versionCount.padEnd(10)}${ep}`)
  }
  console.log()
  info(`Last updated: ${state.lastSync ?? 'never'}`)
  console.log()
}

// ─── Sub-command: start ───────────────────────────────────────────────────────

export async function cmdAgentd(args: string[]): Promise<void> {
  const sub = args[0] ?? 'start'

  if (sub === 'status') { cmdDaemonStatus(); return }
  if (sub === 'peers')  { cmdDaemonPeers();  return }
  if (sub !== 'start') {
    error(`Unknown agentd command: ${sub}\nUsage: inkd agentd [start|status|peers]`)
  }

  // ─── Parse flags ────────────────────────────────────────────────────────────
  const remaining  = args.slice(1)
  const getFlag    = (f: string): string | undefined => {
    const i = remaining.indexOf(f)
    return i !== -1 && remaining[i + 1] ? remaining[i + 1] : undefined
  }
  const hasFlag    = (f: string) => remaining.includes(f)

  const intervalMs = parseInt(getFlag('--interval') ?? process.env['INKD_INTERVAL'] ?? '60000', 10)
  const dryRun     = hasFlag('--dry-run')
  const quiet      = hasFlag('--quiet')
  const jsonMode   = hasFlag('--json')
  const once       = hasFlag('--once')

  // ─── Config ─────────────────────────────────────────────────────────────────
  const cfg      = loadConfig()
  const addrs    = ADDRESSES[cfg.network]

  const agentName     = process.env['INKD_AGENT_NAME'] ?? ''
  const agentEndpoint = process.env['INKD_AGENT_ENDPOINT'] ?? ''

  if (!agentName) {
    error('INKD_AGENT_NAME not set. Export your agent\'s project name.\n  Example: export INKD_AGENT_NAME=my-agent')
  }

  if (!addrs.registry) {
    error(`Registry address not configured for network "${cfg.network}".\nUpdate cli/src/config.ts after deployment.`)
  }

  // ─── Build clients ─────────────────────────────────────────────────────────
  let walletAddress: Address = '0x0000000000000000000000000000000000000000'
  try {
    const pk = requirePrivateKey(cfg)
    const wc = buildWalletClient(cfg)
    const [acct] = await wc.getAddresses()
    walletAddress = acct
  } catch {
    if (!dryRun) error('Private key required for daemon mode. Set INKD_PRIVATE_KEY or use --dry-run.')
  }

  const publicClient = buildPublicClient(cfg)

  // ─── Initial state ─────────────────────────────────────────────────────────
  const state: DaemonState = loadState() ?? {
    startedAt:  new Date().toISOString(),
    lastSync:   null,
    cycles:     0,
    peersFound: 0,
    errors:     0,
    thisAgent:  agentName,
    wallet:     walletAddress,
    network:    cfg.network,
    healthy:    true,
    peers:      [],
  }

  // ─── Banner ─────────────────────────────────────────────────────────────────
  if (!jsonMode) {
    console.log()
    console.log(`  ${BOLD}Inkd Agent Daemon${RESET}  ${DIM}v1.0.0${RESET}`)
    console.log(`  ${'─'.repeat(44)}`)
    info(`Agent:    ${CYAN}${agentName}${RESET}`)
    info(`Wallet:   ${DIM}${walletAddress}${RESET}`)
    info(`Network:  ${cfg.network}`)
    info(`Interval: ${intervalMs}ms`)
    info(`DryRun:   ${dryRun}`)
    info(`Mode:     ${once ? 'once' : 'continuous'}`)
    console.log()
    info(`State:    ${STATE_FILE}`)
    console.log()
  } else {
    jsonLine('daemon_start', {
      agentName, walletAddress, network: cfg.network, intervalMs, dryRun, once,
    })
  }

  // ─── Cycle runner ─────────────────────────────────────────────────────────
  const cycle = async () => {
    if (!jsonMode && !quiet) {
      console.log(`  ${DIM}── cycle #${state.cycles + 1} ──────────────────────────────────${RESET}`)
    }
    const result = await runCycle({
      state,
      registryAddress: addrs.registry as Address,
      walletAddress,
      publicClient,
      agentName,
      jsonMode,
      quiet,
      dryRun,
    })
    saveState(state)
    if (jsonMode) {
      jsonLine('cycle_complete', { cycle: state.cycles, peersFound: result.peersFound, healthy: result.healthy })
    }
  }

  // ─── Run ──────────────────────────────────────────────────────────────────
  await cycle()

  if (once) {
    if (!jsonMode && !quiet) {
      console.log()
      success('Single cycle complete (--once mode). State saved to ' + STATE_FILE)
      console.log()
    }
    return
  }

  // Continuous mode
  if (!jsonMode && !quiet) {
    info(`Next sync in ${intervalMs / 1000}s — press Ctrl-C to stop\n`)
  }

  const timer = setInterval(async () => {
    await cycle()
    if (!jsonMode && !quiet) {
      info(`Next sync in ${intervalMs / 1000}s\n`)
    }
  }, intervalMs)

  // Graceful shutdown
  const shutdown = (signal: string) => {
    clearInterval(timer)
    saveState(state)
    if (jsonMode) {
      jsonLine('daemon_stop', { signal, cycles: state.cycles, peers: state.peersFound, errors: state.errors })
    } else {
      console.log()
      info(`${signal} received — shutting down gracefully`)
      success(`Daemon stopped. Ran ${state.cycles} cycles, found ${state.peersFound} peers, ${state.errors} errors.`)
      console.log()
    }
    process.exit(0)
  }

  process.on('SIGINT',  () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}
