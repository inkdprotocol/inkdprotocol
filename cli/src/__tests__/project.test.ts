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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";
import { parseEther } from "viem";

// ─── @inkd/sdk mock (hoisted so vi.mock can reference it) ─────────────────────
const hoisted = vi.hoisted(() => ({
  mockCreateProject: vi.fn().mockResolvedValue({
    projectId: 1n,
    owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    txHash: "0xdeadbeefdeadbeefdeadbeef" as `0x${string}`,
  }),
}))

vi.mock("@inkd/sdk", () => ({
  ProjectsClient: vi.fn(function () {
    return { createProject: hoisted.mockCreateProject }
  }),
}))

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_TX_HASH = "0xdeadbeefdeadbeefdeadbeef" as `0x${string}`;
const MOCK_OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const MOCK_TO = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111" as const;
const MOCK_TOKEN = "0x2222222222222222222222222222222222222222" as const;

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock config so we always get a deterministic testnet config
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
let mockReadContract: Mock;
let mockWriteContract: Mock;
let mockWaitForReceipt: Mock;

vi.mock("../client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client.js")>();
  return {
    ...actual,
    buildPublicClient: vi.fn(() => ({
      readContract: (...args: unknown[]) => mockReadContract(...args),
      waitForTransactionReceipt: (...args: unknown[]) =>
        mockWaitForReceipt(...args),
      getBalance: vi.fn().mockResolvedValue(parseEther("1")),
    })),
    buildClients: vi.fn(() => ({
      publicClient: {
        readContract: (...args: unknown[]) => mockReadContract(...args),
        waitForTransactionReceipt: (...args: unknown[]) =>
          mockWaitForReceipt(...args),
      },
      walletClient: {
        writeContract: (...args: unknown[]) => mockWriteContract(...args),
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

describe("cmdProjectGet", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      });

    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(makeProject()) // getProject
      .mockResolvedValueOnce([MOCK_TO]); // getCollaborators
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and displays project details by positional id", async () => {
    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["1"]);

    expect(mockReadContract).toHaveBeenCalledTimes(2);
    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/test-agent/);
    expect(logged).toMatch(/MIT/);
  });

  it("fetches by --id flag", async () => {
    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["--id", "1"]);

    expect(mockReadContract).toHaveBeenCalledTimes(2);
  });

  it("shows agent badge for agent projects", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(makeProject({ isAgent: true, agentEndpoint: "https://agent.example.com" }))
      .mockResolvedValueOnce([]);

    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/agent/i);
  });

  it("calls process.exit when project does not exist", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(makeProject({ exists: false }))
      .mockResolvedValueOnce([]);

    const { cmdProjectGet } = await import("../commands/project.js");
    await expect(cmdProjectGet(["99"])).rejects.toThrow("process.exit");
  });

  it("displays collaborators when present", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(makeProject())
      .mockResolvedValueOnce([MOCK_TO, MOCK_OWNER]);

    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(new RegExp(MOCK_TO, "i"));
  });
});

// ─── cmdProjectList ───────────────────────────────────────────────────────────

describe("cmdProjectList", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits when address is missing", async () => {
    const { cmdProjectList } = await import("../commands/project.js");
    await expect(cmdProjectList([])).rejects.toThrow("process.exit");
  });

  it("exits when address is invalid", async () => {
    const { cmdProjectList } = await import("../commands/project.js");
    await expect(cmdProjectList(["not-an-address"])).rejects.toThrow(
      "process.exit"
    );
  });

  it("prints 'no projects' when owner has none", async () => {
    mockReadContract = vi.fn().mockResolvedValue([]);
    const { cmdProjectList } = await import("../commands/project.js");
    await cmdProjectList([MOCK_OWNER]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/No projects/i);
  });

  it("lists projects for a valid address", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce([1n, 2n]) // getOwnerProjects
      .mockResolvedValue(makeProject()); // getProject calls

    const { cmdProjectList } = await import("../commands/project.js");
    await cmdProjectList([MOCK_OWNER]);

    expect(mockReadContract).toHaveBeenCalledTimes(3); // 1 owner call + 2 project calls
    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/test-agent/);
  });
});

// ─── cmdProjectCreate ─────────────────────────────────────────────────────────

describe("cmdProjectCreate", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((_code?: number | string | null | undefined) => {
      throw new Error("process.exit");
    });
    hoisted.mockCreateProject.mockResolvedValue({
      projectId: 1n,
      owner: MOCK_OWNER,
      txHash: MOCK_TX_HASH,
    })
  });

  afterEach(() => {
    vi.restoreAllMocks();
    hoisted.mockCreateProject.mockClear();
  });

  it("exits when --name is missing", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await expect(cmdProjectCreate([])).rejects.toThrow("process.exit");
  });

  it("calls createProject with correct args", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate([
      "--name", "my-agent",
      "--description", "Cool agent",
      "--license", "Apache-2.0",
    ]);

    expect(hoisted.mockCreateProject).toHaveBeenCalledTimes(1);
    const call = hoisted.mockCreateProject.mock.calls[0][0];
    expect(call.name).toBe("my-agent");
    expect(call.description).toBe("Cool agent");
    expect(call.license).toBe("Apache-2.0");
  });

  it("marks project as private when --private flag is set", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "secret-agent", "--private"]);
    const call = hoisted.mockCreateProject.mock.calls[0][0];
    expect(call.isPublic).toBe(false);
  });

  it("marks project as agent when --agent flag is set", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "autonomous", "--agent"]);
    const call = hoisted.mockCreateProject.mock.calls[0][0];
    expect(call.isAgent).toBe(true);
  });

  it("sets agentEndpoint when --endpoint is provided", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "bot", "--agent", "--endpoint", "https://bot.example.com"]);
    const call = hoisted.mockCreateProject.mock.calls[0][0];
    expect(call.agentEndpoint).toBe("https://bot.example.com");
  });

  it("prints success with project name", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "ok-agent"]);
    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/ok-agent/);
  });

  it("calls process.exit when createProject throws", async () => {
    hoisted.mockCreateProject.mockRejectedValueOnce(new Error("payment failed"));
    const { cmdProjectCreate } = await import("../commands/project.js");
    await expect(cmdProjectCreate(["--name", "fail-agent"])).rejects.toThrow("process.exit");
  });
});



// ─── Registry-not-configured error paths ─────────────────────────────────────

describe("registry not configured error paths (mainnet)", () => {
  function setupMocks() {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      }
    );
  }

  function mockMainnet() {
    return {
      network: "mainnet" as const,
      privateKey:
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`,
      rpcUrl: undefined,
    };
  }

  beforeEach(() => {
    setupMocks();
    mockReadContract = vi.fn();
    mockWriteContract = vi.fn();
    mockWaitForReceipt = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cmdProjectCreate exits when createProject fails", async () => {
    hoisted.mockCreateProject.mockRejectedValueOnce(new Error("402 payment required"));
    const { cmdProjectCreate } = await import("../commands/project.js");
    await expect(
      cmdProjectCreate(["--name", "fail-project"])
    ).rejects.toThrow("process.exit");
  });

  it("cmdProjectGet exits when registry not configured", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());

    const { cmdProjectGet } = await import("../commands/project.js");
    await expect(cmdProjectGet(["1"])).rejects.toThrow("process.exit");
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("cmdProjectList exits when registry not configured", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());

    const { cmdProjectList } = await import("../commands/project.js");
    await expect(cmdProjectList([MOCK_OWNER])).rejects.toThrow("process.exit");
    expect(mockReadContract).not.toHaveBeenCalled();
  });


});

// ─── cmdProjectList — badge coverage ─────────────────────────────────────────

describe("cmdProjectList — badge display", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 'agent' badge for agent projects in list", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce([1n]) // getOwnerProjects
      .mockResolvedValueOnce(makeProject({ isAgent: true, isPublic: true }));

    const { cmdProjectList } = await import("../commands/project.js");
    await cmdProjectList([MOCK_OWNER]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/agent/i);
  });

  it("shows 'private' badge for private projects in list", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce([1n]) // getOwnerProjects
      .mockResolvedValueOnce(makeProject({ isAgent: false, isPublic: false }));

    const { cmdProjectList } = await import("../commands/project.js");
    await cmdProjectList([MOCK_OWNER]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/private/i);
  });

  it("shows both 'agent' and 'private' badges when applicable", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce([1n])
      .mockResolvedValueOnce(makeProject({ isAgent: true, isPublic: false }));

    const { cmdProjectList } = await import("../commands/project.js");
    await cmdProjectList([MOCK_OWNER]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/agent/i);
    expect(logged).toMatch(/private/i);
  });
});

// ─── cmdProjectGet — optional field display ───────────────────────────────────

describe("cmdProjectGet — optional fields", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows README hash when project has one", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(makeProject({ readmeHash: "ar://readmehash123" }))
      .mockResolvedValueOnce([]);

    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/ar:\/\/readmehash123/);
    expect(logged).toMatch(/README hash/i);
  });

  it("shows agent endpoint when project has one", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(
        makeProject({ isAgent: true, agentEndpoint: "https://my-agent.xyz/rpc" })
      )
      .mockResolvedValueOnce([]);

    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/https:\/\/my-agent\.xyz\/rpc/);
    expect(logged).toMatch(/Agent endpoint/i);
  });
});

// ─── Branch-coverage gap: cmdProjectGet description/visibility (project.ts:130-135) ──

describe("cmdProjectGet — description and visibility branches", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      }
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 'none' placeholder when project description is empty (|| right branch)", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(makeProject({ description: "" }))
      .mockResolvedValueOnce([]); // collaborators

    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/none/i);
  });

  it("shows 'private' when project is not public (isPublic ternary false branch)", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(makeProject({ isPublic: false }))
      .mockResolvedValueOnce([]); // collaborators

    const { cmdProjectGet } = await import("../commands/project.js");
    await cmdProjectGet(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/private/i);
  });
});

// ─── Branch-coverage gap-fill ─────────────────────────────────────────────────

describe("cmdProjectGet — missing id branch (branch coverage)", () => {
  it("exits when no positional arg and no --id flag provided", async () => {
    // args[0] is undefined → ?? triggers requireFlag → missing flag → error() → throws
    const { cmdProjectGet } = await import("../commands/project.js");
    await expect(cmdProjectGet([])).rejects.toThrow();
  });
});
