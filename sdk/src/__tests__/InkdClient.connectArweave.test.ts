/**
 * @file InkdClient.connectArweave.test.ts
 * @description Unit tests for InkdClient.connectArweave() — covers lines 81-91 of InkdClient.ts.
 *
 * Strategy: mock the ../arweave module using vi.hoisted() to satisfy vitest's hoist constraint.
 * Verifies: constructor args (irysUrl/gateway defaults + overrides), connect() called,
 * subsequent inscribe() succeeds with the injected instance.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (required so vi.mock factory can reference them) ───────────

const { mockConnect, mockUploadFile, MockArweaveClient } = vi.hoisted(() => {
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const mockUploadFile = vi.fn().mockResolvedValue({ hash: "tx-arweave-abc", size: 512 });
  const MockArweaveClient = vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    uploadFile: mockUploadFile,
  }));
  return { mockConnect, mockUploadFile, MockArweaveClient };
});

vi.mock("../arweave", () => ({
  ArweaveClient: MockArweaveClient,
}));

// ─── Import under test (after mock registration) ─────────────────────────────

import { InkdClient } from "../InkdClient";
import type { InkdClientConfig } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_CONFIG: InkdClientConfig = {
  tokenAddress: "0x1111111111111111111111111111111111111111",
  vaultAddress: "0x2222222222222222222222222222222222222222",
  registryAddress: "0x3333333333333333333333333333333333333333",
  chainId: 84532,
};

function makeMockPublicClient(overrides: Record<string, unknown> = {}) {
  return {
    readContract: vi.fn().mockResolvedValue(0n),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] }),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n }),
    ...overrides,
  };
}

function makeMockWalletClient() {
  return {
    writeContract: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    account: { address: "0xuser" as `0x${string}` },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InkdClient — connectArweave()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("instantiates ArweaveClient with default irysUrl and gateway when no overrides given", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave("0xprivatekey");

    expect(MockArweaveClient).toHaveBeenCalledOnce();
    expect(MockArweaveClient).toHaveBeenCalledWith(
      "https://node2.irys.xyz",
      "0xprivatekey",
      "https://arweave.net"
    );
  });

  it("calls ArweaveClient.connect() after construction", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave("0xprivatekey");

    expect(mockConnect).toHaveBeenCalledOnce();
  });

  it("uses custom irysUrl when provided", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave("0xprivatekey", "https://custom-irys.xyz");

    expect(MockArweaveClient).toHaveBeenCalledWith(
      "https://custom-irys.xyz",
      "0xprivatekey",
      "https://arweave.net"
    );
  });

  it("uses custom gateway when provided", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave("0xprivatekey", undefined, "https://my-gateway.net");

    expect(MockArweaveClient).toHaveBeenCalledWith(
      "https://node2.irys.xyz",
      "0xprivatekey",
      "https://my-gateway.net"
    );
  });

  it("uses custom irysUrl AND custom gateway when both provided", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave(
      "0xprivatekey",
      "https://node1.irys.xyz",
      "https://my-gateway.net"
    );

    expect(MockArweaveClient).toHaveBeenCalledWith(
      "https://node1.irys.xyz",
      "0xprivatekey",
      "https://my-gateway.net"
    );
  });

  it("resolves without error on successful connect", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await expect(client.connectArweave("0xprivatekey")).resolves.toBeUndefined();
  });

  it("propagates ArweaveClient.connect() rejection", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Irys node unreachable"));
    const client = new InkdClient(TEST_CONFIG);

    await expect(client.connectArweave("0xprivatekey")).rejects.toThrow(
      "Irys node unreachable"
    );
  });

  it("multiple connectArweave() calls each create a new ArweaveClient instance", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave("0xkey1");
    await client.connectArweave("0xkey2", "https://node1.irys.xyz");

    expect(MockArweaveClient).toHaveBeenCalledTimes(2);
    expect(MockArweaveClient).toHaveBeenNthCalledWith(1, "https://node2.irys.xyz", "0xkey1", "https://arweave.net");
    expect(MockArweaveClient).toHaveBeenNthCalledWith(2, "https://node1.irys.xyz", "0xkey2", "https://arweave.net");
  });

  it("after connectArweave(), inscribe() uses the injected ArweaveClient (Buffer input)", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave("0xprivatekey");

    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [{ topics: ["0xInscribed", "0x1", "0x0", "0x1"] }],
      }),
    });
    const walletClient = makeMockWalletClient();
    client.connect(
      walletClient as unknown as Parameters<typeof client.connect>[0],
      publicClient as unknown as Parameters<typeof client.connect>[1]
    );

    const result = await client.inscribe(1n, Buffer.from("hello world"));

    expect(mockUploadFile).toHaveBeenCalledOnce();
    expect(result.upload.hash).toBe("tx-arweave-abc");
  });

  it("inscribe() with Uint8Array (non-Buffer) takes the else branch on line 169", async () => {
    const client = new InkdClient(TEST_CONFIG);
    await client.connectArweave("0xprivatekey");

    const publicClient = makeMockPublicClient({
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [{ topics: ["0xInscribed", "0x1", "0x0", "0x2"] }],
      }),
    });
    const walletClient = makeMockWalletClient();
    client.connect(
      walletClient as unknown as Parameters<typeof client.connect>[0],
      publicClient as unknown as Parameters<typeof client.connect>[1]
    );

    // Pass Uint8Array directly — not a Buffer, so instanceof Buffer → false (else branch)
    const uint8Data = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    const result = await client.inscribe(1n, uint8Data);

    expect(mockUploadFile).toHaveBeenCalledOnce();
    // The Uint8Array is passed through as-is
    const callArg = mockUploadFile.mock.calls[0][0];
    expect(callArg).toBeInstanceOf(Uint8Array);
    expect(result.upload.hash).toBe("tx-arweave-abc");
  });
});
