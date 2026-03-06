/**
 * @file version.test.ts
 * Unit tests for `inkd version` subcommands.
 * All on-chain reads/writes are mocked via vitest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";
import { parseEther } from "viem";

// ─── @inkd/sdk mock ───────────────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  mockPushVersion: vi.fn().mockResolvedValue({
    txHash: "0xbeefbeefbeefbeefbeef" as `0x${string}`,
    contentHash: "ar://abc123",
  }),
  mockUpload: vi.fn().mockResolvedValue({
    hash: "ar://uploaded123",
    url: "https://arweave.net/uploaded123",
  }),
}))

vi.mock("@inkd/sdk", () => ({
  ProjectsClient: vi.fn(function () {
    return {
      pushVersion: hoisted.mockPushVersion,
      upload:      hoisted.mockUpload,
    }
  }),
}))

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_TX_HASH = "0xbeefbeefbeefbeefbeef" as `0x${string}`;
const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111" as const;
const MOCK_TOKEN = "0x2222222222222222222222222222222222222222" as const;
const MOCK_PUSHER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

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
        token: MOCK_TOKEN,
        treasury: "0x3333333333333333333333333333333333333333",
      },
      mainnet: { registry: "", token: "", treasury: "" },
    },
  };
});

let mockReadContract: Mock;
let mockWriteContract: Mock;
let mockWaitForReceipt: Mock;

vi.mock("../client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client.js")>();
  return {
    ...actual,
    buildPublicClient: vi.fn(() => ({
      readContract: (...args: unknown[]) => mockReadContract(...args),
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
      account: { address: MOCK_PUSHER },
      addrs: {
        registry: MOCK_REGISTRY,
        token: MOCK_TOKEN,
        treasury: "0x3333333333333333333333333333333333333333",
      },
    })),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVersion(overrides = {}) {
  return {
    projectId: 1n,
    arweaveHash: "abc123defxyz",
    versionTag: "v0.2.0",
    changelog: "Bug fixes",
    pushedBy: MOCK_PUSHER,
    pushedAt: 1709000000n,
    ...overrides,
  };
}

function setupProcessMocks() {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  return vi
    .spyOn(process, "exit")
    .mockImplementation((_code?: number | string | null | undefined) => {
      throw new Error("process.exit");
    });
}

// ─── cmdVersionPush ───────────────────────────────────────────────────────────

describe("cmdVersionPush", () => {
  beforeEach(() => {
    setupProcessMocks();
    mockReadContract = vi.fn();
    mockWriteContract = vi.fn();
    mockWaitForReceipt = vi.fn();
    hoisted.mockPushVersion.mockResolvedValue({
      txHash: MOCK_TX_HASH,
      contentHash: "ar://abc123",
    })
  });

  afterEach(() => {
    vi.restoreAllMocks();
    hoisted.mockPushVersion.mockClear();
  });

  it("exits when --id is missing", async () => {
    const { cmdVersionPush } = await import("../commands/version.js");
    await expect(
      cmdVersionPush(["--hash", "ar://abc123", "--tag", "v0.1.0"])
    ).rejects.toThrow("process.exit");
  });

  it("exits when both --hash and --file are missing", async () => {
    const { cmdVersionPush } = await import("../commands/version.js");
    await expect(
      cmdVersionPush(["--id", "1", "--tag", "v0.1.0"])
    ).rejects.toThrow("process.exit");
  });

  it("exits when --tag is missing", async () => {
    const { cmdVersionPush } = await import("../commands/version.js");
    await expect(
      cmdVersionPush(["--id", "1", "--hash", "ar://abc123"])
    ).rejects.toThrow("process.exit");
  });

  it("calls pushVersion with correct args", async () => {
    const { cmdVersionPush } = await import("../commands/version.js");
    await cmdVersionPush([
      "--id", "1",
      "--hash", "ar://abc123",
      "--tag", "v0.9.0",
    ]);

    expect(hoisted.mockPushVersion).toHaveBeenCalledTimes(1);
    const [id, opts] = hoisted.mockPushVersion.mock.calls[0] as [number, Record<string, unknown>]
    expect(id).toBe(1);
    expect(opts.tag).toBe("v0.9.0");
    expect(opts.contentHash).toBe("ar://abc123");
  });

  it("prints success with version tag", async () => {
    const consoleLog = vi.spyOn(console, "log");
    const { cmdVersionPush } = await import("../commands/version.js");
    await cmdVersionPush([
      "--id", "1",
      "--hash", "ar://abc123",
      "--tag", "v0.9.0",
    ]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/v0\.9\.0/);
  });

  it("calls process.exit when pushVersion throws", async () => {
    hoisted.mockPushVersion.mockRejectedValueOnce(new Error("payment failed"));
    const { cmdVersionPush } = await import("../commands/version.js");
    await expect(
      cmdVersionPush(["--id", "1", "--hash", "ar://abc", "--tag", "v0.1.0"])
    ).rejects.toThrow("process.exit");
  });
});

// ─── cmdVersionList ───────────────────────────────────────────────────────────

describe("cmdVersionList", () => {
  beforeEach(() => {
    setupProcessMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints 'no versions' message when count is 0", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(0n); // getVersionCount

    const consoleLog = vi.spyOn(console, "log");
    const { cmdVersionList } = await import("../commands/version.js");
    await cmdVersionList(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/No versions/i);
  });

  it("lists versions in reverse order (newest first)", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(2n) // getVersionCount
      .mockResolvedValueOnce(makeVersion({ versionTag: "v0.1.0", pushedAt: 1700000000n }))
      .mockResolvedValueOnce(makeVersion({ versionTag: "v0.2.0", pushedAt: 1709000000n }));

    const consoleLog = vi.spyOn(console, "log");
    const { cmdVersionList } = await import("../commands/version.js");
    await cmdVersionList(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/v0\.1\.0/);
    expect(logged).toMatch(/v0\.2\.0/);
  });

  it("accepts --id flag instead of positional arg", async () => {
    mockReadContract = vi.fn().mockResolvedValueOnce(0n);
    const { cmdVersionList } = await import("../commands/version.js");
    await cmdVersionList(["--id", "42"]);

    // readContract should have been called (no error thrown)
    expect(mockReadContract).toHaveBeenCalledTimes(1);
  });

  it("makes correct number of readContract calls (1 + versionCount)", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(3n) // getVersionCount = 3
      .mockResolvedValue(makeVersion()); // getVersion x3

    const { cmdVersionList } = await import("../commands/version.js");
    await cmdVersionList(["1"]);

    expect(mockReadContract).toHaveBeenCalledTimes(4); // 1 count + 3 versions
  });

  it("shows version tag and hash in list", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(makeVersion({ versionTag: "v1.2.3", arweaveHash: "ar://somehash" }));

    const consoleLog = vi.spyOn(console, "log");
    const { cmdVersionList } = await import("../commands/version.js");
    await cmdVersionList(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/v1\.2\.3/);
  });
});

// ─── cmdVersionShow ───────────────────────────────────────────────────────────

describe("cmdVersionShow", () => {
  beforeEach(() => {
    setupProcessMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits when --id is missing", async () => {
    const { cmdVersionShow } = await import("../commands/version.js");
    await expect(cmdVersionShow(["--index", "0"])).rejects.toThrow("process.exit");
  });

  it("exits when --index is missing", async () => {
    const { cmdVersionShow } = await import("../commands/version.js");
    await expect(cmdVersionShow(["--id", "1"])).rejects.toThrow("process.exit");
  });

  it("displays version details", async () => {
    mockReadContract = vi.fn().mockResolvedValue(
      makeVersion({
        versionTag: "v0.5.0",
        arweaveHash: "xyz_arweave_hash",
        pushedBy: MOCK_PUSHER,
        changelog: "Perf improvements",
      })
    );

    const consoleLog = vi.spyOn(console, "log");
    const { cmdVersionShow } = await import("../commands/version.js");
    await cmdVersionShow(["--id", "1", "--index", "0"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).toMatch(/v0\.5\.0/);
    expect(logged).toMatch(/xyz_arweave_hash/);
    expect(logged).toMatch(/Perf improvements/);
  });

  it("calls getVersion with correct bigint args", async () => {
    mockReadContract = vi.fn().mockResolvedValue(makeVersion());
    const { cmdVersionShow } = await import("../commands/version.js");
    await cmdVersionShow(["--id", "7", "--index", "3"]);

    const call = mockReadContract.mock.calls[0][0];
    expect(call.functionName).toBe("getVersion");
    expect(call.args[0]).toBe(7n);
    expect(call.args[1]).toBe(3n);
  });

  it("does not print changelog section when changelog is empty", async () => {
    mockReadContract = vi.fn().mockResolvedValue(makeVersion({ changelog: "" }));
    const consoleLog = vi.spyOn(console, "log");
    const { cmdVersionShow } = await import("../commands/version.js");
    await cmdVersionShow(["--id", "1", "--index", "0"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(logged).not.toMatch(/Changelog/i);
  });
});

// ─── Registry-not-configured error paths ─────────────────────────────────────

describe("registry not configured error paths", () => {
  beforeEach(() => {
    setupProcessMocks();
    mockReadContract = vi.fn();
    mockWriteContract = vi.fn();
    mockWaitForReceipt = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cmdVersionPush exits when registry address is not configured (mainnet)", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce({
      network: "mainnet",
      privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      rpcUrl: undefined,
    } as ReturnType<typeof loadConfig>);

    const { cmdVersionPush } = await import("../commands/version.js");
    await expect(
      cmdVersionPush(["--id", "1", "--hash", "abc", "--tag", "v0.1.0"])
    ).rejects.toThrow("process.exit");

    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it("cmdVersionList exits when registry address is not configured (mainnet)", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce({
      network: "mainnet",
      privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      rpcUrl: undefined,
    } as ReturnType<typeof loadConfig>);

    const { cmdVersionList } = await import("../commands/version.js");
    await expect(cmdVersionList(["1"])).rejects.toThrow("process.exit");

    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("cmdVersionList exits when called with no args (requireFlag fallback)", async () => {
    mockReadContract = vi.fn().mockResolvedValue(0n);
    const { cmdVersionList } = await import("../commands/version.js");
    await expect(cmdVersionList([])).rejects.toThrow("process.exit");
  });

  it("cmdVersionShow exits when registry address is not configured (mainnet)", async () => {
    const { loadConfig } = await import("../config.js");
    vi.mocked(loadConfig).mockReturnValueOnce({
      network: "mainnet",
      privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      rpcUrl: undefined,
    } as ReturnType<typeof loadConfig>);

    const { cmdVersionShow } = await import("../commands/version.js");
    await expect(
      cmdVersionShow(["--id", "1", "--index", "0"])
    ).rejects.toThrow("process.exit");

    expect(mockReadContract).not.toHaveBeenCalled();
  });
});


// ─── cmdVersionList — empty changelog branch (branch coverage) ────────────────

describe("cmdVersionList — empty changelog (branch coverage)", () => {
  beforeEach(() => {
    setupProcessMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not print changelog line when changelog is empty in list view", async () => {
    mockReadContract = vi
      .fn()
      .mockResolvedValueOnce(1n) // getVersionCount
      .mockResolvedValueOnce(makeVersion({ changelog: "" }));

    const consoleLog = vi.spyOn(console, "log");
    const { cmdVersionList } = await import("../commands/version.js");
    await cmdVersionList(["1"]);

    const logged = consoleLog.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    // changelog line (indented with spaces) should NOT appear
    expect(logged).not.toMatch(/^\s{7}/m);
  });
});
