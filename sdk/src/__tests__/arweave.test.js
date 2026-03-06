"use strict";
/**
 * @file arweave.test.ts
 * @description Unit tests for ArweaveClient — upload, download, pricing, encryption stub.
 *
 * Strategy: mock the @irys/sdk dynamic import so tests run without a live node.
 * global fetch is stubbed for getFile / downloadData paths.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arweave_1 = require("../arweave");
const errors_1 = require("../errors");
// ─── Mock @irys/sdk ──────────────────────────────────────────────────────────
const mockUpload = vitest_1.vi.fn();
const mockGetPrice = vitest_1.vi.fn();
const mockReady = vitest_1.vi.fn();
const MockIrys = vitest_1.vi.fn().mockImplementation(() => ({
    upload: mockUpload,
    getPrice: mockGetPrice,
    ready: mockReady,
}));
vitest_1.vi.mock("@irys/sdk", () => ({
    default: MockIrys,
}));
// ─── Mock global fetch ───────────────────────────────────────────────────────
const mockFetch = vitest_1.vi.fn();
vitest_1.vi.stubGlobal("fetch", mockFetch);
// ─── Helpers ─────────────────────────────────────────────────────────────────
const IRYS_URL = "https://node2.irys.xyz";
const PRIVATE_KEY = "0xdeadbeef";
const CUSTOM_GATEWAY = "https://my-gateway.net";
const TX_ID = "abc123txid";
function makeClient(gateway) {
    return new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY, gateway);
}
function mockResponse(body, ok = true, status = 200, statusText = "OK") {
    return {
        ok,
        status,
        statusText,
        arrayBuffer: vitest_1.vi.fn().mockResolvedValue(body),
    };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — constructor", () => {
    (0, vitest_1.it)("accepts irysUrl and privateKey with default gateway", () => {
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        // getUrl uses the default gateway
        (0, vitest_1.expect)(client.getUrl("test123")).toBe("https://arweave.net/test123");
    });
    (0, vitest_1.it)("accepts a custom gateway", () => {
        const client = makeClient(CUSTOM_GATEWAY);
        (0, vitest_1.expect)(client.getUrl("test123")).toBe(`${CUSTOM_GATEWAY}/test123`);
    });
    (0, vitest_1.it)("creates without connecting (irys is null initially)", async () => {
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        // uploadFile before connect should throw
        await (0, vitest_1.expect)(client.uploadFile(Buffer.from("x"), "text/plain")).rejects.toThrow(errors_1.UploadError);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — connect()", () => {
    (0, vitest_1.beforeEach)(() => {
        MockIrys.mockClear();
        mockReady.mockReset();
    });
    (0, vitest_1.it)("calls Irys constructor with correct args", async () => {
        mockReady.mockResolvedValue(undefined);
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await client.connect();
        (0, vitest_1.expect)(MockIrys).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(MockIrys).toHaveBeenCalledWith({
            url: IRYS_URL,
            token: "ethereum",
            key: PRIVATE_KEY,
        });
    });
    (0, vitest_1.it)("calls ready() on the Irys instance", async () => {
        mockReady.mockResolvedValue(undefined);
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await client.connect();
        (0, vitest_1.expect)(mockReady).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("propagates errors thrown by Irys.ready()", async () => {
        mockReady.mockRejectedValue(new Error("network timeout"));
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await (0, vitest_1.expect)(client.connect()).rejects.toThrow("network timeout");
    });
    (0, vitest_1.it)("propagates errors thrown by Irys constructor", async () => {
        MockIrys.mockImplementationOnce(() => {
            throw new Error("bad key");
        });
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await (0, vitest_1.expect)(client.connect()).rejects.toThrow("bad key");
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — uploadFile()", () => {
    let client;
    (0, vitest_1.beforeEach)(async () => {
        MockIrys.mockClear();
        mockReady.mockResolvedValue(undefined);
        mockUpload.mockReset();
        client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await client.connect();
    });
    (0, vitest_1.it)("throws UploadError when not connected", async () => {
        const fresh = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await (0, vitest_1.expect)(fresh.uploadFile(Buffer.from("data"), "text/plain")).rejects.toThrow(errors_1.UploadError);
        await (0, vitest_1.expect)(fresh.uploadFile(Buffer.from("data"), "text/plain")).rejects.toThrow("ArweaveClient not connected");
    });
    (0, vitest_1.it)("returns UploadResult on success (Buffer input)", async () => {
        mockUpload.mockResolvedValue({ id: TX_ID });
        const data = Buffer.from("hello arweave");
        const result = await client.uploadFile(data, "text/plain");
        (0, vitest_1.expect)(result.hash).toBe(TX_ID);
        (0, vitest_1.expect)(result.url).toBe(`https://arweave.net/${TX_ID}`);
        (0, vitest_1.expect)(result.size).toBe(data.length);
    });
    (0, vitest_1.it)("returns UploadResult with custom gateway URL", async () => {
        mockUpload.mockResolvedValue({ id: TX_ID });
        const gatewayClient = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY, CUSTOM_GATEWAY);
        mockReady.mockResolvedValue(undefined);
        await gatewayClient.connect();
        const result = await gatewayClient.uploadFile(Buffer.from("data"), "text/plain");
        (0, vitest_1.expect)(result.url).toBe(`${CUSTOM_GATEWAY}/${TX_ID}`);
    });
    (0, vitest_1.it)("accepts Uint8Array input and converts to Buffer", async () => {
        mockUpload.mockResolvedValue({ id: TX_ID });
        const data = new Uint8Array([1, 2, 3, 4]);
        const result = await client.uploadFile(data, "application/octet-stream");
        (0, vitest_1.expect)(result.hash).toBe(TX_ID);
        (0, vitest_1.expect)(result.size).toBe(4);
        // upload should have been called with a Buffer
        const [passedData] = mockUpload.mock.calls[0];
        (0, vitest_1.expect)(Buffer.isBuffer(passedData)).toBe(true);
    });
    (0, vitest_1.it)("always includes Content-Type and App-Name tags", async () => {
        mockUpload.mockResolvedValue({ id: TX_ID });
        await client.uploadFile(Buffer.from("x"), "application/json");
        const [, opts] = mockUpload.mock.calls[0];
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "Content-Type", value: "application/json" });
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "App-Name", value: "inkd-protocol" });
    });
    (0, vitest_1.it)("merges extra tags into tag list", async () => {
        mockUpload.mockResolvedValue({ id: TX_ID });
        await client.uploadFile(Buffer.from("x"), "text/plain", {
            "Token-Id": "42",
            "Schema-Version": "1",
        });
        const [, opts] = mockUpload.mock.calls[0];
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "Token-Id", value: "42" });
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "Schema-Version", value: "1" });
    });
    (0, vitest_1.it)("omits extra tags section when tags param is undefined", async () => {
        mockUpload.mockResolvedValue({ id: TX_ID });
        await client.uploadFile(Buffer.from("x"), "text/plain");
        const [, opts] = mockUpload.mock.calls[0];
        // Only 2 default tags should be present
        (0, vitest_1.expect)(opts.tags).toHaveLength(2);
    });
    (0, vitest_1.it)("passes non-Uint8Array data directly to upload without Buffer conversion", async () => {
        // Both `Buffer` and `Uint8Array` are instanceof Uint8Array, so the `else`
        // branch of `data instanceof Uint8Array ? Buffer.from(data) : data` is only
        // reachable via a plain object. This test exercises that path.
        mockUpload.mockResolvedValue({ id: TX_ID });
        // Plain object with `length` — not instanceof Uint8Array
        const plainData = { length: 7 };
        const result = await client.uploadFile(plainData, "application/octet-stream");
        (0, vitest_1.expect)(result.hash).toBe(TX_ID);
        (0, vitest_1.expect)(result.size).toBe(7);
        // The same reference should be passed to upload (no Buffer.from conversion)
        const passedData = mockUpload.mock.calls.at(-1)[0];
        (0, vitest_1.expect)(passedData).toBe(plainData);
    });
    (0, vitest_1.it)("throws UploadError when irys.upload rejects", async () => {
        mockUpload.mockRejectedValue(new Error("insufficient balance"));
        await (0, vitest_1.expect)(client.uploadFile(Buffer.from("x"), "text/plain")).rejects.toThrow(errors_1.UploadError);
        await (0, vitest_1.expect)(client.uploadFile(Buffer.from("x"), "text/plain")).rejects.toThrow("Arweave upload failed: insufficient balance");
    });
    (0, vitest_1.it)("wraps non-Error upload rejections in UploadError", async () => {
        mockUpload.mockRejectedValue("raw string error");
        await (0, vitest_1.expect)(client.uploadFile(Buffer.from("x"), "text/plain")).rejects.toThrow("Arweave upload failed: raw string error");
    });
    (0, vitest_1.it)("size matches uploaded data length exactly", async () => {
        mockUpload.mockResolvedValue({ id: TX_ID });
        const bigData = Buffer.alloc(1024, 0xab);
        const result = await client.uploadFile(bigData, "application/octet-stream");
        (0, vitest_1.expect)(result.size).toBe(1024);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — uploadData() alias", () => {
    (0, vitest_1.it)("delegates to uploadFile with same args", async () => {
        mockReady.mockResolvedValue(undefined);
        mockUpload.mockReset();
        mockUpload.mockResolvedValue({ id: TX_ID });
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await client.connect();
        const data = Buffer.from("test payload");
        const result = await client.uploadData(data, "text/plain", { "My-Tag": "hello" });
        (0, vitest_1.expect)(result.hash).toBe(TX_ID);
        const [, opts] = mockUpload.mock.calls[0];
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "My-Tag", value: "hello" });
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — getFile() / downloadData()", () => {
    (0, vitest_1.beforeEach)(() => {
        mockFetch.mockReset();
    });
    (0, vitest_1.it)("fetches data by hash from default gateway", async () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        mockFetch.mockResolvedValue(mockResponse(bytes.buffer));
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        const result = await client.getFile(TX_ID);
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledWith(`https://arweave.net/${TX_ID}`);
        (0, vitest_1.expect)(Buffer.isBuffer(result)).toBe(true);
        (0, vitest_1.expect)(result).toEqual(Buffer.from(bytes));
    });
    (0, vitest_1.it)("fetches from custom gateway", async () => {
        mockFetch.mockResolvedValue(mockResponse(new ArrayBuffer(0)));
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY, CUSTOM_GATEWAY);
        await client.getFile(TX_ID);
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledWith(`${CUSTOM_GATEWAY}/${TX_ID}`);
    });
    (0, vitest_1.it)("throws UploadError on non-OK HTTP response", async () => {
        mockFetch.mockResolvedValue(mockResponse(new ArrayBuffer(0), false, 404, "Not Found"));
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await (0, vitest_1.expect)(client.getFile(TX_ID)).rejects.toThrow(errors_1.UploadError);
        await (0, vitest_1.expect)(client.getFile(TX_ID)).rejects.toThrow("Failed to fetch from Arweave: 404 Not Found");
    });
    (0, vitest_1.it)("throws UploadError on 500 server error", async () => {
        mockFetch.mockResolvedValue(mockResponse(new ArrayBuffer(0), false, 500, "Internal Server Error"));
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await (0, vitest_1.expect)(client.getFile(TX_ID)).rejects.toThrow("500 Internal Server Error");
    });
    (0, vitest_1.it)("downloadData() is an alias for getFile()", async () => {
        const bytes = new Uint8Array([1, 2, 3]);
        mockFetch.mockResolvedValue(mockResponse(bytes.buffer));
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        const result = await client.downloadData(TX_ID);
        (0, vitest_1.expect)(result).toEqual(Buffer.from(bytes));
    });
    (0, vitest_1.it)("returns empty Buffer for empty response body", async () => {
        mockFetch.mockResolvedValue(mockResponse(new ArrayBuffer(0)));
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        const result = await client.getFile(TX_ID);
        (0, vitest_1.expect)(result.length).toBe(0);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — getUploadPrice()", () => {
    let client;
    (0, vitest_1.beforeEach)(async () => {
        MockIrys.mockClear();
        mockReady.mockResolvedValue(undefined);
        mockGetPrice.mockReset();
        client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await client.connect();
    });
    (0, vitest_1.it)("throws UploadError when not connected", async () => {
        const fresh = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await (0, vitest_1.expect)(fresh.getUploadPrice(1024)).rejects.toThrow(errors_1.UploadError);
        await (0, vitest_1.expect)(fresh.getUploadPrice(1024)).rejects.toThrow("ArweaveClient not connected");
    });
    (0, vitest_1.it)("returns bigint from irys.getPrice()", async () => {
        mockGetPrice.mockResolvedValue(5000000000000n);
        const price = await client.getUploadPrice(512);
        (0, vitest_1.expect)(price).toBe(5000000000000n);
        (0, vitest_1.expect)(mockGetPrice).toHaveBeenCalledWith(512);
    });
    (0, vitest_1.it)("returns fallback estimate when getPrice throws", async () => {
        mockGetPrice.mockRejectedValue(new Error("rate limit"));
        // 1024 bytes → ceil(1024/1024) * 10_000_000_000_000 = 10_000_000_000_000
        const price = await client.getUploadPrice(1024);
        (0, vitest_1.expect)(price).toBe(10000000000000n);
    });
    (0, vitest_1.it)("fallback: uses ceiling division (512 bytes → 1 KB bucket)", async () => {
        mockGetPrice.mockRejectedValue(new Error("error"));
        const price = await client.getUploadPrice(512);
        (0, vitest_1.expect)(price).toBe(10000000000000n); // ceil(512/1024) = 1
    });
    (0, vitest_1.it)("fallback: 2048 bytes → 2 KB buckets", async () => {
        mockGetPrice.mockRejectedValue(new Error("error"));
        const price = await client.getUploadPrice(2048);
        (0, vitest_1.expect)(price).toBe(20000000000000n);
    });
    (0, vitest_1.it)("fallback: 1 byte → 1 KB bucket (ceiling)", async () => {
        mockGetPrice.mockRejectedValue(new Error("error"));
        const price = await client.getUploadPrice(1);
        (0, vitest_1.expect)(price).toBe(10000000000000n);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — uploadEncrypted()", () => {
    let client;
    (0, vitest_1.beforeEach)(async () => {
        MockIrys.mockClear();
        mockReady.mockResolvedValue(undefined);
        mockUpload.mockReset();
        mockUpload.mockResolvedValue({ id: TX_ID });
        client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await client.connect();
    });
    (0, vitest_1.it)("includes Encryption=lit-protocol tag", async () => {
        await client.uploadEncrypted(Buffer.from("secret"), "application/json");
        const [, opts] = mockUpload.mock.calls[0];
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "Encryption", value: "lit-protocol" });
    });
    (0, vitest_1.it)("still includes Content-Type and App-Name tags", async () => {
        await client.uploadEncrypted(Buffer.from("secret"), "application/json");
        const [, opts] = mockUpload.mock.calls[0];
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "Content-Type", value: "application/json" });
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "App-Name", value: "inkd-protocol" });
    });
    (0, vitest_1.it)("merges caller tags alongside Encryption tag", async () => {
        await client.uploadEncrypted(Buffer.from("x"), "text/plain", { "Token-Id": "99" });
        const [, opts] = mockUpload.mock.calls[0];
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "Token-Id", value: "99" });
        (0, vitest_1.expect)(opts.tags).toContainEqual({ name: "Encryption", value: "lit-protocol" });
    });
    (0, vitest_1.it)("returns valid UploadResult", async () => {
        const result = await client.uploadEncrypted(Buffer.from("encrypted blob"), "text/plain");
        (0, vitest_1.expect)(result.hash).toBe(TX_ID);
        (0, vitest_1.expect)(result.url).toBe(`https://arweave.net/${TX_ID}`);
    });
    (0, vitest_1.it)("throws UploadError when not connected", async () => {
        const fresh = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        await (0, vitest_1.expect)(fresh.uploadEncrypted(Buffer.from("x"), "text/plain")).rejects.toThrow(errors_1.UploadError);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — getUrl()", () => {
    (0, vitest_1.it)("returns default gateway URL", () => {
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        (0, vitest_1.expect)(client.getUrl("abc123")).toBe("https://arweave.net/abc123");
    });
    (0, vitest_1.it)("returns custom gateway URL", () => {
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY, CUSTOM_GATEWAY);
        (0, vitest_1.expect)(client.getUrl("abc123")).toBe(`${CUSTOM_GATEWAY}/abc123`);
    });
    (0, vitest_1.it)("handles hash with special characters", () => {
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        const hash = "AbC_-xyz123";
        (0, vitest_1.expect)(client.getUrl(hash)).toBe(`https://arweave.net/${hash}`);
    });
    (0, vitest_1.it)("does not encode or modify the hash", () => {
        const client = new arweave_1.ArweaveClient(IRYS_URL, PRIVATE_KEY);
        const hash = "SomeLongBase64HashValue==";
        (0, vitest_1.expect)(client.getUrl(hash)).toContain(hash);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ArweaveClient — UploadError class", () => {
    (0, vitest_1.it)("UploadError has correct code and name", () => {
        const err = new errors_1.UploadError("test message");
        (0, vitest_1.expect)(err.code).toBe("UPLOAD_ERROR");
        (0, vitest_1.expect)(err.name).toBe("UploadError");
        (0, vitest_1.expect)(err.message).toBe("test message");
    });
    (0, vitest_1.it)("UploadError is instanceof Error", () => {
        const err = new errors_1.UploadError("oops");
        (0, vitest_1.expect)(err instanceof Error).toBe(true);
    });
});
//# sourceMappingURL=arweave.test.js.map