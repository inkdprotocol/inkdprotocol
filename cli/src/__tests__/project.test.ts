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
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      });

    // Default: allowance is sufficient, tx succeeds
    mockReadContract = vi
      .fn()
      .mockResolvedValue(parseEther("10")); // allowance >= 1 INKD
    mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);
    mockWaitForReceipt = vi
      .fn()
      .mockResolvedValue({ status: "success", blockNumber: 12345n });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits when --name is missing", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await expect(cmdProjectCreate([])).rejects.toThrow("process.exit");
  });

  it("calls createProject on registry with correct args", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate([
      "--name",
      "my-agent",
      "--description",
      "Cool agent",
      "--license",
      "Apache-2.0",
    ]);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][0];
    expect(call.functionName).toBe("createProject");
    expect(call.args[0]).toBe("my-agent");
    expect(call.args[1]).toBe("Cool agent");
    expect(call.args[2]).toBe("Apache-2.0");
  });

  it("approves token spending when allowance is insufficient", async () => {
    mockReadContract = vi.fn().mockResolvedValue(0n); // allowance = 0
    mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);
    mockWaitForReceipt = vi
      .fn()
      .mockResolvedValue({ status: "success", blockNumber: 12345n });

    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "my-agent"]);

    // First writeContract = approve, second = createProject
    expect(mockWriteContract).toHaveBeenCalledTimes(2);
    expect(mockWriteContract.mock.calls[0][0].functionName).toBe("approve");
    expect(mockWriteContract.mock.calls[1][0].functionName).toBe("createProject");
  });

  it("marks project as private when --private flag is set", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "secret-agent", "--private"]);

    const call = mockWriteContract.mock.calls[0][0];
    // isPublic is args[3]
    expect(call.args[3]).toBe(false);
  });

  it("marks project as agent when --agent flag is set", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "autonomous", "--agent"]);

    const call = mockWriteContract.mock.calls[0][0];
    // isAgent is args[5]
    expect(call.args[5]).toBe(true);
  });

  it("sets agentEndpoint when --endpoint is provided", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate([
      "--name",
      "bot",
      "--agent",
      "--endpoint",
      "https://bot.example.com",
    ]);

    const call = mockWriteContract.mock.calls[0][0];
    // agentEndpoint is args[6]
    expect(call.args[6]).toBe("https://bot.example.com");
  });

  it("prints success when transaction succeeds", async () => {
    const { cmdProjectCreate } = await import("../commands/project.js");
    await cmdProjectCreate(["--name", "ok-agent"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/ok-agent/);
  });

  it("calls process.exit when transaction reverts", async () => {
    mockWaitForReceipt = vi
      .fn()
      .mockResolvedValue({ status: "reverted", blockNumber: 12345n });

    const { cmdProjectCreate } = await import("../commands/project.js");
    await expect(
      cmdProjectCreate(["--name", "fail-agent"])
    ).rejects.toThrow("process.exit");
  });
});

// ─── cmdProjectTransfer ───────────────────────────────────────────────────────

describe("cmdProjectTransfer", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      });

    mockReadContract = vi.fn().mockResolvedValue(parseEther("0.001")); // transferFee
    mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);
    mockWaitForReceipt = vi.fn().mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits when --id is missing", async () => {
    const { cmdProjectTransfer } = await import("../commands/project.js");
    await expect(
      cmdProjectTransfer(["--to", MOCK_TO])
    ).rejects.toThrow("process.exit");
  });

  it("exits when --to is missing", async () => {
    const { cmdProjectTransfer } = await import("../commands/project.js");
    await expect(
      cmdProjectTransfer(["--id", "1"])
    ).rejects.toThrow("process.exit");
  });

  it("exits when --to is not a valid address", async () => {
    const { cmdProjectTransfer } = await import("../commands/project.js");
    await expect(
      cmdProjectTransfer(["--id", "1", "--to", "not-an-address"])
    ).rejects.toThrow("process.exit");
  });

  it("calls transferProject with correct args including fee", async () => {
    const { cmdProjectTransfer } = await import("../commands/project.js");
    await cmdProjectTransfer(["--id", "42", "--to", MOCK_TO]);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][0];
    expect(call.functionName).toBe("transferProject");
    expect(call.args[0]).toBe(42n);
    expect(call.args[1].toLowerCase()).toBe(MOCK_TO.toLowerCase());
    expect(call.value).toBe(parseEther("0.001"));
  });
});

// ─── cmdProjectCollab ─────────────────────────────────────────────────────────

describe("cmdProjectCollab", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit");
      });

    mockWriteContract = vi.fn().mockResolvedValue(MOCK_TX_HASH);
    mockWaitForReceipt = vi.fn().mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits when action is neither add nor remove", async () => {
    const { cmdProjectCollab } = await import("../commands/project.js");
    await expect(cmdProjectCollab(["grant"])).rejects.toThrow("process.exit");
  });

  it("calls addCollaborator when action is 'add'", async () => {
    const { cmdProjectCollab } = await import("../commands/project.js");
    await cmdProjectCollab(["add", "--id", "5", "--address", MOCK_TO]);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][0];
    expect(call.functionName).toBe("addCollaborator");
    expect(call.args[0]).toBe(5n);
    expect(call.args[1].toLowerCase()).toBe(MOCK_TO.toLowerCase());
  });

  it("calls removeCollaborator when action is 'remove'", async () => {
    const { cmdProjectCollab } = await import("../commands/project.js");
    await cmdProjectCollab(["remove", "--id", "5", "--address", MOCK_TO]);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][0];
    expect(call.functionName).toBe("removeCollaborator");
  });

  it("exits when --id is missing", async () => {
    const { cmdProjectCollab } = await import("../commands/project.js");
    await expect(
      cmdProjectCollab(["add", "--address", MOCK_TO])
    ).rejects.toThrow("process.exit");
  });

  it("exits when --address is invalid", async () => {
    const { cmdProjectCollab } = await import("../commands/project.js");
    await expect(
      cmdProjectCollab(["add", "--id", "1", "--address", "bad"])
    ).rejects.toThrow("process.exit");
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

  it("cmdProjectCreate exits when registry not configured", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());

    const { cmdProjectCreate } = await import("../commands/project.js");
    await expect(
      cmdProjectCreate(["--name", "fail-project"])
    ).rejects.toThrow("process.exit");
    expect(mockWriteContract).not.toHaveBeenCalled();
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

  it("cmdProjectTransfer exits when registry not configured", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());

    const { cmdProjectTransfer } = await import("../commands/project.js");
    await expect(
      cmdProjectTransfer(["--id", "1", "--to", MOCK_TO])
    ).rejects.toThrow("process.exit");
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it("cmdProjectCollab exits when registry not configured", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce(mockMainnet());

    const { cmdProjectCollab } = await import("../commands/project.js");
    await expect(
      cmdProjectCollab(["add", "--id", "1", "--address", MOCK_TO])
    ).rejects.toThrow("process.exit");
    expect(mockWriteContract).not.toHaveBeenCalled();
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
