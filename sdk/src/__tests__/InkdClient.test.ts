import { describe, it, expect, vi, beforeEach } from "vitest";
import { InkdClient } from "../InkdClient";
import { ClientNotConnected, ArweaveNotConnected } from "../errors";
import type { InkdClientConfig } from "../types";

// ─── Test Config ──────────────────────────────────────────────────────────────

const TEST_CONFIG: InkdClientConfig = {
  tokenAddress: "0x1111111111111111111111111111111111111111",
  vaultAddress: "0x2222222222222222222222222222222222222222",
  registryAddress: "0x3333333333333333333333333333333333333333",
  chainId: 84532,
};

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeMockPublicClient(overrides: Record<string, unknown> = {}) {
  return {
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n }),
    ...overrides,
  };
}

function makeMockWalletClient(overrides: Record<string, unknown> = {}) {
  return {
    writeContract: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    account: { address: "0xuser" as `0x${string}` },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InkdClient — construction", () => {
  it("creates a client with the given config", () => {
    const client = new InkdClient(TEST_CONFIG);
    expect(client).toBeInstanceOf(InkdClient);
  });
});

describe("InkdClient — connection guards", () => {
  let client: InkdClient;

  beforeEach(() => {
    client = new InkdClient(TEST_CONFIG);
  });

  it("throws ClientNotConnected when mintToken called before connect()", async () => {
    await expect(client.mintToken()).rejects.toThrow("not connected");
    await expect(client.mintToken()).rejects.toMatchObject({
      code: "CLIENT_NOT_CONNECTED",
    });
  });

  it("throws ClientNotConnected when getToken called without publicClient", async () => {
    await expect(client.getToken(1n)).rejects.toThrow("not connected");
  });

  it("throws ClientNotConnected when hasInkdToken called without publicClient", async () => {
    await expect(
      client.hasInkdToken("0x0000000000000000000000000000000000000001")
    ).rejects.toThrow("not connected");
  });

  it("throws ClientNotConnected when getStats called without publicClient", async () => {
    await expect(client.getStats()).rejects.toThrow("not connected");
  });

  it("throws ArweaveNotConnected when inscribe called without connectArweave()", async () => {
    const publicClient = makeMockPublicClient();
    const walletClient = makeMockWalletClient();
    // @ts-expect-error — mock clients lack full viem types
    client.connect(walletClient, publicClient);

    await expect(client.inscribe(1n, Buffer.from("data"))).rejects.toThrow("Arweave client is not connected");
    await expect(client.inscribe(1n, Buffer.from("data"))).rejects.toMatchObject({
      code: "ARWEAVE_NOT_CONNECTED",
    });
  });
});

describe("InkdClient — connect()", () => {
  it("accepts wallet + public clients and no longer throws on guarded calls", async () => {
    const client = new InkdClient(TEST_CONFIG);

    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(true),
    });
    const walletClient = makeMockWalletClient();

    // @ts-expect-error — mock clients lack full viem types
    client.connect(walletClient, publicClient);

    // Should NOT throw ClientNotConnected anymore
    await expect(
      client.hasInkdToken("0x0000000000000000000000000000000000000001")
    ).resolves.toBe(true);
  });
});

describe("InkdClient — mintToken()", () => {
  it("calls readContract for mintPrice then writeContract", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const MINT_PRICE = 10_000_000_000_000_000n; // 0.01 ETH

    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(MINT_PRICE),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [{ topics: ["0xTransfer", "0x0", "0xuser", "0x1"] }],
      }),
    });
    const walletClient = makeMockWalletClient();

    // @ts-expect-error — mock clients lack full viem types
    client.connect(walletClient, publicClient);

    const result = await client.mintToken();

    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.tokenAddress,
        functionName: "mintPrice",
      })
    );
    expect(walletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.tokenAddress,
        functionName: "mint",
        value: MINT_PRICE,
      })
    );
    expect(result.hash).toBe("0xdeadbeef");
    expect(result.tokenId).toBe(1n);
  });

  it("extracts tokenId from Transfer log topics", async () => {
    const client = new InkdClient(TEST_CONFIG);

    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [
          // Non-matching log (too few topics)
          { topics: ["0xSomeOtherEvent"] },
          // Transfer log: from, to, tokenId
          { topics: ["0xTransfer", "0x0", "0xuser", "0x2a"] }, // 42 in hex
        ],
      }),
    });
    const walletClient = makeMockWalletClient();

    // @ts-expect-error — mock
    client.connect(walletClient, publicClient);

    const result = await client.mintToken();
    expect(result.tokenId).toBe(42n);
  });

  it("returns tokenId as undefined when no matching logs", async () => {
    const client = new InkdClient(TEST_CONFIG);

    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [{ topics: ["0xOnlyOneTopic"] }],
      }),
    });
    const walletClient = makeMockWalletClient();

    // @ts-expect-error — mock
    client.connect(walletClient, publicClient);

    const result = await client.mintToken();
    expect(result.tokenId).toBeUndefined();
  });

  it("extractTokenIdFromLogs: skips log with invalid topic[3] (catch branch), falls back to next valid log", async () => {
    // First log has an unparseable topic[3] → BigInt throws → catch fires → continue
    // Second log has a valid topic[3] = 0xff → tokenId = 255n
    const client = new InkdClient(TEST_CONFIG);
    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [
          { topics: ["0xTransfer", "0x0", "0xuser", "not-a-bigint"] }, // ← triggers catch
          { topics: ["0xTransfer", "0x0", "0xuser", "0xff"] },          // ← valid: 255n
        ],
      }),
    });
    const walletClient = makeMockWalletClient();
    // @ts-expect-error — mock
    client.connect(walletClient, publicClient);
    const result = await client.mintToken();
    expect(result.tokenId).toBe(255n);
  });
});

describe("InkdClient — getToken()", () => {
  it("reads owner, mintedAt, inscriptionCount, tokenURI in parallel", async () => {
    const client = new InkdClient(TEST_CONFIG);

    const OWNER = "0xowner" as `0x${string}`;
    const MINTED_AT = 1_700_000_000n;
    const INSC_COUNT = 3n;
    const TOKEN_URI = "data:application/json,{}";

    let callCount = 0;
    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockImplementation(() => {
        callCount++;
        const results = [OWNER, MINTED_AT, INSC_COUNT, TOKEN_URI];
        return Promise.resolve(results[(callCount - 1) % 4]);
      }),
    });

    // @ts-expect-error — mock
    client.connect(makeMockWalletClient(), publicClient);

    const data = await client.getToken(1n);

    expect(data.tokenId).toBe(1n);
    expect(data.owner).toBe(OWNER);
    expect(data.mintedAt).toBe(MINTED_AT);
    expect(data.inscriptionCount).toBe(3);
    expect(data.tokenURI).toBe(TOKEN_URI);
    expect(publicClient.readContract).toHaveBeenCalledTimes(4);
  });
});

describe("InkdClient — hasInkdToken()", () => {
  it("returns true when the contract returns true", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(true),
    });
    // @ts-expect-error — mock
    client.connect(makeMockWalletClient(), publicClient);

    const result = await client.hasInkdToken(
      "0x0000000000000000000000000000000000000001"
    );
    expect(result).toBe(true);
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "isInkdHolder" })
    );
  });

  it("returns false when the contract returns false", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(false),
    });
    // @ts-expect-error — mock
    client.connect(makeMockWalletClient(), publicClient);

    const result = await client.hasInkdToken(
      "0x0000000000000000000000000000000000000002"
    );
    expect(result).toBe(false);
  });
});

describe("InkdClient — getStats()", () => {
  it("maps tuple response to ProtocolStats object", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue([500n, 12_000n, 9_000_000_000_000_000_000n, 300n]),
    });
    // @ts-expect-error — mock
    client.connect(makeMockWalletClient(), publicClient);

    const stats = await client.getStats();
    expect(stats.totalTokens).toBe(500n);
    expect(stats.totalInscriptions).toBe(12_000n);
    expect(stats.totalVolume).toBe(9_000_000_000_000_000_000n);
    expect(stats.totalSales).toBe(300n);
  });
});

describe("InkdClient — estimateInscribeCost()", () => {
  it("returns non-zero estimates for a 10KB file", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(50n), // 0.5% fee
    });
    // @ts-expect-error — mock
    client.connect(makeMockWalletClient(), publicClient);

    const estimate = await client.estimateInscribeCost(10_240);
    expect(estimate.gas).toBeGreaterThan(0n);
    expect(estimate.arweave).toBeGreaterThan(0n);
    expect(estimate.protocolFee).toBeGreaterThan(0n);
    expect(estimate.total).toBe(estimate.gas + estimate.arweave + estimate.protocolFee);
  });

  it("arweave cost scales with file size", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(0n),
    });
    // @ts-expect-error — mock
    client.connect(makeMockWalletClient(), publicClient);

    const small = await client.estimateInscribeCost(1_024);   // 1 KB
    const large = await client.estimateInscribeCost(102_400); // 100 KB

    expect(large.arweave).toBeGreaterThan(small.arweave);
  });
});

describe("InkdClient — setEncryptionProvider()", () => {
  it("accepts a custom encryption provider without throwing", () => {
    const client = new InkdClient(TEST_CONFIG);
    const mockProvider = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    };
    expect(() => client.setEncryptionProvider(mockProvider)).not.toThrow();
  });
});
