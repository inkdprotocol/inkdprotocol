"use strict";
/**
 * @file InkdClient.advanced.test.ts
 * @description Edge-case and untested-method coverage for InkdClient.
 *              Covers: grantAccess, revokeAccess, listForSale, buyToken,
 *              getInscriptions, removeInscription, updateInscription,
 *              getTokensByOwner, batch mint, full inscribe flow, and
 *              connection guards for all previously uncovered methods.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const InkdClient_1 = require("../InkdClient");
const errors_1 = require("../errors");
// ─── Shared Config ────────────────────────────────────────────────────────────
const TEST_CONFIG = {
    tokenAddress: "0x1111111111111111111111111111111111111111",
    vaultAddress: "0x2222222222222222222222222222222222222222",
    registryAddress: "0x3333333333333333333333333333333333333333",
    chainId: 84532,
};
const ZERO_HASH = "0xdeadbeef";
const BLOCK_TIMESTAMP = 1700000000n;
// ─── Mock Factories ───────────────────────────────────────────────────────────
function makeMockPublicClient(overrides = {}) {
    return {
        readContract: vitest_1.vi.fn(),
        waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        getBlock: vitest_1.vi.fn().mockResolvedValue({ timestamp: BLOCK_TIMESTAMP }),
        ...overrides,
    };
}
function makeMockWalletClient(overrides = {}) {
    return {
        writeContract: vitest_1.vi.fn().mockResolvedValue(ZERO_HASH),
        account: { address: "0xuser" },
        ...overrides,
    };
}
/** Inject a fake Arweave client into the private field. */
function injectMockArweave(client, uploadResult = { hash: "arweave-tx-id", size: 1024 }) {
    const mockArweave = {
        uploadFile: vitest_1.vi.fn().mockResolvedValue(uploadResult),
        connect: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
    // Access private field via type cast for test injection
    client.arweave = mockArweave;
    return mockArweave;
}
function connectClient(client, publicOverrides = {}, walletOverrides = {}) {
    const pub = makeMockPublicClient(publicOverrides);
    const wal = makeMockWalletClient(walletOverrides);
    // @ts-expect-error — mock clients lack full viem types
    client.connect(wal, pub);
    return { pub, wal };
}
// ─── Connection Guards (previously uncovered methods) ─────────────────────────
(0, vitest_1.describe)("InkdClient — connection guards (additional methods)", () => {
    let client;
    (0, vitest_1.beforeEach)(() => {
        client = new InkdClient_1.InkdClient(TEST_CONFIG);
    });
    (0, vitest_1.it)("getInscriptions: throws ClientNotConnected without publicClient", async () => {
        await (0, vitest_1.expect)(client.getInscriptions(1n)).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("removeInscription: throws ClientNotConnected without wallet", async () => {
        await (0, vitest_1.expect)(client.removeInscription(1n, 0)).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("updateInscription: throws ClientNotConnected without wallet", async () => {
        await (0, vitest_1.expect)(client.updateInscription(1n, 0, "new data")).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("updateInscription: throws ArweaveNotConnected when wallet connected but no arweave", async () => {
        connectClient(client);
        await (0, vitest_1.expect)(client.updateInscription(1n, 0, Buffer.from("data"))).rejects.toThrow(errors_1.ArweaveNotConnected);
    });
    (0, vitest_1.it)("grantAccess: throws ClientNotConnected without wallet", async () => {
        await (0, vitest_1.expect)(client.grantAccess(1n, "0x0000000000000000000000000000000000000001", 3600)).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("revokeAccess: throws ClientNotConnected without wallet", async () => {
        await (0, vitest_1.expect)(client.revokeAccess(1n, "0x0000000000000000000000000000000000000001")).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("listForSale: throws ClientNotConnected without wallet", async () => {
        await (0, vitest_1.expect)(client.listForSale(1n, 1000000000000000n)).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("buyToken: throws ClientNotConnected without wallet", async () => {
        await (0, vitest_1.expect)(client.buyToken(1n)).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("getTokensByOwner: throws ClientNotConnected without publicClient", async () => {
        await (0, vitest_1.expect)(client.getTokensByOwner("0x0000000000000000000000000000000000000001")).rejects.toThrow(errors_1.ClientNotConnected);
    });
    (0, vitest_1.it)("estimateInscribeCost: throws ClientNotConnected without publicClient", async () => {
        await (0, vitest_1.expect)(client.estimateInscribeCost(1024)).rejects.toThrow(errors_1.ClientNotConnected);
    });
});
// ─── getInscriptions() ────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — getInscriptions()", () => {
    (0, vitest_1.it)("returns a mapped array of inscriptions", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const rawInscriptions = [
            {
                arweaveHash: "abc123",
                contentType: "application/json",
                size: 512n,
                name: "brain.json",
                createdAt: 1700000000n,
                isRemoved: false,
                version: 1n,
            },
            {
                arweaveHash: "def456",
                contentType: "text/plain",
                size: 100n,
                name: "readme.txt",
                createdAt: 1700001000n,
                isRemoved: true,
                version: 2n,
            },
        ];
        const { pub } = connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(rawInscriptions),
        });
        const result = await client.getInscriptions(42n);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.vaultAddress,
            functionName: "getInscriptions",
            args: [42n],
        }));
        (0, vitest_1.expect)(result).toHaveLength(2);
        (0, vitest_1.expect)(result[0].arweaveHash).toBe("abc123");
        (0, vitest_1.expect)(result[0].contentType).toBe("application/json");
        (0, vitest_1.expect)(result[0].size).toBe(512n);
        (0, vitest_1.expect)(result[0].isRemoved).toBe(false);
        (0, vitest_1.expect)(result[0].version).toBe(1n);
        (0, vitest_1.expect)(result[1].isRemoved).toBe(true);
    });
    (0, vitest_1.it)("returns empty array when token has no inscriptions", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue([]),
        });
        const result = await client.getInscriptions(1n);
        (0, vitest_1.expect)(result).toEqual([]);
    });
});
// ─── removeInscription() ─────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — removeInscription()", () => {
    (0, vitest_1.it)("calls writeContract with correct args and returns hash + tokenId", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client);
        const result = await client.removeInscription(7n, 2);
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.vaultAddress,
            functionName: "removeInscription",
            args: [7n, 2n],
        }));
        (0, vitest_1.expect)(result.hash).toBe(ZERO_HASH);
        (0, vitest_1.expect)(result.tokenId).toBe(7n);
    });
    (0, vitest_1.it)("converts numeric index to BigInt for contract call", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client);
        await client.removeInscription(1n, 0);
        const call = wal.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.args[1]).toBe(0n); // index converted to BigInt
    });
});
// ─── updateInscription() ─────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — updateInscription()", () => {
    (0, vitest_1.it)("uploads to Arweave and calls updateInscription on-chain with string data", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client);
        const mockArweave = injectMockArweave(client, {
            hash: "new-arweave-tx",
            size: 256,
        });
        const result = await client.updateInscription(5n, 1, "updated brain data");
        (0, vitest_1.expect)(mockArweave.uploadFile).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.vaultAddress,
            functionName: "updateInscription",
            args: [5n, 1n, "new-arweave-tx"],
        }));
        (0, vitest_1.expect)(result.hash).toBe(ZERO_HASH);
        (0, vitest_1.expect)(result.tokenId).toBe(5n);
    });
    (0, vitest_1.it)("accepts Buffer data", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client);
        injectMockArweave(client);
        await (0, vitest_1.expect)(client.updateInscription(1n, 0, Buffer.from("buffer payload"), "image/png")).resolves.toBeDefined();
    });
    (0, vitest_1.it)("accepts Uint8Array data", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client);
        injectMockArweave(client);
        await (0, vitest_1.expect)(client.updateInscription(1n, 0, new Uint8Array([1, 2, 3]))).resolves.toBeDefined();
    });
    (0, vitest_1.it)("uses application/octet-stream when no contentType given", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client);
        const mockArweave = injectMockArweave(client);
        await client.updateInscription(1n, 0, "data");
        (0, vitest_1.expect)(mockArweave.uploadFile).toHaveBeenCalledWith(vitest_1.expect.anything(), "application/octet-stream");
    });
});
// ─── grantAccess() ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — grantAccess()", () => {
    (0, vitest_1.it)("calculates expiresAt from block timestamp + duration", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const DURATION = 3600; // 1 hour
        const expectedExpiry = BLOCK_TIMESTAMP + BigInt(DURATION);
        const { wal } = connectClient(client);
        const TARGET_WALLET = "0x0000000000000000000000000000000000000042";
        await client.grantAccess(1n, TARGET_WALLET, DURATION);
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.vaultAddress,
            functionName: "grantReadAccess",
            args: [1n, TARGET_WALLET, expectedExpiry],
        }));
    });
    (0, vitest_1.it)("returns hash and tokenId", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client);
        const result = await client.grantAccess(9n, "0x0000000000000000000000000000000000000001", 86400);
        (0, vitest_1.expect)(result.hash).toBe(ZERO_HASH);
        (0, vitest_1.expect)(result.tokenId).toBe(9n);
    });
    (0, vitest_1.it)("fetches block timestamp before calling contract", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { pub } = connectClient(client);
        await client.grantAccess(1n, "0x0000000000000000000000000000000000000001", 100);
        (0, vitest_1.expect)(pub.getBlock).toHaveBeenCalledOnce();
    });
});
// ─── revokeAccess() ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — revokeAccess()", () => {
    (0, vitest_1.it)("calls revokeAccess on the vault contract", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client);
        const TARGET = "0x0000000000000000000000000000000000000099";
        const result = await client.revokeAccess(3n, TARGET);
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.vaultAddress,
            functionName: "revokeAccess",
            args: [3n, TARGET],
        }));
        (0, vitest_1.expect)(result.hash).toBe(ZERO_HASH);
        (0, vitest_1.expect)(result.tokenId).toBe(3n);
    });
});
// ─── listForSale() ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — listForSale()", () => {
    (0, vitest_1.it)("first approves registry, then calls listForSale", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client);
        const PRICE = 500000000000000000n; // 0.5 ETH
        await client.listForSale(4n, PRICE);
        // Two writeContract calls: approve + listForSale
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledTimes(2);
        const [approveCall, listCall] = wal.writeContract.mock.calls;
        // First call: approve
        (0, vitest_1.expect)(approveCall[0]).toMatchObject({
            address: TEST_CONFIG.tokenAddress,
            functionName: "approve",
            args: [TEST_CONFIG.registryAddress, 4n],
        });
        // Second call: listForSale
        (0, vitest_1.expect)(listCall[0]).toMatchObject({
            address: TEST_CONFIG.registryAddress,
            functionName: "listForSale",
            args: [4n, PRICE],
        });
    });
    (0, vitest_1.it)("returns hash and tokenId", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client);
        const result = await client.listForSale(2n, 1000000000000000n);
        (0, vitest_1.expect)(result.hash).toBe(ZERO_HASH);
        (0, vitest_1.expect)(result.tokenId).toBe(2n);
    });
});
// ─── buyToken() ───────────────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — buyToken()", () => {
    (0, vitest_1.it)("reads listing price and calls buyToken with correct value", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const LISTING_PRICE = 250000000000000000n; // 0.25 ETH
        // listings() returns: [listingId, seller, price, createdAt, isActive]
        const mockListing = [0n, "0xseller", LISTING_PRICE, 1700000000n, true];
        const { pub, wal } = connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(mockListing),
        });
        const result = await client.buyToken(6n);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.registryAddress,
            functionName: "listings",
            args: [6n],
        }));
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.registryAddress,
            functionName: "buyToken",
            args: [6n],
            value: LISTING_PRICE,
        }));
        (0, vitest_1.expect)(result.hash).toBe(ZERO_HASH);
        (0, vitest_1.expect)(result.tokenId).toBe(6n);
    });
    (0, vitest_1.it)("extracts price from listing index 2", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const PRICE = 100000000000000n;
        const listing = [1n, "0xseller", PRICE, 1700000000n, true];
        const { wal } = connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(listing),
        });
        await client.buyToken(99n);
        const buyCall = wal.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(buyCall.value).toBe(PRICE);
    });
});
// ─── getTokensByOwner() ───────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — getTokensByOwner()", () => {
    (0, vitest_1.it)("returns full token data for each owned token ID", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const OWNER = "0xowner1111111111111111111111111111111111111";
        // readContract is called: once for getTokensByOwner, then 4 times per token (owner, mintedAt, inscCount, tokenURI)
        let callIndex = 0;
        const tokenData = [
            OWNER, 1700000000n, 2n, "data:application/json,token1",
            OWNER, 1700001000n, 5n, "data:application/json,token2",
        ];
        const { pub } = connectClient(client, {
            readContract: vitest_1.vi.fn().mockImplementation(({ functionName }) => {
                if (functionName === "getTokensByOwner") {
                    return Promise.resolve([10n, 11n]);
                }
                return Promise.resolve(tokenData[callIndex++]);
            }),
        });
        const tokens = await client.getTokensByOwner(OWNER);
        (0, vitest_1.expect)(pub.readContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "getTokensByOwner",
            args: [OWNER],
        }));
        (0, vitest_1.expect)(tokens).toHaveLength(2);
        (0, vitest_1.expect)(tokens[0].tokenId).toBe(10n);
        (0, vitest_1.expect)(tokens[1].tokenId).toBe(11n);
    });
    (0, vitest_1.it)("returns empty array when owner holds no tokens", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            readContract: vitest_1.vi.fn().mockImplementation(({ functionName }) => {
                if (functionName === "getTokensByOwner")
                    return Promise.resolve([]);
                return Promise.resolve("fallback");
            }),
        });
        const tokens = await client.getTokensByOwner("0x0000000000000000000000000000000000000000");
        (0, vitest_1.expect)(tokens).toEqual([]);
    });
});
// ─── mintToken() batch (quantity > 1) ────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — mintToken() batch", () => {
    (0, vitest_1.it)("calls batchMint when quantity > 1", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const MINT_PRICE = 10000000000000000n; // 0.01 ETH
        const { wal } = connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(MINT_PRICE),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [
                    { topics: ["0xTransfer", "0x0", "0xuser", "0x1"] },
                    { topics: ["0xTransfer", "0x0", "0xuser", "0x2"] },
                    { topics: ["0xTransfer", "0x0", "0xuser", "0x3"] },
                ],
            }),
        });
        const result = await client.mintToken({ quantity: 3 });
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            functionName: "batchMint",
            args: [3n],
            value: MINT_PRICE * 3n,
        }));
        // result.tokenId is the first tokenId from the batch
        (0, vitest_1.expect)(result.tokenId).toBe(1n);
    });
    (0, vitest_1.it)("multiplies mint price by quantity for batchMint value", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const PRICE = 5000000000000000n; // 0.005 ETH
        const { wal } = connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(PRICE),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        });
        await client.mintToken({ quantity: 10 });
        const call = wal.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.value).toBe(PRICE * 10n);
    });
    (0, vitest_1.it)("single mint (quantity=1) uses regular mint, not batchMint", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        });
        await client.mintToken({ quantity: 1 });
        const call = wal.writeContract.mock.calls[0][0];
        (0, vitest_1.expect)(call.functionName).toBe("mint"); // not batchMint
    });
    (0, vitest_1.it)("extractAllTokenIdsFromLogs: skips log with invalid topic[3] (catch branch)", async () => {
        // First log has an unparseable topic[3] — BigInt("not-a-bigint") throws → catch fires
        // Second log is valid — should be included in result
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const MINT_PRICE = 1000000000000000n;
        connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(MINT_PRICE),
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [
                    { topics: ["0xTransfer", "0x0", "0xuser", "not-a-bigint"] }, // ← triggers catch
                    { topics: ["0xTransfer", "0x0", "0xuser", "0x5"] }, // ← valid: 5n
                ],
            }),
        });
        const result = await client.mintToken({ quantity: 2 });
        // Only the valid log contributes; tokenId = first valid tokenId = 5n
        (0, vitest_1.expect)(result.tokenId).toBe(5n);
    });
    (0, vitest_1.it)("extractInscriptionIndexFromLogs: skips log with invalid topic[2] (catch branch), falls back to next valid log", async () => {
        // First log has an unparseable topic[2] — BigInt throws → catch fires → continue
        // Second log has valid topic[2] = 0x9 → inscriptionIndex = 9n
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [
                    { topics: ["0xInscribed", "0x1", "not-a-bigint"] }, // ← triggers catch
                    { topics: ["0xInscribed", "0x1", "0x9"] }, // ← valid: 9n
                ],
            }),
        });
        injectMockArweave(client);
        const result = await client.inscribe(1n, "data");
        (0, vitest_1.expect)(result.inscriptionIndex).toBe(9n);
    });
});
// ─── inscribe() full flow ─────────────────────────────────────────────────────
(0, vitest_1.describe)("InkdClient — inscribe() full flow", () => {
    (0, vitest_1.it)("encrypts, uploads to Arweave, and inscribes on-chain", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client, {
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
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
        (0, vitest_1.expect)(mockArweave.uploadFile).toHaveBeenCalledWith(vitest_1.expect.any(Uint8Array), "application/json", undefined // no extra tags
        );
        // On-chain inscribe
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            address: TEST_CONFIG.vaultAddress,
            functionName: "inscribe",
            args: [5n, "arweave-inscription-id", "application/json", 2048n, "memory.json"],
            value: 0n,
        }));
        (0, vitest_1.expect)(result.hash).toBe(ZERO_HASH);
        (0, vitest_1.expect)(result.inscriptionIndex).toBe(3n);
        (0, vitest_1.expect)(result.upload.hash).toBe("arweave-inscription-id");
        (0, vitest_1.expect)(result.upload.size).toBe(2048);
    });
    (0, vitest_1.it)("handles string data input by converting to Buffer", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        });
        const mockArweave = injectMockArweave(client);
        await client.inscribe(1n, "plain string data");
        const uploadCall = mockArweave.uploadFile.mock.calls[0];
        (0, vitest_1.expect)(uploadCall[0]).toBeInstanceOf(Uint8Array);
    });
    (0, vitest_1.it)("uses default contentType when none provided", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        });
        const mockArweave = injectMockArweave(client);
        await client.inscribe(1n, Buffer.from("data"));
        const uploadCall = mockArweave.uploadFile.mock.calls[0];
        (0, vitest_1.expect)(uploadCall[1]).toBe("application/octet-stream");
    });
    (0, vitest_1.it)("passes custom value to writeContract when specified", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const { wal } = connectClient(client, {
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        });
        injectMockArweave(client);
        const CUSTOM_VALUE = 1000000000000000n;
        await client.inscribe(1n, "data", { value: CUSTOM_VALUE });
        (0, vitest_1.expect)(wal.writeContract).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ value: CUSTOM_VALUE }));
    });
    (0, vitest_1.it)("returns inscriptionIndex=0n when no matching logs", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({
                logs: [{ topics: ["0xSomeOtherEvent"] }],
            }),
        });
        injectMockArweave(client);
        const result = await client.inscribe(1n, "data");
        (0, vitest_1.expect)(result.inscriptionIndex).toBe(0n);
    });
});
// ─── estimateInscribeCost() edge cases ───────────────────────────────────────
(0, vitest_1.describe)("InkdClient — estimateInscribeCost() edge cases", () => {
    (0, vitest_1.it)("handles 0 bytes gracefully (rounds up to 1 KB for arweave)", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
        });
        const estimate = await client.estimateInscribeCost(0);
        // ceil(0 / 1024) = 0, so arweave cost = 0
        (0, vitest_1.expect)(estimate.arweave).toBe(0n);
        (0, vitest_1.expect)(estimate.total).toBeGreaterThan(0n); // gas still applies
    });
    (0, vitest_1.it)("has total = gas + arweave + protocolFee always", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(100n), // 1% fee
        });
        const estimate = await client.estimateInscribeCost(50_000);
        (0, vitest_1.expect)(estimate.total).toBe(estimate.gas + estimate.arweave + estimate.protocolFee);
    });
    (0, vitest_1.it)("protocol fee is zero when feeBps is 0", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            readContract: vitest_1.vi.fn().mockResolvedValue(0n),
        });
        const estimate = await client.estimateInscribeCost(1024);
        (0, vitest_1.expect)(estimate.protocolFee).toBe(0n);
    });
    (0, vitest_1.it)("larger feeBps yields higher protocolFee", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        const withLowFee = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(10n),
        });
        const withHighFee = makeMockPublicClient({
            readContract: vitest_1.vi.fn().mockResolvedValue(500n),
        });
        const clientA = new InkdClient_1.InkdClient(TEST_CONFIG);
        const clientB = new InkdClient_1.InkdClient(TEST_CONFIG);
        // @ts-expect-error — mock
        clientA.connect(makeMockWalletClient(), withLowFee);
        // @ts-expect-error — mock
        clientB.connect(makeMockWalletClient(), withHighFee);
        const estA = await clientA.estimateInscribeCost(1024);
        const estB = await clientB.estimateInscribeCost(1024);
        (0, vitest_1.expect)(estB.protocolFee).toBeGreaterThan(estA.protocolFee);
        void client; // suppress unused warning
    });
});
// ─── setEncryptionProvider() with inscribe integration ────────────────────────
(0, vitest_1.describe)("InkdClient — custom encryption provider with inscribe", () => {
    (0, vitest_1.it)("uses the custom provider's encrypt method instead of passthrough", async () => {
        const client = new InkdClient_1.InkdClient(TEST_CONFIG);
        connectClient(client, {
            waitForTransactionReceipt: vitest_1.vi.fn().mockResolvedValue({ logs: [] }),
        });
        const ENCRYPTED_DATA = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        const mockProvider = {
            encrypt: vitest_1.vi.fn().mockResolvedValue({
                ciphertext: ENCRYPTED_DATA,
                encryptedSymmetricKey: "mock-key",
                accessControlConditions: [],
            }),
            decrypt: vitest_1.vi.fn(),
        };
        client.setEncryptionProvider(mockProvider);
        const mockArweave = injectMockArweave(client);
        await client.inscribe(1n, Buffer.from("raw data"));
        (0, vitest_1.expect)(mockProvider.encrypt).toHaveBeenCalledOnce();
        // The encrypted payload should have been passed to arweave upload
        (0, vitest_1.expect)(mockArweave.uploadFile).toHaveBeenCalledWith(ENCRYPTED_DATA, "application/octet-stream", undefined);
    });
});
//# sourceMappingURL=InkdClient.advanced.test.js.map