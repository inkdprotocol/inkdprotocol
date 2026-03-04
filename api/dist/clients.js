"use strict";
/**
 * Inkd API Server — viem client factories
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPublicClient = buildPublicClient;
exports.buildWalletClient = buildWalletClient;
exports.normalizePrivateKey = normalizePrivateKey;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const config_js_1 = require("./config.js");
function buildPublicClient(cfg) {
    return (0, viem_1.createPublicClient)({
        chain: (0, config_js_1.getChain)(cfg.network),
        transport: (0, viem_1.http)(cfg.rpcUrl),
    });
}
function buildWalletClient(cfg, privateKey) {
    const account = (0, accounts_1.privateKeyToAccount)(privateKey);
    return {
        client: (0, viem_1.createWalletClient)({
            account,
            chain: (0, config_js_1.getChain)(cfg.network),
            transport: (0, viem_1.http)(cfg.rpcUrl),
        }),
        account,
        address: account.address,
    };
}
function normalizePrivateKey(key) {
    const hex = key.startsWith('0x') ? key : `0x${key}`;
    return hex;
}
//# sourceMappingURL=clients.js.map