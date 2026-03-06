"use strict";
/**
 * @file ProjectRegistry.test.ts
 * @description Comprehensive unit tests for ProjectRegistry — the on-chain
 * project registry client. Covers all read methods, all write methods,
 * error guards, and edge-case paths.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ProjectRegistry_js_1 = require("../ProjectRegistry.js");
// ─── Fixtures ────────────────────────────────────────────────────────────────
const REGISTRY_ADDR = "0xRegistryAddress000000000000000000000001";
const TOKEN_ADDR = "0xTokenAddress00000000000000000000000002";
const OWNER_ADDR = "0xOwnerAddress0000000000000000000000000003";
const COLLAB_ADDR = "0xCollabAddress000000000000000000000000004";
const TX_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const BASE_CONFIG = {
    registryAddress: REGISTRY_ADDR,
    tokenAddress: TOKEN_ADDR,
    chainId: 84532,
};
const MOCK_PROJECT = {
    id: 1n,
    name: "agent-brain",
    description: "Persistent memory for AI",
    license: "MIT",
    readmeHash: "ar://readme-hash",
    owner: OWNER_ADDR,
    isPublic: true,
    isAgent: true,
    agentEndpoint: "https://api.myagent.xyz",
    createdAt: 1700000000n,
    versionCount: 3n,
    exists: true,
};
const MOCK_VERSION = {
    projectId: 1n,
    arweaveHash: "ar://v1-hash",
    versionTag: "v1.0.0",
    changelog: "Initial release",
    pushedBy: OWNER_ADDR,
    pushedAt: 1700001000n,
};
// ─── Mock factory helpers ─────────────────────────────────────────────────────
function makeMockPublicClient(overrides = {}) {
    return {
        readContract: vitest_1.vi.fn(),
        waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        ...overrides,
    };
}
function makeMockWalletClient(address = OWNER_ADDR) {
    return {
        account: { address },
        writeContract: vitest_1.vi.fn().mockResolvedValue(TX_HASH),
    };
}
// ─── Error Classes ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("RegistryNotConnected", () => {
    (0, vitest_1.it)("is an instance of Error", () => {
        const err = new ProjectRegistry_js_1.RegistryNotConnected();
        (0, vitest_1.expect)(err).toBeInstanceOf(Error);
    });
    (0, vitest_1.it)("has name RegistryNotConnected", () => {
        (0, vitest_1.expect)(new ProjectRegistry_js_1.RegistryNotConnected().name).toBe("RegistryNotConnected");
    });
    (0, vitest_1.it)("message mentions connect()", () => {
        (0, vitest_1.expect)(new ProjectRegistry_js_1.RegistryNotConnected().message).toContain("connect()");
    });
});
(0, vitest_1.describe)("InsufficientInkdBalance", () => {
    (0, vitest_1.it)("is an instance of Error", () => {
        (0, vitest_1.expect)(new ProjectRegistry_js_1.InsufficientInkdBalance(0n, 1000000000000000000n)).toBeInstanceOf(Error);
    });
    (0, vitest_1.it)("has name InsufficientInkdBalance", () => {
        (0, vitest_1.expect)(new ProjectRegistry_js_1.InsufficientInkdBalance(0n, 1000000000000000000n).name).toBe("InsufficientInkdBalance");
    });
    (0, vitest_1.it)("message includes balance and required amounts", () => {
        const err = new ProjectRegistry_js_1.InsufficientInkdBalance(500n, 1000n);
        (0, vitest_1.expect)(err.message).toContain("500");
        (0, vitest_1.expect)(err.message).toContain("1000");
    });
});
(0, vitest_1.describe)("InsufficientEthBalance", () => {
    (0, vitest_1.it)("is an instance of Error", () => {
        (0, vitest_1.expect)(new ProjectRegistry_js_1.InsufficientEthBalance(1000000n)).toBeInstanceOf(Error);
    });
    (0, vitest_1.it)("has name InsufficientEthBalance", () => {
        (0, vitest_1.expect)(new ProjectRegistry_js_1.InsufficientEthBalance(1000000n).name).toBe("InsufficientEthBalance");
    });
    (0, vitest_1.it)("message includes the fee amount", () => {
        const err = new ProjectRegistry_js_1.InsufficientEthBalance(999n);
        (0, vitest_1.expect)(err.message).toContain("999");
    });
});
// ─── Constructor ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — constructor", () => {
    (0, vitest_1.it)("creates an instance with Base Sepolia config", () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        (0, vitest_1.expect)(r).toBeInstanceOf(ProjectRegistry_js_1.ProjectRegistry);
    });
    (0, vitest_1.it)("creates an instance with Base mainnet config", () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry({ ...BASE_CONFIG, chainId: 8453 });
        (0, vitest_1.expect)(r).toBeInstanceOf(ProjectRegistry_js_1.ProjectRegistry);
    });
    (0, vitest_1.it)("does not throw on valid config", () => {
        (0, vitest_1.expect)(() => new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG)).not.toThrow();
    });
});
// ─── connect() ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — connect()", () => {
    (0, vitest_1.it)("enables subsequent read calls", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(5n);
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const count = await r.getProjectCount();
        (0, vitest_1.expect)(count).toBe(5n);
    });
    (0, vitest_1.it)("allows reconnect with a different client", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub1 = makeMockPublicClient();
        const pub2 = makeMockPublicClient();
        pub1.readContract.mockResolvedValue(1n);
        pub2.readContract.mockResolvedValue(99n);
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub1);
        (0, vitest_1.expect)(await r.getProjectCount()).toBe(1n);
        r.connect(wlt, pub2);
        (0, vitest_1.expect)(await r.getProjectCount()).toBe(99n);
    });
});
// ─── Guard (RegistryNotConnected) ─────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — connection guard", () => {
    (0, vitest_1.it)("getProject throws without publicClient", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.getProject(1n)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("getVersion throws without publicClient", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.getVersion(1n, 0n)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("getAllVersions throws without publicClient", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.getAllVersions(1n)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("getOwnerProjects throws without publicClient", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.getOwnerProjects(OWNER_ADDR)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("getVersionFee throws without publicClient", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.getVersionFee()).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("createProject throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.createProject({ name: "foo" })).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("pushVersion throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.pushVersion({ projectId: 1n, arweaveHash: "ar://x", versionTag: "v1" })).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("addCollaborator throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.addCollaborator(1n, COLLAB_ADDR)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("removeCollaborator throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.removeCollaborator(1n, COLLAB_ADDR)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("transferProject throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.transferProject(1n, COLLAB_ADDR)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("setVisibility throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.setVisibility(1n, false)).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("setReadme throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.setReadme(1n, "ar://readme")).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
    (0, vitest_1.it)("setAgentEndpoint throws without wallet", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        await (0, vitest_1.expect)(r.setAgentEndpoint(1n, "https://api.xyz")).rejects.toThrow(ProjectRegistry_js_1.RegistryNotConnected);
    });
});
// ─── Read methods ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — getProject()", () => {
    (0, vitest_1.it)("calls readContract with correct args and returns project", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(MOCK_PROJECT);
        r.connect(makeMockWalletClient(), pub);
        const result = await r.getProject(1n);
        (0, vitest_1.expect)(result).toEqual(MOCK_PROJECT);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "getProject", args: [1n] }));
    });
    (0, vitest_1.it)("returns null when project does not exist (exists=false)", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue({ ...MOCK_PROJECT, exists: false });
        r.connect(makeMockWalletClient(), pub);
        const result = await r.getProject(999n);
        (0, vitest_1.expect)(result).toBeNull();
    });
});
(0, vitest_1.describe)("ProjectRegistry — getVersion()", () => {
    (0, vitest_1.it)("calls readContract with projectId and index", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(MOCK_VERSION);
        r.connect(makeMockWalletClient(), pub);
        const result = await r.getVersion(1n, 0n);
        (0, vitest_1.expect)(result).toEqual(MOCK_VERSION);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "getVersion", args: [1n, 0n] }));
    });
});
(0, vitest_1.describe)("ProjectRegistry — getAllVersions()", () => {
    (0, vitest_1.it)("fetches version count then iterates over all versions", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        const versions = [
            { ...MOCK_VERSION, versionTag: "v1.0.0" },
            { ...MOCK_VERSION, versionTag: "v1.1.0" },
            { ...MOCK_VERSION, versionTag: "v1.2.0" },
        ];
        pub.readContract
            .mockResolvedValueOnce(3n) // getVersionCount
            .mockResolvedValueOnce(versions[0])
            .mockResolvedValueOnce(versions[1])
            .mockResolvedValueOnce(versions[2]);
        r.connect(makeMockWalletClient(), pub);
        const result = await r.getAllVersions(1n);
        (0, vitest_1.expect)(result).toHaveLength(3);
        (0, vitest_1.expect)(result[0].versionTag).toBe("v1.0.0");
        (0, vitest_1.expect)(result[2].versionTag).toBe("v1.2.0");
    });
    (0, vitest_1.it)("returns empty array when no versions exist", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(0n);
        r.connect(makeMockWalletClient(), pub);
        const result = await r.getAllVersions(1n);
        (0, vitest_1.expect)(result).toEqual([]);
    });
});
(0, vitest_1.describe)("ProjectRegistry — getOwnerProjects()", () => {
    (0, vitest_1.it)("returns project IDs for an owner", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue([1n, 2n, 5n]);
        r.connect(makeMockWalletClient(), pub);
        const ids = await r.getOwnerProjects(OWNER_ADDR);
        (0, vitest_1.expect)(ids).toEqual([1n, 2n, 5n]);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "getOwnerProjects", args: [OWNER_ADDR] }));
    });
    (0, vitest_1.it)("returns empty array when owner has no projects", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue([]);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.getOwnerProjects(OWNER_ADDR)).toEqual([]);
    });
});
(0, vitest_1.describe)("ProjectRegistry — getCollaborators()", () => {
    (0, vitest_1.it)("returns collaborator addresses", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue([COLLAB_ADDR]);
        r.connect(makeMockWalletClient(), pub);
        const collabs = await r.getCollaborators(1n);
        (0, vitest_1.expect)(collabs).toEqual([COLLAB_ADDR]);
    });
});
(0, vitest_1.describe)("ProjectRegistry — isCollaborator()", () => {
    (0, vitest_1.it)("returns true when address is a collaborator", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(true);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.isCollaborator(1n, COLLAB_ADDR)).toBe(true);
    });
    (0, vitest_1.it)("returns false when address is not a collaborator", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(false);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.isCollaborator(1n, COLLAB_ADDR)).toBe(false);
    });
});
(0, vitest_1.describe)("ProjectRegistry — isNameTaken()", () => {
    (0, vitest_1.it)("returns true when name is taken", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(true);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.isNameTaken("agent-brain")).toBe(true);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "nameTaken", args: ["agent-brain"] }));
    });
    (0, vitest_1.it)("returns false when name is available", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(false);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.isNameTaken("new-project")).toBe(false);
    });
});
(0, vitest_1.describe)("ProjectRegistry — getAgentProjects()", () => {
    (0, vitest_1.it)("calls readContract with pagination args", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue([1n, 3n]);
        r.connect(makeMockWalletClient(), pub);
        const result = await r.getAgentProjects(0n, 10n);
        (0, vitest_1.expect)(result).toEqual([1n, 3n]);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "getAgentProjects", args: [0n, 10n] }));
    });
});
(0, vitest_1.describe)("ProjectRegistry — getVersionFee()", () => {
    (0, vitest_1.it)("returns fee as bigint", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(500000000000000n); // 0.0005 ETH
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.getVersionFee()).toBe(500000000000000n);
    });
});
(0, vitest_1.describe)("ProjectRegistry — getTransferFee()", () => {
    (0, vitest_1.it)("returns fee as bigint", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(1000000000000000n); // 0.001 ETH
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.getTransferFee()).toBe(1000000000000000n);
    });
});
(0, vitest_1.describe)("ProjectRegistry — getProjectCount()", () => {
    (0, vitest_1.it)("returns total project count", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(42n);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.getProjectCount()).toBe(42n);
    });
    (0, vitest_1.it)("returns 0n when registry is empty", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(0n);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.getProjectCount()).toBe(0n);
    });
});
// ─── estimatePushCost / estimateTransferCost ──────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — estimatePushCost()", () => {
    (0, vitest_1.it)("delegates to getVersionFee()", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(500000000000000n);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.estimatePushCost()).toBe(500000000000000n);
    });
});
(0, vitest_1.describe)("ProjectRegistry — estimateTransferCost()", () => {
    (0, vitest_1.it)("delegates to getTransferFee()", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(1000000000000000n);
        r.connect(makeMockWalletClient(), pub);
        (0, vitest_1.expect)(await r.estimateTransferCost()).toBe(1000000000000000n);
    });
});
// ─── createProject() ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — createProject()", () => {
    function setupCreateProjectMocks(pub) {
        // TOKEN_LOCK_AMOUNT (1 INKD = 1e18)
        const LOCK = 1000000000000000000n;
        // call sequence: TOKEN_LOCK_AMOUNT, balanceOf, allowance, then writeContract receipt
        pub.readContract
            .mockResolvedValueOnce(LOCK) // TOKEN_LOCK_AMOUNT
            .mockResolvedValueOnce(LOCK * 2n) // balanceOf (sufficient)
            .mockResolvedValueOnce(LOCK); // allowance (sufficient — no approve needed)
        pub.waitForTransactionReceipt.mockResolvedValue({
            logs: [{ topics: ["0xPROJECT_CREATED", "0x1"] }],
        });
    }
    (0, vitest_1.it)("calls writeContract with createProject and returns hash + projectId", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        setupCreateProjectMocks(pub);
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const result = await r.createProject({ name: "agent-brain" });
        (0, vitest_1.expect)(result.hash).toBe(TX_HASH);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "createProject" }));
    });
    (0, vitest_1.it)("passes default values for optional fields", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        setupCreateProjectMocks(pub);
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        await r.createProject({ name: "my-agent" });
        const callArgs = wlt.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(callArgs.args).toContain("MIT"); // default license
        (0, vitest_1.expect)(callArgs.args).toContain(true); // default isPublic
    });
    (0, vitest_1.it)("respects explicit isAgent and agentEndpoint", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        setupCreateProjectMocks(pub);
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        await r.createProject({
            name: "smart-agent",
            isAgent: true,
            agentEndpoint: "https://agent.example.com",
        });
        const callArgs = wlt.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(callArgs.args).toContain(true);
        (0, vitest_1.expect)(callArgs.args).toContain("https://agent.example.com");
    });
    (0, vitest_1.it)("throws InsufficientInkdBalance when balance is too low", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        const LOCK = 1000000000000000000n;
        pub.readContract
            .mockResolvedValueOnce(LOCK) // TOKEN_LOCK_AMOUNT
            .mockResolvedValueOnce(0n); // balanceOf (insufficient)
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        await (0, vitest_1.expect)(r.createProject({ name: "broke-agent" })).rejects.toThrow(ProjectRegistry_js_1.InsufficientInkdBalance);
    });
    (0, vitest_1.it)("sends an approve tx when allowance is insufficient", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        const LOCK = 1000000000000000000n;
        pub.readContract
            .mockResolvedValueOnce(LOCK) // TOKEN_LOCK_AMOUNT
            .mockResolvedValueOnce(LOCK * 2n) // balanceOf (sufficient)
            .mockResolvedValueOnce(0n); // allowance (0 — approve needed)
        pub.waitForTransactionReceipt.mockResolvedValue({
            logs: [{ topics: ["0xPROJECT_CREATED", "0x1"] }],
        });
        const wlt = makeMockWalletClient();
        // First call is approve, second is createProject
        wlt.writeContract.mockResolvedValueOnce(TX_HASH).mockResolvedValueOnce(TX_HASH);
        r.connect(wlt, pub);
        await r.createProject({ name: "new-agent" });
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledTimes(2);
        const firstCall = wlt.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(firstCall.functionName).toBe("approve");
    });
    (0, vitest_1.it)("extracts projectId from transaction log topics", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        const LOCK = 1000000000000000000n;
        pub.readContract
            .mockResolvedValueOnce(LOCK)
            .mockResolvedValueOnce(LOCK)
            .mockResolvedValueOnce(LOCK);
        pub.waitForTransactionReceipt.mockResolvedValue({
            logs: [{ topics: ["0xeventSig", "0x7"] }], // projectId = 7
        });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const { projectId } = await r.createProject({ name: "agent-7" });
        (0, vitest_1.expect)(projectId).toBe(7n);
    });
    (0, vitest_1.it)("falls back to 0n when no useful log topics found", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        const LOCK = 1000000000000000000n;
        pub.readContract
            .mockResolvedValueOnce(LOCK)
            .mockResolvedValueOnce(LOCK)
            .mockResolvedValueOnce(LOCK);
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] }); // no logs
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const { projectId } = await r.createProject({ name: "silent-agent" });
        (0, vitest_1.expect)(projectId).toBe(0n);
    });
    (0, vitest_1.it)("extractProjectIdFromLogs: skips log with invalid topic[1] (catch branch), returns 0n", async () => {
        // Log has 2 topics but topic[1] is not a valid BigInt string → catch fires → continue → return 0n
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        const LOCK = 1000000000000000000n;
        pub.readContract
            .mockResolvedValueOnce(LOCK)
            .mockResolvedValueOnce(LOCK)
            .mockResolvedValueOnce(LOCK);
        pub.waitForTransactionReceipt.mockResolvedValue({
            logs: [{ topics: ["0xProjectCreated", "not-a-valid-bigint"] }], // ← triggers catch
        });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const { projectId } = await r.createProject({ name: "catch-branch-agent" });
        (0, vitest_1.expect)(projectId).toBe(0n);
    });
});
// ─── pushVersion() ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — pushVersion()", () => {
    (0, vitest_1.it)("reads versionFee and writes pushVersion with correct args", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract
            .mockResolvedValueOnce(500000000000000n) // getVersionFee
            .mockResolvedValueOnce(1n); // getVersionCount (after push)
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const result = await r.pushVersion({
            projectId: 1n,
            arweaveHash: "ar://v1-hash",
            versionTag: "v1.0.0",
            changelog: "First push",
        });
        (0, vitest_1.expect)(result.hash).toBe(TX_HASH);
        (0, vitest_1.expect)(result.versionIndex).toBe(0n); // count=1 → index=0
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "pushVersion",
            args: [1n, "ar://v1-hash", "v1.0.0", "First push"],
            value: 500000000000000n,
        }));
    });
    (0, vitest_1.it)("accepts explicit value override (skips fee read)", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(5n); // getVersionCount
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        await r.pushVersion({ projectId: 2n, arweaveHash: "ar://x", versionTag: "v2", changelog: "" }, 1000000000000000n);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ value: 1000000000000000n }));
    });
    (0, vitest_1.it)("uses empty string as default changelog", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract
            .mockResolvedValueOnce(500000000000000n)
            .mockResolvedValueOnce(1n);
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        await r.pushVersion({ projectId: 1n, arweaveHash: "ar://x", versionTag: "v0.1" });
        const args = wlt.writeContract.mock.calls[0][0].args;
        (0, vitest_1.expect)(args[3]).toBe(""); // changelog defaults to ""
    });
});
// ─── addCollaborator() ────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — addCollaborator()", () => {
    (0, vitest_1.it)("calls writeContract with correct args and returns hash", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const hash = await r.addCollaborator(1n, COLLAB_ADDR);
        (0, vitest_1.expect)(hash).toBe(TX_HASH);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "addCollaborator",
            args: [1n, COLLAB_ADDR],
        }));
    });
});
// ─── removeCollaborator() ─────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — removeCollaborator()", () => {
    (0, vitest_1.it)("calls writeContract with correct args and returns hash", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const hash = await r.removeCollaborator(1n, COLLAB_ADDR);
        (0, vitest_1.expect)(hash).toBe(TX_HASH);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "removeCollaborator",
            args: [1n, COLLAB_ADDR],
        }));
    });
});
// ─── transferProject() ────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — transferProject()", () => {
    (0, vitest_1.it)("reads transferFee and calls writeContract with correct value", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.readContract.mockResolvedValue(1000000000000000n); // 0.001 ETH
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const hash = await r.transferProject(1n, COLLAB_ADDR);
        (0, vitest_1.expect)(hash).toBe(TX_HASH);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "transferProject",
            args: [1n, COLLAB_ADDR],
            value: 1000000000000000n,
        }));
    });
    (0, vitest_1.it)("accepts explicit value override", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        await r.transferProject(1n, COLLAB_ADDR, 999n);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ value: 999n }));
    });
});
// ─── setVisibility() ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — setVisibility()", () => {
    (0, vitest_1.it)("calls writeContract with isPublic=false", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const hash = await r.setVisibility(1n, false);
        (0, vitest_1.expect)(hash).toBe(TX_HASH);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "setVisibility", args: [1n, false] }));
    });
    (0, vitest_1.it)("calls writeContract with isPublic=true", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        await r.setVisibility(2n, true);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ args: [2n, true] }));
    });
});
// ─── setReadme() ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — setReadme()", () => {
    (0, vitest_1.it)("calls writeContract with correct args", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const hash = await r.setReadme(1n, "ar://new-readme");
        (0, vitest_1.expect)(hash).toBe(TX_HASH);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "setReadme", args: [1n, "ar://new-readme"] }));
    });
});
// ─── setAgentEndpoint() ───────────────────────────────────────────────────────
(0, vitest_1.describe)("ProjectRegistry — setAgentEndpoint()", () => {
    (0, vitest_1.it)("calls writeContract with correct args", async () => {
        const r = new ProjectRegistry_js_1.ProjectRegistry(BASE_CONFIG);
        const pub = makeMockPublicClient();
        pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
        const wlt = makeMockWalletClient();
        r.connect(wlt, pub);
        const hash = await r.setAgentEndpoint(1n, "https://agent.new.xyz");
        (0, vitest_1.expect)(hash).toBe(TX_HASH);
        (0, vitest_1.expect)(wlt.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "setAgentEndpoint",
            args: [1n, "https://agent.new.xyz"],
        }));
    });
});
// ─── ABI exports ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("INKD_REGISTRY_ABI / INKD_ERC20_ABI exports", () => {
    (0, vitest_1.it)("INKD_REGISTRY_ABI is a non-empty array", () => {
        (0, vitest_1.expect)(Array.isArray(ProjectRegistry_js_1.INKD_REGISTRY_ABI)).toBe(true);
        (0, vitest_1.expect)(ProjectRegistry_js_1.INKD_REGISTRY_ABI.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)("INKD_ERC20_ABI is a non-empty array", () => {
        (0, vitest_1.expect)(Array.isArray(ProjectRegistry_js_1.INKD_ERC20_ABI)).toBe(true);
        (0, vitest_1.expect)(ProjectRegistry_js_1.INKD_ERC20_ABI.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)("INKD_REGISTRY_ABI includes createProject function", () => {
        const fns = ProjectRegistry_js_1.INKD_REGISTRY_ABI.filter((e) => e.type === "function").map((e) => e.name);
        (0, vitest_1.expect)(fns).toContain("createProject");
    });
    (0, vitest_1.it)("INKD_REGISTRY_ABI includes pushVersion function", () => {
        const fns = ProjectRegistry_js_1.INKD_REGISTRY_ABI.filter((e) => e.type === "function").map((e) => e.name);
        (0, vitest_1.expect)(fns).toContain("pushVersion");
    });
    (0, vitest_1.it)("INKD_ERC20_ABI includes approve function", () => {
        const fns = ProjectRegistry_js_1.INKD_ERC20_ABI.filter((e) => e.type === "function").map((e) => e.name);
        (0, vitest_1.expect)(fns).toContain("approve");
    });
    (0, vitest_1.it)("INKD_ERC20_ABI includes balanceOf function", () => {
        const fns = ProjectRegistry_js_1.INKD_ERC20_ABI.filter((e) => e.type === "function").map((e) => e.name);
        (0, vitest_1.expect)(fns).toContain("balanceOf");
    });
});
//# sourceMappingURL=ProjectRegistry.test.js.map