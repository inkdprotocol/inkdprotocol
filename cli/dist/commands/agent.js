"use strict";
/**
 * inkd agent <sub-command> — AI agent project directory
 *
 * Sub-commands:
 *   list    — paginated list of registered agent projects
 *   lookup  — find agent by name
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdAgentList = cmdAgentList;
exports.cmdAgentLookup = cmdAgentLookup;
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
function parseFlag(args, flag) {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}
// ─── list ────────────────────────────────────────────────────────────────────
async function cmdAgentList(args) {
    const offsetStr = parseFlag(args, '--offset') ?? '0';
    const limitStr = parseFlag(args, '--limit') ?? '25';
    const offset = BigInt(offsetStr);
    const limit = BigInt(limitStr);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry) {
        (0, config_js_1.info)('Registry not deployed yet. Check back after mainnet launch.');
        return;
    }
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const projects = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getAgentProjects',
        args: [offset, limit],
    });
    if (!projects.length) {
        (0, config_js_1.info)('No agent projects found.');
        return;
    }
    console.log();
    console.log(`  ${config_js_1.BOLD}Agent Directory${config_js_1.RESET}  (offset: ${offset}, limit: ${limit})`);
    console.log(`  ${'─'.repeat(60)}`);
    for (const p of projects) {
        const vis = p.isPublic ? config_js_1.GREEN + '●' + config_js_1.RESET : config_js_1.YELLOW + '○' + config_js_1.RESET;
        console.log(`  ${vis}  ${config_js_1.BOLD}#${p.id}${config_js_1.RESET}  ${config_js_1.CYAN}${p.name.padEnd(22)}${config_js_1.RESET}` +
            `  v${p.versionCount}  ${config_js_1.DIM}${p.owner.slice(0, 10)}…${config_js_1.RESET}`);
        if (p.description) {
            console.log(`       ${config_js_1.DIM}${p.description.slice(0, 70)}${p.description.length > 70 ? '…' : ''}${config_js_1.RESET}`);
        }
        if (p.agentEndpoint) {
            console.log(`       ${config_js_1.DIM}→ ${p.agentEndpoint}${config_js_1.RESET}`);
        }
    }
    if (projects.length === Number(limit)) {
        console.log();
        (0, config_js_1.info)(`Showing ${limit} results. Use ${config_js_1.DIM}--offset ${offset + limit} --limit ${limit}${config_js_1.RESET} for next page.`);
    }
    console.log();
}
// ─── lookup ──────────────────────────────────────────────────────────────────
async function cmdAgentLookup(args) {
    const name = args[0];
    if (!name)
        (0, config_js_1.error)('Usage: inkd agent lookup <name>');
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry) {
        (0, config_js_1.info)('Registry not deployed yet.');
        return;
    }
    // Scan through projects to find by name (linear scan — acceptable for CLI)
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const projectCount = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'projectCount',
    });
    const target = name.toLowerCase();
    for (let i = 1n; i <= projectCount; i++) {
        const p = await client.readContract({
            address: addrs.registry,
            abi: abi_js_1.REGISTRY_ABI,
            functionName: 'getProject',
            args: [i],
        });
        if (p.name.toLowerCase() === target) {
            console.log();
            console.log(`  ${config_js_1.BOLD}Agent: ${config_js_1.CYAN}${p.name}${config_js_1.RESET}  (#${p.id})`);
            console.log(`  ${'─'.repeat(42)}`);
            (0, config_js_1.info)(`Owner:     ${p.owner}`);
            (0, config_js_1.info)(`Endpoint:  ${p.agentEndpoint || config_js_1.DIM + 'none' + config_js_1.RESET}`);
            (0, config_js_1.info)(`Versions:  ${config_js_1.GREEN}${p.versionCount}${config_js_1.RESET}`);
            (0, config_js_1.info)(`License:   ${p.license}`);
            if (p.description)
                (0, config_js_1.info)(`Desc:      ${p.description}`);
            if (p.readmeHash)
                (0, config_js_1.info)(`README:    ${config_js_1.DIM}ar://${p.readmeHash}${config_js_1.RESET}`);
            console.log();
            return;
        }
    }
    (0, config_js_1.error)(`Agent project "${name}" not found.`);
}
//# sourceMappingURL=agent.js.map