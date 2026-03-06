"use strict";
/**
 * @file status.test.ts
 * Unit tests for `inkd status` command.
 * All on-chain reads are mocked via vitest.
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
const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111";
const MOCK_TOKEN = "0x2222222222222222222222222222222222222222";
const MOCK_TREASURY = "0x3333333333333333333333333333333333333333";
// ─── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock("../config.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        loadConfig: vitest_1.vi.fn(() => ({
            network: "testnet",
            rpcUrl: "https://rpc.example.com",
        })),
        ADDRESSES: {
            testnet: {
                registry: MOCK_REGISTRY,
                token: MOCK_TOKEN,
                treasury: MOCK_TREASURY,
            },
            mainnet: { registry: "", token: "", treasury: "" },
        },
        error: vitest_1.vi.fn((msg) => { throw new Error(msg); }),
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        BOLD: "",
        RESET: "",
        CYAN: "",
        DIM: "",
        GREEN: "",
    };
});
let mockReadContract;
vitest_1.vi.mock("../client.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildPublicClient: vitest_1.vi.fn(() => ({
            readContract: (...args) => mockReadContract(...args),
        })),
    };
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
(0, vitest_1.beforeEach)(() => {
    mockReadContract = vitest_1.vi.fn();
    vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
});
(0, vitest_1.afterEach)(() => {
    vitest_1.vi.restoreAllMocks();
});
// ─── cmdStatus ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdStatus", () => {
    (0, vitest_1.it)("reads versionFee, transferFee, and projectCount in parallel", async () => {
        mockReadContract
            .mockResolvedValueOnce((0, viem_1.parseEther)("0.001")) // versionFee
            .mockResolvedValueOnce((0, viem_1.parseEther)("0.01")) // transferFee
            .mockResolvedValueOnce(42n); // projectCount
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(3);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "versionFee" }));
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "transferFee" }));
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "projectCount" }));
    });
    (0, vitest_1.it)("displays project count and fee values", async () => {
        mockReadContract
            .mockResolvedValueOnce((0, viem_1.parseEther)("0.001"))
            .mockResolvedValueOnce((0, viem_1.parseEther)("0.01"))
            .mockResolvedValueOnce(99n);
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("99");
        (0, vitest_1.expect)(infoCalls).toContain("0.001");
        (0, vitest_1.expect)(infoCalls).toContain("0.01");
    });
    (0, vitest_1.it)("shows network and rpcUrl from config", async () => {
        mockReadContract
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n);
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("testnet");
        (0, vitest_1.expect)(infoCalls).toContain("https://rpc.example.com");
    });
    (0, vitest_1.it)("shows 'default (public)' when rpcUrl is not set", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        loadConfig.mockReturnValueOnce({ network: "testnet", rpcUrl: undefined });
        mockReadContract
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n);
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("default (public)");
    });
    (0, vitest_1.it)("warns and returns early when registry address is not configured", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const orig = ADDRESSES.testnet.registry;
        ADDRESSES.testnet.registry = "";
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        (0, vitest_1.expect)(mockReadContract).not.toHaveBeenCalled();
        const { warn } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(warn).toHaveBeenCalledWith(vitest_1.expect.stringContaining("Contract addresses not configured"));
        ADDRESSES.testnet.registry = orig;
    });
    (0, vitest_1.it)("warns on RPC error instead of throwing", async () => {
        mockReadContract.mockRejectedValue(new Error("network timeout"));
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        // Should NOT throw — it catches the error and warns
        await (0, vitest_1.expect)(cmdStatus()).resolves.toBeUndefined();
        const { warn } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(warn).toHaveBeenCalledWith(vitest_1.expect.stringContaining("network timeout"));
    });
    (0, vitest_1.it)("displays contract addresses from ADDRESSES config", async () => {
        mockReadContract
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n);
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain(MOCK_REGISTRY);
        (0, vitest_1.expect)(infoCalls).toContain(MOCK_TOKEN);
        (0, vitest_1.expect)(infoCalls).toContain(MOCK_TREASURY);
    });
    (0, vitest_1.it)("shows 'not deployed yet' when token address is empty", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const origToken = ADDRESSES.testnet.token;
        ADDRESSES.testnet.token = "";
        mockReadContract
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n);
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("not deployed yet");
        ADDRESSES.testnet.token = origToken;
    });
    (0, vitest_1.it)("handles zero project count", async () => {
        mockReadContract
            .mockResolvedValueOnce(0n) // versionFee
            .mockResolvedValueOnce(0n) // transferFee
            .mockResolvedValueOnce(0n); // projectCount
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await (0, vitest_1.expect)(cmdStatus()).resolves.toBeUndefined();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("0");
    });
});
// ─── Branch-coverage gap-fill ─────────────────────────────────────────────────
(0, vitest_1.describe)("cmdStatus — treasury empty branch (branch coverage)", () => {
    (0, vitest_1.it)("shows 'not deployed yet' for treasury when treasury address is empty", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const origTreasury = ADDRESSES.testnet.treasury;
        ADDRESSES.testnet.treasury = "";
        mockReadContract
            .mockResolvedValueOnce(0n) // versionFee
            .mockResolvedValueOnce(0n) // transferFee
            .mockResolvedValueOnce(0n); // projectCount
        const { cmdStatus } = await Promise.resolve().then(() => __importStar(require("../commands/status.js")));
        await cmdStatus();
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("not deployed yet"); // treasury || 'not deployed yet'
        ADDRESSES.testnet.treasury = origTreasury;
    });
});
//# sourceMappingURL=status.test.js.map