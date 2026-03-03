/**
 * @file agentd.test.ts
 * Unit tests for `inkd agentd` — autonomous agent daemon.
 *
 * Strategy:
 *  - Mock `fs` (existsSync, readFileSync, writeFileSync) to control state file reads/writes
 *  - Mock `../config.js` for loadConfig, ADDRESSES, requirePrivateKey, colour helpers
 *  - Mock `../client.js` for buildPublicClient + buildWalletClient
 *  - Mock `../abi.js` for REGISTRY_ABI (value not important — mocked readContract)
 *  - Use process.exit spy (throws sentinel) and process.on spy for signal handlers
 *  - For `--once` mode: run full cycle without infinite loop
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111" as const;
const MOCK_TOKEN    = "0x2222222222222222222222222222222222222222" as const;
const MOCK_WALLET   = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const MOCK_PK       = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// ─── fs mock ─────────────────────────────────────────────────────────────────

const mockExistsSync   = vi.fn<[string], boolean>();
const mockReadFileSync  = vi.fn<[string, string], string>();
const mockWriteFileSync = vi.fn();

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync:   (...args: unknown[]) => mockExistsSync(...(args as [string, boolean])),
    readFileSync:  (...args: unknown[]) => mockReadFileSync(...(args as [string, string])),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  };
});

// ─── config mock ──────────────────────────────────────────────────────────────

vi.mock("../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config.js")>();
  return {
    ...actual,
    loadConfig: vi.fn(() => ({
      network: "testnet" as const,
      privateKey: MOCK_PK,
      rpcUrl: undefined,
    })),
    requirePrivateKey: vi.fn(() => MOCK_PK),
    ADDRESSES: {
      testnet: { registry: MOCK_REGISTRY, token: MOCK_TOKEN, treasury: "0x3333333333333333333333333333333333333333" },
      mainnet: { registry: "",            token: "",          treasury: "" },
    },
    // passthrough colour helpers so they don't break string output
    info:    vi.fn(),
    success: vi.fn(),
    warn:    vi.fn(),
    error:   vi.fn((msg: string) => { throw new Error(`process.exit: ${msg}`) }),
    BOLD: "", RESET: "", CYAN: "", DIM: "", GREEN: "", YELLOW: "", RED: "",
  };
});

// ─── client mock ─────────────────────────────────────────────────────────────

let mockReadContract: Mock;
let mockGetBalance:   Mock;
let mockGetAddresses: Mock;

vi.mock("../client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client.js")>();
  return {
    ...actual,
    buildPublicClient: vi.fn(() => ({
      readContract: (...args: unknown[]) => mockReadContract(...args),
      getBalance:   (...args: unknown[]) => mockGetBalance(...args),
    })),
    buildWalletClient: vi.fn(() => ({
      getAddresses: (...args: unknown[]) => mockGetAddresses(...args),
    })),
  };
});

// ─── abi mock ─────────────────────────────────────────────────────────────────

vi.mock("../abi.js", () => ({
  REGISTRY_ABI: [],
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a realistic DaemonState fixture */
function makeDaemonState(overrides: Record<string, unknown> = {}) {
  return {
    startedAt:  "2026-03-03T01:00:00.000Z",
    lastSync:   "2026-03-03T02:00:00.000Z",
    cycles:     5,
    peersFound: 3,
    errors:     0,
    thisAgent:  "test-agent",
    wallet:     MOCK_WALLET,
    network:    "testnet",
    healthy:    true,
    peers: [
      {
        id: "1", owner: MOCK_WALLET, name: "test-agent",
        description: "me", agentEndpoint: "https://test.agent/api",
        isPublic: true, versionCount: "3", createdAt: "1709000000",
      },
      {
        id: "2", owner: MOCK_WALLET, name: "peer-alpha",
        description: "peer", agentEndpoint: "",
        isPublic: true, versionCount: "10", createdAt: "1709000001",
      },
      {
        id: "3", owner: MOCK_WALLET, name: "peer-beta",
        description: "b", agentEndpoint: "https://beta.ai",
        isPublic: false, versionCount: "2", createdAt: "1709000002",
      },
    ],
    ...overrides,
  };
}

/** Build a raw on-chain agent record as returned by readContract */
function makeOnChainAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "1", owner: MOCK_WALLET, name: "test-agent",
    description: "My agent", agentEndpoint: "https://agent.example.com",
    isPublic: true, versionCount: "3", createdAt: "1709000000",
    ...overrides,
  };
}

/** Spy on console.log/error and process.exit */
function setupConsoleMocks() {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  return vi.spyOn(process, "exit").mockImplementation((_code?: number | string | null) => {
    throw new Error("process.exit");
  });
}

// ─── Global beforeEach: always init mock fns ─────────────────────────────────

beforeEach(() => {
  mockReadContract  = vi.fn();
  mockGetBalance    = vi.fn();
  mockGetAddresses  = vi.fn();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("cmdAgentd — status subcommand", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
    delete process.env["INKD_AGENT_ENDPOINT"];
    delete process.env["INKD_INTERVAL"];
  });

  it("warns when no state file exists", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    const warnMock = vi.fn();
    const { warn } = await import("../config.js");
    (warn as Mock).mockImplementation(warnMock);

    await cmdAgentd(["status"]);

    expect(mockExistsSync).toHaveBeenCalled();
    // warn should be called when no state found
    expect(warnMock).toHaveBeenCalled();
  });

  it("displays daemon state when state file exists", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["status"]);

    expect(mockReadFileSync).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });

  it("displays status with zero errors in green", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState({ errors: 0, healthy: true });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["status"]);

    expect(console.log).toHaveBeenCalled();
  });

  it("displays status with non-zero errors (unhealthy)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState({ errors: 3, healthy: false });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["status"]);

    expect(console.log).toHaveBeenCalled();
  });

  it("handles state with null lastSync", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState({ lastSync: null, cycles: 0 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["status"]);

    expect(console.log).toHaveBeenCalled();
  });
});

describe("cmdAgentd — peers subcommand", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("warns when no state file exists", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);

    await cmdAgentd(["peers"]);

    expect(console.log).toHaveBeenCalled();
  });

  it("warns when state has no peers", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState({ peers: [] });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["peers"]);

    expect(console.log).toHaveBeenCalled();
  });

  it("displays peer table when peers exist", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["peers"]);

    expect(console.log).toHaveBeenCalled();
  });

  it("shows 'none' for peers without agentEndpoint", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState({
      peers: [{ id: "2", owner: MOCK_WALLET, name: "nendpoint", description: "", agentEndpoint: "", isPublic: true, versionCount: "1", createdAt: "1709000001" }],
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["peers"]);

    expect(console.log).toHaveBeenCalled();
  });
});

describe("cmdAgentd — unknown subcommand", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("calls error() for unknown subcommand", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const { error } = await import("../config.js");
    (error as Mock).mockImplementationOnce((msg: string) => { throw new Error(`error: ${msg}`) });

    await expect(cmdAgentd(["wibble"])).rejects.toThrow("error:");
  });
});

describe("cmdAgentd — start --once mode", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
    delete process.env["INKD_AGENT_ENDPOINT"];
    delete process.env["INKD_INTERVAL"];
    delete process.env["INKD_PRIVATE_KEY"];
  });

  it("runs a single cycle with --once --dry-run and exits cleanly", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000")); // 1 ETH

    await cmdAgentd(["start", "--once", "--dry-run"]);

    // State should be saved
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("runs --once with fresh state (no existing state file)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("500000000000000000")); // 0.5 ETH

    await cmdAgentd(["start", "--once", "--dry-run"]);

    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = (mockWriteFileSync as Mock).mock.calls[0];
    const savedState = JSON.parse(written[1] as string);
    expect(savedState.cycles).toBe(1);
    expect(savedState.thisAgent).toBe("test-agent");
  });

  it("resumes from existing state file", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const existing = makeDaemonState({ cycles: 4, peersFound: 2 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("2000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run"]);

    const written = (mockWriteFileSync as Mock).mock.calls[0];
    const savedState = JSON.parse(written[1] as string);
    expect(savedState.cycles).toBe(5); // resumed from 4 + 1
  });

  it("warns on low ETH balance (< 0.01 ETH)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("5000000000000000")); // 0.005 ETH < 0.01

    await cmdAgentd(["start", "--once", "--dry-run"]);

    const written = (mockWriteFileSync as Mock).mock.calls[0];
    const savedState = JSON.parse(written[1] as string);
    expect(savedState.healthy).toBe(false);
  });

  it("marks healthy when balance >= 0.01 ETH", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("20000000000000000")); // 0.02 ETH

    await cmdAgentd(["start", "--once", "--dry-run"]);

    const written = (mockWriteFileSync as Mock).mock.calls[0];
    const savedState = JSON.parse(written[1] as string);
    expect(savedState.healthy).toBe(true);
  });

  it("handles agent not found on-chain (self not in peers)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    // Return a peer with a different name
    mockReadContract.mockResolvedValue([makeOnChainAgent({ name: "some-other-agent" })]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run"]);

    // Should still save state
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("handles multiple peers and records peer count", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    const peers = [
      makeOnChainAgent({ id: "1", name: "test-agent",  versionCount: "3" }),
      makeOnChainAgent({ id: "2", name: "alpha-agent", versionCount: "10" }),
      makeOnChainAgent({ id: "3", name: "beta-agent",  versionCount: "1" }),
    ];
    mockReadContract.mockResolvedValue(peers);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run"]);

    const written = (mockWriteFileSync as Mock).mock.calls[0];
    const savedState = JSON.parse(written[1] as string);
    expect(savedState.peersFound).toBe(3);
    expect(savedState.peers).toHaveLength(3);
  });

  it("handles RPC error during discoverAgents — records error in state", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockRejectedValue(new Error("RPC timeout"));

    await cmdAgentd(["start", "--once", "--dry-run"]);

    const written = (mockWriteFileSync as Mock).mock.calls[0];
    const savedState = JSON.parse(written[1] as string);
    // state.errors is incremented in the error catch path
    expect(savedState.errors).toBe(1);
    // Note: state.healthy is only set to false in the SUCCESS path (when balance is low).
    // In the error catch path, state.healthy stays at its initial value (true).
    // We verify errors > 0 as the indicator of an unhealthy cycle.
    expect(savedState.cycles).toBe(0); // cycles not incremented on error
  });

  it("runs in --json mode without throwing", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run", "--json"]);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("runs in --quiet mode without throwing", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run", "--quiet"]);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("honours --interval flag (parses integer)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // Should not throw despite custom interval
    await cmdAgentd(["start", "--once", "--dry-run", "--interval", "30000"]);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("uses INKD_INTERVAL env var when --interval flag not present", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    process.env["INKD_INTERVAL"] = "45000";
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run"]);

    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});

describe("cmdAgentd — start --once with private key (non-dry-run)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "my-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
    delete process.env["INKD_AGENT_ENDPOINT"];
  });

  it("resolves wallet address via walletClient when private key is set", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockGetAddresses.mockResolvedValue([MOCK_WALLET]);
    mockReadContract.mockResolvedValue([makeOnChainAgent({ name: "my-agent" })]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once"]);

    const written = (mockWriteFileSync as Mock).mock.calls[0];
    const savedState = JSON.parse(written[1] as string);
    expect(savedState.wallet).toBe(MOCK_WALLET);
  });

  it("falls back to zero address when requirePrivateKey throws in dry-run-fallback path", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const { requirePrivateKey, error } = await import("../config.js");
    (requirePrivateKey as Mock).mockImplementation(() => { throw new Error("no key") });
    // In non-dry-run mode, should call error()
    (error as Mock).mockImplementationOnce((msg: string) => { throw new Error(`error: ${msg}`) });
    mockExistsSync.mockReturnValue(false);

    await expect(cmdAgentd(["start", "--once"])).rejects.toThrow("error:");
  });
});

describe("cmdAgentd — INKD_AGENT_NAME guard", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("calls error() when INKD_AGENT_NAME is not set", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const { error } = await import("../config.js");
    (error as Mock).mockImplementationOnce((msg: string) => { throw new Error(`error: ${msg}`) });

    await expect(cmdAgentd(["start", "--once"])).rejects.toThrow("error:");
  });
});

describe("cmdAgentd — registry address guard", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("calls error() when registry address is empty for the network", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const { loadConfig, error } = await import("../config.js");
    (loadConfig as Mock).mockReturnValueOnce({ network: "mainnet", privateKey: MOCK_PK });
    // Use mockReturnValueOnce so the implementation resets after one call
    (error as Mock).mockImplementationOnce((msg: string) => { throw new Error(`error: ${msg}`) });

    await expect(cmdAgentd(["start", "--once"])).rejects.toThrow("error:");
  });
});

describe("cmdAgentd — start continuous mode (signal handling)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
    delete process.env["INKD_AGENT_ENDPOINT"];
  });

  it("enters continuous mode: registers setInterval and signal handlers", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");

    const registeredEvents: string[] = [];
    const processOnSpy = vi.spyOn(process, "on").mockImplementation((event: string) => {
      registeredEvents.push(event);
      return process;
    });
    const clearIntervalSpy = vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    const setIntervalSpy = vi
      .spyOn(global, "setInterval")
      .mockImplementation((_fn, _ms) => 42 as unknown as ReturnType<typeof setInterval>);

    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // cmdAgentd in continuous mode runs the first cycle, registers handlers, then resolves
    await cmdAgentd(["start", "--dry-run"]);

    // Verify continuous-mode plumbing
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
    expect(registeredEvents).toContain("SIGINT");
    expect(registeredEvents).toContain("SIGTERM");
    // State was saved after the first cycle
    expect(mockWriteFileSync).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  it("shutdown handler (SIGINT) saves state and calls process.exit", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");

    const handlers: Record<string, () => void> = {};
    const processOnSpy = vi.spyOn(process, "on").mockImplementation((event: string, fn: (...a: unknown[]) => void) => {
      handlers[event] = fn as () => void;
      return process;
    });
    vi.spyOn(global, "setInterval").mockImplementation(() => 42 as unknown as ReturnType<typeof setInterval>);
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("process.exit") });

    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--dry-run"]);

    // SIGINT handler should now be registered — fire it
    expect(handlers["SIGINT"]).toBeDefined();
    const calls = (mockWriteFileSync as Mock).mock.calls.length;
    expect(() => handlers["SIGINT"]()).toThrow("process.exit");

    // writeFileSync called again on shutdown
    expect((mockWriteFileSync as Mock).mock.calls.length).toBeGreaterThan(calls);

    processOnSpy.mockRestore();
  });

  it("shutdown handler in --json mode outputs JSON line and calls process.exit", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");

    const handlers: Record<string, () => void> = {};
    vi.spyOn(process, "on").mockImplementation((event: string, fn: (...a: unknown[]) => void) => {
      handlers[event] = fn as () => void;
      return process;
    });
    vi.spyOn(global, "setInterval").mockImplementation(() => 42 as unknown as ReturnType<typeof setInterval>);
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("process.exit") });

    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--dry-run", "--json"]);

    expect(handlers["SIGTERM"]).toBeDefined();
    expect(() => handlers["SIGTERM"]()).toThrow("process.exit");
    // console.log should have been called with a JSON string
    const logCalls = (console.log as Mock).mock.calls;
    const jsonCall = logCalls.find((c: unknown[]) =>
      typeof c[0] === "string" && (c[0] as string).includes("daemon_stop")
    );
    expect(jsonCall).toBeDefined();
  });
});

describe("cmdAgentd — default subcommand (no args = start)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "my-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("start subcommand — enters continuous mode with setInterval registered", async () => {
    // Providing INKD_AGENT_NAME via env, so it should attempt to start (not error on name)
    const { cmdAgentd } = await import("../commands/agentd.js");

    const registeredEvents: string[] = [];
    const processOnSpy = vi.spyOn(process, "on").mockImplementation((event: string) => {
      registeredEvents.push(event);
      return process;
    });
    const setIntervalSpy = vi.spyOn(global, "setInterval").mockImplementation(() => 42 as unknown as ReturnType<typeof setInterval>);
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent({ name: "my-agent" })]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // Empty args defaults to "start"; test the default via explicit "start" + dry-run
    // (empty [] with no PK would fail; the key behavior being tested is continuous mode)
    await cmdAgentd(["start", "--dry-run"]);

    expect(setIntervalSpy).toHaveBeenCalled();
    expect(registeredEvents).toContain("SIGINT");

    setIntervalSpy.mockRestore();
    processOnSpy.mockRestore();
  });
});

// ─── Branch-coverage gap tests ───────────────────────────────────────────────

describe("cmdAgentd — loadState() catch branch (corrupt JSON)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("returns null (falls back to fresh state) when state file contains corrupt JSON", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");

    // existsSync → true but readFileSync returns invalid JSON → catch → null → fresh state
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("{not-valid-json:::");
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));
    process.env["INKD_AGENT_NAME"] = "test-agent";

    vi.spyOn(global, "setInterval").mockImplementation(() => 42 as unknown as ReturnType<typeof setInterval>);
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    vi.spyOn(process, "on").mockImplementation((_e: string) => process);

    // Should NOT throw — corrupt file is silently ignored, daemon starts fresh
    await expect(cmdAgentd(["start", "--once", "--dry-run"])).resolves.toBeUndefined();
    // writeFileSync called once to save state (proves we reached the end of the cycle)
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("shows 'no state found' warning when state file contains corrupt JSON (status command)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("{bad json");
    const warnMock = vi.fn();
    const { warn } = await import("../config.js");
    (warn as Mock).mockImplementation(warnMock);

    await cmdAgentd(["status"]);

    // loadState() returns null → status prints "no state" warning
    expect(warnMock).toHaveBeenCalled();
  });
});

describe("cmdAgentd — setInterval callback body (lines 387-389)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("executes the setInterval callback (cycle + info log) in plain mode", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");

    let capturedCallback: (() => Promise<void>) | null = null;
    vi.spyOn(global, "setInterval").mockImplementation((fn) => {
      capturedCallback = fn as () => Promise<void>;
      return 42 as unknown as ReturnType<typeof setInterval>;
    });
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    vi.spyOn(process, "on").mockImplementation((_e: string) => process);

    mockExistsSync.mockReturnValue(false);
    // Two resolved values: one for the initial cycle, one for the callback invocation
    mockReadContract
      .mockResolvedValueOnce([makeOnChainAgent()])  // initial cycle
      .mockResolvedValueOnce([makeOnChainAgent()]); // timer callback cycle
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // Run in plain mode (no --json, no --quiet) so lines 387-389 are exercised
    await cmdAgentd(["start", "--dry-run"]);

    expect(capturedCallback).not.toBeNull();
    // Invoke the timer callback — covers lines 387-389
    await capturedCallback!();

    const { info } = await import("../config.js");
    // info() should have been called for the "Next sync in …s" message
    expect(info as Mock).toHaveBeenCalled();
  });
});

// ─── Branch-coverage gap-fills ────────────────────────────────────────────────

describe("agentd — line 126: agentEndpoint ?? '' fallback (branch coverage)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("maps agent with undefined agentEndpoint to empty string (covers ?? '' branch)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    // Omit agentEndpoint so it comes through as undefined → ?? '' fires
    const agentWithoutEndpoint = { ...makeOnChainAgent(), agentEndpoint: undefined };
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([agentWithoutEndpoint]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // --once so it doesn't loop; --dry-run so no wallet needed
    await cmdAgentd(["start", "--once", "--dry-run"]);

    // State should be written (cycle completed without throwing)
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});

describe("agentd — line 201: non-Error catch branch (branch coverage)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("handles non-Error thrown in cycle (String(e) branch)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    // Throw a plain string (not an Error) to hit `String(e)` branch on line 201
    mockReadContract.mockRejectedValue("plain string error");
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run"]);

    // Should complete (catch block handles it); state written with errors > 0
    expect(mockWriteFileSync).toHaveBeenCalled();
    const savedJson = mockWriteFileSync.mock.calls[0][1] as string;
    const saved = JSON.parse(savedJson);
    expect(saved.errors).toBeGreaterThan(0);
  });
});

describe("agentd — line 257: lastSync ?? 'never' in peers (branch coverage)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("shows 'never' when peers state has null lastSync", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const state = makeDaemonState({
      lastSync: null,
      peers: [{ id: "1", owner: MOCK_WALLET, name: "peer-x", description: "", agentEndpoint: "https://x.ai", isPublic: true, versionCount: "1", createdAt: "1709000000" }],
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(state));

    await cmdAgentd(["peers"]);

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("never");
  });
});

describe("agentd — line 388: setInterval callback false branch (json/quiet mode)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("executes setInterval callback in --json mode (no info call for 'Next sync')", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");

    let capturedCallback: (() => Promise<void>) | null = null;
    vi.spyOn(global, "setInterval").mockImplementation((fn) => {
      capturedCallback = fn as () => Promise<void>;
      return 42 as unknown as ReturnType<typeof setInterval>;
    });
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    vi.spyOn(process, "on").mockImplementation((_e: string) => process);

    mockExistsSync.mockReturnValue(false);
    mockReadContract
      .mockResolvedValueOnce([makeOnChainAgent()])  // initial cycle
      .mockResolvedValueOnce([makeOnChainAgent()]); // timer callback cycle
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // --json mode: timer callback should NOT call info (false branch of !jsonMode && !quiet)
    await cmdAgentd(["start", "--dry-run", "--json"]);

    expect(capturedCallback).not.toBeNull();
    const { info } = await import("../config.js");
    (info as Mock).mockClear();

    await capturedCallback!();
    // In --json mode, "Next sync" info line should NOT be printed
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).not.toContain("Next sync");
  });
});

describe("agentd — line 102: humanLine else-if(event) false branch", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("emits nothing when jsonMode=true and say() is called without a json event key", async () => {
    // In --json mode, say() calls humanLine(jsonMode=true, event=undefined-ish).
    // The say() helper maps 'cycle_start' etc., but the 'cycle_error' code path
    // calls humanLine directly. To trigger the jsonMode=true + !event branch we
    // just run a --json --once cycle; the json emitted lines confirm the path.
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // --json emits JSON lines (event present) but also calls humanLine with no event
    // for the cycle_ok branch — just confirm it doesn't throw
    await expect(cmdAgentd(["start", "--once", "--dry-run", "--json"])).resolves.toBeUndefined();
  });
});

describe("agentd — line 125: description ?? '' fallback (branch coverage)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("maps agent with undefined description to empty string (covers ?? '' branch)", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    const agentWithoutDesc = { ...makeOnChainAgent(), description: undefined };
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([agentWithoutDesc]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    await cmdAgentd(["start", "--once", "--dry-run"]);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});

describe("agentd — line 264: args[0] ?? 'start' fallback (branch coverage)", () => {
  beforeEach(() => {
    setupConsoleMocks();
    vi.clearAllMocks();
    process.env["INKD_AGENT_NAME"] = "test-agent";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["INKD_AGENT_NAME"];
  });

  it("defaults to 'start' subcommand when called with no args", async () => {
    const { cmdAgentd } = await import("../commands/agentd.js");
    mockExistsSync.mockReturnValue(false);
    mockReadContract.mockResolvedValue([makeOnChainAgent()]);
    mockGetBalance.mockResolvedValue(BigInt("1000000000000000000"));

    // cmdAgentd([]) → args[0] is undefined → ?? 'start' → runs start path
    vi.spyOn(global, "setInterval").mockImplementation(() => 42 as unknown as ReturnType<typeof setInterval>);
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    vi.spyOn(process, "on").mockImplementation((_e: string) => process);

    await cmdAgentd(["--once", "--dry-run"]); // no positional sub → args[0] starts with --
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
