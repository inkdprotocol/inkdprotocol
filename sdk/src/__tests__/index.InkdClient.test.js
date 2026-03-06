"use strict";
/**
 * Tests for sdk/src/index.ts — InkdClient (viem-based) and ADDRESSES
 *
 * Strategy: mock viem's createPublicClient so no real RPC calls are made.
 * The wallet client is also a plain vi.fn() mock.
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
const viem_1 = require("viem");
// ─── Mock viem before importing index ────────────────────────────────────────
const mockReadContract = vitest_1.vi.fn();
const mockPublicClient = { readContract: mockReadContract };
vitest_1.vi.mock("viem", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        createPublicClient: vitest_1.vi.fn(() => mockPublicClient),
    };
});
// Import AFTER mocking
const index_js_1 = require("../index.js");
// ─── Mock Wallet Client ───────────────────────────────────────────────────────
function makeMockWallet(address = "0xuser000000000000000000000000000000000000") {
    return {
        getAddresses: vitest_1.vi.fn().mockResolvedValue([address]),
        writeContract: vitest_1.vi.fn().mockResolvedValue("0xtxhash"),
        chain: { id: 84532 },
    };
}
// ─── ADDRESSES export ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("ADDRESSES", () => {
    (0, vitest_1.it)("exports mainnet and testnet address objects", () => {
        (0, vitest_1.expect)(index_js_1.ADDRESSES).toHaveProperty("mainnet");
        (0, vitest_1.expect)(index_js_1.ADDRESSES).toHaveProperty("testnet");
    });
    (0, vitest_1.it)("mainnet has token, registry, treasury keys", () => {
        (0, vitest_1.expect)(index_js_1.ADDRESSES.mainnet).toHaveProperty("token");
        (0, vitest_1.expect)(index_js_1.ADDRESSES.mainnet).toHaveProperty("registry");
        (0, vitest_1.expect)(index_js_1.ADDRESSES.mainnet).toHaveProperty("treasury");
    });
    (0, vitest_1.it)("testnet has token, registry, treasury keys", () => {
        (0, vitest_1.expect)(index_js_1.ADDRESSES.testnet).toHaveProperty("token");
        (0, vitest_1.expect)(index_js_1.ADDRESSES.testnet).toHaveProperty("registry");
        (0, vitest_1.expect)(index_js_1.ADDRESSES.testnet).toHaveProperty("treasury");
    });
});
// ─── InkdClient construction ──────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — constructor", () => {
    (0, vitest_1.it)("constructs with default testnet network", () => {
        const wallet = makeMockWallet();
        const client = new index_js_1.InkdClient({ walletClient: wallet });
        (0, vitest_1.expect)(client).toBeInstanceOf(index_js_1.InkdClient);
    });
    (0, vitest_1.it)("constructs with explicit mainnet network", () => {
        const wallet = makeMockWallet();
        const client = new index_js_1.InkdClient({ walletClient: wallet, network: "mainnet" });
        (0, vitest_1.expect)(client).toBeInstanceOf(index_js_1.InkdClient);
    });
    (0, vitest_1.it)("constructs with explicit testnet network", () => {
        const wallet = makeMockWallet();
        const client = new index_js_1.InkdClient({ walletClient: wallet, network: "testnet" });
        (0, vitest_1.expect)(client).toBeInstanceOf(index_js_1.InkdClient);
    });
    (0, vitest_1.it)("constructs with custom rpcUrl", () => {
        const wallet = makeMockWallet();
        const client = new index_js_1.InkdClient({
            walletClient: wallet,
            rpcUrl: "https://my-custom-rpc.example.com",
        });
        (0, vitest_1.expect)(client).toBeInstanceOf(index_js_1.InkdClient);
    });
});
// ─── Token helpers ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — approveToken()", () => {
    let client;
    let wallet;
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
        wallet.writeContract.mockResolvedValue("0xapprove_tx");
    });
    (0, vitest_1.it)("calls writeContract with approve function", async () => {
        const hash = await client.approveToken();
        (0, vitest_1.expect)(wallet.writeContract).toHaveBeenCalledOnce();
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("approve");
        (0, vitest_1.expect)(hash).toBe("0xapprove_tx");
    });
    (0, vitest_1.it)("uses default amount of 1 ether when not specified", async () => {
        await client.approveToken();
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[1]).toBe((0, viem_1.parseEther)("1"));
    });
    (0, vitest_1.it)("uses custom amount when provided", async () => {
        const customAmount = (0, viem_1.parseEther)("5");
        await client.approveToken(customAmount);
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[1]).toBe(customAmount);
    });
    (0, vitest_1.it)("uses the first wallet address as account", async () => {
        await client.approveToken();
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.account).toBe("0xuser000000000000000000000000000000000000");
    });
});
(0, vitest_1.describe)("InkdClient — tokenBalance()", () => {
    let client;
    let wallet;
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
        mockReadContract.mockResolvedValue(1000n);
    });
    (0, vitest_1.it)("returns balance from readContract", async () => {
        const bal = await client.tokenBalance();
        (0, vitest_1.expect)(bal).toBe(1000n);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledOnce();
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("balanceOf");
    });
    (0, vitest_1.it)("uses caller address when no address specified", async () => {
        await client.tokenBalance();
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[0]).toBe("0xuser000000000000000000000000000000000000");
    });
    (0, vitest_1.it)("uses provided address instead of caller", async () => {
        const customAddr = "0xother00000000000000000000000000000000000";
        await client.tokenBalance(customAddr);
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[0]).toBe(customAddr);
    });
});
// ─── Projects ─────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — createProject()", () => {
    let client;
    let wallet;
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
        wallet.writeContract.mockResolvedValue("0xcreate_tx");
    });
    (0, vitest_1.it)("calls createProject with required fields", async () => {
        const hash = await client.createProject({ name: "MyProj", description: "A project" });
        (0, vitest_1.expect)(wallet.writeContract).toHaveBeenCalledOnce();
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("createProject");
        (0, vitest_1.expect)(hash).toBe("0xcreate_tx");
    });
    (0, vitest_1.it)("uses defaults for optional fields", async () => {
        await client.createProject({ name: "X", description: "Y" });
        const call = wallet.writeContract.mock.calls[0][0];
        const args = call.args;
        (0, vitest_1.expect)(args[0]).toBe("X"); // name
        (0, vitest_1.expect)(args[1]).toBe("Y"); // description
        (0, vitest_1.expect)(args[2]).toBe("MIT"); // license default
        (0, vitest_1.expect)(args[3]).toBe(""); // readmeHash default
        (0, vitest_1.expect)(args[4]).toBe(""); // agentEndpoint default
        (0, vitest_1.expect)(args[5]).toBe(false); // isAgent default
        (0, vitest_1.expect)(args[6]).toBe(true); // isPublic default
    });
    (0, vitest_1.it)("passes custom optional fields", async () => {
        await client.createProject({
            name: "AgentProj",
            description: "An agent",
            license: "Apache-2.0",
            readmeHash: "arweave-hash-abc",
            isAgent: true,
            isPublic: false,
            agentEndpoint: "https://agent.example.com",
        });
        const call = wallet.writeContract.mock.calls[0][0];
        const args = call.args;
        (0, vitest_1.expect)(args[2]).toBe("Apache-2.0");
        (0, vitest_1.expect)(args[3]).toBe("arweave-hash-abc");
        (0, vitest_1.expect)(args[4]).toBe("https://agent.example.com");
        (0, vitest_1.expect)(args[5]).toBe(true);
        (0, vitest_1.expect)(args[6]).toBe(false);
    });
    (0, vitest_1.it)("includes account from wallet", async () => {
        await client.createProject({ name: "P", description: "D" });
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.account).toBe("0xuser000000000000000000000000000000000000");
    });
});
// ─── pushVersion ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — pushVersion()", () => {
    let client;
    let wallet;
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
        wallet.writeContract.mockResolvedValue("0xpush_tx");
        mockReadContract.mockResolvedValue(500n); // versionFee
    });
    (0, vitest_1.it)("fetches version fee then calls pushVersion", async () => {
        const hash = await client.pushVersion(1n, {
            arweaveHash: "ar-hash-xyz",
            versionTag: "v0.9.1",
        });
        // first readContract call is getVersionFee
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledOnce();
        const feeCall = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(feeCall.functionName).toBe("versionFee");
        (0, vitest_1.expect)(wallet.writeContract).toHaveBeenCalledOnce();
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("pushVersion");
        (0, vitest_1.expect)(call.value).toBe(500n);
        (0, vitest_1.expect)(hash).toBe("0xpush_tx");
    });
    (0, vitest_1.it)("passes correct args to pushVersion", async () => {
        await client.pushVersion(42n, {
            arweaveHash: "ar-hash-42",
            versionTag: "v0.9.2",
            changelog: "Fixed a bug",
        });
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[0]).toBe(42n);
        (0, vitest_1.expect)(call.args[1]).toBe("ar-hash-42");
        (0, vitest_1.expect)(call.args[2]).toBe("v0.9.2");
        (0, vitest_1.expect)(call.args[3]).toBe("Fixed a bug");
    });
    (0, vitest_1.it)("defaults changelog to empty string when omitted", async () => {
        await client.pushVersion(1n, { arweaveHash: "h", versionTag: "v1" });
        const call = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[3]).toBe("");
    });
});
// ─── getProject ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — getProject()", () => {
    let client;
    let wallet;
    const fakeProject = {
        id: 1n, name: "Test", description: "Desc", license: "MIT",
        readmeHash: "", agentEndpoint: "", owner: "0xowner",
        isAgent: false, isPublic: true, createdAt: 0n, versionCount: 0n, exists: true,
    };
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        mockReadContract.mockResolvedValue(fakeProject);
    });
    (0, vitest_1.it)("calls getProject and returns result", async () => {
        const result = await client.getProject(1n);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledOnce();
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("getProject");
        (0, vitest_1.expect)(call.args[0]).toBe(1n);
        (0, vitest_1.expect)(result).toEqual(fakeProject);
    });
});
// ─── getVersions ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — getVersions()", () => {
    let client;
    let wallet;
    const fakeVersions = [
        { projectId: 1n, arweaveHash: "ar-abc", versionTag: "v0.1.0", changelog: "", pushedBy: "0xa", pushedAt: 1000n },
    ];
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        mockReadContract.mockResolvedValue(fakeVersions);
    });
    (0, vitest_1.it)("calls getVersions with projectId and returns array", async () => {
        const result = await client.getVersions(1n);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledOnce();
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("getVersions");
        (0, vitest_1.expect)(call.args[0]).toBe(1n);
        (0, vitest_1.expect)(result).toEqual(fakeVersions);
    });
});
// ─── getVersionFee ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — getVersionFee()", () => {
    let client;
    let wallet;
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        mockReadContract.mockResolvedValue(250n);
    });
    (0, vitest_1.it)("reads versionFee from contract", async () => {
        const fee = await client.getVersionFee();
        (0, vitest_1.expect)(fee).toBe(250n);
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("versionFee");
    });
});
// ─── transferProject ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — transferProject()", () => {
    let client;
    let wallet;
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
        wallet.writeContract.mockResolvedValue("0xtransfer_tx");
        mockReadContract.mockResolvedValue(1000n); // transferFee
    });
    (0, vitest_1.it)("reads transferFee then calls transferProject", async () => {
        const newOwner = "0xnewowner000000000000000000000000000000000";
        const hash = await client.transferProject(7n, newOwner);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledOnce();
        const feeCall = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(feeCall.functionName).toBe("transferFee");
        (0, vitest_1.expect)(wallet.writeContract).toHaveBeenCalledOnce();
        const txCall = wallet.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(txCall.functionName).toBe("transferProject");
        (0, vitest_1.expect)(txCall.args[0]).toBe(7n);
        (0, vitest_1.expect)(txCall.args[1]).toBe(newOwner);
        (0, vitest_1.expect)(txCall.value).toBe(1000n);
        (0, vitest_1.expect)(hash).toBe("0xtransfer_tx");
    });
});
// ─── getAgentProjects ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — getAgentProjects()", () => {
    let client;
    let wallet;
    (0, vitest_1.beforeEach)(() => {
        wallet = makeMockWallet();
        client = new index_js_1.InkdClient({ walletClient: wallet });
        vitest_1.vi.clearAllMocks();
        mockReadContract.mockResolvedValue([1n, 2n, 3n]);
    });
    (0, vitest_1.it)("calls getAgentProjects with default offsets", async () => {
        const result = await client.getAgentProjects();
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledOnce();
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("getAgentProjects");
        (0, vitest_1.expect)(call.args[0]).toBe(0n);
        (0, vitest_1.expect)(call.args[1]).toBe(100n);
        (0, vitest_1.expect)(result).toEqual([1n, 2n, 3n]);
    });
    (0, vitest_1.it)("accepts custom offset and limit", async () => {
        await client.getAgentProjects(10n, 25n);
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[0]).toBe(10n);
        (0, vitest_1.expect)(call.args[1]).toBe(25n);
    });
    (0, vitest_1.it)("returns empty array when no agent projects", async () => {
        mockReadContract.mockResolvedValue([]);
        const result = await client.getAgentProjects();
        (0, vitest_1.expect)(result).toEqual([]);
    });
});
// ─── Re-exports smoke test ────────────────────────────────────────────────────
(0, vitest_1.describe)("index.ts — re-exports", () => {
    (0, vitest_1.it)("exports watchProjectCreated from events", async () => {
        const mod = await Promise.resolve().then(() => __importStar(require("../index.js")));
        (0, vitest_1.expect)(typeof mod.watchProjectCreated).toBe("function");
    });
    (0, vitest_1.it)("exports watchVersionPushed from events", async () => {
        const mod = await Promise.resolve().then(() => __importStar(require("../index.js")));
        (0, vitest_1.expect)(typeof mod.watchVersionPushed).toBe("function");
    });
    (0, vitest_1.it)("exports watchRegistryEvents from events", async () => {
        const mod = await Promise.resolve().then(() => __importStar(require("../index.js")));
        (0, vitest_1.expect)(typeof mod.watchRegistryEvents).toBe("function");
    });
    (0, vitest_1.it)("exports batchGetProjects from multicall", async () => {
        const mod = await Promise.resolve().then(() => __importStar(require("../index.js")));
        (0, vitest_1.expect)(typeof mod.batchGetProjects).toBe("function");
    });
    (0, vitest_1.it)("exports batchGetVersions from multicall", async () => {
        const mod = await Promise.resolve().then(() => __importStar(require("../index.js")));
        (0, vitest_1.expect)(typeof mod.batchGetVersions).toBe("function");
    });
    (0, vitest_1.it)("exports batchGetFees from multicall", async () => {
        const mod = await Promise.resolve().then(() => __importStar(require("../index.js")));
        (0, vitest_1.expect)(typeof mod.batchGetFees).toBe("function");
    });
    (0, vitest_1.it)("exports batchGetProjectsWithVersions from multicall", async () => {
        const mod = await Promise.resolve().then(() => __importStar(require("../index.js")));
        (0, vitest_1.expect)(typeof mod.batchGetProjectsWithVersions).toBe("function");
    });
});
//# sourceMappingURL=index.InkdClient.test.js.map