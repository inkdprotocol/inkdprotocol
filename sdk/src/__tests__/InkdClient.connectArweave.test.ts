/**
 * @file InkdClient.connectArweave.test.ts
 * @description Tests for InkdClient.connectArweave() integration.
 */

import { describe, it, expect, vi } from "vitest";
import { InkdClient } from "../InkdClient";

const TEST_CONFIG = {
  tokenAddress: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  vaultAddress: "0x2222222222222222222222222222222222222222" as `0x${string}`,
  registryAddress: "0x3333333333333333333333333333333333333333" as `0x${string}`,
  chainId: 84532,
};

const VALID_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("InkdClient — connectArweave()", () => {
  it("throws ArweaveNotConnected when inscribe called without connectArweave()", async () => {
    const client = new InkdClient(TEST_CONFIG);
    const pub = { readContract: vi.fn(), waitForTransactionReceipt: vi.fn() };
    const wal = { writeContract: vi.fn(), account: { address: "0xuser" as `0x${string}` } };
    // @ts-expect-error mock
    client.connect(wal, pub);
    await expect(
      client.inscribe(1n, Buffer.from("data"), { contentType: "text/plain" })
    ).rejects.toThrow("Arweave client is not connected");
  });
});
