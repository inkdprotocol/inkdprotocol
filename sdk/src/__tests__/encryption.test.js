"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const encryption_1 = require("../encryption");
const errors_1 = require("../errors");
const CONTRACT = "0x1111111111111111111111111111111111111111";
const TOKEN_ID = 1n;
function makeEncryptedData(data) {
    return { ciphertext: data, encryptedSymmetricKey: "", accessControlConditions: [] };
}
(0, vitest_1.describe)("PassthroughEncryption", () => {
    const provider = new encryption_1.PassthroughEncryption();
    (0, vitest_1.it)("encrypt: returns ciphertext identical to input", async () => {
        const input = new Uint8Array([1, 2, 3, 4, 5]);
        const result = await provider.encrypt(input, TOKEN_ID, CONTRACT);
        (0, vitest_1.expect)(result.ciphertext).toEqual(input);
        (0, vitest_1.expect)(result.encryptedSymmetricKey).toBe("");
        (0, vitest_1.expect)(result.accessControlConditions).toEqual([]);
    });
    (0, vitest_1.it)("encrypt: handles empty data", async () => {
        const input = new Uint8Array(0);
        const result = await provider.encrypt(input, TOKEN_ID, CONTRACT);
        (0, vitest_1.expect)(result.ciphertext.length).toBe(0);
    });
    (0, vitest_1.it)("encrypt: handles large payloads (100 KB)", async () => {
        const input = new Uint8Array(100_000).fill(0xff);
        const result = await provider.encrypt(input, TOKEN_ID, CONTRACT);
        (0, vitest_1.expect)(result.ciphertext.length).toBe(100_000);
        (0, vitest_1.expect)(result.ciphertext[99_999]).toBe(0xff);
    });
    (0, vitest_1.it)("decrypt: returns ciphertext unchanged", async () => {
        const bytes = new Uint8Array([10, 20, 30]);
        const encrypted = makeEncryptedData(bytes);
        const decrypted = await provider.decrypt(encrypted, TOKEN_ID, CONTRACT);
        (0, vitest_1.expect)(decrypted).toEqual(bytes);
    });
    (0, vitest_1.it)("round-trip: encrypt then decrypt yields original", async () => {
        const original = new TextEncoder().encode("agent brain v0.1");
        const encryptResult = await provider.encrypt(original, TOKEN_ID, CONTRACT);
        const restored = await provider.decrypt(encryptResult, TOKEN_ID, CONTRACT);
        (0, vitest_1.expect)(restored).toEqual(original);
    });
    (0, vitest_1.it)("round-trip with JSON payload", async () => {
        const payload = JSON.stringify({ type: "agent-brain", version: 1, slots: 64 });
        const input = new TextEncoder().encode(payload);
        const encryptResult = await provider.encrypt(input, TOKEN_ID, CONTRACT);
        const restored = await provider.decrypt(encryptResult, TOKEN_ID, CONTRACT);
        const decoded = new TextDecoder().decode(restored);
        (0, vitest_1.expect)(JSON.parse(decoded)).toEqual({ type: "agent-brain", version: 1, slots: 64 });
    });
    (0, vitest_1.it)("works with different token IDs without cross-contamination", async () => {
        const data1 = new Uint8Array([1, 1, 1]);
        const data2 = new Uint8Array([2, 2, 2]);
        const r1 = await provider.encrypt(data1, 1n, CONTRACT);
        const r2 = await provider.encrypt(data2, 2n, CONTRACT);
        (0, vitest_1.expect)(r1.ciphertext).toEqual(data1);
        (0, vitest_1.expect)(r2.ciphertext).toEqual(data2);
    });
});
// ---------------------------------------------------------------------------
// LitEncryptionProvider — V1 stub (all methods throw EncryptionError)
// ---------------------------------------------------------------------------
const LIT_CONFIG = { network: "datil", chain: "base" };
const LIT_TOKEN_ID = 42n;
function litFixture() {
    return new encryption_1.LitEncryptionProvider(LIT_CONFIG);
}
function makeLitEncryptedData(data) {
    return { ciphertext: data, encryptedSymmetricKey: "key", accessControlConditions: [] };
}
(0, vitest_1.describe)("LitEncryptionProvider — constructor", () => {
    (0, vitest_1.it)("instantiates without throwing", () => {
        (0, vitest_1.expect)(() => new encryption_1.LitEncryptionProvider(LIT_CONFIG)).not.toThrow();
    });
    (0, vitest_1.it)("accepts datil-dev and datil-test network variants", () => {
        const cfgDev = { network: "datil-dev", chain: "base-sepolia" };
        const cfgTest = { network: "datil-test", chain: "polygon" };
        (0, vitest_1.expect)(() => new encryption_1.LitEncryptionProvider(cfgDev)).not.toThrow();
        (0, vitest_1.expect)(() => new encryption_1.LitEncryptionProvider(cfgTest)).not.toThrow();
    });
});
(0, vitest_1.describe)("LitEncryptionProvider — connect()", () => {
    (0, vitest_1.it)("throws EncryptionError", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.connect()).rejects.toThrow(errors_1.EncryptionError);
    });
    (0, vitest_1.it)("error message mentions V2", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.connect()).rejects.toThrow(/V2/);
    });
    (0, vitest_1.it)("error message mentions PassthroughEncryption", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.connect()).rejects.toThrow(/PassthroughEncryption/);
    });
});
(0, vitest_1.describe)("LitEncryptionProvider — encrypt()", () => {
    (0, vitest_1.it)("throws EncryptionError", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.encrypt(new Uint8Array([1, 2, 3]), LIT_TOKEN_ID, CONTRACT)).rejects.toThrow(errors_1.EncryptionError);
    });
    (0, vitest_1.it)("error message mentions V2", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.encrypt(new Uint8Array(), LIT_TOKEN_ID, CONTRACT)).rejects.toThrow(/V2/);
    });
    (0, vitest_1.it)("throws even with empty data", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.encrypt(new Uint8Array(0), 0n, CONTRACT)).rejects.toBeInstanceOf(errors_1.EncryptionError);
    });
});
(0, vitest_1.describe)("LitEncryptionProvider — decrypt()", () => {
    (0, vitest_1.it)("throws EncryptionError", async () => {
        const provider = litFixture();
        const enc = makeLitEncryptedData(new Uint8Array([5, 6, 7]));
        await (0, vitest_1.expect)(provider.decrypt(enc, LIT_TOKEN_ID, CONTRACT)).rejects.toThrow(errors_1.EncryptionError);
    });
    (0, vitest_1.it)("error message mentions V2", async () => {
        const provider = litFixture();
        const enc = makeLitEncryptedData(new Uint8Array([0]));
        await (0, vitest_1.expect)(provider.decrypt(enc, LIT_TOKEN_ID, CONTRACT)).rejects.toThrow(/V2/);
    });
});
(0, vitest_1.describe)("LitEncryptionProvider — encryptForToken()", () => {
    (0, vitest_1.it)("throws EncryptionError (delegates to encrypt)", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.encryptForToken(new Uint8Array([1, 2]), LIT_TOKEN_ID)).rejects.toThrow(errors_1.EncryptionError);
    });
    (0, vitest_1.it)("uses default address 0x0 when contractAddress omitted", async () => {
        const provider = litFixture();
        // Still throws — but the default param path is exercised
        await (0, vitest_1.expect)(provider.encryptForToken(new Uint8Array(), LIT_TOKEN_ID, undefined)).rejects.toBeInstanceOf(errors_1.EncryptionError);
    });
    (0, vitest_1.it)("uses provided contractAddress when supplied", async () => {
        const provider = litFixture();
        await (0, vitest_1.expect)(provider.encryptForToken(new Uint8Array([9]), LIT_TOKEN_ID, CONTRACT)).rejects.toBeInstanceOf(errors_1.EncryptionError);
    });
});
(0, vitest_1.describe)("LitEncryptionProvider — decryptWithToken()", () => {
    (0, vitest_1.it)("throws EncryptionError (delegates to decrypt)", async () => {
        const provider = litFixture();
        const enc = makeLitEncryptedData(new Uint8Array([3, 2, 1]));
        await (0, vitest_1.expect)(provider.decryptWithToken(enc, LIT_TOKEN_ID)).rejects.toThrow(errors_1.EncryptionError);
    });
    (0, vitest_1.it)("uses default address 0x0 when contractAddress omitted", async () => {
        const provider = litFixture();
        const enc = makeLitEncryptedData(new Uint8Array());
        await (0, vitest_1.expect)(provider.decryptWithToken(enc, LIT_TOKEN_ID, undefined)).rejects.toBeInstanceOf(errors_1.EncryptionError);
    });
    (0, vitest_1.it)("uses provided contractAddress when supplied", async () => {
        const provider = litFixture();
        const enc = makeLitEncryptedData(new Uint8Array([1]));
        await (0, vitest_1.expect)(provider.decryptWithToken(enc, LIT_TOKEN_ID, CONTRACT)).rejects.toBeInstanceOf(errors_1.EncryptionError);
    });
});
//# sourceMappingURL=encryption.test.js.map