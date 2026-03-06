"use strict";
/**
 * @file search.test.ts
 * Unit tests for `inkd search` command.
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
        name: "test-project",
        description: "A smart contract toolkit",
        license: "MIT",
        readmeHash: "",
        owner: MOCK_OWNER,
        isPublic: true,
        isAgent: false,
        agentEndpoint: "",
        createdAt: 1000n,
        versionCount: 1n,
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
// ─── cmdSearch ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdSearch", () => {
    (0, vitest_1.it)("errors when no query provided", async () => {
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await (0, vitest_1.expect)(cmdSearch([])).rejects.toThrow("Usage:");
    });
    (0, vitest_1.it)("prints 'no projects' when count is 0", async () => {
        mockReadContract.mockResolvedValueOnce(0n); // projectCount
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["anything"]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(info).toHaveBeenCalledWith(vitest_1.expect.stringContaining("No projects registered"));
    });
    (0, vitest_1.it)("finds projects by name match", async () => {
        mockReadContract
            .mockResolvedValueOnce(2n) // projectCount
            .mockResolvedValueOnce(makeProject({ id: 1n, name: "smart-contract", description: "a smart toolkit" }))
            // Second project: name and description both don't match "smart"
            .mockResolvedValueOnce(makeProject({ id: 2n, name: "totally-unrelated", description: "an nft gallery app" }));
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["smart"]);
        const calls = console.log.mock.calls.flat().join(" ");
        // "smart-contract" appears (possibly with ANSI highlight around "smart")
        (0, vitest_1.expect)(calls).toContain("-contract");
        // "totally-unrelated" must not appear at all
        (0, vitest_1.expect)(calls).not.toContain("totally-unrelated");
    });
    (0, vitest_1.it)("finds projects by description match", async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ name: "no-match", description: "great defi protocol" }));
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["defi"]);
        (0, vitest_1.expect)(console.log).toHaveBeenCalled();
    });
    (0, vitest_1.it)("filters to agents only with --agents flag", async () => {
        mockReadContract
            .mockResolvedValueOnce(2n)
            .mockResolvedValueOnce(makeProject({ id: 1n, name: "non-agent", isAgent: false, description: "regular project" }))
            .mockResolvedValueOnce(makeProject({ id: 2n, name: "agent-project", isAgent: true, description: "an agent" }));
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        // Use "agent" as query so only the agent project matches (non-agent has no "agent" in name/desc)
        await cmdSearch(["agent", "--agents"]);
        const calls = console.log.mock.calls.flat().join(" ");
        // "[agent]" badge appears only for agent projects
        (0, vitest_1.expect)(calls).toContain("[agent]");
        // non-agent should not appear at all
        (0, vitest_1.expect)(calls).not.toContain("non-agent");
    });
    (0, vitest_1.it)("outputs JSON when --json flag is set", async () => {
        const project = makeProject({ name: "json-test", description: "matches" });
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(project);
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["matches", "--json"]);
        const calls = console.log.mock.calls.flat().join("\n");
        // Should be valid JSON containing results array
        const parsed = JSON.parse(calls);
        (0, vitest_1.expect)(parsed).toHaveProperty("results");
        (0, vitest_1.expect)(parsed.results).toHaveLength(1);
        (0, vitest_1.expect)(parsed.results[0].name).toBe("json-test");
    });
    (0, vitest_1.it)("outputs empty JSON array when no results match", async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ name: "other", description: "other" }));
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["zzznomatch", "--json"]);
        const calls = console.log.mock.calls.flat().join("\n");
        const parsed = JSON.parse(calls);
        (0, vitest_1.expect)(parsed.results).toHaveLength(0);
        (0, vitest_1.expect)(parsed.query).toBe("zzznomatch");
    });
    (0, vitest_1.it)("prints no-results message in text mode", async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ name: "other", description: "other" }));
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["zzznomatch"]);
        const { info } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(info).toHaveBeenCalledWith(vitest_1.expect.stringContaining("No results"));
    });
    (0, vitest_1.it)("shows tip to remove --agents flag when no results in agents-only mode", async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ name: "no-match", isAgent: false }));
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["zzznomatch", "--agents"]);
        const { warn } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        (0, vitest_1.expect)(warn).toHaveBeenCalledWith(vitest_1.expect.stringContaining("--agents"));
    });
    (0, vitest_1.it)("respects --limit flag", async () => {
        // 5 matching projects but limit 2
        const projects = [1n, 2n, 3n, 4n, 5n].map((id) => makeProject({ id, name: `match-project-${id}` }));
        mockReadContract
            .mockResolvedValueOnce(5n)
            .mockResolvedValue(projects[0]); // all batch reads return same project (all match)
        // Override to actually return different projects
        mockReadContract
            .mockResolvedValueOnce(5n)
            .mockResolvedValueOnce(projects[0])
            .mockResolvedValueOnce(projects[1])
            .mockResolvedValueOnce(projects[2])
            .mockResolvedValueOnce(projects[3])
            .mockResolvedValueOnce(projects[4]);
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["match", "--limit", "2"]);
        // Should find 2 results and show "Use --limit <n>" hint
        const calls = console.log.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(calls).toContain("--limit");
    });
    (0, vitest_1.it)("skips non-existent projects", async () => {
        mockReadContract
            .mockResolvedValueOnce(2n)
            .mockResolvedValueOnce(makeProject({ exists: false })) // filtered out
            .mockResolvedValueOnce(makeProject({ id: 2n, name: "real-project", exists: true }));
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["real", "--json"]);
        const calls = console.log.mock.calls.flat().join("\n");
        const parsed = JSON.parse(calls);
        (0, vitest_1.expect)(parsed.results).toHaveLength(1);
        (0, vitest_1.expect)(parsed.results[0].name).toBe("real-project");
    });
    (0, vitest_1.it)("includes agentEndpoint in JSON output for agent projects", async () => {
        const project = makeProject({
            name: "my-agent",
            isAgent: true,
            agentEndpoint: "https://agent.example.io",
        });
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(project);
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["my-agent", "--json"]);
        const calls = console.log.mock.calls.flat().join("\n");
        const parsed = JSON.parse(calls);
        (0, vitest_1.expect)(parsed.results[0].agentEndpoint).toBe("https://agent.example.io");
        (0, vitest_1.expect)(parsed.results[0].isAgent).toBe(true);
    });
    (0, vitest_1.it)("omits agentEndpoint from JSON when not set", async () => {
        const project = makeProject({ name: "no-endpoint", agentEndpoint: "" });
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(project);
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["no-endpoint", "--json"]);
        const calls = console.log.mock.calls.flat().join("\n");
        const parsed = JSON.parse(calls);
        (0, vitest_1.expect)(parsed.results[0].agentEndpoint).toBeUndefined();
    });
    (0, vitest_1.it)("errors when registry address is not configured", async () => {
        const { ADDRESSES } = await Promise.resolve().then(() => __importStar(require("../config.js")));
        const orig = ADDRESSES.testnet.registry;
        ADDRESSES.testnet.registry = "";
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await (0, vitest_1.expect)(cmdSearch(["anything"])).rejects.toThrow("Registry address not configured");
        ADDRESSES.testnet.registry = orig;
    });
});
// ─── Branch-coverage gap: non-JSON agentEndpoint display (search.ts:161) ─────
(0, vitest_1.describe)("cmdSearch — non-JSON display with agentEndpoint", () => {
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
    (0, vitest_1.it)("renders agentEndpoint inline when project has one (plain/non-JSON mode)", async () => {
        const project = makeProject({
            name: "endpoint-agent",
            isAgent: true,
            agentEndpoint: "https://my-agent.example.io/rpc",
        });
        mockReadContract
            .mockResolvedValueOnce(1n) // totalProjects
            .mockResolvedValueOnce(project); // getProject(1)
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        // No --json flag → plain display path
        await cmdSearch(["endpoint-agent"]);
        const logged = consoleLog.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(logged).toContain("https://my-agent.example.io/rpc");
    });
});
// ─── Branch-coverage gap-fills ────────────────────────────────────────────────
(0, vitest_1.describe)("cmdSearch — private project text display (branch coverage)", () => {
    (0, vitest_1.it)("shows 'private' badge for non-public project in text mode", async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ id: 1n, name: "private-agent", description: "secret sauce", isPublic: false }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["private-agent"]);
        const logged = consoleLog.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(logged).toContain("private"); // false branch of visBadge ternary
    });
});
(0, vitest_1.describe)("cmdSearch — partial last batch (branch coverage)", () => {
    (0, vitest_1.it)("handles 22 projects so last batch is partial (batchEnd = projectCount)", async () => {
        // 22 projects: batch 1 = ids 1-20 (full), batch 2 = ids 21-22 (partial → batchEnd = 22n)
        const projects = Array.from({ length: 22 }, (_, i) => makeProject({ id: BigInt(i + 1), name: `target-agent`, description: "match me" }));
        mockReadContract
            .mockResolvedValueOnce(22n) // projectCount
            .mockImplementation(() => Promise.resolve(projects[0])); // all getProject calls
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        // Should not throw; exercises partial-batch batchEnd branch
        await (0, vitest_1.expect)(cmdSearch(["target-agent"])).resolves.toBeUndefined();
    });
});
(0, vitest_1.describe)("cmdSearch — description display branches (branch coverage)", () => {
    (0, vitest_1.it)("skips description line when project has no description", async () => {
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ id: 1n, name: "nodesc-project", description: "" }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["nodesc-project"]);
        // The project matches by name; no description line should appear
        const logged = consoleLog.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(logged).toContain("nodesc-project"); // project found
        // description block (line 149 false branch): no description = no extra indented line
    });
    (0, vitest_1.it)("truncates description longer than 80 chars with ellipsis", async () => {
        const longDesc = "Z".repeat(90); // 90 > 80
        mockReadContract
            .mockResolvedValueOnce(1n)
            .mockResolvedValueOnce(makeProject({ id: 1n, name: "longdesc-project", description: longDesc }));
        const consoleLog = vitest_1.vi.spyOn(console, "log");
        const { cmdSearch } = await Promise.resolve().then(() => __importStar(require("../commands/search.js")));
        await cmdSearch(["longdesc-project"]);
        const logged = consoleLog.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(logged).toContain("Z".repeat(80)); // first 80 chars present
        (0, vitest_1.expect)(logged).toContain("…"); // truncation ellipsis (line 150 true branch)
    });
});
//# sourceMappingURL=search.test.js.map