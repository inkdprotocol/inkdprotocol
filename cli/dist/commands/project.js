"use strict";
/**
 * inkd project <sub-command> — project management
 *
 * Sub-commands:
 *   create   — register a new project (locks 1 $INKD)
 *   get      — fetch project details by ID
 *   list     — list projects owned by an address
 *   transfer — transfer ownership to a new address
 *   collab   — add/remove collaborators
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdProjectCreate = cmdProjectCreate;
exports.cmdProjectGet = cmdProjectGet;
exports.cmdProjectList = cmdProjectList;
exports.cmdProjectTransfer = cmdProjectTransfer;
exports.cmdProjectCollab = cmdProjectCollab;
const viem_1 = require("viem");
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
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
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured. Deploy contracts first.');
    const { publicClient, walletClient, account, addrs: a } = (0, client_js_1.buildClients)(cfg);
    // Check/approve token allowance
    const allowance = await publicClient.readContract({
        address: a.token,
        abi: abi_js_1.TOKEN_ABI,
        functionName: 'allowance',
        args: [account.address, a.registry],
    });
    if (allowance < (0, viem_1.parseEther)('1')) {
        (0, config_js_1.info)('Approving 1 $INKD for registry...');
        const approveTx = await walletClient.writeContract({
            address: a.token, abi: abi_js_1.TOKEN_ABI, functionName: 'approve',
            args: [a.registry, (0, viem_1.parseEther)('1')],
            account, chain: walletClient.chain,
        });
        (0, config_js_1.info)(`Approve tx: ${config_js_1.DIM}${approveTx}${config_js_1.RESET}`);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
    (0, config_js_1.info)(`Creating project ${config_js_1.CYAN}${name}${config_js_1.RESET}...`);
    const tx = await walletClient.writeContract({
        address: a.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'createProject',
        args: [name, description, license, isPublic, readmeHash, isAgent, agentEndpoint],
        account,
        chain: walletClient.chain,
    });
    (0, config_js_1.info)(`Tx: ${config_js_1.DIM}${tx}${config_js_1.RESET}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status === 'success') {
        (0, config_js_1.success)(`Project ${config_js_1.BOLD}${name}${config_js_1.RESET} created! (block ${receipt.blockNumber})`);
    }
    else {
        (0, config_js_1.error)('Transaction reverted. Check name uniqueness and token balance.');
    }
}
// ─── get ─────────────────────────────────────────────────────────────────────
async function cmdProjectGet(args) {
    const idStr = args[0] ?? requireFlag(args, '--id', 'inkd project get 42');
    const id = BigInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd project get --id 42') : idStr);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const project = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getProject',
        args: [id],
    });
    if (!project.exists)
        (0, config_js_1.error)(`Project #${id} not found.`);
    const collaborators = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getCollaborators',
        args: [id],
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
    const addrs = config_js_1.ADDRESSES[cfg.network];
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
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getProject',
        args: [id],
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
// ─── transfer ────────────────────────────────────────────────────────────────
async function cmdProjectTransfer(args) {
    const idStr = requireFlag(args, '--id', 'inkd project transfer --id 42 --to 0x...');
    const toAddr = requireFlag(args, '--to', 'inkd project transfer --id 42 --to 0x...');
    if (!(0, viem_1.isAddress)(toAddr))
        (0, config_js_1.error)('--to must be a valid Ethereum address.');
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured.');
    const { publicClient, walletClient, account, addrs: a } = (0, client_js_1.buildClients)(cfg);
    const transferFee = await publicClient.readContract({
        address: a.registry, abi: abi_js_1.REGISTRY_ABI, functionName: 'transferFee',
    });
    (0, config_js_1.info)(`Transfer fee: ${(0, viem_1.formatEther)(transferFee)} ETH`);
    (0, config_js_1.info)(`Transferring project #${idStr} → ${toAddr}...`);
    const tx = await walletClient.writeContract({
        address: a.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'transferProject',
        args: [BigInt(idStr), toAddr],
        value: transferFee,
        account,
        chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    (0, config_js_1.success)(`Project #${idStr} transferred to ${toAddr}`);
}
// ─── collab ──────────────────────────────────────────────────────────────────
async function cmdProjectCollab(args) {
    const action = args[0];
    if (action !== 'add' && action !== 'remove') {
        (0, config_js_1.error)('Usage: inkd project collab add|remove --id <id> --address <address>');
    }
    const idStr = requireFlag(args, '--id', `inkd project collab ${action} --id 42 --address 0x...`);
    const collab = requireFlag(args, '--address', `inkd project collab ${action} --id 42 --address 0x...`);
    if (!(0, viem_1.isAddress)(collab))
        (0, config_js_1.error)('--address must be a valid Ethereum address.');
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured.');
    const { publicClient, walletClient, account, addrs: a } = (0, client_js_1.buildClients)(cfg);
    const fn = action === 'add' ? 'addCollaborator' : 'removeCollaborator';
    (0, config_js_1.info)(`${action === 'add' ? 'Adding' : 'Removing'} collaborator ${collab}...`);
    const tx = await walletClient.writeContract({
        address: a.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: fn,
        args: [BigInt(idStr), collab],
        account,
        chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    (0, config_js_1.success)(`Collaborator ${action === 'add' ? 'added' : 'removed'}.`);
}
//# sourceMappingURL=project.js.map