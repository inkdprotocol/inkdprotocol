/**
 * @file arweave.test.ts
 * @description Unit tests for ArweaveClient — upload, download, pricing, encryption stub.
 *
 * Strategy: mock the @irys/sdk dynamic import so tests run without a live node.
 * global fetch is stubbed for getFile / downloadData paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArweaveClient } from "../arweave";
import { UploadError } from "../errors";

// ─── Mock @irys/sdk ──────────────────────────────────────────────────────────

const mockUpload = vi.fn();
const mockGetPrice = vi.fn();
const mockReady = vi.fn();

const MockIrys = vi.fn().mockImplementation(() => ({
  upload: mockUpload,
  getPrice: mockGetPrice,
  ready: mockReady,
}));

vi.mock("@irys/sdk", () => ({
  default: MockIrys,
}));

// ─── Mock global fetch ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IRYS_URL = "https://node2.irys.xyz";
const PRIVATE_KEY = "0xdeadbeef";
const CUSTOM_GATEWAY = "https://my-gateway.net";
const TX_ID = "abc123txid";

function makeClient(gateway?: string) {
  return new ArweaveClient(IRYS_URL, PRIVATE_KEY, gateway);
}

function mockResponse(body: ArrayBuffer, ok = true, status = 200, statusText = "OK") {
  return {
    ok,
    status,
    statusText,
    arrayBuffer: vi.fn().mockResolvedValue(body),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ArweaveClient — constructor", () => {
  it("accepts irysUrl and privateKey with default gateway", () => {
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    // getUrl uses the default gateway
    expect(client.getUrl("test123")).toBe("https://arweave.net/test123");
  });

  it("accepts a custom gateway", () => {
    const client = makeClient(CUSTOM_GATEWAY);
    expect(client.getUrl("test123")).toBe(`${CUSTOM_GATEWAY}/test123`);
  });

  it("creates without connecting (irys is null initially)", async () => {
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    // uploadFile before connect should throw
    await expect(client.uploadFile(Buffer.from("x"), "text/plain")).rejects.toThrow(
      UploadError
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — connect()", () => {
  beforeEach(() => {
    MockIrys.mockClear();
    mockReady.mockReset();
  });

  it("calls Irys constructor with correct args", async () => {
    mockReady.mockResolvedValue(undefined);
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await client.connect();

    expect(MockIrys).toHaveBeenCalledOnce();
    expect(MockIrys).toHaveBeenCalledWith({
      url: IRYS_URL,
      token: "ethereum",
      key: PRIVATE_KEY,
    });
  });

  it("calls ready() on the Irys instance", async () => {
    mockReady.mockResolvedValue(undefined);
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await client.connect();
    expect(mockReady).toHaveBeenCalledOnce();
  });

  it("propagates errors thrown by Irys.ready()", async () => {
    mockReady.mockRejectedValue(new Error("network timeout"));
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await expect(client.connect()).rejects.toThrow("network timeout");
  });

  it("propagates errors thrown by Irys constructor", async () => {
    MockIrys.mockImplementationOnce(() => {
      throw new Error("bad key");
    });
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await expect(client.connect()).rejects.toThrow("bad key");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — uploadFile()", () => {
  let client: ArweaveClient;

  beforeEach(async () => {
    MockIrys.mockClear();
    mockReady.mockResolvedValue(undefined);
    mockUpload.mockReset();
    client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await client.connect();
  });

  it("throws UploadError when not connected", async () => {
    const fresh = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await expect(fresh.uploadFile(Buffer.from("data"), "text/plain")).rejects.toThrow(
      UploadError
    );
    await expect(fresh.uploadFile(Buffer.from("data"), "text/plain")).rejects.toThrow(
      "ArweaveClient not connected"
    );
  });

  it("returns UploadResult on success (Buffer input)", async () => {
    mockUpload.mockResolvedValue({ id: TX_ID });
    const data = Buffer.from("hello arweave");
    const result = await client.uploadFile(data, "text/plain");

    expect(result.hash).toBe(TX_ID);
    expect(result.url).toBe(`https://arweave.net/${TX_ID}`);
    expect(result.size).toBe(data.length);
  });

  it("returns UploadResult with custom gateway URL", async () => {
    mockUpload.mockResolvedValue({ id: TX_ID });
    const gatewayClient = new ArweaveClient(IRYS_URL, PRIVATE_KEY, CUSTOM_GATEWAY);
    mockReady.mockResolvedValue(undefined);
    await gatewayClient.connect();

    const result = await gatewayClient.uploadFile(Buffer.from("data"), "text/plain");
    expect(result.url).toBe(`${CUSTOM_GATEWAY}/${TX_ID}`);
  });

  it("accepts Uint8Array input and converts to Buffer", async () => {
    mockUpload.mockResolvedValue({ id: TX_ID });
    const data = new Uint8Array([1, 2, 3, 4]);
    const result = await client.uploadFile(data, "application/octet-stream");

    expect(result.hash).toBe(TX_ID);
    expect(result.size).toBe(4);
    // upload should have been called with a Buffer
    const [passedData] = mockUpload.mock.calls[0];
    expect(Buffer.isBuffer(passedData)).toBe(true);
  });

  it("always includes Content-Type and App-Name tags", async () => {
    mockUpload.mockResolvedValue({ id: TX_ID });
    await client.uploadFile(Buffer.from("x"), "application/json");

    const [, opts] = mockUpload.mock.calls[0];
    expect(opts.tags).toContainEqual({ name: "Content-Type", value: "application/json" });
    expect(opts.tags).toContainEqual({ name: "App-Name", value: "inkd-protocol" });
  });

  it("merges extra tags into tag list", async () => {
    mockUpload.mockResolvedValue({ id: TX_ID });
    await client.uploadFile(Buffer.from("x"), "text/plain", {
      "Token-Id": "42",
      "Schema-Version": "1",
    });

    const [, opts] = mockUpload.mock.calls[0];
    expect(opts.tags).toContainEqual({ name: "Token-Id", value: "42" });
    expect(opts.tags).toContainEqual({ name: "Schema-Version", value: "1" });
  });

  it("omits extra tags section when tags param is undefined", async () => {
    mockUpload.mockResolvedValue({ id: TX_ID });
    await client.uploadFile(Buffer.from("x"), "text/plain");

    const [, opts] = mockUpload.mock.calls[0];
    // Only 2 default tags should be present
    expect(opts.tags).toHaveLength(2);
  });

  it("throws UploadError when irys.upload rejects", async () => {
    mockUpload.mockRejectedValue(new Error("insufficient balance"));
    await expect(client.uploadFile(Buffer.from("x"), "text/plain")).rejects.toThrow(
      UploadError
    );
    await expect(
      client.uploadFile(Buffer.from("x"), "text/plain")
    ).rejects.toThrow("Arweave upload failed: insufficient balance");
  });

  it("wraps non-Error upload rejections in UploadError", async () => {
    mockUpload.mockRejectedValue("raw string error");
    await expect(client.uploadFile(Buffer.from("x"), "text/plain")).rejects.toThrow(
      "Arweave upload failed: raw string error"
    );
  });

  it("size matches uploaded data length exactly", async () => {
    mockUpload.mockResolvedValue({ id: TX_ID });
    const bigData = Buffer.alloc(1024, 0xab);
    const result = await client.uploadFile(bigData, "application/octet-stream");
    expect(result.size).toBe(1024);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — uploadData() alias", () => {
  it("delegates to uploadFile with same args", async () => {
    mockReady.mockResolvedValue(undefined);
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ id: TX_ID });

    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await client.connect();

    const data = Buffer.from("test payload");
    const result = await client.uploadData(data, "text/plain", { "My-Tag": "hello" });

    expect(result.hash).toBe(TX_ID);
    const [, opts] = mockUpload.mock.calls[0];
    expect(opts.tags).toContainEqual({ name: "My-Tag", value: "hello" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — getFile() / downloadData()", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("fetches data by hash from default gateway", async () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    mockFetch.mockResolvedValue(mockResponse(bytes.buffer));

    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    const result = await client.getFile(TX_ID);

    expect(mockFetch).toHaveBeenCalledWith(`https://arweave.net/${TX_ID}`);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from(bytes));
  });

  it("fetches from custom gateway", async () => {
    mockFetch.mockResolvedValue(mockResponse(new ArrayBuffer(0)));
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY, CUSTOM_GATEWAY);
    await client.getFile(TX_ID);
    expect(mockFetch).toHaveBeenCalledWith(`${CUSTOM_GATEWAY}/${TX_ID}`);
  });

  it("throws UploadError on non-OK HTTP response", async () => {
    mockFetch.mockResolvedValue(mockResponse(new ArrayBuffer(0), false, 404, "Not Found"));

    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await expect(client.getFile(TX_ID)).rejects.toThrow(UploadError);
    await expect(client.getFile(TX_ID)).rejects.toThrow(
      "Failed to fetch from Arweave: 404 Not Found"
    );
  });

  it("throws UploadError on 500 server error", async () => {
    mockFetch.mockResolvedValue(
      mockResponse(new ArrayBuffer(0), false, 500, "Internal Server Error")
    );

    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await expect(client.getFile(TX_ID)).rejects.toThrow("500 Internal Server Error");
  });

  it("downloadData() is an alias for getFile()", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    mockFetch.mockResolvedValue(mockResponse(bytes.buffer));

    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    const result = await client.downloadData(TX_ID);
    expect(result).toEqual(Buffer.from(bytes));
  });

  it("returns empty Buffer for empty response body", async () => {
    mockFetch.mockResolvedValue(mockResponse(new ArrayBuffer(0)));
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    const result = await client.getFile(TX_ID);
    expect(result.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — getUploadPrice()", () => {
  let client: ArweaveClient;

  beforeEach(async () => {
    MockIrys.mockClear();
    mockReady.mockResolvedValue(undefined);
    mockGetPrice.mockReset();
    client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await client.connect();
  });

  it("throws UploadError when not connected", async () => {
    const fresh = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await expect(fresh.getUploadPrice(1024)).rejects.toThrow(UploadError);
    await expect(fresh.getUploadPrice(1024)).rejects.toThrow(
      "ArweaveClient not connected"
    );
  });

  it("returns bigint from irys.getPrice()", async () => {
    mockGetPrice.mockResolvedValue(5_000_000_000_000n);
    const price = await client.getUploadPrice(512);
    expect(price).toBe(5_000_000_000_000n);
    expect(mockGetPrice).toHaveBeenCalledWith(512);
  });

  it("returns fallback estimate when getPrice throws", async () => {
    mockGetPrice.mockRejectedValue(new Error("rate limit"));
    // 1024 bytes → ceil(1024/1024) * 10_000_000_000_000 = 10_000_000_000_000
    const price = await client.getUploadPrice(1024);
    expect(price).toBe(10_000_000_000_000n);
  });

  it("fallback: uses ceiling division (512 bytes → 1 KB bucket)", async () => {
    mockGetPrice.mockRejectedValue(new Error("error"));
    const price = await client.getUploadPrice(512);
    expect(price).toBe(10_000_000_000_000n); // ceil(512/1024) = 1
  });

  it("fallback: 2048 bytes → 2 KB buckets", async () => {
    mockGetPrice.mockRejectedValue(new Error("error"));
    const price = await client.getUploadPrice(2048);
    expect(price).toBe(20_000_000_000_000n);
  });

  it("fallback: 1 byte → 1 KB bucket (ceiling)", async () => {
    mockGetPrice.mockRejectedValue(new Error("error"));
    const price = await client.getUploadPrice(1);
    expect(price).toBe(10_000_000_000_000n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — uploadEncrypted()", () => {
  let client: ArweaveClient;

  beforeEach(async () => {
    MockIrys.mockClear();
    mockReady.mockResolvedValue(undefined);
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ id: TX_ID });
    client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await client.connect();
  });

  it("includes Encryption=lit-protocol tag", async () => {
    await client.uploadEncrypted(Buffer.from("secret"), "application/json");

    const [, opts] = mockUpload.mock.calls[0];
    expect(opts.tags).toContainEqual({ name: "Encryption", value: "lit-protocol" });
  });

  it("still includes Content-Type and App-Name tags", async () => {
    await client.uploadEncrypted(Buffer.from("secret"), "application/json");

    const [, opts] = mockUpload.mock.calls[0];
    expect(opts.tags).toContainEqual({ name: "Content-Type", value: "application/json" });
    expect(opts.tags).toContainEqual({ name: "App-Name", value: "inkd-protocol" });
  });

  it("merges caller tags alongside Encryption tag", async () => {
    await client.uploadEncrypted(Buffer.from("x"), "text/plain", { "Token-Id": "99" });

    const [, opts] = mockUpload.mock.calls[0];
    expect(opts.tags).toContainEqual({ name: "Token-Id", value: "99" });
    expect(opts.tags).toContainEqual({ name: "Encryption", value: "lit-protocol" });
  });

  it("returns valid UploadResult", async () => {
    const result = await client.uploadEncrypted(Buffer.from("encrypted blob"), "text/plain");
    expect(result.hash).toBe(TX_ID);
    expect(result.url).toBe(`https://arweave.net/${TX_ID}`);
  });

  it("throws UploadError when not connected", async () => {
    const fresh = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    await expect(
      fresh.uploadEncrypted(Buffer.from("x"), "text/plain")
    ).rejects.toThrow(UploadError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — getUrl()", () => {
  it("returns default gateway URL", () => {
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    expect(client.getUrl("abc123")).toBe("https://arweave.net/abc123");
  });

  it("returns custom gateway URL", () => {
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY, CUSTOM_GATEWAY);
    expect(client.getUrl("abc123")).toBe(`${CUSTOM_GATEWAY}/abc123`);
  });

  it("handles hash with special characters", () => {
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    const hash = "AbC_-xyz123";
    expect(client.getUrl(hash)).toBe(`https://arweave.net/${hash}`);
  });

  it("does not encode or modify the hash", () => {
    const client = new ArweaveClient(IRYS_URL, PRIVATE_KEY);
    const hash = "SomeLongBase64HashValue==";
    expect(client.getUrl(hash)).toContain(hash);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ArweaveClient — UploadError class", () => {
  it("UploadError has correct code and name", () => {
    const err = new UploadError("test message");
    expect(err.code).toBe("UPLOAD_ERROR");
    expect(err.name).toBe("UploadError");
    expect(err.message).toBe("test message");
  });

  it("UploadError is instanceof Error", () => {
    const err = new UploadError("oops");
    expect(err instanceof Error).toBe(true);
  });
});
