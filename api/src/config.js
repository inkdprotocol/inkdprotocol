"use strict";
/**
 * Inkd API Server — Configuration
 *
 * All config is via environment variables. See api/.env.example for defaults.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADDRESSES = void 0;
exports.loadConfig = loadConfig;
exports.getChain = getChain;
const chains_1 = require("viem/chains");
// ─── Network addresses (populated after contract deployment) ──────────────────
exports.ADDRESSES = {
    mainnet: {
        token: (process.env['INKD_TOKEN_ADDRESS'] ?? ''),
        registry: (process.env['INKD_REGISTRY_ADDRESS'] ?? ''),
        treasury: (process.env['INKD_TREASURY_ADDRESS'] ?? ''),
    },
    testnet: {
        token: (process.env['INKD_TOKEN_ADDRESS'] ?? ''),
        registry: (process.env['INKD_REGISTRY_ADDRESS'] ?? ''),
        treasury: (process.env['INKD_TREASURY_ADDRESS'] ?? ''),
    },
};
function loadConfig() {
    const network = (process.env['INKD_NETWORK'] ?? 'testnet');
    if (network !== 'mainnet' && network !== 'testnet') {
        throw new Error(`Invalid INKD_NETWORK: "${network}". Must be "mainnet" or "testnet".`);
    }
    const defaultRpc = network === 'mainnet'
        ? 'https://mainnet.base.org'
        : 'https://sepolia.base.org';
    const serverWalletKey = process.env['SERVER_WALLET_KEY'] ?? null;
    const serverWalletAddress = (process.env['SERVER_WALLET_ADDRESS'] ?? null);
    const treasuryAddress = (process.env['INKD_TREASURY_ADDRESS'] ?? null);
    return {
        port: parseInt(process.env['PORT'] ?? '3000', 10),
        network,
        rpcUrl: process.env['INKD_RPC_URL'] ?? defaultRpc,
        apiKey: process.env['INKD_API_KEY'] ?? null,
        corsOrigin: process.env['CORS_ORIGIN'] ?? '*',
        rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10),
        rateLimitMax: parseInt(process.env['RATE_LIMIT_MAX'] ?? '60', 10),
        // x402
        serverWalletKey,
        serverWalletAddress,
        treasuryAddress,
        usdcAddress: (network === 'mainnet'
            ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
            : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
        x402FacilitatorUrl: process.env['X402_FACILITATOR_URL'] ?? 'https://x402.org/facilitator',
        x402Enabled: Boolean(treasuryAddress) && process.env['X402_ENABLED'] !== 'false',
        cdpApiKeyId: process.env['CDP_API_KEY_ID'] ?? null,
        cdpApiKeySecret: process.env['CDP_API_KEY_SECRET'] ?? null,
    };
}
// ─── Chain helper ─────────────────────────────────────────────────────────────
function getChain(network) {
    return network === 'mainnet' ? chains_1.base : chains_1.baseSepolia;
}
//# sourceMappingURL=config.js.map