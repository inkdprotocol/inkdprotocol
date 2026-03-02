"use strict";
/**
 * Inkd CLI — viem client factory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.privateKeyToAccount = void 0;
exports.buildPublicClient = buildPublicClient;
exports.buildWalletClient = buildWalletClient;
exports.buildClients = buildClients;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
Object.defineProperty(exports, "privateKeyToAccount", { enumerable: true, get: function () { return accounts_1.privateKeyToAccount; } });
const chains_1 = require("viem/chains");
const config_js_1 = require("./config.js");
function buildPublicClient(cfg) {
    const chain = cfg.network === 'mainnet' ? chains_1.base : chains_1.baseSepolia;
    return (0, viem_1.createPublicClient)({ chain, transport: (0, viem_1.http)(cfg.rpcUrl) });
}
/** Build a WalletClient. If `account` is provided, use it; otherwise derive from cfg private key. */
function buildWalletClient(cfg, account) {
    const chain = cfg.network === 'mainnet' ? chains_1.base : chains_1.baseSepolia;
    const acct = account ?? (0, accounts_1.privateKeyToAccount)((0, config_js_1.requirePrivateKey)(cfg));
    return (0, viem_1.createWalletClient)({ account: acct, chain, transport: (0, viem_1.http)(cfg.rpcUrl) });
}
function buildClients(cfg) {
    const pk = (0, config_js_1.requirePrivateKey)(cfg);
    const account = (0, accounts_1.privateKeyToAccount)(pk);
    const chain = cfg.network === 'mainnet' ? chains_1.base : chains_1.baseSepolia;
    const publicClient = (0, viem_1.createPublicClient)({ chain, transport: (0, viem_1.http)(cfg.rpcUrl) });
    const walletClient = (0, viem_1.createWalletClient)({ account, chain, transport: (0, viem_1.http)(cfg.rpcUrl) });
    const addrs = config_js_1.ADDRESSES[cfg.network];
    return { publicClient, walletClient, account, addrs };
}
//# sourceMappingURL=client.js.map