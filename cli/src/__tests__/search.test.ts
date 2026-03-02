/**
 * @file search.test.ts
 * Unit tests for `inkd search` command.
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

// ─── cmdSearch ────────────────────────────────────────────────────────────────

describe("cmdSearch", () => {
  it("errors when no query provided", async () => {
    const { cmdSearch } = await import("../commands/search.js");
    await expect(cmdSearch([])).rejects.toThrow("Usage:");
  });

  it("prints 'no projects' when count is 0", async () => {
    mockReadContract.mockResolvedValueOnce(0n); // projectCount

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["anything"]);

    const { info } = await import("../config.js");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("No projects registered"));
  });

  it("finds projects by name match", async () => {
    mockReadContract
      .mockResolvedValueOnce(2n) // projectCount
      .mockResolvedValueOnce(makeProject({ id: 1n, name: "smart-contract", description: "a smart toolkit" }))
      // Second project: name and description both don't match "smart"
      .mockResolvedValueOnce(makeProject({ id: 2n, name: "totally-unrelated", description: "an nft gallery app" }));

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["smart"]);

    const calls = (console.log as Mock).mock.calls.flat().join(" ");
    // "smart-contract" appears (possibly with ANSI highlight around "smart")
    expect(calls).toContain("-contract");
    // "totally-unrelated" must not appear at all
    expect(calls).not.toContain("totally-unrelated");
  });

  it("finds projects by description match", async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(makeProject({ name: "no-match", description: "great defi protocol" }));

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["defi"]);

    expect(console.log).toHaveBeenCalled();
  });

  it("filters to agents only with --agents flag", async () => {
    mockReadContract
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce(makeProject({ id: 1n, name: "non-agent", isAgent: false, description: "regular project" }))
      .mockResolvedValueOnce(makeProject({ id: 2n, name: "agent-project", isAgent: true, description: "an agent" }));

    const { cmdSearch } = await import("../commands/search.js");
    // Use "agent" as query so only the agent project matches (non-agent has no "agent" in name/desc)
    await cmdSearch(["agent", "--agents"]);

    const calls = (console.log as Mock).mock.calls.flat().join(" ");
    // "[agent]" badge appears only for agent projects
    expect(calls).toContain("[agent]");
    // non-agent should not appear at all
    expect(calls).not.toContain("non-agent");
  });

  it("outputs JSON when --json flag is set", async () => {
    const project = makeProject({ name: "json-test", description: "matches" });
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(project);

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["matches", "--json"]);

    const calls = (console.log as Mock).mock.calls.flat().join("\n");
    // Should be valid JSON containing results array
    const parsed = JSON.parse(calls);
    expect(parsed).toHaveProperty("results");
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].name).toBe("json-test");
  });

  it("outputs empty JSON array when no results match", async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(makeProject({ name: "other", description: "other" }));

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["zzznomatch", "--json"]);

    const calls = (console.log as Mock).mock.calls.flat().join("\n");
    const parsed = JSON.parse(calls);
    expect(parsed.results).toHaveLength(0);
    expect(parsed.query).toBe("zzznomatch");
  });

  it("prints no-results message in text mode", async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(makeProject({ name: "other", description: "other" }));

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["zzznomatch"]);

    const { info } = await import("../config.js");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("No results"));
  });

  it("shows tip to remove --agents flag when no results in agents-only mode", async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(makeProject({ name: "no-match", isAgent: false }));

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["zzznomatch", "--agents"]);

    const { warn } = await import("../config.js");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("--agents"));
  });

  it("respects --limit flag", async () => {
    // 5 matching projects but limit 2
    const projects = [1n, 2n, 3n, 4n, 5n].map((id) =>
      makeProject({ id, name: `match-project-${id}` })
    );
    mockReadContract
      .mockResolvedValueOnce(5n)
      .mockResolvedValue(projects[0])  // all batch reads return same project (all match)

    // Override to actually return different projects
    mockReadContract
      .mockResolvedValueOnce(5n)
      .mockResolvedValueOnce(projects[0])
      .mockResolvedValueOnce(projects[1])
      .mockResolvedValueOnce(projects[2])
      .mockResolvedValueOnce(projects[3])
      .mockResolvedValueOnce(projects[4]);

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["match", "--limit", "2"]);

    // Should find 2 results and show "Use --limit <n>" hint
    const calls = (console.log as Mock).mock.calls.flat().join(" ");
    expect(calls).toContain("--limit");
  });

  it("skips non-existent projects", async () => {
    mockReadContract
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce(makeProject({ exists: false })) // filtered out
      .mockResolvedValueOnce(makeProject({ id: 2n, name: "real-project", exists: true }));

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["real", "--json"]);

    const calls = (console.log as Mock).mock.calls.flat().join("\n");
    const parsed = JSON.parse(calls);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].name).toBe("real-project");
  });

  it("includes agentEndpoint in JSON output for agent projects", async () => {
    const project = makeProject({
      name: "my-agent",
      isAgent: true,
      agentEndpoint: "https://agent.example.io",
    });
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(project);

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["my-agent", "--json"]);

    const calls = (console.log as Mock).mock.calls.flat().join("\n");
    const parsed = JSON.parse(calls);
    expect(parsed.results[0].agentEndpoint).toBe("https://agent.example.io");
    expect(parsed.results[0].isAgent).toBe(true);
  });

  it("omits agentEndpoint from JSON when not set", async () => {
    const project = makeProject({ name: "no-endpoint", agentEndpoint: "" });
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(project);

    const { cmdSearch } = await import("../commands/search.js");
    await cmdSearch(["no-endpoint", "--json"]);

    const calls = (console.log as Mock).mock.calls.flat().join("\n");
    const parsed = JSON.parse(calls);
    expect(parsed.results[0].agentEndpoint).toBeUndefined();
  });

  it("errors when registry address is not configured", async () => {
    const { ADDRESSES } = await import("../config.js");
    const orig = (ADDRESSES as Record<string, Record<string, string>>).testnet.registry;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = "";

    const { cmdSearch } = await import("../commands/search.js");
    await expect(cmdSearch(["anything"])).rejects.toThrow("Registry address not configured");

    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = orig;
  });
});
