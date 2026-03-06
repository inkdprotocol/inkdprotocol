"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdAgentd = cmdAgentd;
const fs_1 = require("fs");
const path_1 = require("path");
const viem_1 = require("viem");
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
// ─── State file ───────────────────────────────────────────────────────────────
const STATE_FILE = (0, path_1.resolve)(process.cwd(), '.agentd-state.json');
function loadState() {
    if (!(0, fs_1.existsSync)(STATE_FILE))
        return null;
    try {
        return JSON.parse((0, fs_1.readFileSync)(STATE_FILE, 'utf-8'));
    }
    catch {
        return null;
    }
}
function saveState(state) {
    (0, fs_1.writeFileSync)(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}
// ─── Display helpers ──────────────────────────────────────────────────────────
function ts() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
function jsonLine(event, data) {
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }));
}
function humanLine(icon, color, msg, jsonMode, event) {
    if (!jsonMode) {
        console.log(`  ${color}${icon}${config_js_1.RESET}  ${config_js_1.DIM}[${ts()}]${config_js_1.RESET}  ${msg}`);
    }
    else if (event) {
        jsonLine(event, { msg });
    }
}
// ─── Registry helpers ─────────────────────────────────────────────────────────
async function discoverAgents(publicClient, registryAddress, limit = 100) {
    const raw = await publicClient.readContract({
        address: registryAddress,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getAgentProjects',
        args: [0n, BigInt(limit)],
    });
    return raw.map(a => ({
        id: String(a['id']),
        owner: String(a['owner']),
        name: String(a['name']),
        description: String(a['description'] ?? ''),
        agentEndpoint: String(a['agentEndpoint'] ?? ''),
        isPublic: Boolean(a['isPublic']),
        versionCount: String(a['versionCount']),
        createdAt: String(a['createdAt']),
    }));
}
async function getBalance(publicClient, address) {
    return publicClient.getBalance({ address });
}
// ─── Single sync cycle ────────────────────────────────────────────────────────
async function runCycle(opts) {
    const { state, registryAddress, walletAddress, publicClient, agentName, jsonMode, quiet, dryRun } = opts;
    const say = (icon, color, msg, event) => {
        if (!quiet)
            humanLine(icon, color, msg, jsonMode, event);
    };
    try {
        // 1. Discover peers
        say('⟳', config_js_1.CYAN, 'Discovering peer agents...', 'discover_start');
        const peers = await discoverAgents(publicClient, registryAddress);
        const peers_str = `${config_js_1.CYAN}${peers.length}${config_js_1.RESET} agents`;
        say('✓', config_js_1.GREEN, `Found ${peers_str} on-chain`, 'discover_done');
        // 2. Find self
        const self = peers.find(p => p.name === agentName);
        if (!self) {
            say('⚠', config_js_1.YELLOW, `Agent "${agentName}" not found — run: inkd project create --name ${agentName} --agent`, 'self_not_found');
        }
        else {
            say('✓', config_js_1.GREEN, `Self: ${config_js_1.CYAN}${agentName}${config_js_1.RESET} (id=${self.id}, versions=${self.versionCount})`, 'self_found');
        }
        // 3. ETH balance check
        const balance = await getBalance(publicClient, walletAddress);
        const balEth = (0, viem_1.formatEther)(balance);
        const lowBal = balance < (0, viem_1.parseEther)('0.01');
        if (lowBal) {
            say('⚠', config_js_1.YELLOW, `Low ETH balance: ${config_js_1.YELLOW}${balEth} ETH${config_js_1.RESET} — need ≥ 0.01 ETH to push versions`, 'low_balance');
        }
        else {
            say('✓', config_js_1.GREEN, `ETH balance: ${config_js_1.GREEN}${parseFloat(balEth).toFixed(4)} ETH${config_js_1.RESET}`, 'balance_ok');
        }
        // 4. Peer analysis
        const agentPeers = peers.filter(p => p.name !== agentName);
        if (agentPeers.length > 0 && !quiet) {
            const top3 = agentPeers
                .sort((a, b) => Number(b.versionCount) - Number(a.versionCount))
                .slice(0, 3);
            say('↗', config_js_1.CYAN, `Top peers: ${top3.map(p => `${config_js_1.BOLD}${p.name}${config_js_1.RESET}${config_js_1.DIM}(v${p.versionCount})${config_js_1.RESET}`).join(', ')}`, 'peer_summary');
        }
        // 5. Update state
        state.lastSync = new Date().toISOString();
        state.cycles += 1;
        state.peersFound = peers.length;
        state.healthy = !lowBal;
        state.peers = peers;
        return { peersFound: peers.length, healthy: !lowBal };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        say('✗', config_js_1.RED, `Cycle error: ${msg}`, 'cycle_error');
        state.errors += 1;
        return { peersFound: 0, healthy: false, errorMsg: msg };
    }
}
// ─── Sub-command: status ──────────────────────────────────────────────────────
function cmdDaemonStatus() {
    console.log();
    const state = loadState();
    if (!state) {
        (0, config_js_1.warn)('No daemon state found. Has `inkd agentd start` been run?');
        (0, config_js_1.warn)(`Expected: ${STATE_FILE}`);
        console.log();
        return;
    }
    console.log(`  ${config_js_1.BOLD}Inkd Agent Daemon — Status${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(44)}`);
    (0, config_js_1.info)(`Agent:       ${config_js_1.CYAN}${state.thisAgent}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Wallet:      ${config_js_1.DIM}${state.wallet}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Network:     ${state.network}`);
    (0, config_js_1.info)(`Started:     ${state.startedAt}`);
    (0, config_js_1.info)(`Last sync:   ${state.lastSync ?? 'never'}`);
    (0, config_js_1.info)(`Cycles:      ${state.cycles}`);
    (0, config_js_1.info)(`Peers found: ${state.peersFound}`);
    (0, config_js_1.info)(`Errors:      ${state.errors > 0 ? config_js_1.RED + state.errors + config_js_1.RESET : config_js_1.GREEN + '0' + config_js_1.RESET}`);
    (0, config_js_1.info)(`Healthy:     ${state.healthy ? config_js_1.GREEN + '✓ yes' + config_js_1.RESET : config_js_1.YELLOW + '⚠ no' + config_js_1.RESET}`);
    console.log();
}
// ─── Sub-command: peers ───────────────────────────────────────────────────────
function cmdDaemonPeers() {
    console.log();
    const state = loadState();
    if (!state || !state.peers?.length) {
        (0, config_js_1.warn)('No peer data yet. Run `inkd agentd start` first.');
        console.log();
        return;
    }
    console.log(`  ${config_js_1.BOLD}Inkd Agent Peers (${state.peers.length})${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(70)}`);
    console.log(`  ${'ID'.padEnd(8)}${'Name'.padEnd(30)}${'Versions'.padEnd(10)}${'Endpoint'}`);
    console.log(`  ${config_js_1.DIM}${'─'.repeat(66)}${config_js_1.RESET}`);
    for (const p of state.peers) {
        const ep = p.agentEndpoint
            ? config_js_1.CYAN + p.agentEndpoint.slice(0, 28) + config_js_1.RESET
            : config_js_1.DIM + 'none' + config_js_1.RESET;
        console.log(`  ${p.id.padEnd(8)}${p.name.padEnd(30)}${p.versionCount.padEnd(10)}${ep}`);
    }
    console.log();
    (0, config_js_1.info)(`Last updated: ${state.lastSync ?? 'never'}`);
    console.log();
}
// ─── Sub-command: start ───────────────────────────────────────────────────────
async function cmdAgentd(args) {
    // If the first arg is a flag (starts with --) or absent, default to 'start'
    const isDefaultStart = !args[0] || args[0].startsWith('--');
    const sub = isDefaultStart ? 'start' : args[0];
    if (sub === 'status') {
        cmdDaemonStatus();
        return;
    }
    if (sub === 'peers') {
        cmdDaemonPeers();
        return;
    }
    if (sub !== 'start') {
        (0, config_js_1.error)(`Unknown agentd command: ${sub}\nUsage: inkd agentd [start|status|peers]`);
    }
    // ─── Parse flags ────────────────────────────────────────────────────────────
    // When defaulting to 'start', all args are flags; otherwise skip the sub-command token
    const remaining = isDefaultStart ? args : args.slice(1);
    const getFlag = (f) => {
        const i = remaining.indexOf(f);
        return i !== -1 && remaining[i + 1] ? remaining[i + 1] : undefined;
    };
    const hasFlag = (f) => remaining.includes(f);
    const intervalMs = parseInt(getFlag('--interval') ?? process.env['INKD_INTERVAL'] ?? '60000', 10);
    const dryRun = hasFlag('--dry-run');
    const quiet = hasFlag('--quiet');
    const jsonMode = hasFlag('--json');
    const once = hasFlag('--once');
    // ─── Config ─────────────────────────────────────────────────────────────────
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    const agentName = process.env['INKD_AGENT_NAME'] ?? '';
    const agentEndpoint = process.env['INKD_AGENT_ENDPOINT'] ?? '';
    if (!agentName) {
        (0, config_js_1.error)('INKD_AGENT_NAME not set. Export your agent\'s project name.\n  Example: export INKD_AGENT_NAME=my-agent');
    }
    if (!addrs.registry) {
        (0, config_js_1.error)(`Registry address not configured for network "${cfg.network}".\nUpdate cli/src/config.ts after deployment.`);
    }
    // ─── Build clients ─────────────────────────────────────────────────────────
    let walletAddress = '0x0000000000000000000000000000000000000000';
    try {
        const pk = (0, config_js_1.requirePrivateKey)(cfg);
        const wc = (0, client_js_1.buildWalletClient)(cfg);
        const [acct] = await wc.getAddresses();
        walletAddress = acct;
    }
    catch {
        if (!dryRun)
            (0, config_js_1.error)('Private key required for daemon mode. Set INKD_PRIVATE_KEY or use --dry-run.');
    }
    const publicClient = (0, client_js_1.buildPublicClient)(cfg);
    // ─── Initial state ─────────────────────────────────────────────────────────
    const state = loadState() ?? {
        startedAt: new Date().toISOString(),
        lastSync: null,
        cycles: 0,
        peersFound: 0,
        errors: 0,
        thisAgent: agentName,
        wallet: walletAddress,
        network: cfg.network,
        healthy: true,
        peers: [],
    };
    // ─── Banner ─────────────────────────────────────────────────────────────────
    if (!jsonMode) {
        console.log();
        console.log(`  ${config_js_1.BOLD}Inkd Agent Daemon${config_js_1.RESET}  ${config_js_1.DIM}v1.0.0${config_js_1.RESET}`);
        console.log(`  ${'─'.repeat(44)}`);
        (0, config_js_1.info)(`Agent:    ${config_js_1.CYAN}${agentName}${config_js_1.RESET}`);
        (0, config_js_1.info)(`Wallet:   ${config_js_1.DIM}${walletAddress}${config_js_1.RESET}`);
        (0, config_js_1.info)(`Network:  ${cfg.network}`);
        (0, config_js_1.info)(`Interval: ${intervalMs}ms`);
        (0, config_js_1.info)(`DryRun:   ${dryRun}`);
        (0, config_js_1.info)(`Mode:     ${once ? 'once' : 'continuous'}`);
        console.log();
        (0, config_js_1.info)(`State:    ${STATE_FILE}`);
        console.log();
    }
    else {
        jsonLine('daemon_start', {
            agentName, walletAddress, network: cfg.network, intervalMs, dryRun, once,
        });
    }
    // ─── Cycle runner ─────────────────────────────────────────────────────────
    const cycle = async () => {
        if (!jsonMode && !quiet) {
            console.log(`  ${config_js_1.DIM}── cycle #${state.cycles + 1} ──────────────────────────────────${config_js_1.RESET}`);
        }
        const result = await runCycle({
            state,
            registryAddress: addrs.registry,
            walletAddress,
            publicClient,
            agentName,
            jsonMode,
            quiet,
            dryRun,
        });
        saveState(state);
        if (jsonMode) {
            jsonLine('cycle_complete', { cycle: state.cycles, peersFound: result.peersFound, healthy: result.healthy });
        }
    };
    // ─── Run ──────────────────────────────────────────────────────────────────
    await cycle();
    if (once) {
        if (!jsonMode && !quiet) {
            console.log();
            (0, config_js_1.success)('Single cycle complete (--once mode). State saved to ' + STATE_FILE);
            console.log();
        }
        return;
    }
    // Continuous mode
    if (!jsonMode && !quiet) {
        (0, config_js_1.info)(`Next sync in ${intervalMs / 1000}s — press Ctrl-C to stop\n`);
    }
    const timer = setInterval(async () => {
        await cycle();
        if (!jsonMode && !quiet) {
            (0, config_js_1.info)(`Next sync in ${intervalMs / 1000}s\n`);
        }
    }, intervalMs);
    // Graceful shutdown
    const shutdown = (signal) => {
        clearInterval(timer);
        saveState(state);
        if (jsonMode) {
            jsonLine('daemon_stop', { signal, cycles: state.cycles, peers: state.peersFound, errors: state.errors });
        }
        else {
            console.log();
            (0, config_js_1.info)(`${signal} received — shutting down gracefully`);
            (0, config_js_1.success)(`Daemon stopped. Ran ${state.cycles} cycles, found ${state.peersFound} peers, ${state.errors} errors.`);
            console.log();
        }
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
//# sourceMappingURL=agentd.js.map