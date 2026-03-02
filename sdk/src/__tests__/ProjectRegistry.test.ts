/**
 * @file ProjectRegistry.test.ts
 * @description Comprehensive unit tests for ProjectRegistry — the on-chain
 * project registry client. Covers all read methods, all write methods,
 * error guards, and edge-case paths.
 */

import { describe, it, expect, vi } from "vitest";
import {
  ProjectRegistry,
  RegistryNotConnected,
  InsufficientInkdBalance,
  InsufficientEthBalance,
  INKD_REGISTRY_ABI,
  INKD_ERC20_ABI,
  type ProjectRegistryConfig,
  type Project,
  type ProjectVersion,
} from "../ProjectRegistry.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const REGISTRY_ADDR = "0xRegistryAddress000000000000000000000001" as const;
const TOKEN_ADDR = "0xTokenAddress00000000000000000000000002" as const;
const OWNER_ADDR = "0xOwnerAddress0000000000000000000000000003" as const;
const COLLAB_ADDR = "0xCollabAddress000000000000000000000000004" as const;
const TX_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as const;

const BASE_CONFIG: ProjectRegistryConfig = {
  registryAddress: REGISTRY_ADDR,
  tokenAddress: TOKEN_ADDR,
  chainId: 84532,
};

const MOCK_PROJECT: Project = {
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

const MOCK_VERSION: ProjectVersion = {
  projectId: 1n,
  arweaveHash: "ar://v1-hash",
  versionTag: "v1.0.0",
  changelog: "Initial release",
  pushedBy: OWNER_ADDR,
  pushedAt: 1700001000n,
};

// ─── Mock factory helpers ─────────────────────────────────────────────────────

function makeMockPublicClient(overrides: Record<string, unknown> = {}) {
  return {
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    ...overrides,
  };
}

function makeMockWalletClient(address: string = OWNER_ADDR) {
  return {
    account: { address },
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
  };
}

// ─── Error Classes ────────────────────────────────────────────────────────────

describe("RegistryNotConnected", () => {
  it("is an instance of Error", () => {
    const err = new RegistryNotConnected();
    expect(err).toBeInstanceOf(Error);
  });

  it("has name RegistryNotConnected", () => {
    expect(new RegistryNotConnected().name).toBe("RegistryNotConnected");
  });

  it("message mentions connect()", () => {
    expect(new RegistryNotConnected().message).toContain("connect()");
  });
});

describe("InsufficientInkdBalance", () => {
  it("is an instance of Error", () => {
    expect(new InsufficientInkdBalance(0n, 1000000000000000000n)).toBeInstanceOf(Error);
  });

  it("has name InsufficientInkdBalance", () => {
    expect(new InsufficientInkdBalance(0n, 1000000000000000000n).name).toBe("InsufficientInkdBalance");
  });

  it("message includes balance and required amounts", () => {
    const err = new InsufficientInkdBalance(500n, 1000n);
    expect(err.message).toContain("500");
    expect(err.message).toContain("1000");
  });
});

describe("InsufficientEthBalance", () => {
  it("is an instance of Error", () => {
    expect(new InsufficientEthBalance(1000000n)).toBeInstanceOf(Error);
  });

  it("has name InsufficientEthBalance", () => {
    expect(new InsufficientEthBalance(1000000n).name).toBe("InsufficientEthBalance");
  });

  it("message includes the fee amount", () => {
    const err = new InsufficientEthBalance(999n);
    expect(err.message).toContain("999");
  });
});

// ─── Constructor ──────────────────────────────────────────────────────────────

describe("ProjectRegistry — constructor", () => {
  it("creates an instance with Base Sepolia config", () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    expect(r).toBeInstanceOf(ProjectRegistry);
  });

  it("creates an instance with Base mainnet config", () => {
    const r = new ProjectRegistry({ ...BASE_CONFIG, chainId: 8453 });
    expect(r).toBeInstanceOf(ProjectRegistry);
  });

  it("does not throw on valid config", () => {
    expect(() => new ProjectRegistry(BASE_CONFIG)).not.toThrow();
  });
});

// ─── connect() ────────────────────────────────────────────────────────────────

describe("ProjectRegistry — connect()", () => {
  it("enables subsequent read calls", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(5n);
    const wlt = makeMockWalletClient();

    r.connect(wlt as any, pub as any);
    const count = await r.getProjectCount();
    expect(count).toBe(5n);
  });

  it("allows reconnect with a different client", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub1 = makeMockPublicClient();
    const pub2 = makeMockPublicClient();
    pub1.readContract.mockResolvedValue(1n);
    pub2.readContract.mockResolvedValue(99n);
    const wlt = makeMockWalletClient();

    r.connect(wlt as any, pub1 as any);
    expect(await r.getProjectCount()).toBe(1n);

    r.connect(wlt as any, pub2 as any);
    expect(await r.getProjectCount()).toBe(99n);
  });
});

// ─── Guard (RegistryNotConnected) ─────────────────────────────────────────────

describe("ProjectRegistry — connection guard", () => {
  it("getProject throws without publicClient", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.getProject(1n)).rejects.toThrow(RegistryNotConnected);
  });

  it("getVersion throws without publicClient", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.getVersion(1n, 0n)).rejects.toThrow(RegistryNotConnected);
  });

  it("getAllVersions throws without publicClient", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.getAllVersions(1n)).rejects.toThrow(RegistryNotConnected);
  });

  it("getOwnerProjects throws without publicClient", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.getOwnerProjects(OWNER_ADDR)).rejects.toThrow(RegistryNotConnected);
  });

  it("getVersionFee throws without publicClient", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.getVersionFee()).rejects.toThrow(RegistryNotConnected);
  });

  it("createProject throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.createProject({ name: "foo" })).rejects.toThrow(RegistryNotConnected);
  });

  it("pushVersion throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(
      r.pushVersion({ projectId: 1n, arweaveHash: "ar://x", versionTag: "v1" })
    ).rejects.toThrow(RegistryNotConnected);
  });

  it("addCollaborator throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.addCollaborator(1n, COLLAB_ADDR)).rejects.toThrow(RegistryNotConnected);
  });

  it("removeCollaborator throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.removeCollaborator(1n, COLLAB_ADDR)).rejects.toThrow(RegistryNotConnected);
  });

  it("transferProject throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.transferProject(1n, COLLAB_ADDR)).rejects.toThrow(RegistryNotConnected);
  });

  it("setVisibility throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.setVisibility(1n, false)).rejects.toThrow(RegistryNotConnected);
  });

  it("setReadme throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.setReadme(1n, "ar://readme")).rejects.toThrow(RegistryNotConnected);
  });

  it("setAgentEndpoint throws without wallet", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    await expect(r.setAgentEndpoint(1n, "https://api.xyz")).rejects.toThrow(RegistryNotConnected);
  });
});

// ─── Read methods ─────────────────────────────────────────────────────────────

describe("ProjectRegistry — getProject()", () => {
  it("calls readContract with correct args and returns project", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(MOCK_PROJECT);
    r.connect(makeMockWalletClient() as any, pub as any);

    const result = await r.getProject(1n);
    expect(result).toEqual(MOCK_PROJECT);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getProject", args: [1n] })
    );
  });

  it("returns null when project does not exist (exists=false)", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue({ ...MOCK_PROJECT, exists: false });
    r.connect(makeMockWalletClient() as any, pub as any);

    const result = await r.getProject(999n);
    expect(result).toBeNull();
  });
});

describe("ProjectRegistry — getVersion()", () => {
  it("calls readContract with projectId and index", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(MOCK_VERSION);
    r.connect(makeMockWalletClient() as any, pub as any);

    const result = await r.getVersion(1n, 0n);
    expect(result).toEqual(MOCK_VERSION);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getVersion", args: [1n, 0n] })
    );
  });
});

describe("ProjectRegistry — getAllVersions()", () => {
  it("fetches version count then iterates over all versions", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
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

    r.connect(makeMockWalletClient() as any, pub as any);
    const result = await r.getAllVersions(1n);

    expect(result).toHaveLength(3);
    expect(result[0].versionTag).toBe("v1.0.0");
    expect(result[2].versionTag).toBe("v1.2.0");
  });

  it("returns empty array when no versions exist", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(0n);
    r.connect(makeMockWalletClient() as any, pub as any);

    const result = await r.getAllVersions(1n);
    expect(result).toEqual([]);
  });
});

describe("ProjectRegistry — getOwnerProjects()", () => {
  it("returns project IDs for an owner", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue([1n, 2n, 5n]);
    r.connect(makeMockWalletClient() as any, pub as any);

    const ids = await r.getOwnerProjects(OWNER_ADDR);
    expect(ids).toEqual([1n, 2n, 5n]);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getOwnerProjects", args: [OWNER_ADDR] })
    );
  });

  it("returns empty array when owner has no projects", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue([]);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.getOwnerProjects(OWNER_ADDR)).toEqual([]);
  });
});

describe("ProjectRegistry — getCollaborators()", () => {
  it("returns collaborator addresses", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue([COLLAB_ADDR]);
    r.connect(makeMockWalletClient() as any, pub as any);

    const collabs = await r.getCollaborators(1n);
    expect(collabs).toEqual([COLLAB_ADDR]);
  });
});

describe("ProjectRegistry — isCollaborator()", () => {
  it("returns true when address is a collaborator", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(true);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.isCollaborator(1n, COLLAB_ADDR)).toBe(true);
  });

  it("returns false when address is not a collaborator", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(false);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.isCollaborator(1n, COLLAB_ADDR)).toBe(false);
  });
});

describe("ProjectRegistry — isNameTaken()", () => {
  it("returns true when name is taken", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(true);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.isNameTaken("agent-brain")).toBe(true);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "nameTaken", args: ["agent-brain"] })
    );
  });

  it("returns false when name is available", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(false);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.isNameTaken("new-project")).toBe(false);
  });
});

describe("ProjectRegistry — getAgentProjects()", () => {
  it("calls readContract with pagination args", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue([1n, 3n]);
    r.connect(makeMockWalletClient() as any, pub as any);

    const result = await r.getAgentProjects(0n, 10n);
    expect(result).toEqual([1n, 3n]);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getAgentProjects", args: [0n, 10n] })
    );
  });
});

describe("ProjectRegistry — getVersionFee()", () => {
  it("returns fee as bigint", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(500000000000000n); // 0.0005 ETH
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.getVersionFee()).toBe(500000000000000n);
  });
});

describe("ProjectRegistry — getTransferFee()", () => {
  it("returns fee as bigint", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(1000000000000000n); // 0.001 ETH
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.getTransferFee()).toBe(1000000000000000n);
  });
});

describe("ProjectRegistry — getProjectCount()", () => {
  it("returns total project count", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(42n);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.getProjectCount()).toBe(42n);
  });

  it("returns 0n when registry is empty", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(0n);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.getProjectCount()).toBe(0n);
  });
});

// ─── estimatePushCost / estimateTransferCost ──────────────────────────────────

describe("ProjectRegistry — estimatePushCost()", () => {
  it("delegates to getVersionFee()", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(500000000000000n);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.estimatePushCost()).toBe(500000000000000n);
  });
});

describe("ProjectRegistry — estimateTransferCost()", () => {
  it("delegates to getTransferFee()", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(1000000000000000n);
    r.connect(makeMockWalletClient() as any, pub as any);

    expect(await r.estimateTransferCost()).toBe(1000000000000000n);
  });
});

// ─── createProject() ─────────────────────────────────────────────────────────

describe("ProjectRegistry — createProject()", () => {
  function setupCreateProjectMocks(pub: ReturnType<typeof makeMockPublicClient>) {
    // TOKEN_LOCK_AMOUNT (1 INKD = 1e18)
    const LOCK = 1_000_000_000_000_000_000n;
    // call sequence: TOKEN_LOCK_AMOUNT, balanceOf, allowance, then writeContract receipt
    pub.readContract
      .mockResolvedValueOnce(LOCK)        // TOKEN_LOCK_AMOUNT
      .mockResolvedValueOnce(LOCK * 2n)   // balanceOf (sufficient)
      .mockResolvedValueOnce(LOCK);       // allowance (sufficient — no approve needed)
    pub.waitForTransactionReceipt.mockResolvedValue({
      logs: [{ topics: ["0xPROJECT_CREATED", "0x1"] }],
    });
  }

  it("calls writeContract with createProject and returns hash + projectId", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    setupCreateProjectMocks(pub);
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const result = await r.createProject({ name: "agent-brain" });

    expect(result.hash).toBe(TX_HASH);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "createProject" })
    );
  });

  it("passes default values for optional fields", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    setupCreateProjectMocks(pub);
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    await r.createProject({ name: "my-agent" });

    const callArgs = wlt.writeContract.mock.calls[0][0];
    expect(callArgs.args).toContain("MIT");   // default license
    expect(callArgs.args).toContain(true);    // default isPublic
  });

  it("respects explicit isAgent and agentEndpoint", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    setupCreateProjectMocks(pub);
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    await r.createProject({
      name: "smart-agent",
      isAgent: true,
      agentEndpoint: "https://agent.example.com",
    });

    const callArgs = wlt.writeContract.mock.calls[0][0];
    expect(callArgs.args).toContain(true);
    expect(callArgs.args).toContain("https://agent.example.com");
  });

  it("throws InsufficientInkdBalance when balance is too low", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    const LOCK = 1_000_000_000_000_000_000n;
    pub.readContract
      .mockResolvedValueOnce(LOCK)   // TOKEN_LOCK_AMOUNT
      .mockResolvedValueOnce(0n);    // balanceOf (insufficient)
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    await expect(r.createProject({ name: "broke-agent" })).rejects.toThrow(InsufficientInkdBalance);
  });

  it("sends an approve tx when allowance is insufficient", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    const LOCK = 1_000_000_000_000_000_000n;
    pub.readContract
      .mockResolvedValueOnce(LOCK)     // TOKEN_LOCK_AMOUNT
      .mockResolvedValueOnce(LOCK * 2n) // balanceOf (sufficient)
      .mockResolvedValueOnce(0n);      // allowance (0 — approve needed)
    pub.waitForTransactionReceipt.mockResolvedValue({
      logs: [{ topics: ["0xPROJECT_CREATED", "0x1"] }],
    });
    const wlt = makeMockWalletClient();
    // First call is approve, second is createProject
    wlt.writeContract.mockResolvedValueOnce(TX_HASH).mockResolvedValueOnce(TX_HASH);
    r.connect(wlt as any, pub as any);

    await r.createProject({ name: "new-agent" });

    expect(wlt.writeContract).toHaveBeenCalledTimes(2);
    const firstCall = wlt.writeContract.mock.calls[0][0];
    expect(firstCall.functionName).toBe("approve");
  });

  it("extracts projectId from transaction log topics", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    const LOCK = 1_000_000_000_000_000_000n;
    pub.readContract
      .mockResolvedValueOnce(LOCK)
      .mockResolvedValueOnce(LOCK)
      .mockResolvedValueOnce(LOCK);
    pub.waitForTransactionReceipt.mockResolvedValue({
      logs: [{ topics: ["0xeventSig", "0x7"] }], // projectId = 7
    });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const { projectId } = await r.createProject({ name: "agent-7" });
    expect(projectId).toBe(7n);
  });

  it("falls back to 0n when no useful log topics found", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    const LOCK = 1_000_000_000_000_000_000n;
    pub.readContract
      .mockResolvedValueOnce(LOCK)
      .mockResolvedValueOnce(LOCK)
      .mockResolvedValueOnce(LOCK);
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] }); // no logs
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const { projectId } = await r.createProject({ name: "silent-agent" });
    expect(projectId).toBe(0n);
  });
});

// ─── pushVersion() ────────────────────────────────────────────────────────────

describe("ProjectRegistry — pushVersion()", () => {
  it("reads versionFee and writes pushVersion with correct args", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract
      .mockResolvedValueOnce(500000000000000n)  // getVersionFee
      .mockResolvedValueOnce(1n);               // getVersionCount (after push)
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const result = await r.pushVersion({
      projectId: 1n,
      arweaveHash: "ar://v1-hash",
      versionTag: "v1.0.0",
      changelog: "First push",
    });

    expect(result.hash).toBe(TX_HASH);
    expect(result.versionIndex).toBe(0n); // count=1 → index=0
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "pushVersion",
        args: [1n, "ar://v1-hash", "v1.0.0", "First push"],
        value: 500000000000000n,
      })
    );
  });

  it("accepts explicit value override (skips fee read)", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(5n); // getVersionCount
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    await r.pushVersion(
      { projectId: 2n, arweaveHash: "ar://x", versionTag: "v2", changelog: "" },
      1_000_000_000_000_000n
    );

    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ value: 1_000_000_000_000_000n })
    );
  });

  it("uses empty string as default changelog", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract
      .mockResolvedValueOnce(500000000000000n)
      .mockResolvedValueOnce(1n);
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    await r.pushVersion({ projectId: 1n, arweaveHash: "ar://x", versionTag: "v0.1" });
    const args = wlt.writeContract.mock.calls[0][0].args;
    expect(args[3]).toBe(""); // changelog defaults to ""
  });
});

// ─── addCollaborator() ────────────────────────────────────────────────────────

describe("ProjectRegistry — addCollaborator()", () => {
  it("calls writeContract with correct args and returns hash", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const hash = await r.addCollaborator(1n, COLLAB_ADDR);
    expect(hash).toBe(TX_HASH);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "addCollaborator",
        args: [1n, COLLAB_ADDR],
      })
    );
  });
});

// ─── removeCollaborator() ─────────────────────────────────────────────────────

describe("ProjectRegistry — removeCollaborator()", () => {
  it("calls writeContract with correct args and returns hash", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const hash = await r.removeCollaborator(1n, COLLAB_ADDR);
    expect(hash).toBe(TX_HASH);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "removeCollaborator",
        args: [1n, COLLAB_ADDR],
      })
    );
  });
});

// ─── transferProject() ────────────────────────────────────────────────────────

describe("ProjectRegistry — transferProject()", () => {
  it("reads transferFee and calls writeContract with correct value", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.readContract.mockResolvedValue(1_000_000_000_000_000n); // 0.001 ETH
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const hash = await r.transferProject(1n, COLLAB_ADDR);
    expect(hash).toBe(TX_HASH);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "transferProject",
        args: [1n, COLLAB_ADDR],
        value: 1_000_000_000_000_000n,
      })
    );
  });

  it("accepts explicit value override", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    await r.transferProject(1n, COLLAB_ADDR, 999n);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ value: 999n })
    );
  });
});

// ─── setVisibility() ─────────────────────────────────────────────────────────

describe("ProjectRegistry — setVisibility()", () => {
  it("calls writeContract with isPublic=false", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const hash = await r.setVisibility(1n, false);
    expect(hash).toBe(TX_HASH);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "setVisibility", args: [1n, false] })
    );
  });

  it("calls writeContract with isPublic=true", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    await r.setVisibility(2n, true);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [2n, true] })
    );
  });
});

// ─── setReadme() ──────────────────────────────────────────────────────────────

describe("ProjectRegistry — setReadme()", () => {
  it("calls writeContract with correct args", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const hash = await r.setReadme(1n, "ar://new-readme");
    expect(hash).toBe(TX_HASH);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "setReadme", args: [1n, "ar://new-readme"] })
    );
  });
});

// ─── setAgentEndpoint() ───────────────────────────────────────────────────────

describe("ProjectRegistry — setAgentEndpoint()", () => {
  it("calls writeContract with correct args", async () => {
    const r = new ProjectRegistry(BASE_CONFIG);
    const pub = makeMockPublicClient();
    pub.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const wlt = makeMockWalletClient();
    r.connect(wlt as any, pub as any);

    const hash = await r.setAgentEndpoint(1n, "https://agent.new.xyz");
    expect(hash).toBe(TX_HASH);
    expect(wlt.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setAgentEndpoint",
        args: [1n, "https://agent.new.xyz"],
      })
    );
  });
});

// ─── ABI exports ──────────────────────────────────────────────────────────────

describe("INKD_REGISTRY_ABI / INKD_ERC20_ABI exports", () => {
  it("INKD_REGISTRY_ABI is a non-empty array", () => {
    expect(Array.isArray(INKD_REGISTRY_ABI)).toBe(true);
    expect(INKD_REGISTRY_ABI.length).toBeGreaterThan(0);
  });

  it("INKD_ERC20_ABI is a non-empty array", () => {
    expect(Array.isArray(INKD_ERC20_ABI)).toBe(true);
    expect(INKD_ERC20_ABI.length).toBeGreaterThan(0);
  });

  it("INKD_REGISTRY_ABI includes createProject function", () => {
    const fns = INKD_REGISTRY_ABI.filter((e: any) => e.type === "function").map((e: any) => e.name);
    expect(fns).toContain("createProject");
  });

  it("INKD_REGISTRY_ABI includes pushVersion function", () => {
    const fns = INKD_REGISTRY_ABI.filter((e: any) => e.type === "function").map((e: any) => e.name);
    expect(fns).toContain("pushVersion");
  });

  it("INKD_ERC20_ABI includes approve function", () => {
    const fns = INKD_ERC20_ABI.filter((e: any) => e.type === "function").map((e: any) => e.name);
    expect(fns).toContain("approve");
  });

  it("INKD_ERC20_ABI includes balanceOf function", () => {
    const fns = INKD_ERC20_ABI.filter((e: any) => e.type === "function").map((e: any) => e.name);
    expect(fns).toContain("balanceOf");
  });
});
