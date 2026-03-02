/**
 * @file client.test.ts
 * Unit tests for the CLI viem client factory (client.ts).
 * Validates that correct chain / transport objects are wired up without
 * making real RPC calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A minimal config that matches InkdConfig shape */
function makeConfig(
  network: "mainnet" | "testnet" = "testnet",
  rpcUrl?: string,
  privateKey?: `0x${string}`
) {
  return {
    network,
    rpcUrl,
    privateKey,
  };
}

// Real private key from viem docs (safe test key — never holds funds)
const TEST_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

// ─── buildPublicClient ────────────────────────────────────────────────────────

describe("buildPublicClient", () => {
  it("returns an object with readContract method", async () => {
    const { buildPublicClient } = await import("../client.js");
    const client = buildPublicClient(makeConfig("testnet"));
    expect(typeof client.readContract).toBe("function");
  });

  it("returns an object with getBalance method", async () => {
    const { buildPublicClient } = await import("../client.js");
    const client = buildPublicClient(makeConfig("testnet"));
    expect(typeof client.getBalance).toBe("function");
  });

  it("works for mainnet config", async () => {
    const { buildPublicClient } = await import("../client.js");
    const client = buildPublicClient(makeConfig("mainnet"));
    expect(typeof client.readContract).toBe("function");
  });

  it("accepts a custom rpcUrl", async () => {
    const { buildPublicClient } = await import("../client.js");
    const client = buildPublicClient(
      makeConfig("testnet", "https://base-sepolia.example.com")
    );
    expect(client).toBeTruthy();
  });
});

// ─── buildWalletClient ────────────────────────────────────────────────────────

describe("buildWalletClient", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = { INKD_PRIVATE_KEY: process.env.INKD_PRIVATE_KEY };
    process.env.INKD_PRIVATE_KEY = TEST_PK;
  });

  afterEach(() => {
    process.env.INKD_PRIVATE_KEY = savedEnv.INKD_PRIVATE_KEY;
    vi.restoreAllMocks();
  });

  it("returns an object with writeContract method", async () => {
    const { buildWalletClient } = await import("../client.js");
    const cfg = makeConfig("testnet", undefined, TEST_PK);
    const client = buildWalletClient(cfg);
    expect(typeof client.writeContract).toBe("function");
  });

  it("works for mainnet config", async () => {
    const { buildWalletClient } = await import("../client.js");
    const cfg = makeConfig("mainnet", undefined, TEST_PK);
    const client = buildWalletClient(cfg);
    expect(client).toBeTruthy();
  });

  it("accepts a pre-built account object", async () => {
    const { buildWalletClient, privateKeyToAccount } = await import(
      "../client.js"
    );
    const account = privateKeyToAccount(TEST_PK);
    const cfg = makeConfig("testnet");
    const client = buildWalletClient(cfg, account);
    expect(client).toBeTruthy();
  });
});

// ─── buildClients ─────────────────────────────────────────────────────────────

describe("buildClients", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = { INKD_PRIVATE_KEY: process.env.INKD_PRIVATE_KEY };
    process.env.INKD_PRIVATE_KEY = TEST_PK;
  });

  afterEach(() => {
    process.env.INKD_PRIVATE_KEY = savedEnv.INKD_PRIVATE_KEY;
    vi.restoreAllMocks();
  });

  it("returns publicClient, walletClient, account, and addrs", async () => {
    const { buildClients } = await import("../client.js");
    const result = buildClients(makeConfig("testnet", undefined, TEST_PK));

    expect(result).toHaveProperty("publicClient");
    expect(result).toHaveProperty("walletClient");
    expect(result).toHaveProperty("account");
    expect(result).toHaveProperty("addrs");
  });

  it("account has correct address derived from private key", async () => {
    const { buildClients, privateKeyToAccount } = await import("../client.js");
    const expected = privateKeyToAccount(TEST_PK);
    const { account } = buildClients(makeConfig("testnet", undefined, TEST_PK));
    expect(account.address.toLowerCase()).toBe(
      expected.address.toLowerCase()
    );
  });

  it("addrs matches ADDRESSES for the given network (testnet)", async () => {
    const { buildClients } = await import("../client.js");
    const { ADDRESSES } = await import("../config.js");
    const { addrs } = buildClients(makeConfig("testnet", undefined, TEST_PK));
    expect(addrs).toEqual(ADDRESSES.testnet);
  });

  it("addrs matches ADDRESSES for the given network (mainnet)", async () => {
    const { buildClients } = await import("../client.js");
    const { ADDRESSES } = await import("../config.js");
    const { addrs } = buildClients(makeConfig("mainnet", undefined, TEST_PK));
    expect(addrs).toEqual(ADDRESSES.mainnet);
  });
});

// ─── privateKeyToAccount re-export ────────────────────────────────────────────

describe("privateKeyToAccount (re-export)", () => {
  it("derives a checksummed Ethereum address", async () => {
    const { privateKeyToAccount } = await import("../client.js");
    const account = privateKeyToAccount(TEST_PK);
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("is deterministic for the same key", async () => {
    const { privateKeyToAccount } = await import("../client.js");
    const a1 = privateKeyToAccount(TEST_PK);
    const a2 = privateKeyToAccount(TEST_PK);
    expect(a1.address).toBe(a2.address);
  });
});
