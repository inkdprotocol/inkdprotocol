"use strict";
/**
 * inkd version <sub-command> — version management (x402 payment flow)
 *
 * Sub-commands:
 *   push  — upload content to Arweave + push version on-chain ($2 USDC via x402)
 *   list  — list all versions for a project
 *   show  — show a specific version by index
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdVersionPush = cmdVersionPush;
exports.cmdVersionList = cmdVersionList;
exports.cmdVersionShow = cmdVersionShow;
const fs_1 = require("fs");
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const sdk_1 = require("@inkd/sdk");
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
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
    return new Date(Number(ts) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
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
// ─── push ────────────────────────────────────────────────────────────────────
async function cmdVersionPush(args) {
    const idStr = requireFlag(args, '--id', 'inkd version push --id 1 --file ./dist.tar.gz --tag v1.0.0');
    const vTag = requireFlag(args, '--tag', 'inkd version push --id 1 --file ./dist.tar.gz --tag v1.0.0');
    // Accepts either --file (uploads to Arweave) or --hash (pre-uploaded)
    const filePath = parseFlag(args, '--file');
    const arHash = parseFlag(args, '--hash');
    if (!filePath && !arHash) {
        (0, config_js_1.error)('Provide either:\n' +
            '  --file <path>   Upload file to Arweave, then push\n' +
            '  --hash <ar://…> Use existing Arweave hash');
    }
    const cfg = (0, config_js_1.loadConfig)();
    const { wallet, reader } = buildPayingClients(cfg);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new sdk_1.ProjectsClient({ wallet: wallet, publicClient: reader, apiUrl: API_URL });
    let contentHash;
    let contentSize = 0;
    if (filePath) {
        if (!(0, fs_1.existsSync)(filePath))
            (0, config_js_1.error)(`File not found: ${filePath}`);
        const data = (0, fs_1.readFileSync)(filePath);
        contentSize = data.length;
        // Detect content type from extension
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const contentType = {
            json: 'application/json', ts: 'text/plain', js: 'text/javascript',
            md: 'text/markdown', txt: 'text/plain',
        }[ext] ?? 'application/octet-stream';
        (0, config_js_1.info)(`Uploading ${config_js_1.CYAN}${filePath}${config_js_1.RESET} to Arweave (${(contentSize / 1024).toFixed(1)} KB)...`);
        let upload;
        try {
            upload = await client.upload(data, {
                contentType,
                filename: filePath.split('/').pop(),
            });
        }
        catch (err) {
            (0, config_js_1.error)(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        contentHash = upload.hash;
        (0, config_js_1.info)(`  Uploaded → ${config_js_1.DIM}${upload.url}${config_js_1.RESET}`);
        (0, config_js_1.info)(`  Hash: ${config_js_1.CYAN}${contentHash}${config_js_1.RESET}`);
    }
    else {
        contentHash = arHash;
        if (!contentHash.startsWith('ar://') && !contentHash.startsWith('0x')) {
            (0, config_js_1.error)('--hash must be an Arweave TxId (ar://...) or hash');
        }
    }
    (0, config_js_1.info)(`Pushing version ${config_js_1.CYAN}${vTag}${config_js_1.RESET} to project #${idStr}...`);
    (0, config_js_1.info)(`  Paying $2.00 USDC from ${config_js_1.DIM}${wallet.account.address}${config_js_1.RESET}`);
    let result;
    try {
        result = await client.pushVersion(parseInt(idStr, 10), {
            tag: vTag, contentHash, contentSize,
        });
    }
    catch (err) {
        (0, config_js_1.error)(err instanceof Error ? err.message : String(err));
    }
    (0, config_js_1.success)(`Version ${config_js_1.BOLD}${vTag}${config_js_1.RESET} pushed!`);
    (0, config_js_1.info)(`  Content hash: ${config_js_1.DIM}${result.contentHash}${config_js_1.RESET}`);
    (0, config_js_1.info)(`  TX:           ${config_js_1.DIM}${result.txHash}${config_js_1.RESET}`);
    (0, config_js_1.info)(`  Basescan:     https://basescan.org/tx/${result.txHash}`);
    console.log();
}
// ─── list ────────────────────────────────────────────────────────────────────
async function cmdVersionList(args) {
    const idStr = args[0] ?? requireFlag(args, '--id', 'inkd version list 42');
    const id = BigInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd version list --id 42') : idStr);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.registry)
        (0, config_js_1.error)('Registry address not configured.');
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const versionCount = await client.readContract({
        address: addrs.registry, abi: abi_js_1.REGISTRY_ABI, functionName: 'getVersionCount', args: [id],
    });
    if (versionCount === 0n) {
        (0, config_js_1.info)(`No versions found for project #${id}`);
        return;
    }
    const versions = await Promise.all(Array.from({ length: Number(versionCount) }, (_, i) => client.readContract({
        address: addrs.registry, abi: abi_js_1.REGISTRY_ABI, functionName: 'getVersion', args: [id, BigInt(i)],
    })));
    console.log();
    console.log(`  ${config_js_1.BOLD}Versions for Project #${id}${config_js_1.RESET} (${versionCount} total)`);
    console.log(`  ${'─'.repeat(55)}`);
    for (let i = versions.length - 1; i >= 0; i--) {
        const v = versions[i];
        const hash = v.contentHash ?? v['arweaveHash'] ?? '';
        const tag = v.tag ?? v['versionTag'] ?? '';
        console.log(`  ${config_js_1.DIM}#${i}${config_js_1.RESET}  ${config_js_1.CYAN}${tag.padEnd(12)}${config_js_1.RESET}` +
            `  ${config_js_1.DIM}${hash.replace('ar://', '').slice(0, 12)}…${config_js_1.RESET}` +
            `  ${config_js_1.GREEN}${formatDate(v.pushedAt)}${config_js_1.RESET}`);
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
        address: addrs.registry, abi: abi_js_1.REGISTRY_ABI, functionName: 'getVersion',
        args: [BigInt(idStr), BigInt(indexStr)],
    });
    const hash = version['contentHash'] ?? version['arweaveHash'] ?? '';
    const tag = version['tag'] ?? version['versionTag'] ?? '';
    console.log();
    console.log(`  ${config_js_1.BOLD}Version #${indexStr} of Project #${idStr}${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(42)}`);
    (0, config_js_1.info)(`Tag:           ${config_js_1.CYAN}${tag}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Content hash:  ${hash}`);
    if (hash.startsWith('ar://') || hash.length === 43) {
        (0, config_js_1.info)(`Arweave URL:   https://arweave.net/${hash.replace('ar://', '')}`);
    }
    (0, config_js_1.info)(`Pushed by:     ${version['pushedBy']}`);
    (0, config_js_1.info)(`Pushed at:     ${config_js_1.GREEN}${formatDate(version['pushedAt'])}${config_js_1.RESET}`);
    console.log();
}
//# sourceMappingURL=version.js.map