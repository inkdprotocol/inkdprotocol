"use strict";
/**
 * @file agent.test.ts
 * Unit tests for `inkd agent` subcommands.
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
// ─── Constants ────────────────────────────────────────────────────────────────
const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111";
const MOCK_OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
function makeProject(overrides = {}) {
    return {
        id: 1n,
        name: "test-agent",
        description: "An AI agent project",
        license: "MIT",
        readmeHash: "",
        owner: MOCK_OWNER,
        isPublic: true,
        isAgent: true,
        agentEndpoint: "https://agent.example.com",
        createdAt: 1000n,
        versionCount: 3n,
        exists: true,
        ...overrides,
    };
}
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
                token: "0x2222222222222222222222222222222222222222",
                treasury: "0x3333333333333333333333333333333333333333",
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
        YELLOW: "",
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
// ─── cmdAgentList ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdAgentList", () => {
    (0, vitest_1.it)("prints agent directory when projects exist", async () => {
        const projects = [
            makeProject({ id: 1n, name: "gork-agent", description: "AI helper" }),
            makeProject({ id: 2n, name: "inkd-bot", description: "", agentEndpoint: "" }),
        ];
        mockReadContract.mockResolvedValueOnce(projects);
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentList([]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "getAgentProjects", args: [0n, 25n] }));
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("uses --offset and --limit flags", async () => {
        mockReadContract.mockResolvedValueOnce([makeProject()]);
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentList(["--offset", "10", "--limit", "5"]);
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ args: [10n, 5n] }));
    });
    (0, vitest_1.it)("prints 'No agent projects found' when list is empty", async () => {
        mockReadContract.mockResolvedValueOnce([]);
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentList([]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(info).toHaveBeenCalledWith(vitest_1.expect.stringContaining("No agent projects"));
    });
    (0, vitest_1.it)("shows pagination hint when results equal limit", async () => {
        // Exactly 3 results with limit 3 → show next-page hint
        const projects = [1n, 2n, 3n].map((id) => makeProject({ id, name: `agent-${id}` }));
        mockReadContract.mockResolvedValueOnce(projects);
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentList(["--limit", "3"]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(info).toHaveBeenCalledWith(vitest_1.expect.stringContaining("Showing 3 results"));
    });
    (0, vitest_1.it)("prints agent endpoint when set", async () => {
        const project = makeProject({ agentEndpoint: "https://my-agent.xyz/v1" });
        mockReadContract.mockResolvedValueOnce([project]);
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentList([]);
        // console.log should have been called with endpoint line
        const calls = console.log.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(calls).toContain("https://my-agent.xyz/v1");
    });
    (0, vitest_1.it)("prints private badge for non-public project", async () => {
        const project = makeProject({ isPublic: false });
        mockReadContract.mockResolvedValueOnce([project]);
        // Should not throw; private projects use a different badge
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await (0, vitest_1.expect)(cmdAgentList([])).resolves.toBeUndefined();
    });
    (0, vitest_1.it)("handles registry not deployed (no address)", async () => {
        const { loadConfig, ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const origAddresses = ADDRESSES.testnet.registry;
        // Temporarily clear the registry address
        ADDRESSES.testnet.registry = "";
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentList([]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(info).toHaveBeenCalledWith(vitest_1.expect.stringContaining("not deployed yet"));
        // Restore
        ADDRESSES.testnet.registry = origAddresses;
    });
});
// ─── cmdAgentLookup ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdAgentLookup", () => {
    (0, vitest_1.it)("finds agent by exact name (case-insensitive)", async () => {
        // projectCount = 2, then getProject for each
        mockReadContract
            .mockResolvedValueOnce(2n) // projectCount
            .mockResolvedValueOnce(makeProject({ id: 1n, name: "gork-agent" }))
            .mockResolvedValueOnce(makeProject({ id: 2n, name: "inkd-bot" }));
        const { cmdAgentLookup } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentLookup(["Gork-Agent"]); // uppercase → should still match
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("calls process.exit(1) when name not found", async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ name: "other-bot" }));
        const exitSpy = vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
            throw new Error("process.exit");
        });
        const { cmdAgentLookup } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await (0, vitest_1.expect)(cmdAgentLookup(["nonexistent"])).rejects.toThrow();
        exitSpy.mockRestore();
    });
    (0, vitest_1.it)("calls error() when no name argument provided", async () => {
        const { cmdAgentLookup } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await (0, vitest_1.expect)(cmdAgentLookup([])).rejects.toThrow("Usage:");
    });
    (0, vitest_1.it)("shows agent endpoint and readme in detail view", async () => {
        const project = makeProject({
            name: "detail-agent",
            agentEndpoint: "https://endpoint.xyz",
            readmeHash: "abc123",
            description: "detailed agent",
        });
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(project);
        const { cmdAgentLookup } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentLookup(["detail-agent"]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("https://endpoint.xyz");
        (0, vitest_1.expect)(infoCalls).toContain("abc123");
        (0, vitest_1.expect)(infoCalls).toContain("detailed agent");
    });
    (0, vitest_1.it)("returns early with info when registry not deployed", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const orig = ADDRESSES.testnet.registry;
        ADDRESSES.testnet.registry = "";
        const { cmdAgentLookup } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentLookup(["any"]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(info).toHaveBeenCalledWith(vitest_1.expect.stringContaining("not deployed yet"));
        ADDRESSES.testnet.registry = orig;
    });
    (0, vitest_1.it)("skips non-matching projects and finds target", async () => {
        mockReadContract
            .mockResolvedValueOnce(3n)
            .mockResolvedValueOnce(makeProject({ id: 1n, name: "alpha" }))
            .mockResolvedValueOnce(makeProject({ id: 2n, name: "beta" }))
            .mockResolvedValueOnce(makeProject({ id: 3n, name: "target-agent" }));
        const { cmdAgentLookup } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentLookup(["target-agent"]);
        // Should have read all 3 projects
        (0, vitest_1.expect)(mockReadContract).toHaveBeenCalledTimes(4); // 1 count + 3 getProject
    });
});
// ─── Branch-coverage gap-fills ────────────────────────────────────────────────
(0, vitest_1.describe)("cmdAgentList — description truncation (branch coverage)", () => {
    (0, vitest_1.it)("truncates description longer than 70 chars with ellipsis", async () => {
        const longDesc = "A".repeat(80); // 80 > 70
        const project = {
            id: 1n, name: "verbose-agent", description: longDesc,
            owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            agentEndpoint: "", license: "MIT", readmeHash: "",
            isPublic: true, isAgent: true, createdAt: 1000n,
            versionCount: 1n, exists: true,
        };
        mockReadContract.mockResolvedValueOnce([project]);
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdAgentList } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentList([]);
        const logged = consoleLog.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(logged).toContain("…"); // truncation ellipsis present
    });
});
(0, vitest_1.describe)("cmdAgentLookup — no endpoint / no description (branch coverage)", () => {
    (0, vitest_1.it)("shows 'none' when agentEndpoint is empty and skips description when absent", async () => {
        const project = {
            id: 1n, name: "bare-agent", description: "",
            owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            agentEndpoint: "", license: "MIT", readmeHash: "",
            isPublic: true, isAgent: true, createdAt: 1000n,
            versionCount: 2n, exists: true,
        };
        mockReadContract
            .mockResolvedValueOnce(1n) // projectCount
            .mockResolvedValueOnce(project); // getProject(1)
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        // Clear accumulated calls from previous tests before asserting
        info.mockClear();
        const { cmdAgentLookup } = await Promise.resolve().then(() => __importStar(require("../commands/agent.js")));
        await cmdAgentLookup(["bare-agent"]);
        const infoCalls = info.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(infoCalls).toContain("none"); // false branch of agentEndpoint || 'none'
        // description branch (false): info should NOT contain "Desc:" line in THIS call
        (0, vitest_1.expect)(infoCalls).not.toContain("Desc:");
    });
});
//# sourceMappingURL=agent.test.js.map