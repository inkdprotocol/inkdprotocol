/**
 * Tests for sdk/src/index.ts — InkdClient (viem-based) and ADDRESSES
 *
 * Strategy: mock viem's createPublicClient so no real RPC calls are made.
 * The wallet client is also a plain vi.fn() mock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseEther, type Address } from "viem";

// ─── Mock viem before importing index ────────────────────────────────────────

const mockReadContract = vi.fn();
const mockPublicClient = { readContract: mockReadContract };

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => mockPublicClient),
  };
});

// Import AFTER mocking
import { InkdClient, ADDRESSES } from "../index.js";

// ─── Mock Wallet Client ───────────────────────────────────────────────────────

function makeMockWallet(address: Address = "0xuser000000000000000000000000000000000000") {
  return {
    getAddresses: vi.fn().mockResolvedValue([address]),
    writeContract: vi.fn().mockResolvedValue("0xtxhash" as `0x${string}`),
    chain: { id: 84532 },
  };
}

// ─── ADDRESSES export ─────────────────────────────────────────────────────────

describe("ADDRESSES", () => {
  it("exports mainnet and testnet address objects", () => {
    expect(ADDRESSES).toHaveProperty("mainnet");
    expect(ADDRESSES).toHaveProperty("testnet");
  });

  it("mainnet has token, registry, treasury keys", () => {
    expect(ADDRESSES.mainnet).toHaveProperty("token");
    expect(ADDRESSES.mainnet).toHaveProperty("registry");
    expect(ADDRESSES.mainnet).toHaveProperty("treasury");
  });

  it("testnet has token, registry, treasury keys", () => {
    expect(ADDRESSES.testnet).toHaveProperty("token");
    expect(ADDRESSES.testnet).toHaveProperty("registry");
    expect(ADDRESSES.testnet).toHaveProperty("treasury");
  });
});

// ─── InkdClient construction ──────────────────────────────────────────────────

describe("InkdClient — constructor", () => {
  it("constructs with default testnet network", () => {
    const wallet = makeMockWallet();
    const client = new InkdClient({ walletClient: wallet as any });
    expect(client).toBeInstanceOf(InkdClient);
  });

  it("constructs with explicit mainnet network", () => {
    const wallet = makeMockWallet();
    const client = new InkdClient({ walletClient: wallet as any, network: "mainnet" });
    expect(client).toBeInstanceOf(InkdClient);
  });

  it("constructs with explicit testnet network", () => {
    const wallet = makeMockWallet();
    const client = new InkdClient({ walletClient: wallet as any, network: "testnet" });
    expect(client).toBeInstanceOf(InkdClient);
  });

  it("constructs with custom rpcUrl", () => {
    const wallet = makeMockWallet();
    const client = new InkdClient({
      walletClient: wallet as any,
      rpcUrl: "https://my-custom-rpc.example.com",
    });
    expect(client).toBeInstanceOf(InkdClient);
  });
});

// ─── Token helpers ────────────────────────────────────────────────────────────

describe("InkdClient — approveToken()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
    wallet.writeContract.mockResolvedValue("0xapprove_tx");
  });

  it("calls writeContract with approve function", async () => {
    const hash = await client.approveToken();
    expect(wallet.writeContract).toHaveBeenCalledOnce();
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.functionName).toBe("approve");
    expect(hash).toBe("0xapprove_tx");
  });

  it("uses default amount of 1 ether when not specified", async () => {
    await client.approveToken();
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.args[1]).toBe(parseEther("1"));
  });

  it("uses custom amount when provided", async () => {
    const customAmount = parseEther("5");
    await client.approveToken(customAmount);
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.args[1]).toBe(customAmount);
  });

  it("uses the first wallet address as account", async () => {
    await client.approveToken();
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.account).toBe("0xuser000000000000000000000000000000000000");
  });
});

describe("InkdClient — tokenBalance()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
    mockReadContract.mockResolvedValue(1000n);
  });

  it("returns balance from readContract", async () => {
    const bal = await client.tokenBalance();
    expect(bal).toBe(1000n);
    expect(mockReadContract).toHaveBeenCalledOnce();
    const call = mockReadContract.mock.calls[0][0];
    expect(call.functionName).toBe("balanceOf");
  });

  it("uses caller address when no address specified", async () => {
    await client.tokenBalance();
    const call = mockReadContract.mock.calls[0][0];
    expect(call.args[0]).toBe("0xuser000000000000000000000000000000000000");
  });

  it("uses provided address instead of caller", async () => {
    const customAddr = "0xother00000000000000000000000000000000000" as Address;
    await client.tokenBalance(customAddr);
    const call = mockReadContract.mock.calls[0][0];
    expect(call.args[0]).toBe(customAddr);
  });
});

// ─── Projects ─────────────────────────────────────────────────────────────────

describe("InkdClient — createProject()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
    wallet.writeContract.mockResolvedValue("0xcreate_tx");
  });

  it("calls createProject with required fields", async () => {
    const hash = await client.createProject({ name: "MyProj", description: "A project" });
    expect(wallet.writeContract).toHaveBeenCalledOnce();
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.functionName).toBe("createProject");
    expect(hash).toBe("0xcreate_tx");
  });

  it("uses defaults for optional fields", async () => {
    await client.createProject({ name: "X", description: "Y" });
    const call = wallet.writeContract.mock.calls[0][0];
    const args = call.args;
    expect(args[0]).toBe("X");          // name
    expect(args[1]).toBe("Y");          // description
    expect(args[2]).toBe("MIT");        // license default
    expect(args[3]).toBe("");           // readmeHash default
    expect(args[4]).toBe("");           // agentEndpoint default
    expect(args[5]).toBe(false);        // isAgent default
    expect(args[6]).toBe(true);         // isPublic default
  });

  it("passes custom optional fields", async () => {
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
    expect(args[2]).toBe("Apache-2.0");
    expect(args[3]).toBe("arweave-hash-abc");
    expect(args[4]).toBe("https://agent.example.com");
    expect(args[5]).toBe(true);
    expect(args[6]).toBe(false);
  });

  it("includes account from wallet", async () => {
    await client.createProject({ name: "P", description: "D" });
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.account).toBe("0xuser000000000000000000000000000000000000");
  });
});

// ─── pushVersion ─────────────────────────────────────────────────────────────

describe("InkdClient — pushVersion()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
    wallet.writeContract.mockResolvedValue("0xpush_tx");
    mockReadContract.mockResolvedValue(500n); // versionFee
  });

  it("fetches version fee then calls pushVersion", async () => {
    const hash = await client.pushVersion(1n, {
      arweaveHash: "ar-hash-xyz",
      versionTag: "v0.9.1",
    });
    // first readContract call is getVersionFee
    expect(mockReadContract).toHaveBeenCalledOnce();
    const feeCall = mockReadContract.mock.calls[0][0];
    expect(feeCall.functionName).toBe("versionFee");

    expect(wallet.writeContract).toHaveBeenCalledOnce();
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.functionName).toBe("pushVersion");
    expect(call.value).toBe(500n);
    expect(hash).toBe("0xpush_tx");
  });

  it("passes correct args to pushVersion", async () => {
    await client.pushVersion(42n, {
      arweaveHash: "ar-hash-42",
      versionTag: "v0.9.2",
      changelog: "Fixed a bug",
    });
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.args[0]).toBe(42n);
    expect(call.args[1]).toBe("ar-hash-42");
    expect(call.args[2]).toBe("v0.9.2");
    expect(call.args[3]).toBe("Fixed a bug");
  });

  it("defaults changelog to empty string when omitted", async () => {
    await client.pushVersion(1n, { arweaveHash: "h", versionTag: "v1" });
    const call = wallet.writeContract.mock.calls[0][0];
    expect(call.args[3]).toBe("");
  });
});

// ─── getProject ──────────────────────────────────────────────────────────────

describe("InkdClient — getProject()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;
  const fakeProject = {
    id: 1n, name: "Test", description: "Desc", license: "MIT",
    readmeHash: "", agentEndpoint: "", owner: "0xowner",
    isAgent: false, isPublic: true, createdAt: 0n, versionCount: 0n, exists: true,
  };

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    mockReadContract.mockResolvedValue(fakeProject);
  });

  it("calls getProject and returns result", async () => {
    const result = await client.getProject(1n);
    expect(mockReadContract).toHaveBeenCalledOnce();
    const call = mockReadContract.mock.calls[0][0];
    expect(call.functionName).toBe("getProject");
    expect(call.args[0]).toBe(1n);
    expect(result).toEqual(fakeProject);
  });
});

// ─── getVersions ─────────────────────────────────────────────────────────────

describe("InkdClient — getVersions()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;
  const fakeVersions = [
    { projectId: 1n, arweaveHash: "ar-abc", versionTag: "v0.1.0", changelog: "", pushedBy: "0xa", pushedAt: 1000n },
  ];

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    mockReadContract.mockResolvedValue(fakeVersions);
  });

  it("calls getVersions with projectId and returns array", async () => {
    const result = await client.getVersions(1n);
    expect(mockReadContract).toHaveBeenCalledOnce();
    const call = mockReadContract.mock.calls[0][0];
    expect(call.functionName).toBe("getVersions");
    expect(call.args[0]).toBe(1n);
    expect(result).toEqual(fakeVersions);
  });
});

// ─── getVersionFee ────────────────────────────────────────────────────────────

describe("InkdClient — getVersionFee()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    mockReadContract.mockResolvedValue(250n);
  });

  it("reads versionFee from contract", async () => {
    const fee = await client.getVersionFee();
    expect(fee).toBe(250n);
    const call = mockReadContract.mock.calls[0][0];
    expect(call.functionName).toBe("versionFee");
  });
});

// ─── transferProject ─────────────────────────────────────────────────────────

describe("InkdClient — transferProject()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    wallet.getAddresses.mockResolvedValue(["0xuser000000000000000000000000000000000000"]);
    wallet.writeContract.mockResolvedValue("0xtransfer_tx");
    mockReadContract.mockResolvedValue(1000n); // transferFee
  });

  it("reads transferFee then calls transferProject", async () => {
    const newOwner = "0xnewowner000000000000000000000000000000000" as Address;
    const hash = await client.transferProject(7n, newOwner);

    expect(mockReadContract).toHaveBeenCalledOnce();
    const feeCall = mockReadContract.mock.calls[0][0];
    expect(feeCall.functionName).toBe("transferFee");

    expect(wallet.writeContract).toHaveBeenCalledOnce();
    const txCall = wallet.writeContract.mock.calls[0][0];
    expect(txCall.functionName).toBe("transferProject");
    expect(txCall.args[0]).toBe(7n);
    expect(txCall.args[1]).toBe(newOwner);
    expect(txCall.value).toBe(1000n);
    expect(hash).toBe("0xtransfer_tx");
  });
});

// ─── getAgentProjects ─────────────────────────────────────────────────────────

describe("InkdClient — getAgentProjects()", () => {
  let client: InkdClient;
  let wallet: ReturnType<typeof makeMockWallet>;

  beforeEach(() => {
    wallet = makeMockWallet();
    client = new InkdClient({ walletClient: wallet as any });
    vi.clearAllMocks();
    mockReadContract.mockResolvedValue([1n, 2n, 3n]);
  });

  it("calls getAgentProjects with default offsets", async () => {
    const result = await client.getAgentProjects();
    expect(mockReadContract).toHaveBeenCalledOnce();
    const call = mockReadContract.mock.calls[0][0];
    expect(call.functionName).toBe("getAgentProjects");
    expect(call.args[0]).toBe(0n);
    expect(call.args[1]).toBe(100n);
    expect(result).toEqual([1n, 2n, 3n]);
  });

  it("accepts custom offset and limit", async () => {
    await client.getAgentProjects(10n, 25n);
    const call = mockReadContract.mock.calls[0][0];
    expect(call.args[0]).toBe(10n);
    expect(call.args[1]).toBe(25n);
  });

  it("returns empty array when no agent projects", async () => {
    mockReadContract.mockResolvedValue([]);
    const result = await client.getAgentProjects();
    expect(result).toEqual([]);
  });
});

// ─── Re-exports smoke test ────────────────────────────────────────────────────

describe("index.ts — re-exports", () => {
  it("exports watchProjectCreated from events", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.watchProjectCreated).toBe("function");
  });

  it("exports watchVersionPushed from events", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.watchVersionPushed).toBe("function");
  });

  it("exports watchRegistryEvents from events", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.watchRegistryEvents).toBe("function");
  });

  it("exports batchGetProjects from multicall", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.batchGetProjects).toBe("function");
  });

  it("exports batchGetVersions from multicall", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.batchGetVersions).toBe("function");
  });

  it("exports batchGetFees from multicall", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.batchGetFees).toBe("function");
  });

  it("exports batchGetProjectsWithVersions from multicall", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.batchGetProjectsWithVersions).toBe("function");
  });
});
