"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdSearch = cmdSearch;
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
function parseFlag(args, flag) {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}
function highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1)
        return text;
    return (text.slice(0, idx) +
        config_js_1.BOLD + '\x1b[33m' + text.slice(idx, idx + query.length) + config_js_1.RESET +
        text.slice(idx + query.length));
}
async function cmdSearch(args) {
    // First non-flag arg is the query
    const query = args.find(a => !a.startsWith('--'));
    if (!query)
        (0, config_js_1.error)('Usage: inkd search <query> [--agents] [--limit <n>] [--json]');
    const agentsOnly = args.includes('--agents');
    const jsonMode = args.includes('--json');
    const limitStr = parseFlag(args, '--limit') ?? '20';
    const maxResults = Math.min(parseInt(limitStr, 10), 100);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured. Deploy contracts first.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    // Get total count
    const projectCount = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'projectCount',
    });
    if (projectCount === 0n) {
        (0, config_js_1.info)('No projects registered yet.');
        return;
    }
    if (!jsonMode) {
        console.log();
        console.log(`  ${config_js_1.BOLD}Search${config_js_1.RESET}: "${config_js_1.CYAN}${query}${config_js_1.RESET}"  ${config_js_1.DIM}(scanning ${projectCount} projects)${config_js_1.RESET}`);
        console.log(`  ${'─'.repeat(50)}`);
    }
    // Batch reads in groups of 20 for speed
    const BATCH = 20;
    const results = [];
    let scanned = 0n;
    outer: for (let i = 1n; i <= projectCount; i += BigInt(BATCH)) {
        const batchEnd = i + BigInt(BATCH) - 1n < projectCount ? i + BigInt(BATCH) - 1n : projectCount;
        const ids = [];
        for (let j = i; j <= batchEnd; j++)
            ids.push(j);
        const batch = await Promise.all(ids.map(id => client.readContract({
            address: addrs.registry,
            abi: abi_js_1.REGISTRY_ABI,
            functionName: 'getProject',
            args: [id],
        })));
        scanned += BigInt(ids.length);
        for (const p of batch) {
            if (!p.exists)
                continue;
            if (agentsOnly && !p.isAgent)
                continue;
            const nameMatch = p.name.toLowerCase().includes(query.toLowerCase());
            const descMatch = p.description.toLowerCase().includes(query.toLowerCase());
            if (!nameMatch && !descMatch)
                continue;
            results.push(p);
            if (results.length >= maxResults)
                break outer;
        }
    }
    if (!results.length) {
        if (jsonMode) {
            console.log(JSON.stringify({ query, results: [], scanned: scanned.toString() }));
        }
        else {
            (0, config_js_1.info)(`No results for "${query}"`);
            if (agentsOnly)
                (0, config_js_1.warn)('Tip: remove --agents to search all projects.');
            console.log();
        }
        return;
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
        }));
        console.log(JSON.stringify({ query, results: out, scanned: scanned.toString() }, null, 2));
        return;
    }
    for (const p of results) {
        const agentBadge = p.isAgent ? config_js_1.CYAN + ' [agent]' + config_js_1.RESET : '';
        const visBadge = p.isPublic ? config_js_1.GREEN + 'public' + config_js_1.RESET : config_js_1.YELLOW + 'private' + config_js_1.RESET;
        console.log(`\n  ${config_js_1.BOLD}#${p.id}${config_js_1.RESET}  ${config_js_1.CYAN}${highlight(p.name, query)}${config_js_1.RESET}${agentBadge}  ${visBadge}`);
        if (p.description) {
            const desc = p.description.length > 80
                ? p.description.slice(0, 80) + '…'
                : p.description;
            console.log(`  ${config_js_1.DIM}${highlight(desc, query)}${config_js_1.RESET}`);
        }
        console.log(`  ${config_js_1.DIM}owner: ${p.owner.slice(0, 10)}…  ` +
            `versions: ${p.versionCount}  ` +
            `license: ${p.license}${config_js_1.RESET}`);
        if (p.agentEndpoint) {
            console.log(`  ${config_js_1.DIM}→ ${p.agentEndpoint}${config_js_1.RESET}`);
        }
    }
    console.log();
    console.log(`  ${config_js_1.DIM}Found ${config_js_1.GREEN}${results.length}${config_js_1.DIM} result(s) in ${scanned} scanned projects.` +
        (results.length >= maxResults ? ` Use ${config_js_1.RESET}--limit <n>${config_js_1.DIM} to see more.` : '') +
        config_js_1.RESET);
    console.log();
}
//# sourceMappingURL=search.js.map