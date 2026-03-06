"use strict";
/**
 * @file project.test.ts
 * Unit tests for the `inkd project` subcommands.
 *
 * All on-chain interactions are mocked — these tests verify:
 *   - Correct arguments are extracted from the CLI args array
 *   - The right contract functions are called with the right params
 *   - Console output reflects success / error states
 *   - Error paths (missing flags, bad addresses) call process.exit(1)
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
const MOCK_TX_HASH = "0xdeadbeefdeadbeefdeadbeef";
const MOCK_OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MOCK_TO = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111";
const MOCK_TOKEN = "0x2222222222222222222222222222222222222222";
// ─── Mocks ────────────────────────────────────────────────────────────────────
// Mock config so we always get a deterministic testnet config
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
            mainnet: {
                registry: "",
                token: "",
                treasury: "",
            },
        },
    };
});
// Shared mock read/write functions — reassigned in each test
let mockReadContract;
let mockWriteContract;
let mockWaitForReceipt;
vitest_1.vi.mock("../client.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildPublicClient: vitest_1.vi.fn(() => ({
            readContract: (...args) => mockReadContract(...args),
            waitForTransactionReceipt: (...args) => mockWaitForReceipt(...args),
            getBalance: vitest_1.vi.fn().mockResolvedValue((0, viem_1.parseEther)("1")),
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
            account: { address: MOCK_OWNER },
            addrs: {
                registry: MOCK_REGISTRY,
                token: MOCK_TOKEN,
                treasury: "0x3333333333333333333333333333333333333333",
            },
        })),
    };
});
// ─── Setup ────────────────────────────────────────────────────────────────────
function makeProject(overrides = {}) {
    return {
        id: 1n,
        name: "test-agent",
        description: "A test project",
        license: "MIT",
        readmeHash: "",
        owner: MOCK_OWNER,
        isPublic: true,
        isAgent: false,
        agentEndpoint: "",
        createdAt: 1709000000n,
        versionCount: 3n,
        exists: true,
        ...overrides,
    };
}
// ─── cmdProjectGet ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdProjectGet", () => {
    let consoleLog;
    let consoleError;
    let exitSpy;
    (0, vitest_1.beforeEach)(() => {
        consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        consoleError = vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        exitSpy = vitest_1.vi
            .spyOn(process, "exit")
            .mockImplementation((_code) => {
            throw new Error("process.exit");
        });
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject()) // getProject
            .mockResolvedValueOnce([MOCK_TO]); // getCollaborators
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("fetches and displays project details by positional id", async () => {
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["1"]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(2);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/test-agent/);
        (0, vitest_1.expect)(logged).toMatch(/MIT/);
    });
    (0, vitest_1.it)("fetches by --id flag", async () => {
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["--id", "1"]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)("shows agent badge for agent projects", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject({ isAgent: true, agentEndpoint: "https://agent.example.com" }))
            .mockResolvedValueOnce([]);
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/agent/i);
    });
    (0, vitest_1.it)("calls process.exit when project does not exist", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject({ exists: false }))
            .mockResolvedValueOnce([]);
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectGet(["99"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("displays collaborators when present", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject())
            .mockResolvedValueOnce([MOCK_TO, MOCK_OWNER]);
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(new RegExp(MOCK_TO, "i"));
    });
});
// ─── cmdProjectList ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdProjectList", () => {
    let consoleLog;
    let exitSpy;
    (0, vitest_1.beforeEach)(() => {
        consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        exitSpy = vitest_1.vi
            .spyOn(process, "exit")
            .mockImplementation((_code) => {
            throw new Error("process.exit");
        });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("exits when address is missing", async () => {
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectList([])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits when address is invalid", async () => {
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectList(["not-an-address"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("prints 'no projects' when owner has none", async () => {
        mockReadContract = vitest_1.vi.fn().mockResolvedValue([]);
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectList([MOCK_OWNER]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/No projects/i);
    });
    (0, vitest_1.it)("lists projects for a valid address", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce([1n, 2n]) // getOwnerProjects
            .mockResolvedValue(makeProject()); // getProject calls
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectList([MOCK_OWNER]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(3); // 1 owner call + 2 project calls
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/test-agent/);
    });
});
// ─── cmdProjectCreate ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdProjectCreate", () => {
    let consoleLog;
    let exitSpy;
    (0, vitest_1.beforeEach)(() => {
        consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        exitSpy = vitest_1.vi
            .spyOn(process, "exit")
            .mockImplementation((_code) => {
            throw new Error("process.exit");
        });
        // Default: allowance is sufficient, tx succeeds
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValue((0, viem_1.parseEther)("10")); // allowance >= 1 INKD
        mockWriteContract = vitest_1.vi.fn().mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt = vitest_1.vi
            .fn()
            .mockResolvedValue({ status: "success", blockNumber: 12345n });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("exits when --name is missing", async () => {
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectCreate([])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("calls createProject on registry with correct args", async () => {
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCreate([
            "--name",
            "my-agent",
            "--description",
            "Cool agent",
            "--license",
            "Apache-2.0",
        ]);
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledTimes(1);
        const call = mockWriteContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("createProject");
        (0, vitest_1.expect)(call.args[0]).toBe("my-agent");
        (0, vitest_1.expect)(call.args[1]).toBe("Cool agent");
        (0, vitest_1.expect)(call.args[2]).toBe("Apache-2.0");
    });
    (0, vitest_1.it)("approves token spending when allowance is insufficient", async () => {
        mockReadContract = vitest_1.vi.fn().mockResolvedValue(0n); // allowance = 0
        mockWriteContract = vitest_1.vi.fn().mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt = vitest_1.vi
            .fn()
            .mockResolvedValue({ status: "success", blockNumber: 12345n });
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCreate(["--name", "my-agent"]);
        // First writeContract = approve, second = createProject
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(mockWriteContract.mock.calls[0][0].functionName).toBe("approve");
        (0, vitest_1.expect)(mockWriteContract.mock.calls[1][0].functionName).toBe("createProject");
    });
    (0, vitest_1.it)("marks project as private when --private flag is set", async () => {
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCreate(["--name", "secret-agent", "--private"]);
        const call = mockWriteContract.mock.calls[0][0];
        // isPublic is args[3]
        (0, vitest_1.expect)(call.args[3]).toBe(false);
    });
    (0, vitest_1.it)("marks project as agent when --agent flag is set", async () => {
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCreate(["--name", "autonomous", "--agent"]);
        const call = mockWriteContract.mock.calls[0][0];
        // isAgent is args[5]
        (0, vitest_1.expect)(call.args[5]).toBe(true);
    });
    (0, vitest_1.it)("sets agentEndpoint when --endpoint is provided", async () => {
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCreate([
            "--name",
            "bot",
            "--agent",
            "--endpoint",
            "https://bot.example.com",
        ]);
        const call = mockWriteContract.mock.calls[0][0];
        // agentEndpoint is args[6]
        (0, vitest_1.expect)(call.args[6]).toBe("https://bot.example.com");
    });
    (0, vitest_1.it)("prints success when transaction succeeds", async () => {
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCreate(["--name", "ok-agent"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/ok-agent/);
    });
    (0, vitest_1.it)("calls process.exit when transaction reverts", async () => {
        mockWaitForReceipt = vitest_1.vi
            .fn()
            .mockResolvedValue({ status: "reverted", blockNumber: 12345n });
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectCreate(["--name", "fail-agent"])).rejects.toThrow("process.exit");
    });
});
// ─── cmdProjectTransfer ───────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdProjectTransfer", () => {
    let exitSpy;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        exitSpy = vitest_1.vi
            .spyOn(process, "exit")
            .mockImplementation((_code) => {
            throw new Error("process.exit");
        });
        mockReadContract = vitest_1.vi.fn().mockResolvedValue((0, viem_1.parseEther)("0.001")); // transferFee
        mockWriteContract = vitest_1.vi.fn().mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt = vitest_1.vi.fn().mockResolvedValue({ status: "success" });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("exits when --id is missing", async () => {
        const { cmdProjectTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectTransfer(["--to", MOCK_TO])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits when --to is missing", async () => {
        const { cmdProjectTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectTransfer(["--id", "1"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits when --to is not a valid address", async () => {
        const { cmdProjectTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectTransfer(["--id", "1", "--to", "not-an-address"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("calls transferProject with correct args including fee", async () => {
        const { cmdProjectTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectTransfer(["--id", "42", "--to", MOCK_TO]);
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledTimes(1);
        const call = mockWriteContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("transferProject");
        (0, vitest_1.expect)(call.args[0]).toBe(42n);
        (0, vitest_1.expect)(call.args[1].toLowerCase()).toBe(MOCK_TO.toLowerCase());
        (0, vitest_1.expect)(call.value).toBe((0, viem_1.parseEther)("0.001"));
    });
});
// ─── cmdProjectCollab ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdProjectCollab", () => {
    let exitSpy;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        exitSpy = vitest_1.vi
            .spyOn(process, "exit")
            .mockImplementation((_code) => {
            throw new Error("process.exit");
        });
        mockWriteContract = vitest_1.vi.fn().mockResolvedValue(MOCK_TX_HASH);
        mockWaitForReceipt = vitest_1.vi.fn().mockResolvedValue({ status: "success" });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("exits when action is neither add nor remove", async () => {
        const { cmdProjectCollab } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectCollab(["grant"])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("calls addCollaborator when action is 'add'", async () => {
        const { cmdProjectCollab } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCollab(["add", "--id", "5", "--address", MOCK_TO]);
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledTimes(1);
        const call = mockWriteContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("addCollaborator");
        (0, vitest_1.expect)(call.args[0]).toBe(5n);
        (0, vitest_1.expect)(call.args[1].toLowerCase()).toBe(MOCK_TO.toLowerCase());
    });
    (0, vitest_1.it)("calls removeCollaborator when action is 'remove'", async () => {
        const { cmdProjectCollab } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectCollab(["remove", "--id", "5", "--address", MOCK_TO]);
        (0, vitest_1.expect)(mockWriteContract).toHaveBeenCalledTimes(1);
        const call = mockWriteContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("removeCollaborator");
    });
    (0, vitest_1.it)("exits when --id is missing", async () => {
        const { cmdProjectCollab } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectCollab(["add", "--address", MOCK_TO])).rejects.toThrow("process.exit");
    });
    (0, vitest_1.it)("exits when --address is invalid", async () => {
        const { cmdProjectCollab } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectCollab(["add", "--id", "1", "--address", "bad"])).rejects.toThrow("process.exit");
    });
});
// ─── Registry-not-configured error paths ─────────────────────────────────────
(0, vitest_1.describe)("registry not configured error paths (mainnet)", () => {
    function setupMocks() {
        vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
            throw new Error("process.exit");
        });
    }
    function mockMainnet() {
        return {
            network: "mainnet",
            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            rpcUrl: undefined,
        };
    }
    (0, vitest_1.beforeEach)(() => {
        setupMocks();
        mockReadContract = vitest_1.vi.fn();
        mockWriteContract = vitest_1.vi.fn();
        mockWaitForReceipt = vitest_1.vi.fn();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("cmdProjectCreate exits when registry not configured", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());
        const { cmdProjectCreate } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectCreate(["--name", "fail-project"])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockWriteContract).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("cmdProjectGet exits when registry not configured", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectGet(["1"])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockReadContract).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("cmdProjectList exits when registry not configured", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectList([MOCK_OWNER])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockReadContract).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("cmdProjectTransfer exits when registry not configured", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());
        const { cmdProjectTransfer } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectTransfer(["--id", "1", "--to", MOCK_TO])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockWriteContract).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("cmdProjectCollab exits when registry not configured", async () => {
        const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        vitest_1.vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());
        const { cmdProjectCollab } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectCollab(["add", "--id", "1", "--address", MOCK_TO])).rejects.toThrow("process.exit");
        (0, vitest_1.expect)(mockWriteContract).not.toHaveBeenCalled();
    });
});
// ─── cmdProjectList — badge coverage ─────────────────────────────────────────
(0, vitest_1.describe)("cmdProjectList — badge display", () => {
    let consoleLog;
    (0, vitest_1.beforeEach)(() => {
        consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
            throw new Error("process.exit");
        });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("shows 'agent' badge for agent projects in list", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce([1n]) // getOwnerProjects
            .mockResolvedValueOnce(makeProject({ isAgent: true, isPublic: true }));
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectList([MOCK_OWNER]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/agent/i);
    });
    (0, vitest_1.it)("shows 'private' badge for private projects in list", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce([1n]) // getOwnerProjects
            .mockResolvedValueOnce(makeProject({ isAgent: false, isPublic: false }));
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectList([MOCK_OWNER]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/private/i);
    });
    (0, vitest_1.it)("shows both 'agent' and 'private' badges when applicable", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce([1n])
            .mockResolvedValueOnce(makeProject({ isAgent: true, isPublic: false }));
        const { cmdProjectList } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectList([MOCK_OWNER]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/agent/i);
        (0, vitest_1.expect)(logged).toMatch(/private/i);
    });
});
// ─── cmdProjectGet — optional field display ───────────────────────────────────
(0, vitest_1.describe)("cmdProjectGet — optional fields", () => {
    let consoleLog;
    (0, vitest_1.beforeEach)(() => {
        consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
            throw new Error("process.exit");
        });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("shows README hash when project has one", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject({ readmeHash: "ar://readmehash123" }))
            .mockResolvedValueOnce([]);
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/ar:\/\/readmehash123/);
        (0, vitest_1.expect)(logged).toMatch(/README hash/i);
    });
    (0, vitest_1.it)("shows agent endpoint when project has one", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject({ isAgent: true, agentEndpoint: "https://my-agent.xyz/rpc" }))
            .mockResolvedValueOnce([]);
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/https:\/\/my-agent\.xyz\/rpc/);
        (0, vitest_1.expect)(logged).toMatch(/Agent endpoint/i);
    });
});
// ─── Branch-coverage gap: cmdProjectGet description/visibility (project.ts:130-135) ──
(0, vitest_1.describe)("cmdProjectGet — description and visibility branches", () => {
    let consoleLog;
    (0, vitest_1.beforeEach)(() => {
        consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
            throw new Error("process.exit");
        });
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("shows 'none' placeholder when project description is empty (|| right branch)", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject({ description: "" }))
            .mockResolvedValueOnce([]); // collaborators
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/none/i);
    });
    (0, vitest_1.it)("shows 'private' when project is not public (isPublic ternary false branch)", async () => {
        mockReadContract = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(makeProject({ isPublic: false }))
            .mockResolvedValueOnce([]); // collaborators
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await cmdProjectGet(["1"]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/private/i);
    });
});
// ─── Branch-coverage gap-fill ─────────────────────────────────────────────────
(0, vitest_1.describe)("cmdProjectGet — missing id branch (branch coverage)", () => {
    (0, vitest_1.it)("exits when no positional arg and no --id flag provided", async () => {
        // args[0] is undefined → ?? triggers requireFlag → missing flag → error() → throws
        const { cmdProjectGet } = await Promise.resolve().then(() => __importStar(require("../commands/project.js")));
        await (0, vitest_1.expect)(cmdProjectGet([])).rejects.toThrow();
    });
});
//# sourceMappingURL=project.test.js.map