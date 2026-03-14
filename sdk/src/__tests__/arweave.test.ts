/**
 * @file arweave.test.ts
 * @description Unit tests for ArweaveClient — constructor, error classes, and basic validation.
 */

import { describe, it, expect } from "vitest";
import { ArweaveClient } from "../arweave";
import { UploadError } from "../errors";

describe("ArweaveClient — constructor", () => {
  it("accepts irysUrl and privateKey with default gateway", () => {
    const client = new ArweaveClient(
      "https://node2.irys.xyz",
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    expect(client).toBeDefined();
  });

  it("accepts a custom gateway", () => {
    const client = new ArweaveClient(
      "https://node2.irys.xyz",
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "https://my-custom-gateway.net"
    );
    expect(client).toBeDefined();
  });
});

describe("ArweaveClient — uploadFile() guards", () => {
  it("throws upload failed when not connected", async () => {
    const client = new ArweaveClient(
      "https://node2.irys.xyz",
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    await expect(
      client.uploadFile(Buffer.from("test"), "text/plain")
    ).rejects.toThrow("not connected");
  });
});

describe("UploadError", () => {
  it("UploadError has correct code and name", () => {
    const err = new UploadError("test");
    expect(err.code).toBe("UPLOAD_ERROR");
    expect(err.name).toBe("UploadError");
  });

  it("UploadError is instanceof Error", () => {
    const err = new UploadError("test");
    expect(err).toBeInstanceOf(Error);
  });
});
