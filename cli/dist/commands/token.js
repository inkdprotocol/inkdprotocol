"use strict";
/**
 * inkd token — Manage $INKD token balance, allowances, and transfers
 *
 * Usage:
 *   inkd token balance [address]          Show INKD + ETH balance for address (default: own wallet)
 *   inkd token approve <amount>            Approve the registry to spend N INKD
 *   inkd token allowance [address]         Check current registry allowance for address
 *   inkd token transfer <to> <amount>      Transfer INKD to another address
 *   inkd token info                        Show total supply and token metadata
 *
 * Flags:
 *   --json                                 JSON output (for scripting)
 *
 * Environment:
 *   INKD_PRIVATE_KEY   Required for approve/transfer
 *   INKD_NETWORK       mainnet | testnet
 *   INKD_RPC_URL       Custom RPC
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdTokenBalance = cmdTokenBalance;
exports.cmdTokenAllowance = cmdTokenAllowance;
exports.cmdTokenApprove = cmdTokenApprove;
exports.cmdTokenTransfer = cmdTokenTransfer;
exports.cmdTokenInfo = cmdTokenInfo;
exports.cmdToken = cmdToken;
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
// TOKEN_ABI now includes: approve, allowance, balanceOf, totalSupply,
//                         transfer, name, symbol, decimals
const FULL_TOKEN_ABI = abi_js_1.TOKEN_ABI;
// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseAmount(raw) {
    try {
        return (0, viem_1.parseEther)(raw);
    }
    catch {
        (0, config_js_1.error)(`Invalid amount: ${raw}. Use a number like 1 or 0.5`);
        process.exit(1);
    }
}
function parseAddress(raw) {
    if (!raw)
        return undefined;
    try {
        return (0, viem_1.getAddress)(raw);
    }
    catch {
        (0, config_js_1.error)(`Invalid address: ${raw}`);
        process.exit(1);
    }
}
// ─── Sub-commands ────────────────────────────────────────────────────────────
/**
 * inkd token balance [address] [--json]
 * Show INKD balance + ETH balance for an address.
 * Defaults to own wallet if INKD_PRIVATE_KEY is set.
 */
async function cmdTokenBalance(args) {
    const jsonMode = args.includes('--json');
    const addressArg = args.find(a => !a.startsWith('--'));
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    let target;
    if (addressArg) {
        target = parseAddress(addressArg);
    }
    else {
        // Fall back to own wallet
        const pk = (0, config_js_1.requirePrivateKey)(cfg);
        const { privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require('viem/accounts')));
        const account = privateKeyToAccount(pk);
        target = account.address;
    }
    if (!addrs.token) {
        (0, config_js_1.warn)('Token contract address not configured.');
        process.exit(1);
    }
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const [inkdBalance, ethBalance] = await Promise.all([
        client.readContract({
            address: addrs.token,
            abi: FULL_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [target],
        }),
        client.getBalance({ address: target }),
    ]);
    if (jsonMode) {
        console.log(JSON.stringify({
            address: target,
            inkd: (0, viem_1.formatEther)(inkdBalance),
            eth: (0, viem_1.formatEther)(ethBalance),
            network: cfg.network,
        }));
        return;
    }
    console.log();
    console.log(`  ${config_js_1.BOLD}Token Balance${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(40)}`);
    (0, config_js_1.info)(`Address:  ${config_js_1.CYAN}${target}${config_js_1.RESET}`);
    (0, config_js_1.info)(`INKD:     ${config_js_1.GREEN}${(0, viem_1.formatEther)(inkdBalance)} INKD${config_js_1.RESET}`);
    (0, config_js_1.info)(`ETH:      ${config_js_1.GREEN}${(0, viem_1.formatEther)(ethBalance)} ETH${config_js_1.RESET}`);
    (0, config_js_1.info)(`Network:  ${cfg.network}`);
    console.log();
}
/**
 * inkd token allowance [address] [--json]
 * Show how much INKD the registry is approved to spend on behalf of address.
 */
async function cmdTokenAllowance(args) {
    const jsonMode = args.includes('--json');
    const addressArg = args.find(a => !a.startsWith('--'));
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    let owner;
    if (addressArg) {
        owner = parseAddress(addressArg);
    }
    else {
        const pk = (0, config_js_1.requirePrivateKey)(cfg);
        const { privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require('viem/accounts')));
        owner = privateKeyToAccount(pk).address;
    }
    if (!addrs.token || !addrs.registry) {
        (0, config_js_1.warn)('Token or registry address not configured.');
        process.exit(1);
    }
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const allowance = await client.readContract({
        address: addrs.token,
        abi: FULL_TOKEN_ABI,
        functionName: 'allowance',
        args: [owner, addrs.registry],
    });
    const formatted = (0, viem_1.formatEther)(allowance);
    const sufficient = allowance >= (0, viem_1.parseEther)('1');
    if (jsonMode) {
        console.log(JSON.stringify({
            owner,
            spender: addrs.registry,
            allowance: formatted,
            sufficientForProject: sufficient,
            network: cfg.network,
        }));
        return;
    }
    console.log();
    console.log(`  ${config_js_1.BOLD}Registry Allowance${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(40)}`);
    (0, config_js_1.info)(`Owner:    ${config_js_1.CYAN}${owner}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Spender:  ${config_js_1.DIM}${addrs.registry}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Allowance: ${sufficient ? config_js_1.GREEN : config_js_1.YELLOW}${formatted} INKD${config_js_1.RESET}`);
    if (!sufficient) {
        console.log();
        (0, config_js_1.warn)(`Allowance is below 1 INKD. Run ${config_js_1.DIM}inkd token approve 1${config_js_1.RESET} before creating a project.`);
    }
    else {
        console.log();
        console.log(`  ${config_js_1.GREEN}✓ Sufficient allowance to create projects.${config_js_1.RESET}`);
    }
    console.log();
}
/**
 * inkd token approve <amount> [--json]
 * Approve the registry contract to spend <amount> INKD on your behalf.
 */
async function cmdTokenApprove(args) {
    const jsonMode = args.includes('--json');
    const amountArg = args.find(a => !a.startsWith('--'));
    if (!amountArg) {
        (0, config_js_1.error)('Usage: inkd token approve <amount>');
        (0, config_js_1.error)('Example: inkd token approve 10');
        process.exit(1);
    }
    const amount = parseAmount(amountArg);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.token || !addrs.registry) {
        (0, config_js_1.warn)('Token or registry address not configured.');
        process.exit(1);
    }
    const pk = (0, config_js_1.requirePrivateKey)(cfg);
    const { privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require('viem/accounts')));
    const account = privateKeyToAccount(pk);
    if (!jsonMode) {
        console.log();
        console.log(`  ${config_js_1.BOLD}Approving INKD Spend${config_js_1.RESET}`);
        console.log(`  ${'─'.repeat(40)}`);
        (0, config_js_1.info)(`From:     ${config_js_1.CYAN}${account.address}${config_js_1.RESET}`);
        (0, config_js_1.info)(`Spender:  ${config_js_1.DIM}${addrs.registry}${config_js_1.RESET}`);
        (0, config_js_1.info)(`Amount:   ${config_js_1.GREEN}${(0, viem_1.formatEther)(amount)} INKD${config_js_1.RESET}`);
        console.log();
        (0, config_js_1.info)('Sending approval...');
    }
    const walletClient = (0, client_js_1.buildWalletClient)(cfg, account);
    const publicClient = (0, client_js_1.buildPublicClient)(cfg);
    const hash = await walletClient.writeContract({
        address: addrs.token,
        abi: FULL_TOKEN_ABI,
        functionName: 'approve',
        args: [addrs.registry, amount],
        chain: cfg.network === 'mainnet' ? chains_1.base : chains_1.baseSepolia,
        account,
    });
    if (!jsonMode)
        (0, config_js_1.info)(`TX hash: ${config_js_1.DIM}${hash}${config_js_1.RESET}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (jsonMode) {
        console.log(JSON.stringify({
            success: receipt.status === 'success',
            hash,
            amount: (0, viem_1.formatEther)(amount),
            spender: addrs.registry,
            from: account.address,
            blockNumber: receipt.blockNumber.toString(),
            network: cfg.network,
        }));
        return;
    }
    if (receipt.status !== 'success') {
        (0, config_js_1.error)(`Transaction reverted: ${hash}`);
        process.exit(1);
    }
    (0, config_js_1.success)(`Approved ${(0, viem_1.formatEther)(amount)} INKD for registry to spend.`);
    (0, config_js_1.info)(`Block: ${receipt.blockNumber}`);
    console.log();
}
/**
 * inkd token transfer <to> <amount> [--json]
 * Transfer <amount> INKD tokens to <to> address.
 */
async function cmdTokenTransfer(args) {
    const jsonMode = args.includes('--json');
    const nonFlags = args.filter(a => !a.startsWith('--'));
    const toArg = nonFlags[0];
    const amountArg = nonFlags[1];
    if (!toArg || !amountArg) {
        (0, config_js_1.error)('Usage: inkd token transfer <to-address> <amount>');
        (0, config_js_1.error)('Example: inkd token transfer 0xABC...123 5');
        process.exit(1);
    }
    const to = parseAddress(toArg);
    const amount = parseAmount(amountArg);
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.token) {
        (0, config_js_1.warn)('Token contract address not configured.');
        process.exit(1);
    }
    const pk = (0, config_js_1.requirePrivateKey)(cfg);
    const { privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require('viem/accounts')));
    const account = privateKeyToAccount(pk);
    // Sanity check — don't transfer to self
    if (to.toLowerCase() === account.address.toLowerCase()) {
        (0, config_js_1.warn)('Destination address is the same as sender.');
        process.exit(1);
    }
    if (!jsonMode) {
        console.log();
        console.log(`  ${config_js_1.BOLD}Transfer INKD${config_js_1.RESET}`);
        console.log(`  ${'─'.repeat(40)}`);
        (0, config_js_1.info)(`From:   ${config_js_1.CYAN}${account.address}${config_js_1.RESET}`);
        (0, config_js_1.info)(`To:     ${config_js_1.CYAN}${to}${config_js_1.RESET}`);
        (0, config_js_1.info)(`Amount: ${config_js_1.GREEN}${(0, viem_1.formatEther)(amount)} INKD${config_js_1.RESET}`);
        console.log();
        (0, config_js_1.info)('Sending transfer...');
    }
    const walletClient = (0, client_js_1.buildWalletClient)(cfg, account);
    const publicClient = (0, client_js_1.buildPublicClient)(cfg);
    const hash = await walletClient.writeContract({
        address: addrs.token,
        abi: FULL_TOKEN_ABI,
        functionName: 'transfer',
        args: [to, amount],
        chain: cfg.network === 'mainnet' ? chains_1.base : chains_1.baseSepolia,
        account,
    });
    if (!jsonMode)
        (0, config_js_1.info)(`TX hash: ${config_js_1.DIM}${hash}${config_js_1.RESET}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (jsonMode) {
        console.log(JSON.stringify({
            success: receipt.status === 'success',
            hash,
            from: account.address,
            to,
            amount: (0, viem_1.formatEther)(amount),
            blockNumber: receipt.blockNumber.toString(),
            network: cfg.network,
        }));
        return;
    }
    if (receipt.status !== 'success') {
        (0, config_js_1.error)(`Transaction reverted: ${hash}`);
        process.exit(1);
    }
    (0, config_js_1.success)(`Transferred ${(0, viem_1.formatEther)(amount)} INKD to ${to}`);
    (0, config_js_1.info)(`Block: ${receipt.blockNumber}`);
    console.log();
}
/**
 * inkd token info [--json]
 * Show $INKD token metadata: name, symbol, decimals, total supply.
 */
async function cmdTokenInfo(args) {
    const jsonMode = args.includes('--json');
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    if (!addrs.token) {
        (0, config_js_1.warn)('Token contract address not configured.');
        process.exit(1);
    }
    const client = (0, client_js_1.buildPublicClient)(cfg);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
        client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'name' }),
        client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'symbol' }),
        client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'decimals' }),
        client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'totalSupply' }),
    ]);
    if (jsonMode) {
        console.log(JSON.stringify({
            address: addrs.token,
            name, symbol, decimals,
            totalSupply: (0, viem_1.formatEther)(totalSupply),
            network: cfg.network,
        }));
        return;
    }
    console.log();
    console.log(`  ${config_js_1.BOLD}$INKD Token Info${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(40)}`);
    (0, config_js_1.info)(`Contract: ${config_js_1.CYAN}${addrs.token}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Name:     ${name}`);
    (0, config_js_1.info)(`Symbol:   ${config_js_1.GREEN}${symbol}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Decimals: ${decimals}`);
    (0, config_js_1.info)(`Supply:   ${config_js_1.GREEN}${(0, viem_1.formatEther)(totalSupply)} ${symbol}${config_js_1.RESET}`);
    (0, config_js_1.info)(`Network:  ${cfg.network}`);
    console.log();
}
// ─── Router ──────────────────────────────────────────────────────────────────
async function cmdToken(args) {
    const sub = args[0];
    const subArgs = args.slice(1);
    const { YELLOW: Y, RESET: R, DIM: D } = { YELLOW: config_js_1.YELLOW, RESET: config_js_1.RESET, DIM: config_js_1.DIM };
    switch (sub) {
        case 'balance':
            await cmdTokenBalance(subArgs);
            break;
        case 'allowance':
            await cmdTokenAllowance(subArgs);
            break;
        case 'approve':
            await cmdTokenApprove(subArgs);
            break;
        case 'transfer':
            await cmdTokenTransfer(subArgs);
            break;
        case 'info':
            await cmdTokenInfo(subArgs);
            break;
        default:
            console.error(`\n  ${Y}Unknown token sub-command: ${sub || '(none)'}${R}`);
            console.error(`\n  ${config_js_1.BOLD}Usage:${R}`);
            console.error(`    inkd token balance [address]       ${D}— INKD + ETH balance${R}`);
            console.error(`    inkd token allowance [address]     ${D}— registry spend allowance${R}`);
            console.error(`    inkd token approve <amount>        ${D}— approve registry to spend N INKD${R}`);
            console.error(`    inkd token transfer <to> <amount>  ${D}— send INKD to address${R}`);
            console.error(`    inkd token info                    ${D}— token metadata + total supply${R}`);
            console.error();
            process.exit(1);
    }
}
//# sourceMappingURL=token.js.map