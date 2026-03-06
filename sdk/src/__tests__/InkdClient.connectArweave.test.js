"use strict";
/**
 * @file InkdClient.connectArweave.test.ts
 * @description Unit tests for InkdClient.connectArweave() — covers lines 81-91 of InkdClient.ts.
 *
 * Strategy: mock the ../arweave module using vi.hoisted() to satisfy vitest's hoist constraint.
 * Verifies: constructor args (irysUrl/gateway defaults + overrides), connect() called,
 * subsequent inscribe() succeeds with the injected instance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ─── Hoisted mocks (required so vi.mock factory can reference them) ───────────
const { mockConnect, mockUploadFile, MockArweaveClient } = vitest_1.vi.hoisted(() => {
    const mockConnect = vitest_1.vi.fn().mockResolvedValue(undefined);
    const mockUploadFile = vitest_1.vi.fn().mockResolvedValue({ hash: "tx-arweave-abc", size: 512 });
    const MockArweaveClient = vitest_1.vi.fn().mockImplementation(() => ({
        connect: mockConnect,
        uploadFile: mockUploadFile,
    }));
    return { mockConnect, mockUploadFile, MockArweaveClient };
});
vitest_1.vi.mock("../arweave", () => ({
    ArweaveClient: MockArweaveClient,
}));
// ─── Import under test (after mock registration) ─────────────────────────────
const InkdClient_1 = require("../InkdClient");
// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEST_CONFIG = {
    tokenAddress: "0x1111111111111111111111111111111111111111",
    vaultAddress: "0x2222222222222222222222222222222222222222",
    registryAddress: "0x3333333333333333333333333333333333333333",
    chainId: 84532,
};
function makeMockPublicClient(overrides = {}) {
    return {
        readContract: vitest_1.vi.fn().mockResolvedValue(0n),
        waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        getBlock: vitest_1.vi.fn().mockResolvedValue({ timestamp: 1700000000n }),
        ...overrides,
    };
}
function makeMockWalletClient() {
    return {
        writeContract: vitest_1.vi.fn().mockResolvedValue("0xdeadbeef"),
        account: { address: "0xuser" },
    };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — connectArweave()", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("instantiates ArweaveClient with default irysUrl and gateway when no overrides given", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xprivatekey");
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenCalledWith("https://node2.irys.xyz", "0xprivatekey", "https://arweave.net");
    });
    (0, vitest_1.it)("calls ArweaveClient.connect() after construction", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xprivatekey");
        (0, vitest_1.expect)(mockConnect).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("uses custom irysUrl when provided", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xprivatekey", "https://custom-irys.xyz");
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenCalledWith("https://custom-irys.xyz", "0xprivatekey", "https://arweave.net");
    });
    (0, vitest_1.it)("uses custom gateway when provided", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xprivatekey", undefined, "https://my-gateway.net");
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenCalledWith("https://node2.irys.xyz", "0xprivatekey", "https://my-gateway.net");
    });
    (0, vitest_1.it)("uses custom irysUrl AND custom gateway when both provided", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xprivatekey", "https://node1.irys.xyz", "https://my-gateway.net");
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenCalledWith("https://node1.irys.xyz", "0xprivatekey", "https://my-gateway.net");
    });
    (0, vitest_1.it)("resolves without error on successful connect", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await (0, vitest_1.expect)(client.connectArweave("0xprivatekey")).resolves.toBeUndefined();
    });
    (0, vitest_1.it)("propagates ArweaveClient.connect() rejection", async () => {
        mockConnect.mockRejectedValueOnce(new Error("Irys node unreachable"));
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await (0, vitest_1.expect)(client.connectArweave("0xprivatekey")).rejects.toThrow("Irys node unreachable");
    });
    (0, vitest_1.it)("multiple connectArweave() calls each create a new ArweaveClient instance", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xkey1");
        await client.connectArweave("0xkey2", "https://node1.irys.xyz");
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenNthCalledWith(1, "https://node2.irys.xyz", "0xkey1", "https://arweave.net");
        (0, vitest_1.expect)(MockArweaveClient).toHaveBeenNthCalledWith(2, "https://node1.irys.xyz", "0xkey2", "https://arweave.net");
    });
    (0, vitest_1.it)("after connectArweave(), inscribe() uses the injected ArweaveClient (Buffer input)", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xprivatekey");
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [{ topics: ["0xInscribed", "0x1", "0x0", "0x1"] }],
            }),
        });
        const walletClient = makeMockWalletClient();
        client.connect(walletClient, publicClient);
        const result = await client.inscribe(1n, Buffer.from("hello world"));
        (0, vitest_1.expect)(mockUploadFile).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(result.upload.hash).toBe("tx-arweave-abc");
    });
    (0, vitest_1.it)("inscribe() with Uint8Array (non-Buffer) takes the else branch on line 169", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        await client.connectArweave("0xprivatekey");
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [{ topics: ["0xInscribed", "0x1", "0x0", "0x2"] }],
            }),
        });
        const walletClient = makeMockWalletClient();
        client.connect(walletClient, publicClient);
        // Pass Uint8Array directly — not a Buffer, so instanceof Buffer → false (else branch)
        const uint8Data = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);
        const result = await client.inscribe(1n, uint8Data);
        (0, vitest_1.expect)(mockUploadFile).toHaveBeenCalledOnce();
        // The Uint8Array is passed through as-is
        const callArg = mockUploadFile.mock.calls[0][0];
        (0, vitest_1.expect)(callArg).toBeInstanceOf(Uint8Array);
        (0, vitest_1.expect)(result.upload.hash).toBe("tx-arweave-abc");
    });
});
//# sourceMappingURL=InkdClient.connectArweave.test.js.map