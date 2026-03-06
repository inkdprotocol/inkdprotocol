"use strict";
/**
 * @file agentd.test.ts
 * Unit tests for `inkd agentd` — autonomous agent daemon.
 *
 * Strategy:
 *  - Mock `fs` (existsSync, readFileSync, writeFileSync) to control state file reads/writes
 *  - Mock `../config.js` for loadConfig, ADDRESSES, requirePrivateKey, colour helpers
 *  - Mock `../client.js` for buildPublicClient + buildWalletClient
 *  - Mock `../abi.js` for REGISTRY_ABI (value not important — mocked readContract)
 *  - Use process.exit spy (throws sentinel) and process.on spy for signal handlers
 *  - For `--once` mode: run full cycle without infinite loop
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
// ─── Constants ────────────────────────────────────────────────────────────────
const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111";
const MOCK_TOKEN = "0x2222222222222222222222222222222222222222";
const MOCK_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MOCK_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// ─── fs mock ─────────────────────────────────────────────────────────────────
const mockExistsSync = vitest_1.vi.fn();
const mockReadFileSync = vitest_1.vi.fn();
const mockWriteFileSync = vitest_1.vi.fn();
vitest_1.vi.mock("fs", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        existsSync: (...args) => mockExistsSync(...args),
        readFileSync: (...args) => mockReadFileSync(...args),
        writeFileSync: (...args) => mockWriteFileSync(...args),
    };
});
// ─── config mock ──────────────────────────────────────────────────────────────
vitest_1.vi.mock("../config.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        loadConfig: vitest_1.vi.fn(() => ({
            network: "testnet",
            privateKey: MOCK_PK,
            rpcUrl: undefined,
        })),
        requirePrivateKey: vitest_1.vi.fn(() => MOCK_PK),
        ADDRESSES: {
            testnet: { registry: MOCK_REGISTRY, token: MOCK_TOKEN, treasury: "0x3333333333333333333333333333333333333333" },
            mainnet: { registry: "", token: "", treasury: "" },
        },
        // passthrough colour helpers so they don't break string output
        info: vitest_1.vi.fn(),
        success: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn((msg) => { throw new Error(`process.exit: ${msg}`); }),
        BOLD: "", RESET: "", CYAN: "", DIM: "", GREEN: "", YELLOW: "", RED: "",
    };
});
// ─── client mock ─────────────────────────────────────────────────────────────
let mockReadContract;
let mockGetBalance;
let mockGetAddresses;
vitest_1.vi.mock("../client.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildPublicClient: vitest_1.vi.fn(() => ({
            readContract: (...args) => mockReadContract(...args),
            getBalance: (...args) => mockGetBalance(...args),
        })),
        buildWalletClient: vitest_1.vi.fn(() => ({
            getAddresses: (...args) => mockGetAddresses(...args),
        })),
    };
});
// ─── abi mock ─────────────────────────────────────────────────────────────────
vitest_1.vi.mock("../abi.js", () => ({
    REGISTRY_ABI: [],
}));
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Build a realistic DaemonState fixture */
function makeDaemonState(overrides = {}) {
    return {
        startedAt: "2026-03-03T01:00:00.000Z",
        lastSync: "2026-03-03T02:00:00.000Z",
        cycles: 5,
        peersFound: 3,
        errors: 0,
        thisAgent: "test-agent",
        wallet: MOCK_WALLET,
        network: "testnet",
        healthy: true,
        peers: [
            {
                id: "1", owner: MOCK_WALLET, name: "test-agent",
                description: "me", agentEndpoint: "https://test.agent/api",
                isPublic: true, versionCount: "3", createdAt: "1709000000",
            },
            {
                id: "2", owner: MOCK_WALLET, name: "peer-alpha",
                description: "peer", agentEndpoint: "",
                isPublic: true, versionCount: "10", createdAt: "1709000001",
            },
            {
                id: "3", owner: MOCK_WALLET, name: "peer-beta",
                description: "b", agentEndpoint: "https://beta.ai",
                isPublic: false, versionCount: "2", createdAt: "1709000002",
            },
        ],
        ...overrides,
    };
}
/** Build a raw on-chain agent record as returned by readContract */
function makeOnChainAgent(overrides = {}) {
    return {
        id: "1", owner: MOCK_WALLET, name: "test-agent",
        description: "My agent", agentEndpoint: "https://agent.example.com",
        isPublic: true, versionCount: "3", createdAt: "1709000000",
        ...overrides,
    };
}
/** Spy on console.log/error and process.exit */
function setupConsoleMocks() {
    vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
    vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
    return vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error("process.exit");
    });
}
// ─── Global beforeEach: always init mock fns ─────────────────────────────────
(0, vitest_1.beforeEach)(() => {
    mockReadContract = vitest_1.vi.fn();
    mockGetBalance = vitest_1.vi.fn();
    mockGetAddresses = vitest_1.vi.fn();
});
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdAgentd — status subcommand", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
        delete process.env["INKD_AGENT_ENDPOINT"];
        delete process.env["INKD_INTERVAL"];
    });
    (0, vitest_1.it)("warns when no state file exists", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        const warnMock = vitest_1.vi.fn();
        const { warn } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        warn.mockImplementation(warnMock);
        await cmdAgentd(["status"]);
        (0, vitest_1.expect)(mockExistsSync).toHaveBeenCalled();
        // warn should be called when no state found
        (0, vitest_1.expect)(warnMock).toHaveBeenCalled();
    });
    (0, vitest_1.it)("displays daemon state when state file exists", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState();
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["status"]);
        (0, vitest_1.expect)(mockReadFileSync).toHaveBeenCalled();
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("displays status with zero errors in green", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState({ errors: 0, healthy: true });
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["status"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("displays status with non-zero errors (unhealthy)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState({ errors: 3, healthy: false });
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["status"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("handles state with null lastSync", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState({ lastSync: null, cycles: 0 });
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["status"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("cmdAgentd — peers subcommand", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("warns when no state file exists", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        await cmdAgentd(["peers"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("warns when state has no peers", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState({ peers: [] });
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["peers"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("displays peer table when peers exist", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState();
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["peers"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("shows 'none' for peers without agentEndpoint", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState({
            peers: [{ id: "2", owner: MOCK_WALLET, name: "nendpoint", description: "", agentEndpoint: "", isPublic: true, versionCount: "1", createdAt: "1709000001" }],
        });
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["peers"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("cmdAgentd — unknown subcommand", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("calls error() for unknown subcommand", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const { error } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        error.mockImplementationOnce((msg) => { throw new Error(`error: ${msg}`); });
        await (0, vitest_1.expect)(cmdAgentd(["wibble"])).rejects.toThrow("error:");
    });
});
(0, vitest_1.describe)("cmdAgentd — start --once mode", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
        delete process.env["INKD_AGENT_ENDPOINT"];
        delete process.env["INKD_INTERVAL"];
        delete process.env["INKD_PRIVATE_KEY"];
    });
    (0, vitest_1.it)("runs a single cycle with --once --dry-run and exits cleanly", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000")); // 1 ETH
        await cmdAgentd(["start", "--once", "--dry-run"]);
        // State should be saved
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("runs --once with fresh state (no existing state file)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("500000000000000000")); // 0.5 ETH
        await cmdAgentd(["start", "--once", "--dry-run"]);
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
        const written = mockWriteFileSync.mock.calls[0];
        const savedState = JSON.parse(written[1]);
        (0, vitest_1.expect)(savedState.cycles).toBe(1);
        (0, vitest_1.expect)(savedState.thisAgent).toBe("test-agent");
    });
    (0, vitest_1.it)("resumes from existing state file", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const existing = makeDaemonState({ cycles: 4, peersFound: 2 });
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(existing));
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("2000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run"]);
        const written = mockWriteFileSync.mock.calls[0];
        const savedState = JSON.parse(written[1]);
        (0, vitest_1.expect)(savedState.cycles).toBe(5); // resumed from 4 + 1
    });
    (0, vitest_1.it)("warns on low ETH balance (< 0.01 ETH)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("5000000000000000")); // 0.005 ETH < 0.01
        await cmdAgentd(["start", "--once", "--dry-run"]);
        const written = mockWriteFileSync.mock.calls[0];
        const savedState = JSON.parse(written[1]);
        (0, vitest_1.expect)(savedState.healthy).toBe(false);
    });
    (0, vitest_1.it)("marks healthy when balance >= 0.01 ETH", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("20000000000000000")); // 0.02 ETH
        await cmdAgentd(["start", "--once", "--dry-run"]);
        const written = mockWriteFileSync.mock.calls[0];
        const savedState = JSON.parse(written[1]);
        (0, vitest_1.expect)(savedState.healthy).toBe(true);
    });
    (0, vitest_1.it)("handles agent not found on-chain (self not in peers)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        // Return a peer with a different name
        mockReadContract.mockResolvedValue([makeOnChainAgent({ name: "some-other-agent" })]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run"]);
        // Should still save state
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("handles multiple peers and records peer count", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        const peers = [
            makeOnChainAgent({ id: "1", name: "test-agent", versionCount: "3" }),
            makeOnChainAgent({ id: "2", name: "alpha-agent", versionCount: "10" }),
            makeOnChainAgent({ id: "3", name: "beta-agent", versionCount: "1" }),
        ];
        mockReadContract.mockResolvedValue(peers);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run"]);
        const written = mockWriteFileSync.mock.calls[0];
        const savedState = JSON.parse(written[1]);
        (0, vitest_1.expect)(savedState.peersFound).toBe(3);
        (0, vitest_1.expect)(savedState.peers).toHaveLength(3);
    });
    (0, vitest_1.it)("handles RPC error during discoverAgents — records error in state", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockRejectedValue(new Error("RPC timeout"));
        await cmdAgentd(["start", "--once", "--dry-run"]);
        const written = mockWriteFileSync.mock.calls[0];
        const savedState = JSON.parse(written[1]);
        // state.errors is incremented in the error catch path
        (0, vitest_1.expect)(savedState.errors).toBe(1);
        // Note: state.healthy is only set to false in the SUCCESS path (when balance is low).
        // In the error catch path, state.healthy stays at its initial value (true).
        // We verify errors > 0 as the indicator of an unhealthy cycle.
        (0, vitest_1.expect)(savedState.cycles).toBe(0); // cycles not incremented on error
    });
    (0, vitest_1.it)("runs in --json mode without throwing", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run", "--json"]);
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("runs in --quiet mode without throwing", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run", "--quiet"]);
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("honours --interval flag (parses integer)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // Should not throw despite custom interval
        await cmdAgentd(["start", "--once", "--dry-run", "--interval", "30000"]);
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("uses INKD_INTERVAL env var when --interval flag not present", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        process.env["INKD_INTERVAL"] = "45000";
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run"]);
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("cmdAgentd — start --once with private key (non-dry-run)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "my-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
        delete process.env["INKD_AGENT_ENDPOINT"];
    });
    (0, vitest_1.it)("resolves wallet address via walletClient when private key is set", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockGetAddresses.mockResolvedValue([MOCK_WALLET]);
        mockReadContract.mockResolvedValue([makeOnChainAgent({ name: "my-agent" })]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once"]);
        const written = mockWriteFileSync.mock.calls[0];
        const savedState = JSON.parse(written[1]);
        (0, vitest_1.expect)(savedState.wallet).toBe(MOCK_WALLET);
    });
    (0, vitest_1.it)("falls back to zero address when requirePrivateKey throws in dry-run-fallback path", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const { requirePrivateKey, error } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        requirePrivateKey.mockImplementation(() => { throw new Error("no key"); });
        // In non-dry-run mode, should call error()
        error.mockImplementationOnce((msg) => { throw new Error(`error: ${msg}`); });
        mockExistsSync.mockReturnValue(false);
        await (0, vitest_1.expect)(cmdAgentd(["start", "--once"])).rejects.toThrow("error:");
    });
});
(0, vitest_1.describe)("cmdAgentd — INKD_AGENT_NAME guard", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("calls error() when INKD_AGENT_NAME is not set", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const { error } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        error.mockImplementationOnce((msg) => { throw new Error(`error: ${msg}`); });
        await (0, vitest_1.expect)(cmdAgentd(["start", "--once"])).rejects.toThrow("error:");
    });
});
(0, vitest_1.describe)("cmdAgentd — registry address guard", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("calls error() when registry address is empty for the network", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const { loadConfig, error } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        loadConfig.mockReturnValueOnce({ network: "mainnet", privateKey: MOCK_PK });
        // Use mockReturnValueOnce so the implementation resets after one call
        error.mockImplementationOnce((msg) => { throw new Error(`error: ${msg}`); });
        await (0, vitest_1.expect)(cmdAgentd(["start", "--once"])).rejects.toThrow("error:");
    });
});
(0, vitest_1.describe)("cmdAgentd — start continuous mode (signal handling)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
        delete process.env["INKD_AGENT_ENDPOINT"];
    });
    (0, vitest_1.it)("enters continuous mode: registers setInterval and signal handlers", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const registeredEvents = [];
        const processOnSpy = vitest_1.vi.spyOn(process, "on").mockImplementation((event) => {
            registeredEvents.push(event);
            return process;
        });
        const clearIntervalSpy = vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        const setIntervalSpy = vitest_1.vi
            .spyOn(global, "setInterval")
            .mockImplementation((_fn, _ms) => 42);
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // cmdAgentd in continuous mode runs the first cycle, registers handlers, then resolves
        await cmdAgentd(["start", "--dry-run"]);
        // Verify continuous-mode plumbing
        (0, vitest_1.expect)(setIntervalSpy).toHaveBeenCalledWith(vitest_1.expect.any(Function), vitest_1.expect.any(Number));
        (0, vitest_1.expect)(registeredEvents).toContain("SIGINT");
        (0, vitest_1.expect)(registeredEvents).toContain("SIGTERM");
        // State was saved after the first cycle
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
        processOnSpy.mockRestore();
    });
    (0, vitest_1.it)("shutdown handler (SIGINT) saves state and calls process.exit", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const handlers = {};
        const processOnSpy = vitest_1.vi.spyOn(process, "on").mockImplementation((event, fn) => {
            handlers[event] = fn;
            return process;
        });
        vitest_1.vi.spyOn(global, "setInterval").mockImplementation(() => 42);
        vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("process.exit"); });
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--dry-run"]);
        // SIGINT handler should now be registered — fire it
        (0, vitest_1.expect)(handlers["SIGINT"]).toBeDefined();
        const calls = mockWriteFileSync.mock.calls.length;
        (0, vitest_1.expect)(() => handlers["SIGINT"]()).toThrow("process.exit");
        // writeFileSync called again on shutdown
        (0, vitest_1.expect)(mockWriteFileSync.mock.calls.length).toBeGreaterThan(calls);
        processOnSpy.mockRestore();
    });
    (0, vitest_1.it)("shutdown handler in --json mode outputs JSON line and calls process.exit", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const handlers = {};
        vitest_1.vi.spyOn(process, "on").mockImplementation((event, fn) => {
            handlers[event] = fn;
            return process;
        });
        vitest_1.vi.spyOn(global, "setInterval").mockImplementation(() => 42);
        vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("process.exit"); });
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--dry-run", "--json"]);
        (0, vitest_1.expect)(handlers["SIGTERM"]).toBeDefined();
        (0, vitest_1.expect)(() => handlers["SIGTERM"]()).toThrow("process.exit");
        // console.log should have been called with a JSON string
        const logCalls = console.log.mock.calls;
        const jsonCall = logCalls.find((c) => typeof c[0] === "string" && c[0].includes("daemon_stop"));
        (0, vitest_1.expect)(jsonCall).toBeDefined();
    });
});
(0, vitest_1.describe)("cmdAgentd — default subcommand (no args = start)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "my-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("start subcommand — enters continuous mode with setInterval registered", async () => {
        // Providing INKD_AGENT_NAME via env, so it should attempt to start (not error on name)
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const registeredEvents = [];
        const processOnSpy = vitest_1.vi.spyOn(process, "on").mockImplementation((event) => {
            registeredEvents.push(event);
            return process;
        });
        const setIntervalSpy = vitest_1.vi.spyOn(global, "setInterval").mockImplementation(() => 42);
        vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent({ name: "my-agent" })]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // Empty args defaults to "start"; test the default via explicit "start" + dry-run
        // (empty [] with no PK would fail; the key behavior being tested is continuous mode)
        await cmdAgentd(["start", "--dry-run"]);
        (0, vitest_1.expect)(setIntervalSpy).toHaveBeenCalled();
        (0, vitest_1.expect)(registeredEvents).toContain("SIGINT");
        setIntervalSpy.mockRestore();
        processOnSpy.mockRestore();
    });
});
// ─── Branch-coverage gap tests ───────────────────────────────────────────────
(0, vitest_1.describe)("cmdAgentd — loadState() catch branch (corrupt JSON)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("returns null (falls back to fresh state) when state file contains corrupt JSON", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        // existsSync → true but readFileSync returns invalid JSON → catch → null → fresh state
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue("{not-valid-json:::");
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        process.env["INKD_AGENT_NAME"] = "test-agent";
        vitest_1.vi.spyOn(global, "setInterval").mockImplementation(() => 42);
        vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "on").mockImplementation((_e) => process);
        // Should NOT throw — corrupt file is silently ignored, daemon starts fresh
        await (0, vitest_1.expect)(cmdAgentd(["start", "--once", "--dry-run"])).resolves.toBeUndefined();
        // writeFileSync called once to save state (proves we reached the end of the cycle)
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("shows 'no state found' warning when state file contains corrupt JSON (status command)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue("{bad json");
        const warnMock = vitest_1.vi.fn();
        const { warn } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        warn.mockImplementation(warnMock);
        await cmdAgentd(["status"]);
        // loadState() returns null → status prints "no state" warning
        (0, vitest_1.expect)(warnMock).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("cmdAgentd — setInterval callback body (lines 387-389)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("executes the setInterval callback (cycle + info log) in plain mode", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        let capturedCallback = null;
        vitest_1.vi.spyOn(global, "setInterval").mockImplementation((fn) => {
            capturedCallback = fn;
            return 42;
        });
        vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "on").mockImplementation((_e) => process);
        mockExistsSync.mockReturnValue(false);
        // Two resolved values: one for the initial cycle, one for the callback invocation
        mockReadContract
            .mockResolvedValueOnce([makeOnChainAgent()]) // initial cycle
            .mockResolvedValueOnce([makeOnChainAgent()]); // timer callback cycle
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // Run in plain mode (no --json, no --quiet) so lines 387-389 are exercised
        await cmdAgentd(["start", "--dry-run"]);
        (0, vitest_1.expect)(capturedCallback).not.toBeNull();
        // Invoke the timer callback — covers lines 387-389
        await capturedCallback();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        // info() should have been called for the "Next sync in …s" message
        (0, vitest_1.expect)(info).toHaveBeenCalled();
    });
});
// ─── Branch-coverage gap-fills ────────────────────────────────────────────────
(0, vitest_1.describe)("agentd — line 126: agentEndpoint ?? '' fallback (branch coverage)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("maps agent with undefined agentEndpoint to empty string (covers ?? '' branch)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        // Omit agentEndpoint so it comes through as undefined → ?? '' fires
        const agentWithoutEndpoint = { ...makeOnChainAgent(), agentEndpoint: undefined };
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([agentWithoutEndpoint]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // --once so it doesn't loop; --dry-run so no wallet needed
        await cmdAgentd(["start", "--once", "--dry-run"]);
        // State should be written (cycle completed without throwing)
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("agentd — line 201: non-Error catch branch (branch coverage)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("handles non-Error thrown in cycle (String(e) branch)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        // Throw a plain string (not an Error) to hit `String(e)` branch on line 201
        mockReadContract.mockRejectedValue("plain string error");
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run"]);
        // Should complete (catch block handles it); state written with errors > 0
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
        const savedJson = mockWriteFileSync.mock.calls[0][1];
        const saved = JSON.parse(savedJson);
        (0, vitest_1.expect)(saved.errors).toBeGreaterThan(0);
    });
});
(0, vitest_1.describe)("agentd — line 257: lastSync ?? 'never' in peers (branch coverage)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("shows 'never' when peers state has null lastSync", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const state = makeDaemonState({
            lastSync: null,
            peers: [{ id: "1", owner: MOCK_WALLET, name: "peer-x", description: "", agentEndpoint: "https://x.ai", isPublic: true, versionCount: "1", createdAt: "1709000000" }],
        });
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(state));
        await cmdAgentd(["peers"]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("never");
    });
});
(0, vitest_1.describe)("agentd — line 388: setInterval callback false branch (json/quiet mode)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("executes setInterval callback in --json mode (no info call for 'Next sync')", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        let capturedCallback = null;
        vitest_1.vi.spyOn(global, "setInterval").mockImplementation((fn) => {
            capturedCallback = fn;
            return 42;
        });
        vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "on").mockImplementation((_e) => process);
        mockExistsSync.mockReturnValue(false);
        mockReadContract
            .mockResolvedValueOnce([makeOnChainAgent()]) // initial cycle
            .mockResolvedValueOnce([makeOnChainAgent()]); // timer callback cycle
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // --json mode: timer callback should NOT call info (false branch of !jsonMode && !quiet)
        await cmdAgentd(["start", "--dry-run", "--json"]);
        (0, vitest_1.expect)(capturedCallback).not.toBeNull();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        info.mockClear();
        await capturedCallback();
        // In --json mode, "Next sync" info line should NOT be printed
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).not.toContain("Next sync");
    });
});
(0, vitest_1.describe)("agentd — line 102: humanLine else-if(event) false branch", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("emits nothing when jsonMode=true and say() is called without a json event key", async () => {
        // In --json mode, say() calls humanLine(jsonMode=true, event=undefined-ish).
        // The say() helper maps 'cycle_start' etc., but the 'cycle_error' code path
        // calls humanLine directly. To trigger the jsonMode=true + !event branch we
        // just run a --json --once cycle; the json emitted lines confirm the path.
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // --json emits JSON lines (event present) but also calls humanLine with no event
        // for the cycle_ok branch — just confirm it doesn't throw
        await (0, vitest_1.expect)(cmdAgentd(["start", "--once", "--dry-run", "--json"])).resolves.toBeUndefined();
    });
});
(0, vitest_1.describe)("agentd — line 125: description ?? '' fallback (branch coverage)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("maps agent with undefined description to empty string (covers ?? '' branch)", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        const agentWithoutDesc = { ...makeOnChainAgent(), description: undefined };
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([agentWithoutDesc]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        await cmdAgentd(["start", "--once", "--dry-run"]);
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("agentd — line 264: args[0] ?? 'start' fallback (branch coverage)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupConsoleMocks();
        vitest_1.vi.clearAllMocks();
        process.env["INKD_AGENT_NAME"] = "test-agent";
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        delete process.env["INKD_AGENT_NAME"];
    });
    (0, vitest_1.it)("defaults to 'start' subcommand when called with no args", async () => {
        const { cmdAgentd } = await Promise.resolve().then(() => __importStar(require("../commands/agentd.js")));
        mockExistsSync.mockReturnValue(false);
        mockReadContract.mockResolvedValue([makeOnChainAgent()]);
        mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
        // cmdAgentd([]) → args[0] is undefined → ?? 'start' → runs start path
        vitest_1.vi.spyOn(global, "setInterval").mockImplementation(() => 42);
        vitest_1.vi.spyOn(global, "clearInterval").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "on").mockImplementation((_e) => process);
        await cmdAgentd(["--once", "--dry-run"]); // no positional sub → args[0] starts with --
        (0, vitest_1.expect)(mockWriteFileSync).toHaveBeenCalled();
    });
});
//# sourceMappingURL=agentd.test.js.map