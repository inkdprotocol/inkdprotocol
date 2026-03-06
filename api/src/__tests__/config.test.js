"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @inkd/api — config.ts unit tests
 *
 * Covers loadConfig() all branches, getChain(), and ADDRESSES shape.
 * loadConfig() reads process.env at call time, so we can mutate env freely.
 */
const vitest_1 = require("vitest");
const chains_1 = require("viem/chains");
const config_js_1 = require("../config.js");
// Keys mutated by these tests
const WATCHED_KEYS = [
    'INKD_NETWORK',
    'PORT',
    'INKD_RPC_URL',
    'INKD_API_KEY',
    'CORS_ORIGIN',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX',
    'SERVER_WALLET_KEY',
    'SERVER_WALLET_ADDRESS',
    'X402_FACILITATOR_URL',
    'X402_ENABLED',
];
// Snapshot before any test runs
const ORIGINAL_ENV = {};
for (const k of WATCHED_KEYS) {
    ORIGINAL_ENV[k] = process.env[k];
}
(0, vitest_1.afterEach)(() => {
    for (const k of WATCHED_KEYS) {
        if (ORIGINAL_ENV[k] === undefined) {
            delete process.env[k];
        }
        else {
            process.env[k] = ORIGINAL_ENV[k];
        }
    }
});
// ─── loadConfig() — network ───────────────────────────────────────────────────
(0, vitest_1.describe)('loadConfig() — network', () => {
    (0, vitest_1.it)('defaults to testnet when INKD_NETWORK is not set', () => {
        delete process.env['INKD_NETWORK'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().network).toBe('testnet');
    });
    (0, vitest_1.it)('accepts "mainnet"', () => {
        process.env['INKD_NETWORK'] = 'mainnet';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().network).toBe('mainnet');
    });
    (0, vitest_1.it)('accepts "testnet"', () => {
        process.env['INKD_NETWORK'] = 'testnet';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().network).toBe('testnet');
    });
    (0, vitest_1.it)('throws on invalid network value', () => {
        process.env['INKD_NETWORK'] = 'polygon';
        (0, vitest_1.expect)(() => (0, config_js_1.loadConfig)()).toThrow('Invalid INKD_NETWORK');
        (0, vitest_1.expect)(() => (0, config_js_1.loadConfig)()).toThrow('"polygon"');
    });
});
// ─── loadConfig() — port ──────────────────────────────────────────────────────
(0, vitest_1.describe)('loadConfig() — port', () => {
    (0, vitest_1.it)('defaults port to 3000', () => {
        delete process.env['PORT'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().port).toBe(3000);
    });
    (0, vitest_1.it)('reads PORT from env', () => {
        process.env['PORT'] = '8080';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().port).toBe(8080);
    });
});
// ─── loadConfig() — rpcUrl ───────────────────────────────────────────────────
(0, vitest_1.describe)('loadConfig() — rpcUrl', () => {
    (0, vitest_1.it)('defaults to sepolia endpoint for testnet', () => {
        delete process.env['INKD_NETWORK'];
        delete process.env['INKD_RPC_URL'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().rpcUrl).toBe('https://sepolia.base.org');
    });
    (0, vitest_1.it)('defaults to mainnet endpoint when network=mainnet', () => {
        process.env['INKD_NETWORK'] = 'mainnet';
        delete process.env['INKD_RPC_URL'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().rpcUrl).toBe('https://mainnet.base.org');
    });
    (0, vitest_1.it)('uses custom INKD_RPC_URL when set', () => {
        process.env['INKD_RPC_URL'] = 'https://custom.rpc.example.com';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().rpcUrl).toBe('https://custom.rpc.example.com');
    });
});
// ─── loadConfig() — apiKey ───────────────────────────────────────────────────
(0, vitest_1.describe)('loadConfig() — apiKey', () => {
    (0, vitest_1.it)('defaults apiKey to null (dev/open mode)', () => {
        delete process.env['INKD_API_KEY'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().apiKey).toBeNull();
    });
    (0, vitest_1.it)('reads INKD_API_KEY from env', () => {
        process.env['INKD_API_KEY'] = 'sk-test-abc123';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().apiKey).toBe('sk-test-abc123');
    });
});
// ─── loadConfig() — CORS ─────────────────────────────────────────────────────
(0, vitest_1.describe)('loadConfig() — CORS', () => {
    (0, vitest_1.it)('defaults corsOrigin to *', () => {
        delete process.env['CORS_ORIGIN'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().corsOrigin).toBe('*');
    });
    (0, vitest_1.it)('reads CORS_ORIGIN from env', () => {
        process.env['CORS_ORIGIN'] = 'https://inkdprotocol.xyz';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().corsOrigin).toBe('https://inkdprotocol.xyz');
    });
});
// ─── loadConfig() — rate limiting ────────────────────────────────────────────
(0, vitest_1.describe)('loadConfig() — rate limiting', () => {
    (0, vitest_1.it)('defaults rateLimitWindowMs to 60000', () => {
        delete process.env['RATE_LIMIT_WINDOW_MS'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().rateLimitWindowMs).toBe(60_000);
    });
    (0, vitest_1.it)('reads RATE_LIMIT_WINDOW_MS from env', () => {
        process.env['RATE_LIMIT_WINDOW_MS'] = '30000';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().rateLimitWindowMs).toBe(30_000);
    });
    (0, vitest_1.it)('defaults rateLimitMax to 60', () => {
        delete process.env['RATE_LIMIT_MAX'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().rateLimitMax).toBe(60);
    });
    (0, vitest_1.it)('reads RATE_LIMIT_MAX from env', () => {
        process.env['RATE_LIMIT_MAX'] = '120';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().rateLimitMax).toBe(120);
    });
});
// ─── loadConfig() — x402 / server wallet ─────────────────────────────────────
(0, vitest_1.describe)('loadConfig() — x402 / server wallet', () => {
    (0, vitest_1.it)('serverWalletKey defaults to null', () => {
        delete process.env['SERVER_WALLET_KEY'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().serverWalletKey).toBeNull();
    });
    (0, vitest_1.it)('reads SERVER_WALLET_KEY', () => {
        process.env['SERVER_WALLET_KEY'] = '0xdeadbeefdeadbeef';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().serverWalletKey).toBe('0xdeadbeefdeadbeef');
    });
    (0, vitest_1.it)('serverWalletAddress defaults to null', () => {
        delete process.env['INKD_TREASURY_ADDRESS'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().serverWalletAddress).toBeNull();
    });
    (0, vitest_1.it)('reads SERVER_WALLET_ADDRESS', () => {
        process.env['INKD_TREASURY_ADDRESS'] = '0xABCDEF1234567890ABCDef1234567890AbCdEf01';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().treasuryAddress).toBe('0xABCDEF1234567890ABCDef1234567890AbCdEf01');
    });
    (0, vitest_1.it)('x402Enabled is false when treasuryAddress not set', () => {
        delete process.env['INKD_TREASURY_ADDRESS'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().x402Enabled).toBe(false);
    });
    (0, vitest_1.it)('x402Enabled is true when treasuryAddress is set', () => {
        process.env['INKD_TREASURY_ADDRESS'] = '0xABCDEF1234567890ABCDef1234567890AbCdEf01';
        delete process.env['X402_ENABLED'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().x402Enabled).toBe(true);
    });
    (0, vitest_1.it)('x402Enabled is false when X402_ENABLED=false even with wallet address', () => {
        process.env['INKD_TREASURY_ADDRESS'] = '0xABCDEF1234567890ABCDef1234567890AbCdEf01';
        process.env['X402_ENABLED'] = 'false';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().x402Enabled).toBe(false);
    });
    (0, vitest_1.it)('defaults x402FacilitatorUrl to Coinbase endpoint', () => {
        delete process.env['X402_FACILITATOR_URL'];
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().x402FacilitatorUrl).toBe('https://x402.org/facilitator');
    });
    (0, vitest_1.it)('reads X402_FACILITATOR_URL from env', () => {
        process.env['X402_FACILITATOR_URL'] = 'https://my.facilitator.io';
        (0, vitest_1.expect)((0, config_js_1.loadConfig)().x402FacilitatorUrl).toBe('https://my.facilitator.io');
    });
});
// ─── getChain() ───────────────────────────────────────────────────────────────
(0, vitest_1.describe)('getChain()', () => {
    (0, vitest_1.it)('returns base (mainnet chain) for "mainnet"', () => {
        (0, vitest_1.expect)((0, config_js_1.getChain)('mainnet')).toEqual(chains_1.base);
    });
    (0, vitest_1.it)('returns baseSepolia for "testnet"', () => {
        (0, vitest_1.expect)((0, config_js_1.getChain)('testnet')).toEqual(chains_1.baseSepolia);
    });
});
// ─── ADDRESSES constant ───────────────────────────────────────────────────────
(0, vitest_1.describe)('ADDRESSES', () => {
    (0, vitest_1.it)('has mainnet and testnet keys', () => {
        (0, vitest_1.expect)(config_js_1.ADDRESSES).toHaveProperty('mainnet');
        (0, vitest_1.expect)(config_js_1.ADDRESSES).toHaveProperty('testnet');
    });
    (0, vitest_1.it)('mainnet entry has token/registry/treasury fields', () => {
        (0, vitest_1.expect)(config_js_1.ADDRESSES.mainnet).toMatchObject({
            token: vitest_1.expect.any(String),
            registry: vitest_1.expect.any(String),
            treasury: vitest_1.expect.any(String),
        });
    });
    (0, vitest_1.it)('testnet entry has token/registry/treasury fields', () => {
        (0, vitest_1.expect)(config_js_1.ADDRESSES.testnet).toMatchObject({
            token: vitest_1.expect.any(String),
            registry: vitest_1.expect.any(String),
            treasury: vitest_1.expect.any(String),
        });
    });
});
//# sourceMappingURL=config.test.js.map