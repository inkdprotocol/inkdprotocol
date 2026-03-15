/**
 * @file agent.test.ts
 * Unit tests for `inkd agent` subcommands.
 * All on-chain reads are mocked via vitest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111" as const;
const MOCK_OWNER    = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

function makeProject(overrides: Partial<Record<string, unknown>> = {}) {
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

vi.mock("../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config.js")>();
  return {
    ...actual,
    loadConfig: vi.fn(() => ({
      network: "testnet",
      privateKey:
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
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
    error: vi.fn((msg: string) => { throw new Error(msg); }),
    info:  vi.fn(),
    warn:  vi.fn(),
    BOLD:  "",
    RESET: "",
    CYAN:  "",
    DIM:   "",
    GREEN: "",
    YELLOW: "",
  };
});

let mockReadContract: Mock;

vi.mock("../client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client.js")>();
  return {
    ...actual,
    buildPublicClient: vi.fn(() => ({
      readContract: (...args: unknown[]) => mockReadContract(...args),
    })),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockReadContract = vi.fn();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── cmdAgentList ─────────────────────────────────────────────────────────────

describe("cmdAgentList", () => {
  it("prints agent directory when projects exist", async () => {
    const projects = [
      makeProject({ id: 1n, name: "gork-agent", description: "AI helper" }),
      makeProject({ id: 2n, name: "inkd-bot",   description: "",           agentEndpoint: "" }),
    ];
    mockReadContract.mockResolvedValueOnce(projects);

    const { cmdAgentList } = await import("../commands/agent.js");
    await cmdAgentList([]);

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getAgentProjects", args: [0n, 25n] })
    );
    expect(console.log).toHaveBeenCalled();
  });

  it("uses --offset and --limit flags", async () => {
    mockReadContract.mockResolvedValueOnce([makeProject()]);

    const { cmdAgentList } = await import("../commands/agent.js");
    await cmdAgentList(["--offset", "10", "--limit", "5"]);

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [10n, 5n] })
    );
  });

  it("prints 'No agent projects found' when list is empty", async () => {
    mockReadContract.mockResolvedValueOnce([]);

    const { cmdAgentList } = await import("../commands/agent.js");
    await cmdAgentList([]);

    const { info } = await import("../config.js");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("No agent projects"));
  });

  it("shows pagination hint when results equal limit", async () => {
    // Exactly 3 results with limit 3 → show next-page hint
    const projects = [1n, 2n, 3n].map((id) => makeProject({ id, name: `agent-${id}` }));
    mockReadContract.mockResolvedValueOnce(projects);

    const { cmdAgentList } = await import("../commands/agent.js");
    await cmdAgentList(["--limit", "3"]);

    const { info } = await import("../config.js");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Showing 3 results"));
  });

  it("prints agent endpoint when set", async () => {
    const project = makeProject({ agentEndpoint: "https://my-agent.xyz/v1" });
    mockReadContract.mockResolvedValueOnce([project]);

    const { cmdAgentList } = await import("../commands/agent.js");
    await cmdAgentList([]);

    // console.log should have been called with endpoint line
    const calls = (console.log as Mock).mock.calls.flat().join(" ");
    expect(calls).toContain("https://my-agent.xyz/v1");
  });

  it("prints private badge for non-public project", async () => {
    const project = makeProject({ isPublic: false });
    mockReadContract.mockResolvedValueOnce([project]);

    // Should not throw; private projects use a different badge
    const { cmdAgentList } = await import("../commands/agent.js");
    await expect(cmdAgentList([])).resolves.toBeUndefined();
  });

  it("handles registry not deployed (no address)", async () => {
    const { ADDRESSES } = await import("../config.js");
    const origAddresses = (ADDRESSES as Record<string, Record<string, string>>).testnet.registry;

    // Temporarily clear the registry address
    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = "";

    const { cmdAgentList } = await import("../commands/agent.js");
    await cmdAgentList([]);

    const { info } = await import("../config.js");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("not deployed yet"));

    // Restore
    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = origAddresses;
  });
});

// ─── cmdAgentLookup ───────────────────────────────────────────────────────────

describe("cmdAgentLookup", () => {
  it("finds agent by exact name (case-insensitive)", async () => {
    // projectCount = 2, then getProject for each
    mockReadContract
      .mockResolvedValueOnce(2n)             // projectCount
      .mockResolvedValueOnce(makeProject({ id: 1n, name: "gork-agent" }))
      .mockResolvedValueOnce(makeProject({ id: 2n, name: "inkd-bot" }));

    const { cmdAgentLookup } = await import("../commands/agent.js");
    await cmdAgentLookup(["Gork-Agent"]); // uppercase → should still match

    expect(console.log).toHaveBeenCalled();
  });

  it("calls process.exit(1) when name not found", async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(makeProject({ name: "other-bot" }));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code?: number) => {
      throw new Error("process.exit");
    });

    const { cmdAgentLookup } = await import("../commands/agent.js");
    await expect(cmdAgentLookup(["nonexistent"])).rejects.toThrow();

    exitSpy.mockRestore();
  });

  it("calls error() when no name argument provided", async () => {
    const { cmdAgentLookup } = await import("../commands/agent.js");
    await expect(cmdAgentLookup([])).rejects.toThrow("Usage:");
  });

  it("shows agent endpoint and readme in detail view", async () => {
    const project = makeProject({
      name: "detail-agent",
      agentEndpoint: "https://endpoint.xyz",
      readmeHash: "abc123",
      description: "detailed agent",
    });

    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(project);

    const { cmdAgentLookup } = await import("../commands/agent.js");
    await cmdAgentLookup(["detail-agent"]);

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("https://endpoint.xyz");
    expect(infoCalls).toContain("abc123");
    expect(infoCalls).toContain("detailed agent");
  });

  it("returns early with info when registry not deployed", async () => {
    const { ADDRESSES } = await import("../config.js");
    const orig = (ADDRESSES as Record<string, Record<string, string>>).testnet.registry;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = "";

    const { cmdAgentLookup } = await import("../commands/agent.js");
    await cmdAgentLookup(["any"]);

    const { info } = await import("../config.js");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("not deployed yet"));

    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = orig;
  });

  it("skips non-matching projects and finds target", async () => {
    mockReadContract
      .mockResolvedValueOnce(3n)
      .mockResolvedValueOnce(makeProject({ id: 1n, name: "alpha" }))
      .mockResolvedValueOnce(makeProject({ id: 2n, name: "beta" }))
      .mockResolvedValueOnce(makeProject({ id: 3n, name: "target-agent" }));

    const { cmdAgentLookup } = await import("../commands/agent.js");
    await cmdAgentLookup(["target-agent"]);

    // Should have read all 3 projects
    expect(mockReadContract).toHaveBeenCalledTimes(4); // 1 count + 3 getProject
  });
});

// ─── Branch-coverage gap-fills ────────────────────────────────────────────────

describe("cmdAgentList — description truncation (branch coverage)", () => {
  it("truncates description longer than 70 chars with ellipsis", async () => {
    const longDesc = "A".repeat(80); // 80 > 70
    const project = {
      id: 1n, name: "verbose-agent", description: longDesc,
      owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      agentEndpoint: "", license: "MIT", readmeHash: "",
      isPublic: true, isAgent: true, createdAt: 1000n,
      versionCount: 1n, exists: true,
    };
    mockReadContract.mockResolvedValueOnce([project]);

    const consoleLog = vi.spyOn(console, "log");
    const { cmdAgentList } = await import("../commands/agent.js");
    await cmdAgentList([]);

    const logged = consoleLog.mock.calls.flat().join(" ");
    expect(logged).toContain("…"); // truncation ellipsis present
  });
});

describe("cmdAgentLookup — no endpoint / no description (branch coverage)", () => {
  it("shows 'none' when agentEndpoint is empty and skips description when absent", async () => {
    const project = {
      id: 1n, name: "bare-agent", description: "",
      owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      agentEndpoint: "", license: "MIT", readmeHash: "",
      isPublic: true, isAgent: true, createdAt: 1000n,
      versionCount: 2n, exists: true,
    };
    mockReadContract
      .mockResolvedValueOnce(1n)       // projectCount
      .mockResolvedValueOnce(project); // getProject(1)

    const { info } = await import("../config.js");
    // Clear accumulated calls from previous tests before asserting
    (info as Mock).mockClear();

    const { cmdAgentLookup } = await import("../commands/agent.js");
    await cmdAgentLookup(["bare-agent"]);

    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("none"); // false branch of agentEndpoint || 'none'
    // description branch (false): info should NOT contain "Desc:" line in THIS call
    expect(infoCalls).not.toContain("Desc:");
  });
});
