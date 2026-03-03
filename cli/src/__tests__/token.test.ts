/**
 * @file token.test.ts
 * Unit tests for `inkd token` subcommands.
 * All on-chain reads/writes and key derivation are mocked via vitest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";
import { parseEther } from "viem";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_REGISTRY = "0x1111111111111111111111111111111111111111" as const;
const MOCK_TOKEN    = "0x2222222222222222222222222222222222222222" as const;
const MOCK_TREASURY = "0x3333333333333333333333333333333333333333" as const;
const MOCK_OWNER    = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const MOCK_RECIPIENT= "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const MOCK_PK       = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const MOCK_TX_HASH  = "0xdeadbeefdeadbeefdeadbeef" as `0x${string}`;

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config.js")>();
  return {
    ...actual,
    loadConfig: vi.fn(() => ({
      network: "testnet",
      privateKey: MOCK_PK,
      rpcUrl: undefined,
    })),
    requirePrivateKey: vi.fn(() => MOCK_PK),
    ADDRESSES: {
      testnet: {
        registry: MOCK_REGISTRY,
        token: MOCK_TOKEN,
        treasury: MOCK_TREASURY,
      },
      mainnet: { registry: "", token: "", treasury: "" },
    },
    error:   vi.fn((msg: string) => { throw new Error(msg); }),
    info:    vi.fn(),
    success: vi.fn(),
    warn:    vi.fn(),
    BOLD:    "",
    RESET:   "",
    CYAN:    "",
    DIM:     "",
    GREEN:   "",
    YELLOW:  "",
  };
});

// Mock viem/accounts dynamic import used inside token commands
vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({ address: MOCK_OWNER })),
}));

let mockReadContract:        Mock;
let mockGetBalance:          Mock;
let mockWriteContract:       Mock;
let mockWaitForReceipt:      Mock;

vi.mock("../client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client.js")>();
  return {
    ...actual,
    buildPublicClient: vi.fn(() => ({
      readContract:              (...args: unknown[]) => mockReadContract(...args),
      getBalance:                (...args: unknown[]) => mockGetBalance(...args),
      waitForTransactionReceipt: (...args: unknown[]) => mockWaitForReceipt(...args),
    })),
    buildWalletClient: vi.fn(() => ({
      writeContract: (...args: unknown[]) => mockWriteContract(...args),
    })),
  };
});

// ─── Setup helpers ────────────────────────────────────────────────────────────

function setupConsoleMocks() {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  return vi.spyOn(process, "exit").mockImplementation((_?: number | string | null) => {
    throw new Error("process.exit");
  });
}

beforeEach(() => {
  setupConsoleMocks();
  mockReadContract   = vi.fn();
  mockGetBalance     = vi.fn();
  mockWriteContract  = vi.fn();
  mockWaitForReceipt = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── cmdTokenBalance ──────────────────────────────────────────────────────────

describe("cmdTokenBalance", () => {
  it("reads balanceOf and getBalance for own wallet when no address given", async () => {
    mockReadContract.mockResolvedValue(parseEther("42"));
    mockGetBalance.mockResolvedValue(parseEther("0.5"));

    const { cmdTokenBalance } = await import("../commands/token.js");
    await cmdTokenBalance([]);

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "balanceOf", args: [MOCK_OWNER] })
    );
    expect(mockGetBalance).toHaveBeenCalledWith({ address: MOCK_OWNER });
  });

  it("reads balance for an explicit address argument", async () => {
    mockReadContract.mockResolvedValue(parseEther("10"));
    mockGetBalance.mockResolvedValue(parseEther("0.1"));

    const { cmdTokenBalance } = await import("../commands/token.js");
    await cmdTokenBalance([MOCK_RECIPIENT]);

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "balanceOf", args: [MOCK_RECIPIENT] })
    );
  });

  it("outputs JSON when --json flag is passed", async () => {
    mockReadContract.mockResolvedValue(parseEther("7"));
    mockGetBalance.mockResolvedValue(parseEther("0.2"));

    const { cmdTokenBalance } = await import("../commands/token.js");
    await cmdTokenBalance(["--json"]);

    const logged = (console.log as Mock).mock.calls.map(c => c[0]).join("");
    const parsed = JSON.parse(logged);
    // formatEther returns "7" (no trailing .0) in this viem version
    expect(String(parsed.inkd)).toMatch(/^7/);
    expect(parsed.address).toBe(MOCK_OWNER);
    expect(parsed.network).toBe("testnet");
  });

  it("exits when token address is not configured", async () => {
    const { ADDRESSES } = await import("../config.js");
    const orig = (ADDRESSES as Record<string, Record<string, string>>).testnet.token;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = "";

    const { cmdTokenBalance } = await import("../commands/token.js");
    await expect(cmdTokenBalance([])).rejects.toThrow("process.exit");

    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = orig;
  });

  it("displays human-readable balance in table output", async () => {
    mockReadContract.mockResolvedValue(parseEther("100"));
    mockGetBalance.mockResolvedValue(parseEther("1"));

    const { cmdTokenBalance } = await import("../commands/token.js");
    await cmdTokenBalance([]);

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    // formatEther returns "100" (no trailing .0) in this viem version
    expect(infoCalls).toMatch(/100/);
    expect(infoCalls).toMatch(/\b1\b/);
  });

  it("shows network in human output", async () => {
    mockReadContract.mockResolvedValue(0n);
    mockGetBalance.mockResolvedValue(0n);

    const { cmdTokenBalance } = await import("../commands/token.js");
    await cmdTokenBalance([]);

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain("testnet");
  });
});

// ─── cmdTokenAllowance ────────────────────────────────────────────────────────

describe("cmdTokenAllowance", () => {
  it("reads allowance for own wallet when no address given", async () => {
    mockReadContract.mockResolvedValue(parseEther("5"));

    const { cmdTokenAllowance } = await import("../commands/token.js");
    await cmdTokenAllowance([]);

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "allowance",
        args: [MOCK_OWNER, MOCK_REGISTRY],
      })
    );
  });

  it("reads allowance for explicit address argument", async () => {
    mockReadContract.mockResolvedValue(parseEther("2"));

    const { cmdTokenAllowance } = await import("../commands/token.js");
    await cmdTokenAllowance([MOCK_RECIPIENT]);

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [MOCK_RECIPIENT, MOCK_REGISTRY] })
    );
  });

  it("outputs JSON when --json flag is passed", async () => {
    mockReadContract.mockResolvedValue(parseEther("3"));

    const { cmdTokenAllowance } = await import("../commands/token.js");
    await cmdTokenAllowance(["--json"]);

    const logged = (console.log as Mock).mock.calls.map(c => c[0]).join("");
    const parsed = JSON.parse(logged);
    expect(String(parsed.allowance)).toMatch(/^3/);
    expect(parsed.sufficientForProject).toBe(true);
    expect(parsed.spender).toBe(MOCK_REGISTRY);
  });

  it("reports sufficientForProject=false when allowance < 1 INKD", async () => {
    mockReadContract.mockResolvedValue(parseEther("0.5"));

    const { cmdTokenAllowance } = await import("../commands/token.js");
    await cmdTokenAllowance(["--json"]);

    const logged = (console.log as Mock).mock.calls.map(c => c[0]).join("");
    const parsed = JSON.parse(logged);
    expect(parsed.sufficientForProject).toBe(false);
  });

  it("warns about insufficient allowance in human mode", async () => {
    mockReadContract.mockResolvedValue(parseEther("0"));

    const { cmdTokenAllowance } = await import("../commands/token.js");
    await cmdTokenAllowance([]);

    const { warn } = await import("../config.js");
    expect(warn).toHaveBeenCalled();
  });

  it("exits when token or registry address not configured", async () => {
    const { ADDRESSES } = await import("../config.js");
    const origToken = (ADDRESSES as Record<string, Record<string, string>>).testnet.token;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = "";

    const { cmdTokenAllowance } = await import("../commands/token.js");
    await expect(cmdTokenAllowance([])).rejects.toThrow("process.exit");

    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = origToken;
  });

  it("shows sufficient message for allowance >= 1 INKD in human mode", async () => {
    mockReadContract.mockResolvedValue(parseEther("1"));

    const { cmdTokenAllowance } = await import("../commands/token.js");
    await cmdTokenAllowance([]);

    const logged = (console.log as Mock).mock.calls.flat().join(" ");
    expect(logged).toContain("Sufficient");
  });
});

// ─── cmdTokenApprove ─────────────────────────────────────────────────────────

describe("cmdTokenApprove", () => {
  beforeEach(() => {
    mockWriteContract.mockResolvedValue(MOCK_TX_HASH);
    mockWaitForReceipt.mockResolvedValue({ status: "success", blockNumber: 123n });
  });

  it("exits when amount argument is missing", async () => {
    const { cmdTokenApprove } = await import("../commands/token.js");
    // error() mock throws before process.exit — just assert it rejects
    await expect(cmdTokenApprove([])).rejects.toThrow();
  });

  it("exits when amount is invalid (non-numeric)", async () => {
    const { cmdTokenApprove } = await import("../commands/token.js");
    await expect(cmdTokenApprove(["notanumber"])).rejects.toThrow();
  });

  it("sends approve tx with correct spender (registry) and amount", async () => {
    const { cmdTokenApprove } = await import("../commands/token.js");
    await cmdTokenApprove(["5"]);

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "approve",
        args: [MOCK_REGISTRY, parseEther("5")],
      })
    );
  });

  it("outputs JSON on success when --json flag passed", async () => {
    const { cmdTokenApprove } = await import("../commands/token.js");
    await cmdTokenApprove(["10", "--json"]);

    const logged = (console.log as Mock).mock.calls.map(c => c[0]).join("");
    const parsed = JSON.parse(logged);
    expect(parsed.success).toBe(true);
    expect(parsed.hash).toBe(MOCK_TX_HASH);
    expect(String(parsed.amount)).toMatch(/^10/);
    expect(parsed.spender).toBe(MOCK_REGISTRY);
  });

  it("exits on reverted transaction", async () => {
    mockWaitForReceipt.mockResolvedValue({ status: "reverted", blockNumber: 99n });

    const { cmdTokenApprove } = await import("../commands/token.js");
    // error() mock throws before process.exit
    await expect(cmdTokenApprove(["1"])).rejects.toThrow();
  });

  it("exits when token or registry address not configured", async () => {
    const { ADDRESSES } = await import("../config.js");
    const origToken = (ADDRESSES as Record<string, Record<string, string>>).testnet.token;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = "";

    const { cmdTokenApprove } = await import("../commands/token.js");
    await expect(cmdTokenApprove(["1"])).rejects.toThrow();

    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = origToken;
  });

  it("shows success message after confirmed tx in human mode", async () => {
    const { cmdTokenApprove } = await import("../commands/token.js");
    await cmdTokenApprove(["2"]);

    const { success } = await import("../config.js");
    expect(success).toHaveBeenCalledWith(expect.stringContaining("2 INKD"));
  });

  it("waits for transaction receipt", async () => {
    const { cmdTokenApprove } = await import("../commands/token.js");
    await cmdTokenApprove(["1"]);

    expect(mockWaitForReceipt).toHaveBeenCalledWith({ hash: MOCK_TX_HASH });
  });
});

// ─── cmdTokenTransfer ─────────────────────────────────────────────────────────

describe("cmdTokenTransfer", () => {
  beforeEach(() => {
    mockWriteContract.mockResolvedValue(MOCK_TX_HASH);
    mockWaitForReceipt.mockResolvedValue({ status: "success", blockNumber: 200n });
  });

  it("exits when to and amount are missing", async () => {
    const { cmdTokenTransfer } = await import("../commands/token.js");
    // error() mock throws before process.exit
    await expect(cmdTokenTransfer([])).rejects.toThrow();
  });

  it("exits when amount is missing (only to given)", async () => {
    const { cmdTokenTransfer } = await import("../commands/token.js");
    await expect(cmdTokenTransfer([MOCK_RECIPIENT])).rejects.toThrow();
  });

  it("exits when transferring to self", async () => {
    // MOCK_OWNER is same as the mocked account.address — warn + process.exit
    const { cmdTokenTransfer } = await import("../commands/token.js");
    await expect(cmdTokenTransfer([MOCK_OWNER, "1"])).rejects.toThrow("process.exit");
  });

  it("sends transfer tx with correct to and amount", async () => {
    const { cmdTokenTransfer } = await import("../commands/token.js");
    await cmdTokenTransfer([MOCK_RECIPIENT, "3"]);

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "transfer",
        args: [MOCK_RECIPIENT, parseEther("3")],
      })
    );
  });

  it("outputs JSON on success when --json flag passed", async () => {
    const { cmdTokenTransfer } = await import("../commands/token.js");
    await cmdTokenTransfer([MOCK_RECIPIENT, "5", "--json"]);

    const logged = (console.log as Mock).mock.calls.map(c => c[0]).join("");
    const parsed = JSON.parse(logged);
    expect(parsed.success).toBe(true);
    expect(parsed.to).toBe(MOCK_RECIPIENT);
    expect(String(parsed.amount)).toMatch(/^5/);
    expect(parsed.from).toBe(MOCK_OWNER);
  });

  it("exits on reverted transaction", async () => {
    mockWaitForReceipt.mockResolvedValue({ status: "reverted", blockNumber: 99n });

    const { cmdTokenTransfer } = await import("../commands/token.js");
    // error() mock throws before process.exit
    await expect(cmdTokenTransfer([MOCK_RECIPIENT, "1"])).rejects.toThrow();
  });

  it("exits when token address not configured", async () => {
    const { ADDRESSES } = await import("../config.js");
    const origToken = (ADDRESSES as Record<string, Record<string, string>>).testnet.token;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = "";

    const { cmdTokenTransfer } = await import("../commands/token.js");
    await expect(cmdTokenTransfer([MOCK_RECIPIENT, "1"])).rejects.toThrow();

    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = origToken;
  });

  it("shows success message after confirmed tx in human mode", async () => {
    const { cmdTokenTransfer } = await import("../commands/token.js");
    await cmdTokenTransfer([MOCK_RECIPIENT, "7"]);

    const { success } = await import("../config.js");
    expect(success).toHaveBeenCalledWith(expect.stringContaining("7 INKD"));
  });

  it("exits on invalid to-address", async () => {
    const { cmdTokenTransfer } = await import("../commands/token.js");
    // error() mock throws before process.exit
    await expect(cmdTokenTransfer(["notanaddress", "1"])).rejects.toThrow();
  });
});

// ─── cmdTokenInfo ─────────────────────────────────────────────────────────────

describe("cmdTokenInfo", () => {
  beforeEach(() => {
    mockReadContract
      .mockResolvedValueOnce("Inkd Protocol")   // name
      .mockResolvedValueOnce("INKD")            // symbol
      .mockResolvedValueOnce(18)                // decimals
      .mockResolvedValueOnce(parseEther("100000000")); // totalSupply
  });

  it("reads name, symbol, decimals, and totalSupply in parallel", async () => {
    const { cmdTokenInfo } = await import("../commands/token.js");
    await cmdTokenInfo([]);

    expect(mockReadContract).toHaveBeenCalledTimes(4);
    expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "name" }));
    expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "symbol" }));
    expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "decimals" }));
    expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "totalSupply" }));
  });

  it("outputs JSON when --json flag is passed", async () => {
    const { cmdTokenInfo } = await import("../commands/token.js");
    await cmdTokenInfo(["--json"]);

    const logged = (console.log as Mock).mock.calls.map(c => c[0]).join("");
    const parsed = JSON.parse(logged);
    expect(parsed.name).toBe("Inkd Protocol");
    expect(parsed.symbol).toBe("INKD");
    expect(parsed.decimals).toBe(18);
    expect(String(parsed.totalSupply)).toMatch(/^100000000/);
    expect(parsed.address).toBe(MOCK_TOKEN);
    expect(parsed.network).toBe("testnet");
  });

  it("displays metadata in human-readable table output", async () => {
    const { cmdTokenInfo } = await import("../commands/token.js");
    // Snapshot info calls before and count new ones
    const { info } = await import("../config.js");
    const before = (info as Mock).mock.calls.length;
    await cmdTokenInfo([]);
    const newCalls = (info as Mock).mock.calls.slice(before).flat().join(" ");
    expect(newCalls).toContain("Inkd Protocol");
    expect(newCalls).toContain("INKD");
    expect(newCalls).toContain("18");
    expect(newCalls).toMatch(/100000000/);
  });

  it("exits when token address not configured", async () => {
    const { ADDRESSES } = await import("../config.js");
    const origToken = (ADDRESSES as Record<string, Record<string, string>>).testnet.token;
    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = "";

    const { cmdTokenInfo } = await import("../commands/token.js");
    await expect(cmdTokenInfo([])).rejects.toThrow("process.exit");

    (ADDRESSES as Record<string, Record<string, string>>).testnet.token = origToken;
  });

  it("shows contract address in human output", async () => {
    const { cmdTokenInfo } = await import("../commands/token.js");
    await cmdTokenInfo([]);

    const { info } = await import("../config.js");
    const infoCalls = (info as Mock).mock.calls.flat().join(" ");
    expect(infoCalls).toContain(MOCK_TOKEN);
  });
});

// ─── cmdToken (router) ────────────────────────────────────────────────────────

describe("cmdToken router", () => {
  it("routes 'balance' to cmdTokenBalance", async () => {
    mockReadContract.mockResolvedValue(parseEther("0"));
    mockGetBalance.mockResolvedValue(parseEther("0"));

    const { cmdToken } = await import("../commands/token.js");
    await expect(cmdToken(["balance"])).resolves.toBeUndefined();
  });

  it("routes 'allowance' to cmdTokenAllowance", async () => {
    mockReadContract.mockResolvedValue(parseEther("0"));

    const { cmdToken } = await import("../commands/token.js");
    await expect(cmdToken(["allowance"])).resolves.toBeUndefined();
  });

  it("routes 'approve' → rejects on missing amount (proves routing works)", async () => {
    const { cmdToken } = await import("../commands/token.js");
    // error() mock throws before process.exit; just assert it rejects
    await expect(cmdToken(["approve"])).rejects.toThrow();
  });

  it("routes 'transfer' → rejects on missing args (proves routing works)", async () => {
    const { cmdToken } = await import("../commands/token.js");
    await expect(cmdToken(["transfer"])).rejects.toThrow();
  });

  it("routes 'info' to cmdTokenInfo", async () => {
    mockReadContract
      .mockResolvedValueOnce("Inkd Protocol")
      .mockResolvedValueOnce("INKD")
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(parseEther("1000000"));

    const { cmdToken } = await import("../commands/token.js");
    await expect(cmdToken(["info"])).resolves.toBeUndefined();
  });

  it("exits with unknown sub-command", async () => {
    const { cmdToken } = await import("../commands/token.js");
    await expect(cmdToken(["unknown-sub"])).rejects.toThrow("process.exit");
  });

  it("exits with no sub-command", async () => {
    const { cmdToken } = await import("../commands/token.js");
    await expect(cmdToken([])).rejects.toThrow("process.exit");
  });
});
