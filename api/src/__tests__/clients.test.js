"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @inkd/api — clients.ts unit tests
 *
 * Covers buildPublicClient(), buildWalletClient(), and normalizePrivateKey()
 * without touching the network — viem client factories are mocked.
 */
const vitest_1 = require("vitest");
const chains_1 = require("viem/chains");
// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPublicClient = { type: 'publicClient', readContract: vitest_1.vi.fn() };
const mockWalletClient = { type: 'walletClient', writeContract: vitest_1.vi.fn() };
const mockAccount = {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    type: 'local',
};
vitest_1.vi.mock('viem', () => ({
    createPublicClient: vitest_1.vi.fn(() => mockPublicClient),
    createWalletClient: vitest_1.vi.fn(() => mockWalletClient),
    http: vitest_1.vi.fn((url) => ({ type: 'http', url })),
}));
vitest_1.vi.mock('viem/accounts', () => ({
    privateKeyToAccount: vitest_1.vi.fn(() => mockAccount),
}));
// import AFTER mocks are hoisted
const clients_js_1 = require("../clients.js");
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function testnetConfig(overrides = {}) {
    return {
        network: 'testnet',
        port: 3000,
        rpcUrl: undefined,
        apiKey: null,
        corsOrigin: '*',
        rateLimitWindowMs: 60_000,
        rateLimitMax: 100,
        serverWalletKey: undefined,
        serverWalletAddress: undefined,
        x402FacilitatorUrl: undefined,
        x402Enabled: false,
        contractsDeployed: false,
        ...overrides,
    };
}
function mainnetConfig(overrides = {}) {
    return testnetConfig({ network: 'mainnet', ...overrides });
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
});
// ─── buildPublicClient() ──────────────────────────────────────────────────────
(0, vitest_1.describe)('buildPublicClient()', () => {
    (0, vitest_1.it)('calls createPublicClient with testnet chain (baseSepolia)', () => {
        (0, clients_js_1.buildPublicClient)(testnetConfig());
        (0, vitest_1.expect)(viem_1.createPublicClient).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(viem_1.createPublicClient).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ chain: chains_1.baseSepolia }));
    });
    (0, vitest_1.it)('calls createPublicClient with mainnet chain (base)', () => {
        (0, clients_js_1.buildPublicClient)(mainnetConfig());
        (0, vitest_1.expect)(viem_1.createPublicClient).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(viem_1.createPublicClient).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ chain: chains_1.base }));
    });
    (0, vitest_1.it)('passes rpcUrl to http() transport when provided', () => {
        const rpcUrl = 'https://my-rpc.example.com';
        (0, clients_js_1.buildPublicClient)(testnetConfig({ rpcUrl }));
        (0, vitest_1.expect)(viem_1.http).toHaveBeenCalledWith(rpcUrl);
        (0, vitest_1.expect)(viem_1.createPublicClient).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ transport: vitest_1.expect.objectContaining({ url: rpcUrl }) }));
    });
    (0, vitest_1.it)('passes undefined to http() when rpcUrl is not set', () => {
        (0, clients_js_1.buildPublicClient)(testnetConfig({ rpcUrl: undefined }));
        (0, vitest_1.expect)(viem_1.http).toHaveBeenCalledWith(undefined);
    });
    (0, vitest_1.it)('returns the mocked public client', () => {
        const client = (0, clients_js_1.buildPublicClient)(testnetConfig());
        (0, vitest_1.expect)(client).toBe(mockPublicClient);
    });
});
// ─── buildWalletClient() ──────────────────────────────────────────────────────
(0, vitest_1.describe)('buildWalletClient()', () => {
    const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    (0, vitest_1.it)('calls privateKeyToAccount with the supplied private key', () => {
        (0, clients_js_1.buildWalletClient)(testnetConfig(), PRIVATE_KEY);
        (0, vitest_1.expect)(accounts_1.privateKeyToAccount).toHaveBeenCalledWith(PRIVATE_KEY);
    });
    (0, vitest_1.it)('calls createWalletClient with testnet chain', () => {
        (0, clients_js_1.buildWalletClient)(testnetConfig(), PRIVATE_KEY);
        (0, vitest_1.expect)(viem_1.createWalletClient).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ chain: chains_1.baseSepolia }));
    });
    (0, vitest_1.it)('calls createWalletClient with mainnet chain', () => {
        (0, clients_js_1.buildWalletClient)(mainnetConfig(), PRIVATE_KEY);
        (0, vitest_1.expect)(viem_1.createWalletClient).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ chain: chains_1.base }));
    });
    (0, vitest_1.it)('passes the derived account to createWalletClient', () => {
        (0, clients_js_1.buildWalletClient)(testnetConfig(), PRIVATE_KEY);
        (0, vitest_1.expect)(viem_1.createWalletClient).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ account: mockAccount }));
    });
    (0, vitest_1.it)('passes rpcUrl to http() transport when provided', () => {
        const rpcUrl = 'https://base-mainnet.example.com';
        (0, clients_js_1.buildWalletClient)(mainnetConfig({ rpcUrl }), PRIVATE_KEY);
        (0, vitest_1.expect)(viem_1.http).toHaveBeenCalledWith(rpcUrl);
    });
    (0, vitest_1.it)('returns { client, account, address } shape', () => {
        const result = (0, clients_js_1.buildWalletClient)(testnetConfig(), PRIVATE_KEY);
        (0, vitest_1.expect)(result).toMatchObject({
            client: mockWalletClient,
            account: mockAccount,
            address: mockAccount.address,
        });
    });
    (0, vitest_1.it)('returns correct address from derived account', () => {
        const result = (0, clients_js_1.buildWalletClient)(testnetConfig(), PRIVATE_KEY);
        (0, vitest_1.expect)(result.address).toBe(mockAccount.address);
    });
});
// ─── normalizePrivateKey() ────────────────────────────────────────────────────
(0, vitest_1.describe)('normalizePrivateKey()', () => {
    (0, vitest_1.it)('returns key unchanged when it already has 0x prefix', () => {
        const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        (0, vitest_1.expect)((0, clients_js_1.normalizePrivateKey)(key)).toBe(key);
    });
    (0, vitest_1.it)('prepends 0x when key is missing the prefix', () => {
        const raw = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const result = (0, clients_js_1.normalizePrivateKey)(raw);
        (0, vitest_1.expect)(result).toBe(`0x${raw}`);
    });
    (0, vitest_1.it)('does not double-prefix a key that already starts with 0x', () => {
        const key = '0xdeadbeef';
        (0, vitest_1.expect)((0, clients_js_1.normalizePrivateKey)(key)).not.toMatch(/^0x0x/);
    });
    (0, vitest_1.it)('returns a string starting with 0x in all cases', () => {
        (0, vitest_1.expect)((0, clients_js_1.normalizePrivateKey)('abc')).toMatch(/^0x/);
        (0, vitest_1.expect)((0, clients_js_1.normalizePrivateKey)('0xabc')).toMatch(/^0x/);
    });
    (0, vitest_1.it)('handles empty string input by prepending 0x', () => {
        (0, vitest_1.expect)((0, clients_js_1.normalizePrivateKey)('')).toBe('0x');
    });
    (0, vitest_1.it)('casts return type as `0x${string}`', () => {
        const result = (0, clients_js_1.normalizePrivateKey)('test');
        // TypeScript-level: result should be assignable to `0x${string}`
        const typed = result;
        (0, vitest_1.expect)(typed).toBe('0xtest');
    });
});
//# sourceMappingURL=clients.test.js.map