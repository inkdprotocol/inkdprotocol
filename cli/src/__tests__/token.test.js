"use strict";
/**
 * @file token.test.ts
 * Unit tests for `inkd token` subcommands.
 * All on-chain reads/writes and key derivation are mocked via vitest.
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
const MOCK_OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MOCK_RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MOCK_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const MOCK_TX_HASH = "0xdeadbeefdeadbeefdeadbeef";
// ─── Mocks ────────────────────────────────────────────────────────────────────
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
            testnet: {
                registry: MOCK_REGISTRY,
                token: MOCK_TOKEN,
                treasury: MOCK_TREASURY,
            },
            mainnet: { registry: "", token: "", treasury: "" },
        },
        error: vitest_1.vi.fn((msg) => { throw new Error(msg); }),
        info: vitest_1.vi.fn(),
        success: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        BOLD: "",
        RESET: "",
        CYAN: "",
        DIM: "",
        GREEN: "",
        YELLOW: "",
    };
});
// Mock viem/accounts dynamic import used inside token commands
vitest_1.vi.mock("viem/accounts", () => ({
    privateKeyToAccount: vitest_1.vi.fn(() => ({ address: MOCK_OWNER })),
}));
let mockReadContract;
let mockGetBalance;
let mockWriteContract;
let mockWaitForReceipt;
vitest_1.vi.mock("../client.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildPublicClient: vitest_1.vi.fn(() => ({
            readContract: (...args) => mockReadContract(...args),
            getBalance: (...args) => mockGetBalance(...args),
            waitForTransactionReceipt: (...args) => mockWaitForReceipt(...args),
        })),
        buildWalletClient: vitest_1.vi.fn(() => ({
            writeContract: (...args) => mockWriteContract(...args),
        })),
    };
});
// ─── Setup helpers ────────────────────────────────────────────────────────────
function setupConsoleMocks() {
    vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
    vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
    return vitest_1.vi.spyOn(process, "exit").mockImplementation((_) => {
        throw new Error("process.exit");
    });
}
(0, vitest_1.beforeEach)(() => {
    setupConsoleMocks();
    mockReadContract = vitest_1.vi.fn();
    mockGetBalance = vitest_1.vi.fn();
    mockWriteContract = vitest_1.vi.fn();
    mockWaitForReceipt = vitest_1.vi.fn();
});
(0, vitest_1.afterEach)(() => {
    vitest_1.vi.restoreAllMocks();
});
// ─── cmdTokenBalance ──────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdTokenBalance", () => {
    (0, vitest_1.it)("reads balanceOf and getBalance for own wallet when no address given", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("42"));
        mockGetBalance.mockResolvedValue((0, viem_1.parseEther)("0.5"));
        const { cmdTokenBalance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenBalance([]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "balanceOf", args: [MOCK_OWNER] }));
        (0, vitest_1.expect)(mockGetBalance).toHaveBeenCalledWith({ address: MOCK_OWNER });
    });
    (0, vitest_1.it)("reads balance for an explicit address argument", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("10"));
        mockGetBalance.mockResolvedValue((0, viem_1.parseEther)("0.1"));
        const { cmdTokenBalance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenBalance([MOCK_RECIPIENT]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "balanceOf", args: [MOCK_RECIPIENT] }));
    });
    (0, vitest_1.it)("outputs JSON when --json flag is passed", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("7"));
        mockGetBalance.mockResolvedValue((0, viem_1.parseEther)("0.2"));
        const { cmdTokenBalance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenBalance(["--json"]);
        const logged = console.log.mock.calls.map(c => c[0]).join("");
        const parsed = JSON.parse(logged);
        // formatEther returns "7" (no trailing .0) in this viem version
        (0, vitest_1.expect)(String(parsed.inkd)).toMatch(/^7/);
        (0, vitest_1.expect)(parsed.address).toBe(MOCK_OWNER);
        (0, vitest_1.expect)(parsed.network).toBe("testnet");
    });
    (0, vitest_1.it)("exits when token address is not configured", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const orig = ADDRESSES.testnet.token;
        ADDRESSES.testnet.token = "";
        const { cmdTokenBalance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenBalance([])).rejects.toThrow("process.exit");
        ADDRESSES.testnet.token = orig;
    });
    (0, vitest_1.it)("displays human-readable balance in table output", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("100"));
        mockGetBalance.mockResolvedValue((0, viem_1.parseEther)("1"));
        const { cmdTokenBalance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenBalance([]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        // formatEther returns "100" (no trailing .0) in this viem version
        (0, vitest_1.expect)(infoCalls).toMatch(/100/);
        (0, vitest_1.expect)(infoCalls).toMatch(/\b1\b/);
    });
    (0, vitest_1.it)("shows network in human output", async () => {
        mockReadContract.mockResolvedValue(0n);
        mockGetBalance.mockResolvedValue(0n);
        const { cmdTokenBalance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenBalance([]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("testnet");
    });
});
// ─── cmdTokenAllowance ────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdTokenAllowance", () => {
    (0, vitest_1.it)("reads allowance for own wallet when no address given", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("5"));
        const { cmdTokenAllowance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenAllowance([]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "allowance",
            args: [MOCK_OWNER, MOCK_REGISTRY],
        }));
    });
    (0, vitest_1.it)("reads allowance for explicit address argument", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("2"));
        const { cmdTokenAllowance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenAllowance([MOCK_RECIPIENT]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ args: [MOCK_RECIPIENT, MOCK_REGISTRY] }));
    });
    (0, vitest_1.it)("outputs JSON when --json flag is passed", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("3"));
        const { cmdTokenAllowance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenAllowance(["--json"]);
        const logged = console.log.mock.calls.map(c => c[0]).join("");
        const parsed = JSON.parse(logged);
        (0, vitest_1.expect)(String(parsed.allowance)).toMatch(/^3/);
        (0, vitest_1.expect)(parsed.sufficientForProject).toBe(true);
        (0, vitest_1.expect)(parsed.spender).toBe(MOCK_REGISTRY);
    });
    (0, vitest_1.it)("reports sufficientForProject=false when allowance < 1 INKD", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("0.5"));
        const { cmdTokenAllowance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenAllowance(["--json"]);
        const logged = console.log.mock.calls.map(c => c[0]).join("");
        const parsed = JSON.parse(logged);
        (0, vitest_1.expect)(parsed.sufficientForProject).toBe(false);
    });
    (0, vitest_1.it)("warns about insufficient allowance in human mode", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("0"));
        const { cmdTokenAllowance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenAllowance([]);
        const { warn } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(warn).toHaveBeenCalled();
    });
    (0, vitest_1.it)("exits when token or registry address not configured", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const origToken = ADDRESSES.testnet.token;
        ADDRESSES.testnet.token = "";
        const { cmdTokenAllowance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenAllowance([])).rejects.toThrow("process.exit");
        ADDRESSES.testnet.token = origToken;
    });
    (0, vitest_1.it)("shows sufficient message for allowance >= 1 INKD in human mode", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("1"));
        const { cmdTokenAllowance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenAllowance([]);
        const logged = console.log.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(logged).toContain("Sufficient");
    });
});
// ─── cmdTokenApprove ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdTokenApprove", () => {
    (0, vitest_1.beforeEach)(() => {
        mockWriteContract.mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt.mockResolvedValue({ status: "success", blockNumber: 123n });
    });
    (0, vitest_1.it)("exits when amount argument is missing", async () => {
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // error() mock throws before process.exit — just assert it rejects
        await (0, vitest_1.expect)(cmdTokenApprove([])).rejects.toThrow();
    });
    (0, vitest_1.it)("exits when amount is invalid (non-numeric)", async () => {
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenApprove(["notanumber"])).rejects.toThrow();
    });
    (0, vitest_1.it)("sends approve tx with correct spender (registry) and amount", async () => {
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenApprove(["5"]);
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "approve",
            args: [MOCK_REGISTRY, (0, viem_1.parseEther)("5")],
        }));
    });
    (0, vitest_1.it)("outputs JSON on success when --json flag passed", async () => {
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenApprove(["10", "--json"]);
        const logged = console.log.mock.calls.map(c => c[0]).join("");
        const parsed = JSON.parse(logged);
        (0, vitest_1.expect)(parsed.success).toBe(true);
        (0, vitest_1.expect)(parsed.hash).toBe(MOCK_TX_HASH);
        (0, vitest_1.expect)(String(parsed.amount)).toMatch(/^10/);
        (0, vitest_1.expect)(parsed.spender).toBe(MOCK_REGISTRY);
    });
    (0, vitest_1.it)("exits on reverted transaction", async () => {
        mockWaitForReceipt.mockResolvedValue({ status: "reverted", blockNumber: 99n });
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // error() mock throws before process.exit
        await (0, vitest_1.expect)(cmdTokenApprove(["1"])).rejects.toThrow();
    });
    (0, vitest_1.it)("exits when token or registry address not configured", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const origToken = ADDRESSES.testnet.token;
        ADDRESSES.testnet.token = "";
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenApprove(["1"])).rejects.toThrow();
        ADDRESSES.testnet.token = origToken;
    });
    (0, vitest_1.it)("shows success message after confirmed tx in human mode", async () => {
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenApprove(["2"]);
        const { success } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(success).toHaveBeenCalledWith(vitest_1.expect.stringContaining("2 INKD"));
    });
    (0, vitest_1.it)("waits for transaction receipt", async () => {
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenApprove(["1"]);
        (0, vitest_1.expect)(mockWaitForReceipt).toHaveBeenCalledWith({ hash: MOCK_TX_HASH });
    });
});
// ─── cmdTokenTransfer ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdTokenTransfer", () => {
    (0, vitest_1.beforeEach)(() => {
        mockWriteContract.mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt.mockResolvedValue({ status: "success", blockNumber: 200n });
    });
    (0, vitest_1.it)("exits when to and amount are missing", async () => {
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // error() mock throws before process.exit
        await (0, vitest_1.expect)(cmdTokenTransfer([])).rejects.toThrow();
    });
    (0, vitest_1.it)("exits when amount is missing (only to given)", async () => {
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenTransfer([MOCK_RECIPIENT])).rejects.toThrow();
    });
    (0, vitest_1.it)("exits when transferring to self", async () => {
        // MOCK_OWNER is same as the mocked account.address — warn + process.exit
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenTransfer([MOCK_OWNER, "1"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("sends transfer tx with correct to and amount", async () => {
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenTransfer([MOCK_RECIPIENT, "3"]);
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "transfer",
            args: [MOCK_RECIPIENT, (0, viem_1.parseEther)("3")],
        }));
    });
    (0, vitest_1.it)("outputs JSON on success when --json flag passed", async () => {
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenTransfer([MOCK_RECIPIENT, "5", "--json"]);
        const logged = console.log.mock.calls.map(c => c[0]).join("");
        const parsed = JSON.parse(logged);
        (0, vitest_1.expect)(parsed.success).toBe(true);
        (0, vitest_1.expect)(parsed.to).toBe(MOCK_RECIPIENT);
        (0, vitest_1.expect)(String(parsed.amount)).toMatch(/^5/);
        (0, vitest_1.expect)(parsed.from).toBe(MOCK_OWNER);
    });
    (0, vitest_1.it)("exits on reverted transaction", async () => {
        mockWaitForReceipt.mockResolvedValue({ status: "reverted", blockNumber: 99n });
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // error() mock throws before process.exit
        await (0, vitest_1.expect)(cmdTokenTransfer([MOCK_RECIPIENT, "1"])).rejects.toThrow();
    });
    (0, vitest_1.it)("exits when token address not configured", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const origToken = ADDRESSES.testnet.token;
        ADDRESSES.testnet.token = "";
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenTransfer([MOCK_RECIPIENT, "1"])).rejects.toThrow();
        ADDRESSES.testnet.token = origToken;
    });
    (0, vitest_1.it)("shows success message after confirmed tx in human mode", async () => {
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenTransfer([MOCK_RECIPIENT, "7"]);
        const { success } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(success).toHaveBeenCalledWith(vitest_1.expect.stringContaining("7 INKD"));
    });
    (0, vitest_1.it)("exits on invalid to-address", async () => {
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // error() mock throws before process.exit
        await (0, vitest_1.expect)(cmdTokenTransfer(["notanaddress", "1"])).rejects.toThrow();
    });
});
// ─── cmdTokenInfo ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdTokenInfo", () => {
    (0, vitest_1.beforeEach)(() => {
        mockReadContract
            .mockResolvedValueOnce("Inkd Protocol") // name
            .mockResolvedValueOnce("INKD") // symbol
            .mockResolvedValueOnce(18) // decimals
            .mockResolvedValueOnce((0, viem_1.parseEther)("100000000")); // totalSupply
    });
    (0, vitest_1.it)("reads name, symbol, decimals, and totalSupply in parallel", async () => {
        const { cmdTokenInfo } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenInfo([]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(4);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "name" }));
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "symbol" }));
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "decimals" }));
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "totalSupply" }));
    });
    (0, vitest_1.it)("outputs JSON when --json flag is passed", async () => {
        const { cmdTokenInfo } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenInfo(["--json"]);
        const logged = console.log.mock.calls.map(c => c[0]).join("");
        const parsed = JSON.parse(logged);
        (0, vitest_1.expect)(parsed.name).toBe("Inkd Protocol");
        (0, vitest_1.expect)(parsed.symbol).toBe("INKD");
        (0, vitest_1.expect)(parsed.decimals).toBe(18);
        (0, vitest_1.expect)(String(parsed.totalSupply)).toMatch(/^100000000/);
        (0, vitest_1.expect)(parsed.address).toBe(MOCK_TOKEN);
        (0, vitest_1.expect)(parsed.network).toBe("testnet");
    });
    (0, vitest_1.it)("displays metadata in human-readable table output", async () => {
        const { cmdTokenInfo } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // Snapshot info calls before and count new ones
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const before = info.mock.calls.length;
        await cmdTokenInfo([]);
        const newCalls = info.mock.calls.slice(before).flat().join(" ");
        (0, vitest_1.expect)(newCalls).toContain("Inkd Protocol");
        (0, vitest_1.expect)(newCalls).toContain("INKD");
        (0, vitest_1.expect)(newCalls).toContain("18");
        (0, vitest_1.expect)(newCalls).toMatch(/100000000/);
    });
    (0, vitest_1.it)("exits when token address not configured", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const origToken = ADDRESSES.testnet.token;
        ADDRESSES.testnet.token = "";
        const { cmdTokenInfo } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenInfo([])).rejects.toThrow("process.exit");
        ADDRESSES.testnet.token = origToken;
    });
    (0, vitest_1.it)("shows contract address in human output", async () => {
        const { cmdTokenInfo } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await cmdTokenInfo([]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain(MOCK_TOKEN);
    });
});
// ─── cmdToken (router) ────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdToken router", () => {
    (0, vitest_1.it)("routes 'balance' to cmdTokenBalance", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("0"));
        mockGetBalance.mockResolvedValue((0, viem_1.parseEther)("0"));
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdToken(["balance"])).resolves.toBeUndefined();
    });
    (0, vitest_1.it)("routes 'allowance' to cmdTokenAllowance", async () => {
        mockReadContract.mockResolvedValue((0, viem_1.parseEther)("0"));
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdToken(["allowance"])).resolves.toBeUndefined();
    });
    (0, vitest_1.it)("routes 'approve' → rejects on missing amount (proves routing works)", async () => {
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // error() mock throws before process.exit; just assert it rejects
        await (0, vitest_1.expect)(cmdToken(["approve"])).rejects.toThrow();
    });
    (0, vitest_1.it)("routes 'transfer' → rejects on missing args (proves routing works)", async () => {
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdToken(["transfer"])).rejects.toThrow();
    });
    (0, vitest_1.it)("routes 'info' to cmdTokenInfo", async () => {
        mockReadContract
            .mockResolvedValueOnce("Inkd Protocol")
            .mockResolvedValueOnce("INKD")
            .mockResolvedValueOnce(18)
            .mockResolvedValueOnce((0, viem_1.parseEther)("1000000"));
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdToken(["info"])).resolves.toBeUndefined();
    });
    (0, vitest_1.it)("exits with unknown sub-command", async () => {
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdToken(["unknown-sub"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits with no sub-command", async () => {
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdToken([])).rejects.toThrow("process.exit");
    });
});
// ─── Branch-coverage gap-fills (router break statements) ─────────────────────
(0, vitest_1.describe)("cmdToken router — approve/transfer break coverage", () => {
    (0, vitest_1.beforeEach)(() => {
        mockWriteContract.mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt.mockResolvedValue({ status: "success", blockNumber: 100n });
    });
    (0, vitest_1.it)("routes 'approve' to successful completion (covers break on line 408)", async () => {
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // Successful approve reaches the break after cmdTokenApprove resolves
        await (0, vitest_1.expect)(cmdToken(["approve", "10"])).resolves.toBeUndefined();
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "approve" }));
    });
    (0, vitest_1.it)("routes 'transfer' to successful completion (covers break on line 411)", async () => {
        const { cmdToken } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // Successful transfer reaches the break after cmdTokenTransfer resolves
        await (0, vitest_1.expect)(cmdToken(["transfer", MOCK_RECIPIENT, "1"])).resolves.toBeUndefined();
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "transfer" }));
    });
});
// ─── Branch-coverage: mainnet chain ternary + parseAddress error path ─────────
(0, vitest_1.describe)("token branch coverage — mainnet chain + parseAddress invalid address", () => {
    const VALID_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    (0, vitest_1.beforeEach)(() => {
        mockWriteContract.mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt.mockResolvedValue({ status: "success", blockNumber: 300n });
    });
    (0, vitest_1.it)("approve: uses base chain (mainnet branch of ternary) when network=mainnet", async () => {
        // Override loadConfig to return mainnet
        const { loadConfig, ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        loadConfig.mockReturnValueOnce({
            network: "mainnet",
            privateKey: VALID_PK,
            rpcUrl: undefined,
        });
        // Give mainnet addresses valid values
        ADDRESSES.mainnet.token = MOCK_TOKEN;
        ADDRESSES.mainnet.registry = MOCK_REGISTRY;
        const { cmdTokenApprove } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenApprove(["5"])).resolves.toBeUndefined();
        // The writeContract call should have been made with the base chain (mainnet path)
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "approve" }));
        // Restore
        ADDRESSES.mainnet.token = "";
        ADDRESSES.mainnet.registry = "";
    });
    (0, vitest_1.it)("transfer: uses base chain (mainnet branch of ternary) when network=mainnet", async () => {
        const { loadConfig, ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        loadConfig.mockReturnValueOnce({
            network: "mainnet",
            privateKey: VALID_PK,
            rpcUrl: undefined,
        });
        ADDRESSES.mainnet.token = MOCK_TOKEN;
        ADDRESSES.mainnet.registry = MOCK_REGISTRY;
        const { cmdTokenTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        await (0, vitest_1.expect)(cmdTokenTransfer([MOCK_RECIPIENT, "3"])).resolves.toBeUndefined();
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "transfer" }));
        ADDRESSES.mainnet.token = "";
        ADDRESSES.mainnet.registry = "";
    });
    (0, vitest_1.it)("parseAddress: error() called on invalid hex address (covers catch branch)", async () => {
        // cmdTokenBalance uses parseAddress when an explicit address arg is provided
        // Passing a non-EIP-55 garbage string triggers getAddress() to throw
        const { cmdTokenBalance } = await Promise.resolve().then(() => __importStar(require("../commands/token.js")));
        // "not-an-address" will fail viem's getAddress() → parseAddress catch → error()
        await (0, vitest_1.expect)(cmdTokenBalance(["not-an-address"])).rejects.toThrow();
        const { error } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(error).toHaveBeenCalledWith(vitest_1.expect.stringContaining("Invalid address"));
    });
});
//# sourceMappingURL=token.test.js.map