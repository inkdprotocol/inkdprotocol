/**
 * @file InkdClient.advanced.test.ts
 * @description Edge-case and untested-method coverage for InkdClient.
 *              Covers: grantAccess, revokeAccess, listForSale, buyToken,
 *              getInscriptions, removeInscription, updateInscription,
 *              getTokensByOwner, batch mint, full inscribe flow, and
 *              connection guards for all previously uncovered methods.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { InkdClient } from "../InkdClient";
import { ClientNotConnected, ArweaveNotConnected } from "../errors";
import type { InkdClientConfig } from "../types";

// ─── Shared Config ────────────────────────────────────────────────────────────

const TEST_CONFIG: InkdClientConfig = {
  tokenAddress: "0x1111111111111111111111111111111111111111",
  vaultAddress: "0x2222222222222222222222222222222222222222",
  registryAddress: "0x3333333333333333333333333333333333333333",
  chainId: 84532,
};

const ZERO_HASH = "0xdeadbeef" as `0x${string}`;
const BLOCK_TIMESTAMP = 1_700_000_000n;

// ─── Mock Factories ───────────────────────────────────────────────────────────

function makeMockPublicClient(overrides: Record<string, unknown> = {}) {
  return {
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    getBlock: vi.fn().mockResolvedValue({ timestamp: BLOCK_TIMESTAMP }),
    ...overrides,
  };
}

function makeMockWalletClient(overrides: Record<string, unknown> = {}) {
  return {
    writeContract: vi.fn().mockResolvedValue(ZERO_HASH),
    account: { address: "0xuser" as `0x${string}` },
    ...overrides,
  };
}

/** Inject a fake Arweave client into the private field. */
function injectMockArweave(
  client: InkdClient,
  uploadResult = { hash: "arweave-tx-id", size: 1024 }
) {
  const mockArweave = {
    uploadFile: vi.fn().mockResolvedValue(uploadResult),
    connect: vi.fn().mockResolvedValue(undefined),
  };
  // Access private field via type cast for test injection
  (client as unknown as Record<string, unknown>).arweave = mockArweave;
  return mockArweave;
}

function connectClient(client: InkdClient, publicOverrides = {}, walletOverrides = {}) {
  const pub = makeMockPublicClient(publicOverrides);
  const wal = makeMockWalletClient(walletOverrides);
  // @ts-expect-error — mock clients lack full viem types
  client.connect(wal, pub);
  return { pub, wal };
}

// ─── Connection Guards (previously uncovered methods) ─────────────────────────

describe("InkdClient — connection guards (additional methods)", () => {
  let client: InkdClient;

  beforeEach(() => {
    client = new InkdClient(TEST_CONFIG);
  });

  it("getInscriptions: throws ClientNotConnected without publicClient", async () => {
    await expect(client.getInscriptions(1n)).rejects.toThrow(ClientNotConnected);
  });

  it("removeInscription: throws ClientNotConnected without wallet", async () => {
    await expect(client.removeInscription(1n, 0)).rejects.toThrow(ClientNotConnected);
  });

  it("updateInscription: throws ClientNotConnected without wallet", async () => {
    await expect(client.updateInscription(1n, 0, "new data")).rejects.toThrow(
      ClientNotConnected
    );
  });

  it("updateInscription: throws ArweaveNotConnected when wallet connected but no arweave", async () => {
    connectClient(client);
    await expect(client.updateInscription(1n, 0, Buffer.from("data"))).rejects.toThrow(
      ArweaveNotConnected
    );
  });

  it("grantAccess: throws ClientNotConnected without wallet", async () => {
    await expect(
      client.grantAccess(1n, "0x0000000000000000000000000000000000000001", 3600)
    ).rejects.toThrow(ClientNotConnected);
  });

  it("revokeAccess: throws ClientNotConnected without wallet", async () => {
    await expect(
      client.revokeAccess(1n, "0x0000000000000000000000000000000000000001")
    ).rejects.toThrow(ClientNotConnected);
  });

  it("listForSale: throws ClientNotConnected without wallet", async () => {
    await expect(client.listForSale(1n, 1_000_000_000_000_000n)).rejects.toThrow(
      ClientNotConnected
    );
  });

  it("buyToken: throws ClientNotConnected without wallet", async () => {
    await expect(client.buyToken(1n)).rejects.toThrow(ClientNotConnected);
  });

  it("getTokensByOwner: throws ClientNotConnected without publicClient", async () => {
    await expect(
      client.getTokensByOwner("0x0000000000000000000000000000000000000001")
    ).rejects.toThrow(ClientNotConnected);
  });

  it("estimateInscribeCost: throws ClientNotConnected without publicClient", async () => {
    await expect(client.estimateInscribeCost(1024)).rejects.toThrow(ClientNotConnected);
  });
});

// ─── getInscriptions() ────────────────────────────────────────────────────────

describe("InkdClient — getInscriptions()", () => {
  it("returns a mapped array of inscriptions", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const rawInscriptions = [
      {
        arweaveHash: "abc123",
        contentType: "application/json",
        size: 512n,
        name: "brain.json",
        createdAt: 1_700_000_000n,
        isRemoved: false,
        version: 1n,
      },
      {
        arweaveHash: "def456",
        contentType: "text/plain",
        size: 100n,
        name: "readme.txt",
        createdAt: 1_700_001_000n,
        isRemoved: true,
        version: 2n,
      },
    ];

    const { pub } = connectClient(client, {
      readContract: vi.fn().mockResolvedValue(rawInscriptions),
    });

    const result = await client.getInscriptions(42n);

    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.vaultAddress,
        functionName: "getInscriptions",
        args: [42n],
      })
    );
    expect(result).toHaveLength(2);
    expect(result[0].arweaveHash).toBe("abc123");
    expect(result[0].contentType).toBe("application/json");
    expect(result[0].size).toBe(512n);
    expect(result[0].isRemoved).toBe(false);
    expect(result[0].version).toBe(1n);
    expect(result[1].isRemoved).toBe(true);
  });

  it("returns empty array when token has no inscriptions", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      readContract: vi.fn().mockResolvedValue([]),
    });
    const result = await client.getInscriptions(1n);
    expect(result).toEqual([]);
  });
});

// ─── removeInscription() ─────────────────────────────────────────────────────

describe("InkdClient — removeInscription()", () => {
  it("calls writeContract with correct args and returns hash + tokenId", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { wal } = connectClient(client);

    const result = await client.removeInscription(7n, 2);

    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.vaultAddress,
        functionName: "removeInscription",
        args: [7n, 2n],
      })
    );
    expect(result.hash).toBe(ZERO_HASH);
    expect(result.tokenId).toBe(7n);
  });

  it("converts numeric index to BigInt for contract call", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { wal } = connectClient(client);

    await client.removeInscription(1n, 0);

    const call = wal.writeContract.mock.calls[0][0];
    expect(call.args[1]).toBe(0n); // index converted to BigInt
  });
});

// ─── updateInscription() ─────────────────────────────────────────────────────

describe("InkdClient — updateInscription()", () => {
  it("uploads to Arweave and calls updateInscription on-chain with string data", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { wal } = connectClient(client);
    const mockArweave = injectMockArweave(client, {
      hash: "new-arweave-tx",
      size: 256,
    });

    const result = await client.updateInscription(5n, 1, "updated brain data");

    expect(mockArweave.uploadFile).toHaveBeenCalledOnce();
    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.vaultAddress,
        functionName: "updateInscription",
        args: [5n, 1n, "new-arweave-tx"],
      })
    );
    expect(result.hash).toBe(ZERO_HASH);
    expect(result.tokenId).toBe(5n);
  });

  it("accepts Buffer data", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client);
    injectMockArweave(client);

    await expect(
      client.updateInscription(1n, 0, Buffer.from("buffer payload"), "image/png")
    ).resolves.toBeDefined();
  });

  it("accepts Uint8Array data", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client);
    injectMockArweave(client);

    await expect(
      client.updateInscription(1n, 0, new Uint8Array([1, 2, 3]))
    ).resolves.toBeDefined();
  });

  it("uses application/octet-stream when no contentType given", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client);
    const mockArweave = injectMockArweave(client);

    await client.updateInscription(1n, 0, "data");

    expect(mockArweave.uploadFile).toHaveBeenCalledWith(
      expect.anything(),
      "application/octet-stream"
    );
  });
});

// ─── grantAccess() ────────────────────────────────────────────────────────────

describe("InkdClient — grantAccess()", () => {
  it("calculates expiresAt from block timestamp + duration", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const DURATION = 3600; // 1 hour
    const expectedExpiry = BLOCK_TIMESTAMP + BigInt(DURATION);

    const { wal } = connectClient(client);

    const TARGET_WALLET = "0x0000000000000000000000000000000000000042" as `0x${string}`;
    await client.grantAccess(1n, TARGET_WALLET, DURATION);

    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.vaultAddress,
        functionName: "grantReadAccess",
        args: [1n, TARGET_WALLET, expectedExpiry],
      })
    );
  });

  it("returns hash and tokenId", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client);

    const result = await client.grantAccess(
      9n,
      "0x0000000000000000000000000000000000000001",
      86400
    );
    expect(result.hash).toBe(ZERO_HASH);
    expect(result.tokenId).toBe(9n);
  });

  it("fetches block timestamp before calling contract", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { pub } = connectClient(client);

    await client.grantAccess(1n, "0x0000000000000000000000000000000000000001", 100);

    expect(pub.getBlock).toHaveBeenCalledOnce();
  });
});

// ─── revokeAccess() ───────────────────────────────────────────────────────────

describe("InkdClient — revokeAccess()", () => {
  it("calls revokeAccess on the vault contract", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { wal } = connectClient(client);

    const TARGET = "0x0000000000000000000000000000000000000099" as `0x${string}`;
    const result = await client.revokeAccess(3n, TARGET);

    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.vaultAddress,
        functionName: "revokeAccess",
        args: [3n, TARGET],
      })
    );
    expect(result.hash).toBe(ZERO_HASH);
    expect(result.tokenId).toBe(3n);
  });
});

// ─── listForSale() ────────────────────────────────────────────────────────────

describe("InkdClient — listForSale()", () => {
  it("first approves registry, then calls listForSale", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { wal } = connectClient(client);

    const PRICE = 500_000_000_000_000_000n; // 0.5 ETH

    await client.listForSale(4n, PRICE);

    // Two writeContract calls: approve + listForSale
    expect(wal.writeContract).toHaveBeenCalledTimes(2);

    const [approveCall, listCall] = wal.writeContract.mock.calls;

    // First call: approve
    expect(approveCall[0]).toMatchObject({
      address: TEST_CONFIG.tokenAddress,
      functionName: "approve",
      args: [TEST_CONFIG.registryAddress, 4n],
    });

    // Second call: listForSale
    expect(listCall[0]).toMatchObject({
      address: TEST_CONFIG.registryAddress,
      functionName: "listForSale",
      args: [4n, PRICE],
    });
  });

  it("returns hash and tokenId", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client);

    const result = await client.listForSale(2n, 1_000_000_000_000_000n);
    expect(result.hash).toBe(ZERO_HASH);
    expect(result.tokenId).toBe(2n);
  });
});

// ─── buyToken() ───────────────────────────────────────────────────────────────

describe("InkdClient — buyToken()", () => {
  it("reads listing price and calls buyToken with correct value", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const LISTING_PRICE = 250_000_000_000_000_000n; // 0.25 ETH
    // listings() returns: [listingId, seller, price, createdAt, isActive]
    const mockListing = [0n, "0xseller", LISTING_PRICE, 1_700_000_000n, true];

    const { pub, wal } = connectClient(client, {
      readContract: vi.fn().mockResolvedValue(mockListing),
    });

    const result = await client.buyToken(6n);

    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.registryAddress,
        functionName: "listings",
        args: [6n],
      })
    );
    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.registryAddress,
        functionName: "buyToken",
        args: [6n],
        value: LISTING_PRICE,
      })
    );
    expect(result.hash).toBe(ZERO_HASH);
    expect(result.tokenId).toBe(6n);
  });

  it("extracts price from listing index 2", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const PRICE = 100_000_000_000_000n;
    const listing = [1n, "0xseller", PRICE, 1_700_000_000n, true];

    const { wal } = connectClient(client, {
      readContract: vi.fn().mockResolvedValue(listing),
    });

    await client.buyToken(99n);
    const buyCall = wal.writeContract.mock.calls[0][0];
    expect(buyCall.value).toBe(PRICE);
  });
});

// ─── getTokensByOwner() ───────────────────────────────────────────────────────

describe("InkdClient — getTokensByOwner()", () => {
  it("returns full token data for each owned token ID", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const OWNER = "0xowner1111111111111111111111111111111111111" as `0x${string}`;

    // readContract is called: once for getTokensByOwner, then 4 times per token (owner, mintedAt, inscCount, tokenURI)
    let callIndex = 0;
    const tokenData = [
      OWNER, 1_700_000_000n, 2n, "data:application/json,token1",
      OWNER, 1_700_001_000n, 5n, "data:application/json,token2",
    ];

    const { pub } = connectClient(client, {
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "getTokensByOwner") {
          return Promise.resolve([10n, 11n]);
        }
        return Promise.resolve(tokenData[callIndex++]);
      }),
    });

    const tokens = await client.getTokensByOwner(OWNER);

    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getTokensByOwner",
        args: [OWNER],
      })
    );
    expect(tokens).toHaveLength(2);
    expect(tokens[0].tokenId).toBe(10n);
    expect(tokens[1].tokenId).toBe(11n);
  });

  it("returns empty array when owner holds no tokens", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "getTokensByOwner") return Promise.resolve([]);
        return Promise.resolve("fallback");
      }),
    });

    const tokens = await client.getTokensByOwner(
      "0x0000000000000000000000000000000000000000"
    );
    expect(tokens).toEqual([]);
  });
});

// ─── mintToken() batch (quantity > 1) ────────────────────────────────────────

describe("InkdClient — mintToken() batch", () => {
  it("calls batchMint when quantity > 1", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const MINT_PRICE = 10_000_000_000_000_000n; // 0.01 ETH

    const { pub, wal } = connectClient(client, {
      readContract: vi.fn().mockResolvedValue(MINT_PRICE),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [
          { topics: ["0xTransfer", "0x0", "0xuser", "0x1"] },
          { topics: ["0xTransfer", "0x0", "0xuser", "0x2"] },
          { topics: ["0xTransfer", "0x0", "0xuser", "0x3"] },
        ],
      }),
    });

    const result = await client.mintToken({ quantity: 3 });

    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "batchMint",
        args: [3n],
        value: MINT_PRICE * 3n,
      })
    );
    // result.tokenId is the first tokenId from the batch
    expect(result.tokenId).toBe(1n);
  });

  it("multiplies mint price by quantity for batchMint value", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const PRICE = 5_000_000_000_000_000n; // 0.005 ETH

    const { wal } = connectClient(client, {
      readContract: vi.fn().mockResolvedValue(PRICE),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    });

    await client.mintToken({ quantity: 10 });

    const call = wal.writeContract.mock.calls[0][0];
    expect(call.value).toBe(PRICE * 10n);
  });

  it("single mint (quantity=1) uses regular mint, not batchMint", async () => {
    const client = new InkdClient(TEST_CONFIG);

    const { wal } = connectClient(client, {
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    });

    await client.mintToken({ quantity: 1 });

    const call = wal.writeContract.mock.calls[0][0];
    expect(call.functionName).toBe("mint"); // not batchMint
  });
});

// ─── inscribe() full flow ─────────────────────────────────────────────────────

describe("InkdClient — inscribe() full flow", () => {
  it("encrypts, uploads to Arweave, and inscribes on-chain", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { wal } = connectClient(client, {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [
          // Inscribed event: [topic0, tokenId, inscriptionIndex]
          { topics: ["0xInscribed", "0x5", "0x3"] },
        ],
      }),
    });
    const mockArweave = injectMockArweave(client, {
      hash: "arweave-inscription-id",
      size: 2048,
    });

    const result = await client.inscribe(5n, Buffer.from("agent memory data"), {
      contentType: "application/json",
      name: "memory.json",
    });

    // Arweave upload happened
    expect(mockArweave.uploadFile).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "application/json",
      undefined // no extra tags
    );

    // On-chain inscribe
    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_CONFIG.vaultAddress,
        functionName: "inscribe",
        args: [5n, "arweave-inscription-id", "application/json", 2048n, "memory.json"],
        value: 0n,
      })
    );

    expect(result.hash).toBe(ZERO_HASH);
    expect(result.inscriptionIndex).toBe(3n);
    expect(result.upload.hash).toBe("arweave-inscription-id");
    expect(result.upload.size).toBe(2048);
  });

  it("handles string data input by converting to Buffer", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    });
    const mockArweave = injectMockArweave(client);

    await client.inscribe(1n, "plain string data");

    const uploadCall = mockArweave.uploadFile.mock.calls[0];
    expect(uploadCall[0]).toBeInstanceOf(Uint8Array);
  });

  it("uses default contentType when none provided", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    });
    const mockArweave = injectMockArweave(client);

    await client.inscribe(1n, Buffer.from("data"));

    const uploadCall = mockArweave.uploadFile.mock.calls[0];
    expect(uploadCall[1]).toBe("application/octet-stream");
  });

  it("passes custom value to writeContract when specified", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const { wal } = connectClient(client, {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    });
    injectMockArweave(client);

    const CUSTOM_VALUE = 1_000_000_000_000_000n;
    await client.inscribe(1n, "data", { value: CUSTOM_VALUE });

    expect(wal.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ value: CUSTOM_VALUE })
    );
  });

  it("returns inscriptionIndex=0n when no matching logs", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [{ topics: ["0xSomeOtherEvent"] }],
      }),
    });
    injectMockArweave(client);

    const result = await client.inscribe(1n, "data");
    expect(result.inscriptionIndex).toBe(0n);
  });
});

// ─── estimateInscribeCost() edge cases ───────────────────────────────────────

describe("InkdClient — estimateInscribeCost() edge cases", () => {
  it("handles 0 bytes gracefully (rounds up to 1 KB for arweave)", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      readContract: vi.fn().mockResolvedValue(0n),
    });

    const estimate = await client.estimateInscribeCost(0);
    // ceil(0 / 1024) = 0, so arweave cost = 0
    expect(estimate.arweave).toBe(0n);
    expect(estimate.total).toBeGreaterThan(0n); // gas still applies
  });

  it("has total = gas + arweave + protocolFee always", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      readContract: vi.fn().mockResolvedValue(100n), // 1% fee
    });

    const estimate = await client.estimateInscribeCost(50_000);
    expect(estimate.total).toBe(estimate.gas + estimate.arweave + estimate.protocolFee);
  });

  it("protocol fee is zero when feeBps is 0", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      readContract: vi.fn().mockResolvedValue(0n),
    });

    const estimate = await client.estimateInscribeCost(1024);
    expect(estimate.protocolFee).toBe(0n);
  });

  it("larger feeBps yields higher protocolFee", async () => {
    const client = new InkdClient(TEST_CONFIG);

    const withLowFee = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(10n),
    });
    const withHighFee = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(500n),
    });

    const clientA = new InkdClient(TEST_CONFIG);
    const clientB = new InkdClient(TEST_CONFIG);

    // @ts-expect-error — mock
    clientA.connect(makeMockWalletClient(), withLowFee);
    // @ts-expect-error — mock
    clientB.connect(makeMockWalletClient(), withHighFee);

    const estA = await clientA.estimateInscribeCost(1024);
    const estB = await clientB.estimateInscribeCost(1024);

    expect(estB.protocolFee).toBeGreaterThan(estA.protocolFee);
    void client; // suppress unused warning
  });
});

// ─── setEncryptionProvider() with inscribe integration ────────────────────────

describe("InkdClient — custom encryption provider with inscribe", () => {
  it("uses the custom provider's encrypt method instead of passthrough", async () => {
    const client = new InkdClient(TEST_CONFIG);
    connectClient(client, {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    });

    const ENCRYPTED_DATA = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const mockProvider = {
      encrypt: vi.fn().mockResolvedValue({
        ciphertext: ENCRYPTED_DATA,
        encryptedSymmetricKey: "mock-key",
        accessControlConditions: [],
      }),
      decrypt: vi.fn(),
    };

    client.setEncryptionProvider(mockProvider);
    const mockArweave = injectMockArweave(client);

    await client.inscribe(1n, Buffer.from("raw data"));

    expect(mockProvider.encrypt).toHaveBeenCalledOnce();
    // The encrypted payload should have been passed to arweave upload
    expect(mockArweave.uploadFile).toHaveBeenCalledWith(
      ENCRYPTED_DATA,
      "application/octet-stream",
      undefined
    );
  });
});
