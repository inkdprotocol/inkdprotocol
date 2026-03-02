"use strict";
/**
 * inkd version <sub-command> — version management
 *
 * Sub-commands:
 *   push  — push a new version to a project
 *   list  — list all versions for a project
 *   show  — show a specific version by index
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdVersionPush = cmdVersionPush;
exports.cmdVersionList = cmdVersionList;
exports.cmdVersionShow = cmdVersionShow;
const viem_1 = require("viem");
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
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
    return new Date(Number(ts) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
// ─── push ────────────────────────────────────────────────────────────────────
async function cmdVersionPush(args) {
    const idStr = requireFlag(args, '--id', 'inkd version push --id 1 --hash abc123 --tag v0.2.0');
    const arweaveHash = requireFlag(args, '--hash', 'inkd version push --id 1 --hash abc123 --tag v0.2.0');
    const versionTag = requireFlag(args, '--tag', 'inkd version push --id 1 --hash abc123 --tag v0.2.0');
    const changelog = parseFlag(args, '--changelog') ?? '';
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured. Deploy contracts first.');
    const { publicClient, walletClient, account, addrs: a } = (0, client_js_1.buildClients)(cfg);
    const versionFee = await publicClient.readContract({
        address: a.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'versionFee',
    });
    (0, config_js_1.info)(`Version fee: ${(0, viem_1.formatEther)(versionFee)} ETH`);
    (0, config_js_1.info)(`Pushing version ${config_js_1.CYAN}${versionTag}${config_js_1.RESET} to project #${idStr}...`);
    const tx = await walletClient.writeContract({
        address: a.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'pushVersion',
        args: [BigInt(idStr), arweaveHash, versionTag, changelog],
        value: versionFee,
        account,
        chain: walletClient.chain,
    });
    (0, config_js_1.info)(`Tx: ${config_js_1.DIM}${tx}${config_js_1.RESET}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status === 'success') {
        (0, config_js_1.success)(`Version ${config_js_1.BOLD}${versionTag}${config_js_1.RESET} pushed! Arweave: ${config_js_1.DIM}${arweaveHash}${config_js_1.RESET}`);
    }
    else {
        (0, config_js_1.error)('Transaction reverted. Verify project ownership and ETH balance.');
    }
}
// ─── list ────────────────────────────────────────────────────────────────────
async function cmdVersionList(args) {
    const idStr = args[0]
        ?? requireFlag(args, '--id', 'inkd version list 42');
    const id = BigInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd version list --id 42') : idStr);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const versionCount = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getVersionCount',
        args: [id],
    });
    if (versionCount === 0n) {
        (0, config_js_1.info)(`No versions found for project #${id}`);
        return;
    }
    const versions = await Promise.all(Array.from({ length: Number(versionCount) }, (_, i) => client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getVersion',
        args: [id, BigInt(i)],
    })));
    console.log();
    console.log(`  ${config_js_1.BOLD}Versions for Project #${id}${config_js_1.RESET} (${versionCount} total)`);
    console.log(`  ${'─'.repeat(55)}`);
    for (let i = versions.length - 1; i >= 0; i--) {
        const v = versions[i];
        console.log(`  ${config_js_1.DIM}#${i}${config_js_1.RESET}  ${config_js_1.CYAN}${v.versionTag.padEnd(12)}${config_js_1.RESET}` +
            `  ${config_js_1.DIM}${v.arweaveHash.slice(0, 12)}…${config_js_1.RESET}` +
            `  ${config_js_1.GREEN}${formatDate(v.pushedAt)}${config_js_1.RESET}`);
        if (v.changelog) {
            console.log(`       ${config_js_1.DIM}${v.changelog.slice(0, 72)}${v.changelog.length > 72 ? '…' : ''}${config_js_1.RESET}`);
        }
    }
    console.log();
}
// ─── show ────────────────────────────────────────────────────────────────────
async function cmdVersionShow(args) {
    const idStr = requireFlag(args, '--id', 'inkd version show --id 42 --index 0');
    const indexStr = requireFlag(args, '--index', 'inkd version show --id 42 --index 0');
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const version = await client.readContract({
        address: addrs.registry,
        abi: abi_js_1.REGISTRY_ABI,
        functionName: 'getVersion',
        args: [BigInt(idStr), BigInt(indexStr)],
    });
    console.log();
    console.log(`  ${config_js_1.BOLD}Version #${indexStr} of Project #${idStr}${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(42)}`);
    (0, config_js_1.info)(`Tag:           ${config_js_1.CYAN}${version.versionTag}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Arweave hash:  ${version.arweaveHash}`);
    (0, config_js_1.info)(`Pushed by:     ${version.pushedBy}`);
    (0, config_js_1.info)(`Pushed at:     ${config_js_1.GREEN}${formatDate(version.pushedAt)}${config_js_1.RESET}`);
    if (version.changelog) {
        (0, config_js_1.info)(`Changelog:     ${version.changelog}`);
    }
    console.log();
}
//# sourceMappingURL=version.js.map