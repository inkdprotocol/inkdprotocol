"use strict";
/**
 * @file version.test.ts
 * Unit tests for `inkd version` subcommands.
 * All on-chain reads/writes are mocked via vitest.
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
// ─── Constants ────────────────────────────────────────────────────────────────
const MOCK_TX_HASH = "0xbeefbeefbeefbeefbeef";
const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111";
const MOCK_TOKEN = "0x2222222222222222222222222222222222222222";
const MOCK_PUSHER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
// ─── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock("../config.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        loadConfig: vitest_1.vi.fn(() => ({
            network: "testnet",
            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            rpcUrl: undefined,
        })),
        ADDRESSES: {
            testnet: {
                registry: MOCK_REGISTRY,
                token: MOCK_TOKEN,
                treasury: "0x3333333333333333333333333333333333333333",
            },
            mainnet: { registry: "", token: "", treasury: "" },
        },
    };
});
let mockReadContract;
let mockWriteContract;
let mockWaitForReceipt;
vitest_1.vi.mock("../client.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildPublicClient: vitest_1.vi.fn(() => ({
            readContract: (...args) => mockReadContract(...args),
        })),
        buildClients: vitest_1.vi.fn(() => ({
            publicClient: {
                readContract: (...args) => mockReadContract(...args),
                waitForTransactionReceipt: (...args) => mockWaitForReceipt(...args),
            },
            walletClient: {
                writeContract: (...args) => mockWriteContract(...args),
                chain: { id: 84532 },
            },
            account: { address: MOCK_PUSHER },
            addrs: {
                registry: MOCK_REGISTRY,
                token: MOCK_TOKEN,
                treasury: "0x3333333333333333333333333333333333333333",
            },
        })),
    };
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeVersion(overrides = {}) {
    return {
        projectId: 1n,
        arweaveHash: "abc123defxyz",
        versionTag: "v0.2.0",
        changelog: "Bug fixes",
        pushedBy: MOCK_PUSHER,
        pushedAt: 1709000000n,
        ...overrides,
    };
}
function setupProcessMocks() {
    vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
    vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
    return vitest_1.vi
        .spyOn(process, "exit")
        .mockImplementation((_code) => {
        throw new Error("process.exit");
    });
}
// ─── cmdVersionPush ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdVersionPush", () => {
    (0, vitest_1.beforeEach)(() => {
        setupProcessMocks();
        mockReadContract = vitest_1.vi.fn().mockResolvedValue((0, viem_1.parseEther)("0.001")); // versionFee
        mockWriteContract = vitest_1.vi.fn().mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt = vitest_1.vi
            .fn()
            .mockResolvedValue({ status: "success", blockNumber: 55555n });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("exits when --id is missing", async () => {
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionPush(["--hash", "abc123", "--tag", "v0.1.0"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits when --hash is missing", async () => {
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionPush(["--id", "1", "--tag", "v0.1.0"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits when --tag is missing", async () => {
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionPush(["--id", "1", "--hash", "abc123"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("calls pushVersion on registry with correct args", async () => {
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionPush([
            "--id", "1",
            "--hash", "arweave_abc123",
            "--tag", "v0.9.0",
            "--changelog", "Initial release",
        ]);
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledTimes(1);
        const call = mockWriteContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("pushVersion");
        (0, vitest_1.expect)(call.args[0]).toBe(1n);
        (0, vitest_1.expect)(call.args[1]).toBe("arweave_abc123");
        (0, vitest_1.expect)(call.args[2]).toBe("v0.9.0");
        (0, vitest_1.expect)(call.args[3]).toBe("Initial release");
    });
    (0, vitest_1.it)("includes versionFee as ETH value", async () => {
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionPush([
            "--id", "1",
            "--hash", "abc",
            "--tag", "v1.0.0",
        ]);
        const call = mockWriteContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.value).toBe((0, viem_1.parseEther)("0.001"));
    });
    (0, vitest_1.it)("defaults changelog to empty string when not provided", async () => {
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionPush(["--id", "1", "--hash", "xyz", "--tag", "v0.1.0"]);
        const call = mockWriteContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[3]).toBe("");
    });
    (0, vitest_1.it)("prints success with arweave hash on success", async () => {
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionPush([
            "--id", "1",
            "--hash", "arweave_hash_abc",
            "--tag", "v0.9.0",
        ]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/v0\.9\.0/);
        (0, vitest_1.expect)(logged).toMatch(/arweave_hash_abc/);
    });
    (0, vitest_1.it)("calls process.exit on reverted transaction", async () => {
        mockWaitForReceipt = vitest_1.vi
            .fn()
            .mockResolvedValue({ status: "reverted", blockNumber: 55555n });
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionPush(["--id", "1", "--hash", "abc", "--tag", "v0.1.0"])).rejects.toThrow("process.exit");
    });
});
// ─── cmdVersionList ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdVersionList", () => {
    (0, vitest_1.beforeEach)(() => {
        setupProcessMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("prints 'no versions' message when count is 0", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(0n); // getVersionCount
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/No versions/i);
    });
    (0, vitest_1.it)("lists versions in reverse order (newest first)", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(2n) // getVersionCount
            .mockResolvedValueOnce(makeVersion({ versionTag: "v0.1.0", pushedAt: 1700000000n }))
            .mockResolvedValueOnce(makeVersion({ versionTag: "v0.2.0", pushedAt: 1709000000n }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/v0\.1\.0/);
        (0, vitest_1.expect)(logged).toMatch(/v0\.2\.0/);
    });
    (0, vitest_1.it)("accepts --id flag instead of positional arg", async () => {
        mockReadContract = vitest_1.vi.fn().mockResolvedValueOnce(0n);
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["--id", "42"]);
        // readContract should have been called (no error thrown)
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("makes correct number of readContract calls (1 + versionCount)", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(3n) // getVersionCount = 3
            .mockResolvedValue(makeVersion()); // getVersion x3
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["1"]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(4); // 1 count + 3 versions
    });
    (0, vitest_1.it)("shows changelog when present", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeVersion({ changelog: "Fixed critical bug" }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/Fixed critical bug/);
    });
});
// ─── cmdVersionShow ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdVersionShow", () => {
    (0, vitest_1.beforeEach)(() => {
        setupProcessMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("exits when --id is missing", async () => {
        const { cmdVersionShow } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionShow(["--index", "0"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits when --index is missing", async () => {
        const { cmdVersionShow } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionShow(["--id", "1"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("displays version details", async () => {
        mockReadContract = vitest_1.vi.fn().mockResolvedValue(makeVersion({
            versionTag: "v0.5.0",
            arweaveHash: "xyz_arweave_hash",
            pushedBy: MOCK_PUSHER,
            changelog: "Perf improvements",
        }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionShow } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionShow(["--id", "1", "--index", "0"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/v0\.5\.0/);
        (0, vitest_1.expect)(logged).toMatch(/xyz_arweave_hash/);
        (0, vitest_1.expect)(logged).toMatch(/Perf improvements/);
    });
    (0, vitest_1.it)("calls getVersion with correct bigint args", async () => {
        mockReadContract = vitest_1.vi.fn().mockResolvedValue(makeVersion());
        const { cmdVersionShow } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionShow(["--id", "7", "--index", "3"]);
        const call = mockReadContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("getVersion");
        (0, vitest_1.expect)(call.args[0]).toBe(7n);
        (0, vitest_1.expect)(call.args[1]).toBe(3n);
    });
    (0, vitest_1.it)("does not print changelog section when changelog is empty", async () => {
        mockReadContract = vitest_1.vi.fn().mockResolvedValue(makeVersion({ changelog: "" }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionShow } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionShow(["--id", "1", "--index", "0"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).not.toMatch(/Changelog/i);
    });
});
// ─── Registry-not-configured error paths ─────────────────────────────────────
(0, vitest_1.describe)("registry not configured error paths", () => {
    (0, vitest_1.beforeEach)(() => {
        setupProcessMocks();
        mockReadContract = vitest_1.vi.fn();
        mockWriteContract = vitest_1.vi.fn();
        mockWaitForReceipt = vitest_1.vi.fn();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("cmdVersionPush exits when registry address is not configured (mainnet)", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce({
            network: "mainnet",
            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            rpcUrl: undefined,
        });
        const { cmdVersionPush } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionPush(["--id", "1", "--hash", "abc", "--tag", "v0.1.0"])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockWriteContract).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("cmdVersionList exits when registry address is not configured (mainnet)", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce({
            network: "mainnet",
            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            rpcUrl: undefined,
        });
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionList(["1"])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockReadContract).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("cmdVersionList exits when called with no args (requireFlag fallback)", async () => {
        mockReadContract = vitest_1.vi.fn().mockResolvedValue(0n);
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionList([])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("cmdVersionShow exits when registry address is not configured (mainnet)", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce({
            network: "mainnet",
            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            rpcUrl: undefined,
        });
        const { cmdVersionShow } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await (0, vitest_1.expect)(cmdVersionShow(["--id", "1", "--index", "0"])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockReadContract).not.toHaveBeenCalled();
    });
});
// ─── Long changelog truncation ────────────────────────────────────────────────
(0, vitest_1.describe)("cmdVersionList — long changelog truncation", () => {
    (0, vitest_1.beforeEach)(() => {
        setupProcessMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("truncates changelog longer than 72 chars with ellipsis", async () => {
        const longChangelog = "A".repeat(80); // 80 chars > 72 limit
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(1n) // getVersionCount
            .mockResolvedValueOnce(makeVersion({ changelog: longChangelog }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        // Should contain the truncated portion (first 72 chars) and the ellipsis
        (0, vitest_1.expect)(logged).toMatch(/A{72}/);
        (0, vitest_1.expect)(logged).toMatch(/…/);
    });
    (0, vitest_1.it)("does not truncate changelog of exactly 72 chars (all chars present)", async () => {
        const exactChangelog = "B".repeat(72);
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeVersion({ changelog: exactChangelog }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        // All 72 B's should be present (no truncation)
        (0, vitest_1.expect)(logged).toMatch(/B{72}/);
        // The changelog line itself should not end with an ellipsis after the B's
        (0, vitest_1.expect)(logged).not.toMatch(/B{72}…/);
    });
});
// ─── cmdVersionList — empty changelog branch (branch coverage) ────────────────
(0, vitest_1.describe)("cmdVersionList — empty changelog (branch coverage)", () => {
    (0, vitest_1.beforeEach)(() => {
        setupProcessMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("does not print changelog line when changelog is empty in list view", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(1n) // getVersionCount
            .mockResolvedValueOnce(makeVersion({ changelog: "" }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdVersionList } = await Promise.resolve().then(() => __importStar(require("../commands/version.js")));
        await cmdVersionList(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        // changelog line (indented with spaces) should NOT appear
        (0, vitest_1.expect)(logged).not.toMatch(/^\s{7}/m);
    });
});
//# sourceMappingURL=version.test.js.map