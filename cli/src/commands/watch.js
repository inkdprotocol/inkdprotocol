"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdWatch = cmdWatch;
const viem_1 = require("viem");
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
// ─── Event signatures ─────────────────────────────────────────────────────────
const WATCH_ABI = (0, viem_1.parseAbi)([
    'event ProjectCreated(uint256 indexed projectId, address indexed owner, string name, bool isAgent)',
    'event VersionPushed(uint256 indexed projectId, uint256 indexed versionIndex, string arweaveHash, string versionTag)',
    'event ProjectTransferred(uint256 indexed projectId, address indexed from, address indexed to)',
    'event CollaboratorAdded(uint256 indexed projectId, address indexed collaborator)',
    'event CollaboratorRemoved(uint256 indexed projectId, address indexed collaborator)',
    'event VisibilityChanged(uint256 indexed projectId, bool isPublic)',
    'event ReadmeUpdated(uint256 indexed projectId, string arweaveHash)',
    'event AgentEndpointUpdated(uint256 indexed projectId, string endpoint)',
]);
function parseFlag(args, flag) {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}
function formatTs() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
function renderEvent(log, jsonMode) {
    try {
        const decoded = (0, viem_1.decodeEventLog)({ abi: WATCH_ABI, data: log.data, topics: log.topics });
        const name = decoded.eventName;
        const args = decoded.args;
        if (jsonMode) {
            console.log(JSON.stringify({
                event: name,
                block: log.blockNumber?.toString(),
                tx: log.transactionHash,
                args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])),
                timestamp: formatTs(),
            }));
            return;
        }
        const ts = config_js_1.DIM + formatTs() + config_js_1.RESET;
        const block = config_js_1.DIM + `#${log.blockNumber}` + config_js_1.RESET;
        switch (name) {
            case 'ProjectCreated': {
                const badge = args['isAgent'] ? config_js_1.CYAN + ' [agent]' + config_js_1.RESET : '';
                console.log(`${ts}  ${config_js_1.GREEN}✦ ProjectCreated${config_js_1.RESET}${badge}  ${block}`);
                console.log(`    id=${config_js_1.CYAN}${args['projectId']}${config_js_1.RESET}  owner=${config_js_1.DIM}${String(args['owner']).slice(0, 10)}…${config_js_1.RESET}  name=${config_js_1.BOLD}${args['name']}${config_js_1.RESET}`);
                break;
            }
            case 'VersionPushed':
                console.log(`${ts}  ${config_js_1.CYAN}↑ VersionPushed${config_js_1.RESET}  ${block}`);
                console.log(`    project=${config_js_1.CYAN}#${args['projectId']}${config_js_1.RESET}  tag=${config_js_1.BOLD}${args['versionTag']}${config_js_1.RESET}  hash=${config_js_1.DIM}ar://${String(args['arweaveHash']).slice(0, 12)}…${config_js_1.RESET}`);
                break;
            case 'ProjectTransferred':
                console.log(`${ts}  ${config_js_1.YELLOW}⇄ ProjectTransferred${config_js_1.RESET}  ${block}`);
                console.log(`    project=${config_js_1.CYAN}#${args['projectId']}${config_js_1.RESET}  from=${config_js_1.DIM}${String(args['from']).slice(0, 10)}…${config_js_1.RESET}  to=${String(args['to']).slice(0, 10)}…`);
                break;
            case 'CollaboratorAdded':
                console.log(`${ts}  ${config_js_1.GREEN}+ CollaboratorAdded${config_js_1.RESET}  ${block}  project=${config_js_1.CYAN}#${args['projectId']}${config_js_1.RESET}  ${config_js_1.DIM}${String(args['collaborator']).slice(0, 10)}…${config_js_1.RESET}`);
                break;
            case 'CollaboratorRemoved':
                console.log(`${ts}  ${config_js_1.YELLOW}- CollaboratorRemoved${config_js_1.RESET}  ${block}  project=${config_js_1.CYAN}#${args['projectId']}${config_js_1.RESET}  ${config_js_1.DIM}${String(args['collaborator']).slice(0, 10)}…${config_js_1.RESET}`);
                break;
            case 'VisibilityChanged':
                console.log(`${ts}  ${config_js_1.CYAN}◎ VisibilityChanged${config_js_1.RESET}  ${block}  project=${config_js_1.CYAN}#${args['projectId']}${config_js_1.RESET}  public=${args['isPublic'] ? config_js_1.GREEN + 'true' : config_js_1.YELLOW + 'false'}${config_js_1.RESET}`);
                break;
            case 'ReadmeUpdated':
                console.log(`${ts}  ${config_js_1.DIM}📄 ReadmeUpdated${config_js_1.RESET}  project=${config_js_1.CYAN}#${args['projectId']}${config_js_1.RESET}  hash=${config_js_1.DIM}ar://${String(args['arweaveHash']).slice(0, 12)}…${config_js_1.RESET}`);
                break;
            case 'AgentEndpointUpdated':
                console.log(`${ts}  ${config_js_1.CYAN}⚡ AgentEndpointUpdated${config_js_1.RESET}  project=${config_js_1.CYAN}#${args['projectId']}${config_js_1.RESET}  endpoint=${args['endpoint']}`);
                break;
            default:
                console.log(`${ts}  ${name}  ${block}  ${config_js_1.DIM}${JSON.stringify(args)}${config_js_1.RESET}`);
        }
    }
    catch {
        // unknown log — show raw
        if (jsonMode) {
            console.log(JSON.stringify({ raw: log.transactionHash, block: log.blockNumber?.toString() }));
        }
    }
}
// ─── Determine which events to include ───────────────────────────────────────
const FILTER_MAP = {
    all: ['ProjectCreated', 'VersionPushed', 'ProjectTransferred', 'CollaboratorAdded', 'CollaboratorRemoved', 'VisibilityChanged', 'ReadmeUpdated', 'AgentEndpointUpdated'],
    projects: ['ProjectCreated', 'ProjectTransferred', 'VisibilityChanged', 'ReadmeUpdated'],
    versions: ['VersionPushed'],
    agents: ['ProjectCreated', 'AgentEndpointUpdated'],
};
// ─── Main ─────────────────────────────────────────────────────────────────────
async function cmdWatch(args) {
    const filterArg = (args[0] && !args[0].startsWith('--') ? args[0] : 'all');
    if (!FILTER_MAP[filterArg]) {
        (0, config_js_1.error)(`Unknown filter "${filterArg}". Use: all | projects | versions | agents`);
    }
    const pollMs = parseInt(parseFlag(args, '--poll') ?? '3000', 10);
    const fromArg = parseFlag(args, '--from');
    const jsonMode = args.includes('--json');
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured. Deploy contracts first.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    // Determine starting block
    let fromBlock;
    if (fromArg) {
        fromBlock = BigInt(fromArg);
    }
    else {
        const latest = await client.getBlockNumber();
        fromBlock = latest > 1000n ? latest - 1000n : 0n;
    }
    if (!jsonMode) {
        console.log();
        console.log(`  ${config_js_1.BOLD}Inkd Protocol — Live Event Feed${config_js_1.RESET}`);
        console.log(`  ${'─'.repeat(50)}`);
        (0, config_js_1.info)(`Network:  ${config_js_1.CYAN}${cfg.network}${config_js_1.RESET}`);
        (0, config_js_1.info)(`Registry: ${config_js_1.DIM}${addrs.registry}${config_js_1.RESET}`);
        (0, config_js_1.info)(`Filter:   ${config_js_1.CYAN}${filterArg}${config_js_1.RESET}  (${FILTER_MAP[filterArg].join(', ')})`);
        (0, config_js_1.info)(`Polling:  every ${pollMs}ms`);
        (0, config_js_1.info)(`From:     block #${fromBlock}`);
        console.log();
        console.log(`  ${config_js_1.DIM}Watching… (Ctrl+C to stop)${config_js_1.RESET}`);
        console.log();
    }
    let lastBlock = fromBlock;
    let seenCount = 0;
    while (true) {
        try {
            const currentBlock = await client.getBlockNumber();
            if (currentBlock > lastBlock) {
                const logs = await client.getLogs({
                    address: addrs.registry,
                    fromBlock: lastBlock + 1n,
                    toBlock: currentBlock,
                });
                for (const log of logs) {
                    // Attempt to decode and filter by event name
                    try {
                        const decoded = (0, viem_1.decodeEventLog)({ abi: WATCH_ABI, data: log.data, topics: log.topics });
                        if (FILTER_MAP[filterArg].includes(decoded.eventName)) {
                            renderEvent(log, jsonMode);
                            seenCount++;
                        }
                    }
                    catch {
                        // not one of our events
                    }
                }
                lastBlock = currentBlock;
            }
        }
        catch (e) {
            if (!jsonMode) {
                console.error(`${config_js_1.DIM}[${formatTs()}] Poll error: ${e.message}${config_js_1.RESET}`);
            }
        }
        await new Promise(r => setTimeout(r, pollMs));
    }
}
//# sourceMappingURL=watch.js.map