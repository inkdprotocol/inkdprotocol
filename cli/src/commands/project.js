"use strict";
/**
 * inkd project <sub-command> — project management (x402 payment flow)
 *
 * Sub-commands:
 *   create   — register a new project ($5 USDC via x402)
 *   get      — fetch project details by ID
 *   list     — list projects owned by an address
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdProjectCreate = cmdProjectCreate;
exports.cmdProjectGet = cmdProjectGet;
exports.cmdProjectList = cmdProjectList;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const sdk_1 = require("@inkd/sdk");
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
const config_js_2 = require("../config.js");
const API_URL = process.env['INKD_API_URL'] ?? 'https://api.inkdprotocol.com';
// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseFlag(args, flag) {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}
function requireFlag(args, flag, hint) {
    const val = parseFlag(args, flag);
    if (!val)
        (0, config_js_1.error)(`Missing required flag ${config_js_1.BOLD}${flag}${config_js_1.RESET}\n  Example: ${config_js_1.DIM}${hint}${config_js_1.RESET}`);
    return val;
}
function formatDate(ts) {
    return new Date(Number(ts) * 1000).toISOString().slice(0, 10);
}
function buildPayingClients(cfg) {
    const key = (0, config_js_1.requirePrivateKey)(cfg);
    const account = (0, accounts_1.privateKeyToAccount)(key);
    const chain = cfg.network === 'mainnet' ? chains_1.base : chains_1.baseSepolia;
    const rpcUrl = cfg.rpcUrl ?? (cfg.network === 'mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org');
    const wallet = (0, viem_1.createWalletClient)({ account, chain, transport: (0, viem_1.http)(rpcUrl) });
    const reader = (0, viem_1.createPublicClient)({ chain, transport: (0, viem_1.http)(rpcUrl) });
    return { wallet, reader, account };
}
// ─── create ──────────────────────────────────────────────────────────────────
async function cmdProjectCreate(args) {
    const name = requireFlag(args, '--name', 'inkd project create --name my-agent');
    const description = parseFlag(args, '--description') ?? '';
    const license = parseFlag(args, '--license') ?? 'MIT';
    const readmeHash = parseFlag(args, '--readme') ?? '';
    const agentEndpoint = parseFlag(args, '--endpoint') ?? '';
    const isPublic = !args.includes('--private');
    const isAgent = args.includes('--agent');
    const cfg = (0, config_js_1.loadConfig)();
    const { wallet, reader } = buildPayingClients(cfg);
    (0, config_js_1.info)(`Creating project ${config_js_1.CYAN}${name}${config_js_1.RESET} via x402...`);
    (0, config_js_1.info)(`  Paying $5.00 USDC from ${config_js_1.DIM}${wallet.account.address}${config_js_1.RESET}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new sdk_1.ProjectsClient({ wallet: wallet, publicClient: reader, apiUrl: API_URL });
    let result;
    try {
        result = await client.createProject({
            name, description, license, isPublic, readmeHash, isAgent, agentEndpoint,
        });
    }
    catch (err) {
        (0, config_js_1.error)(err instanceof Error ? err.message : String(err));
    }
    (0, config_js_1.success)(`Project ${config_js_1.BOLD}${name}${config_js_1.RESET} created!`);
    (0, config_js_1.info)(`  Project ID: ${config_js_1.CYAN}${result.projectId}${config_js_1.RESET}`);
    (0, config_js_1.info)(`  Owner:      ${result.owner}`);
    (0, config_js_1.info)(`  TX:         ${config_js_1.DIM}${result.txHash}${config_js_1.RESET}`);
    (0, config_js_1.info)(`  Basescan:   https://basescan.org/tx/${result.txHash}`);
    console.log();
}
// ─── get ─────────────────────────────────────────────────────────────────────
async function cmdProjectGet(args) {
    const idStr = args[0] ?? requireFlag(args, '--id', 'inkd project get 42');
    const id = parseInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd project get --id 42') : idStr, 10);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_2.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured. Deploy contracts first.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const project = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getProject',
        args: [BigInt(id)],
    });
    if (!project.exists)
        (0, config_js_1.error)(`Project #${id} not found.`);
    const collaborators = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getCollaborators',
        args: [BigInt(id)],
    });
    console.log();
    console.log(`  ${config_js_1.BOLD}Project #${project.id}${config_js_1.RESET}  ${project.isAgent ? config_js_1.CYAN + '[agent]' + config_js_1.RESET : ''}`);
    console.log(`  ${'─'.repeat(42)}`);
    (0, config_js_1.info)(`Name:          ${config_js_1.CYAN}${project.name}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Description:   ${project.description || config_js_1.DIM + 'none' + config_js_1.RESET}`);
    (0, config_js_1.info)(`License:       ${project.license}`);
    (0, config_js_1.info)(`Owner:         ${project.owner}`);
    (0, config_js_1.info)(`Created:       ${formatDate(project.createdAt)}`);
    (0, config_js_1.info)(`Versions:      ${config_js_1.GREEN}${project.versionCount}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Visibility:    ${project.isPublic ? config_js_1.GREEN + 'public' : config_js_1.YELLOW + 'private'}${config_js_1.RESET}`);
    if (project.readmeHash)
        (0, config_js_1.info)(`README hash:   ${config_js_1.DIM}${project.readmeHash}${config_js_1.RESET}`);
    if (project.agentEndpoint)
        (0, config_js_1.info)(`Agent endpoint: ${project.agentEndpoint}`);
    if (collaborators.length)
        (0, config_js_1.info)(`Collaborators: ${collaborators.join(', ')}`);
    console.log();
}
// ─── list ────────────────────────────────────────────────────────────────────
async function cmdProjectList(args) {
    const addressArg = args[0];
    if (!addressArg || !(0, viem_1.isAddress)(addressArg)) {
        (0, config_js_1.error)('Usage: inkd project list <address>\n  Example: inkd project list 0xDead...');
    }
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_2.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const projectIds = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getOwnerProjects',
        args: [addressArg],
    });
    if (!projectIds.length) {
        (0, config_js_1.info)(`No projects found for ${addressArg}`);
        return;
    }
    console.log();
    console.log(`  ${config_js_1.BOLD}Projects owned by ${config_js_1.DIM}${addressArg}${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(50)}`);
    const projects = await Promise.all(projectIds.map(id => client.readContract({
        address: addrs.registry, abi: abi_js_1.REGISTRY_ABI, functionName: 'getProject', args: [id],
    })));
    for (const p of projects) {
        const badges = [
            p.isAgent ? config_js_1.CYAN + 'agent' + config_js_1.RESET : '',
            p.isPublic ? config_js_1.GREEN + 'public' + config_js_1.RESET : config_js_1.YELLOW + 'private' + config_js_1.RESET,
        ].filter(Boolean).join(' ');
        console.log(`  ${config_js_1.BOLD}#${p.id}${config_js_1.RESET}  ${config_js_1.CYAN}${p.name.padEnd(24)}${config_js_1.RESET}` +
            `  v${p.versionCount}  ${badges}  ${config_js_1.DIM}${formatDate(p.createdAt)}${config_js_1.RESET}`);
    }
    console.log();
}
//# sourceMappingURL=project.js.map