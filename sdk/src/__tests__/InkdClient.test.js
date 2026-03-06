"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const InkdClient_1 = require("../InkdClient");
const errors_1 = require("../errors");
// ─── Test Config ──────────────────────────────────────────────────────────────
const TEST_CONFIG = {
    tokenAddress: "0x1111111111111111111111111111111111111111",
    vaultAddress: "0x2222222222222222222222222222222222222222",
    registryAddress: "0x3333333333333333333333333333333333333333",
    chainId: 84532,
};
// ─── Mock Helpers ─────────────────────────────────────────────────────────────
function makeMockPublicClient(overrides = {}) {
    return {
        readContract: vitest_1.vi.fn(),
        waitForTransactionReceipt: vitest_1.vi.fn(),
        getBlock: vitest_1.vi.fn().mockResolvedValue({ timestamp: 1700000000n }),
        ...overrides,
    };
}
function makeMockWalletClient(overrides = {}) {
    return {
        writeContract: vitest_1.vi.fn().mockResolvedValue("0xdeadbeef"),
        account: { address: "0xuser" },
        ...overrides,
    };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — construction", () => {
    (0, vitest_1.it)("creates a client with the given config", () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        (0, vitest_1.expect)(client).toBeInstanceOf(InkdClient_1.InkdClient);
    });
});
(0, vitest_1.describe)("InkdClient — connection guards", () => {
    let client;
    (0, vitest_1.beforeEach)(() => {
        client = new InkdClient_1.InkdClient(TEST_CONFIG);
    });
    (0, vitest_1.it)("throws ClientNotConnected when mintToken called before connect()", async () => {
        await (0, vitest_1.expect)(client.mintToken()).rejects.toThrow(errors_1.ClientNotConnected);
        await (0, vitest_1.expect)(client.mintToken()).rejects.toMatchObject({
            code: "CLIENT_NOT_CONNECTED",
        });
    });
    (0, vitest_1.it)("throws ClientNotConnected when getToken called without publicClient", async () => {
        await (0, vitest_1.expect)(client.getToken(1n)).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("throws ClientNotConnected when hasInkdToken called without publicClient", async () => {
        await (0, vitest_1.expect)(client.hasInkdToken("0x0000000000000000000000000000000000000001")).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("throws ClientNotConnected when getStats called without publicClient", async () => {
        await (0, vitest_1.expect)(client.getStats()).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("throws ArweaveNotConnected when inscribe called without connectArweave()", async () => {
        const publicClient = makeMockPublicClient();
        const walletClient = makeMockWalletClient();
        // @ts-expect-error — mock clients lack full viem types
        client.connect(walletClient, publicClient);
        await (0, vitest_1.expect)(client.inscribe(1n, Buffer.from("data"))).rejects.toThrow(errors_1.ArweaveNotConnected);
        await (0, vitest_1.expect)(client.inscribe(1n, Buffer.from("data"))).rejects.toMatchObject({
            code: "ARWEAVE_NOT_CONNECTED",
        });
    });
});
(0, vitest_1.describe)("InkdClient — connect()", () => {
    (0, vitest_1.it)("accepts wallet + public clients and no longer throws on guarded calls", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(true),
        });
        const walletClient = makeMockWalletClient();
        // @ts-expect-error — mock clients lack full viem types
        client.connect(walletClient, publicClient);
        // Should NOT throw ClientNotConnected anymore
        await (0, vitest_1.expect)(client.hasInkdToken("0x0000000000000000000000000000000000000001")).resolves.toBe(true);
    });
});
(0, vitest_1.describe)("InkdClient — mintToken()", () => {
    (0, vitest_1.it)("calls readContract for mintPrice then writeContract", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const MINT_PRICE = 10000000000000000n; // 0.01 ETH
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(MINT_PRICE),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [{ topics: ["0xTransfer", "0x0", "0xuser", "0x1"] }],
            }),
        });
        const walletClient = makeMockWalletClient();
        // @ts-expect-error — mock clients lack full viem types
        client.connect(walletClient, publicClient);
        const result = await client.mintToken();
        (0, vitest_1.expect)(publicClient.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.tokenAddress,
            functionName: "mintPrice",
        }));
        (0, vitest_1.expect)(walletClient.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.tokenAddress,
            functionName: "mint",
            value: MINT_PRICE,
        }));
        (0, vitest_1.expect)(result.hash).toBe("0xdeadbeef");
        (0, vitest_1.expect)(result.tokenId).toBe(1n);
    });
    (0, vitest_1.it)("extracts tokenId from Transfer log topics", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
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
        (0, vitest_1.expect)(result.tokenId).toBe(42n);
    });
    (0, vitest_1.it)("returns tokenId as undefined when no matching logs", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [{ topics: ["0xOnlyOneTopic"] }],
            }),
        });
        const walletClient = makeMockWalletClient();
        // @ts-expect-error — mock
        client.connect(walletClient, publicClient);
        const result = await client.mintToken();
        (0, vitest_1.expect)(result.tokenId).toBeUndefined();
    });
    (0, vitest_1.it)("extractTokenIdFromLogs: skips log with invalid topic[3] (catch branch), falls back to next valid log", async () => {
        // First log has an unparseable topic[3] → BigInt throws → catch fires → continue
        // Second log has a valid topic[3] = 0xff → tokenId = 255n
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [
                    { topics: ["0xTransfer", "0x0", "0xuser", "not-a-bigint"] }, // ← triggers catch
                    { topics: ["0xTransfer", "0x0", "0xuser", "0xff"] }, // ← valid: 255n
                ],
            }),
        });
        const walletClient = makeMockWalletClient();
        // @ts-expect-error — mock
        client.connect(walletClient, publicClient);
        const result = await client.mintToken();
        (0, vitest_1.expect)(result.tokenId).toBe(255n);
    });
});
(0, vitest_1.describe)("InkdClient — getToken()", () => {
    (0, vitest_1.it)("reads owner, mintedAt, inscriptionCount, tokenURI in parallel", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const OWNER = "0xowner";
        const MINTED_AT = 1700000000n;
        const INSC_COUNT = 3n;
        const TOKEN_URI = "data:application/json,{}";
        let callCount = 0;
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockImplementation(() => {
                callCount++;
                const results = [OWNER, MINTED_AT, INSC_COUNT, TOKEN_URI];
                return Promise.resolve(results[(callCount - 1) % 4]);
            }),
        });
        // @ts-expect-error — mock
        client.connect(makeMockWalletClient(), publicClient);
        const data = await client.getToken(1n);
        (0, vitest_1.expect)(data.tokenId).toBe(1n);
        (0, vitest_1.expect)(data.owner).toBe(OWNER);
        (0, vitest_1.expect)(data.mintedAt).toBe(MINTED_AT);
        (0, vitest_1.expect)(data.inscriptionCount).toBe(3);
        (0, vitest_1.expect)(data.tokenURI).toBe(TOKEN_URI);
        (0, vitest_1.expect)(publicClient.readContract).toHaveBeenCalledTimes(4);
    });
});
(0, vitest_1.describe)("InkdClient — hasInkdToken()", () => {
    (0, vitest_1.it)("returns true when the contract returns true", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(true),
        });
        // @ts-expect-error — mock
        client.connect(makeMockWalletClient(), publicClient);
        const result = await client.hasInkdToken("0x0000000000000000000000000000000000000001");
        (0, vitest_1.expect)(result).toBe(true);
        (0, vitest_1.expect)(publicClient.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ functionName: "isInkdHolder" }));
    });
    (0, vitest_1.it)("returns false when the contract returns false", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(false),
        });
        // @ts-expect-error — mock
        client.connect(makeMockWalletClient(), publicClient);
        const result = await client.hasInkdToken("0x0000000000000000000000000000000000000002");
        (0, vitest_1.expect)(result).toBe(false);
    });
});
(0, vitest_1.describe)("InkdClient — getStats()", () => {
    (0, vitest_1.it)("maps tuple response to ProtocolStats object", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue([500n, 12000n, 9000000000000000000n, 300n]),
        });
        // @ts-expect-error — mock
        client.connect(makeMockWalletClient(), publicClient);
        const stats = await client.getStats();
        (0, vitest_1.expect)(stats.totalTokens).toBe(500n);
        (0, vitest_1.expect)(stats.totalInscriptions).toBe(12000n);
        (0, vitest_1.expect)(stats.totalVolume).toBe(9000000000000000000n);
        (0, vitest_1.expect)(stats.totalSales).toBe(300n);
    });
});
(0, vitest_1.describe)("InkdClient — estimateInscribeCost()", () => {
    (0, vitest_1.it)("returns non-zero estimates for a 10KB file", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(50n), // 0.5% fee
        });
        // @ts-expect-error — mock
        client.connect(makeMockWalletClient(), publicClient);
        const estimate = await client.estimateInscribeCost(10_240);
        (0, vitest_1.expect)(estimate.gas).toBeGreaterThan(0n);
        (0, vitest_1.expect)(estimate.arweave).toBeGreaterThan(0n);
        (0, vitest_1.expect)(estimate.protocolFee).toBeGreaterThan(0n);
        (0, vitest_1.expect)(estimate.total).toBe(estimate.gas + estimate.arweave + estimate.protocolFee);
    });
    (0, vitest_1.it)("arweave cost scales with file size", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const publicClient = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
        });
        // @ts-expect-error — mock
        client.connect(makeMockWalletClient(), publicClient);
        const small = await client.estimateInscribeCost(1_024); // 1 KB
        const large = await client.estimateInscribeCost(102_400); // 100 KB
        (0, vitest_1.expect)(large.arweave).toBeGreaterThan(small.arweave);
    });
});
(0, vitest_1.describe)("InkdClient — setEncryptionProvider()", () => {
    (0, vitest_1.it)("accepts a custom encryption provider without throwing", () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const mockProvider = {
            encrypt: vitest_1.vi.fn(),
            decrypt: vitest_1.vi.fn(),
        };
        (0, vitest_1.expect)(() => client.setEncryptionProvider(mockProvider)).not.toThrow();
    });
});
//# sourceMappingURL=InkdClient.test.js.map