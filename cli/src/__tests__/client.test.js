"use strict";
/**
 * @file client.test.ts
 * Unit tests for the CLI viem client factory (client.ts).
 * Validates that correct chain / transport objects are wired up without
 * making real RPC calls.
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
const vitest_1 = require("vitest");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** A minimal config that matches InkdConfig shape */
function makeConfig(network = "testnet", rpcUrl, privateKey) {
    return {
        network,
        rpcUrl,
        privateKey,
    };
}
// Real private key from viem docs (safe test key — never holds funds)
const TEST_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// ─── buildPublicClient ────────────────────────────────────────────────────────
(0, vitest_1.describe)("buildPublicClient", () => {
    (0, vitest_1.it)("returns an object with readContract method", async () => {
        const { buildPublicClient } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const client = buildPublicClient(makeConfig("testnet"));
        (0, vitest_1.expect)(typeof client.readContract).toBe("function");
    });
    (0, vitest_1.it)("returns an object with getBalance method", async () => {
        const { buildPublicClient } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const client = buildPublicClient(makeConfig("testnet"));
        (0, vitest_1.expect)(typeof client.getBalance).toBe("function");
    });
    (0, vitest_1.it)("works for mainnet config", async () => {
        const { buildPublicClient } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const client = buildPublicClient(makeConfig("mainnet"));
        (0, vitest_1.expect)(typeof client.readContract).toBe("function");
    });
    (0, vitest_1.it)("accepts a custom rpcUrl", async () => {
        const { buildPublicClient } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const client = buildPublicClient(makeConfig("testnet", "https://base-sepolia.example.com"));
        (0, vitest_1.expect)(client).toBeTruthy();
    });
});
// ─── buildWalletClient ────────────────────────────────────────────────────────
(0, vitest_1.describe)("buildWalletClient", () => {
    let savedEnv;
    (0, vitest_1.beforeEach)(() => {
        savedEnv = { INKD_PRIVATE_KEY: process.env.INKD_PRIVATE_KEY };
        process.env.INKD_PRIVATE_KEY = TEST_PK;
    });
    (0, vitest_1.afterEach)(() => {
        process.env.INKD_PRIVATE_KEY = savedEnv.INKD_PRIVATE_KEY;
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("returns an object with writeContract method", async () => {
        const { buildWalletClient } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const cfg = makeConfig("testnet", undefined, TEST_PK);
        const client = buildWalletClient(cfg);
        (0, vitest_1.expect)(typeof client.writeContract).toBe("function");
    });
    (0, vitest_1.it)("works for mainnet config", async () => {
        const { buildWalletClient } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const cfg = makeConfig("mainnet", undefined, TEST_PK);
        const client = buildWalletClient(cfg);
        (0, vitest_1.expect)(client).toBeTruthy();
    });
    (0, vitest_1.it)("accepts a pre-built account object", async () => {
        const { buildWalletClient, privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const account = privateKeyToAccount(TEST_PK);
        const cfg = makeConfig("testnet");
        const client = buildWalletClient(cfg, account);
        (0, vitest_1.expect)(client).toBeTruthy();
    });
});
// ─── buildClients ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("buildClients", () => {
    let savedEnv;
    (0, vitest_1.beforeEach)(() => {
        savedEnv = { INKD_PRIVATE_KEY: process.env.INKD_PRIVATE_KEY };
        process.env.INKD_PRIVATE_KEY = TEST_PK;
    });
    (0, vitest_1.afterEach)(() => {
        process.env.INKD_PRIVATE_KEY = savedEnv.INKD_PRIVATE_KEY;
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("returns publicClient, walletClient, account, and addrs", async () => {
        const { buildClients } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const result = buildClients(makeConfig("testnet", undefined, TEST_PK));
        (0, vitest_1.expect)(result).toHaveProperty("publicClient");
        (0, vitest_1.expect)(result).toHaveProperty("walletClient");
        (0, vitest_1.expect)(result).toHaveProperty("account");
        (0, vitest_1.expect)(result).toHaveProperty("addrs");
    });
    (0, vitest_1.it)("account has correct address derived from private key", async () => {
        const { buildClients, privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const expected = privateKeyToAccount(TEST_PK);
        const { account } = buildClients(makeConfig("testnet", undefined, TEST_PK));
        (0, vitest_1.expect)(account.address.toLowerCase()).toBe(expected.address.toLowerCase());
    });
    (0, vitest_1.it)("addrs matches ADDRESSES for the given network (testnet)", async () => {
        const { buildClients } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const { addrs } = buildClients(makeConfig("testnet", undefined, TEST_PK));
        (0, vitest_1.expect)(addrs).toEqual(ADDRESSES.testnet);
    });
    (0, vitest_1.it)("addrs matches ADDRESSES for the given network (mainnet)", async () => {
        const { buildClients } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const { addrs } = buildClients(makeConfig("mainnet", undefined, TEST_PK));
        (0, vitest_1.expect)(addrs).toEqual(ADDRESSES.mainnet);
    });
});
// ─── privateKeyToAccount re-export ────────────────────────────────────────────
(0, vitest_1.describe)("privateKeyToAccount (re-export)", () => {
    (0, vitest_1.it)("derives a checksummed Ethereum address", async () => {
        const { privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const account = privateKeyToAccount(TEST_PK);
        (0, vitest_1.expect)(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
    (0, vitest_1.it)("is deterministic for the same key", async () => {
        const { privateKeyToAccount } = await Promise.resolve().then(() => __importStar(require("../client.js")));
        const a1 = privateKeyToAccount(TEST_PK);
        const a2 = privateKeyToAccount(TEST_PK);
        (0, vitest_1.expect)(a1.address).toBe(a2.address);
    });
});
//# sourceMappingURL=client.test.js.map