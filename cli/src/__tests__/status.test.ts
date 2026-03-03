/**
 * @file status.test.ts
 * Unit tests for `inkd status` command.
 * All on-chain reads are mocked via vitest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";
import { parseEther } from "viem";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111" as const;
const MOCK_TOKEN    = "0x2222222222222222222222222222222222222222" as const;
const MOCK_TREASURY = "0x3333333333333333333333333333333333333333" as const;

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config.js")>();
  return {
    ...actual,
    loadConfig: vi.fn(() => ({
      network: "testnet",
      rpcUrl: "https://rpc.example.com",
    })),
    ADDRESSES: {
      testnet: {
        registry: MOCK_REGISTRY,
        token: MOCK_TOKEN,
        treasury: MOCK_TREASURY,
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

// ─── cmdStatus ────────────────────────────────────────────────────────────────

describe("cmdStatus", () => {
  it("reads versionFee, transferFee, and projectCount in parallel", async () => {
    mockReadContract
      .mockResolvedValueOnce(parseEther("0.001")) // versionFee
      .mockResolvedValueOnce(parseEther("0.01"))  // transferFee
      .mockResolvedValueOnce(42n);                // projectCount

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    expect(mockReadContract).toHaveBeenCalledTimes(3);
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "versionFee" })
    );
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "transferFee" })
    );
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "projectCount" })
    );
  });

  it("displays project count and fee values", async () => {
    mockReadContract
      .mockResolvedValueOnce(parseEther("0.001"))
      .mockResolvedValueOnce(parseEther("0.01"))
      .mockResolvedValueOnce(99n);

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("99");
    expect(infoCalls).toContain("0.001");
    expect(infoCalls).toContain("0.01");
  });

  it("shows network and rpcUrl from config", async () => {
    mockReadContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("testnet");
    expect(infoCalls).toContain("https://rpc.example.com");
  });

  it("shows 'default (public)' when rpcUrl is not set", async () => {
    const { loadConfig } = await import("../config.js");
    (loadConfig as Mock).mockReturnValueOnce({ network: "testnet", rpcUrl: undefined });

    mockReadContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("default (public)");
  });

  it("warns and returns early when registry address is not configured", async () => {
    const { ADDRESSES } = await import("../config.js");
    const orig = (ADDRESSES as Record<string, Record<string, string>>).testnet.registry;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = "";

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    expect(mockReadContract).not.toHaveBeenCalled();
    const { warn } = await import("../config.js");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Contract addresses not configured"));

    (ADDRESSES as Record<string, Record<string, string>>).testnet.registry = orig;
  });

  it("warns on RPC error instead of throwing", async () => {
    mockReadContract.mockRejectedValue(new Error("network timeout"));

    const { cmdStatus } = await import("../commands/status.js");
    // Should NOT throw — it catches the error and warns
    await expect(cmdStatus()).resolves.toBeUndefined();

    const { warn } = await import("../config.js");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("network timeout"));
  });

  it("displays contract addresses from ADDRESSES config", async () => {
    mockReadContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain(MOCK_REGISTRY);
    expect(infoCalls).toContain(MOCK_TOKEN);
    expect(infoCalls).toContain(MOCK_TREASURY);
  });

  it("shows 'not deployed yet' when token address is empty", async () => {
    const { ADDRESSES } = await import("../config.js");
    const origToken = (ADDRESSES as Record<string, Record<string, string>>).testnet.token;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = "";

    mockReadContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("not deployed yet");

    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = origToken;
  });

  it("handles zero project count", async () => {
    mockReadContract
      .mockResolvedValueOnce(0n) // versionFee
      .mockResolvedValueOnce(0n) // transferFee
      .mockResolvedValueOnce(0n); // projectCount

    const { cmdStatus } = await import("../commands/status.js");
    await expect(cmdStatus()).resolves.toBeUndefined();

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("0");
  });
});

// ─── Branch-coverage gap-fill ─────────────────────────────────────────────────

describe("cmdStatus — treasury empty branch (branch coverage)", () => {
  it("shows 'not deployed yet' for treasury when treasury address is empty", async () => {
    const { ADDRESSES } = await import("../config.js");
    const origTreasury = (ADDRESSES as Record<string, Record<string, string>>).testnet.treasury;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.treasury = "";

    mockReadContract
      .mockResolvedValueOnce(0n) // versionFee
      .mockResolvedValueOnce(0n) // transferFee
      .mockResolvedValueOnce(0n); // projectCount

    const { cmdStatus } = await import("../commands/status.js");
    await cmdStatus();

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("not deployed yet"); // treasury || 'not deployed yet'

    (ADDRESSES as Record<string, Record<string, string>>).testnet.treasury = origTreasury;
  });
});
