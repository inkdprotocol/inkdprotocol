"use strict";
/**
 * @file vault.test.ts
 * @description Tests for AgentVault — ECIES wallet-key credential storage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const vault_js_1 = require("../vault.js");
const secp256k1_1 = require("@noble/curves/secp256k1");
const aes_1 = require("@noble/ciphers/aes");
const hkdf_1 = require("@noble/hashes/hkdf");
const sha256_1 = require("@noble/hashes/sha256");
const webcrypto_1 = require("@noble/ciphers/webcrypto");
// Anvil test key #0 — safe for tests, never use in prod
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// Different key — used to test wrong-key failures
const OTHER_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeMockArweave(downloadData) {
    return {
        uploadFile: vitest_1.vi.fn().mockResolvedValue({ hash: "QmTestHash123", url: "https://arweave.net/QmTestHash123" }),
        downloadData: vitest_1.vi.fn().mockResolvedValue(downloadData ?? Buffer.alloc(0)),
        connect: vitest_1.vi.fn(),
    };
}
// ─── Constructor ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("AgentVault constructor", () => {
    (0, vitest_1.it)("creates a vault from a valid private key", () => {
        (0, vitest_1.expect)(() => new vault_js_1.AgentVault(TEST_PRIVATE_KEY)).not.toThrow();
    });
    (0, vitest_1.it)("throws on invalid private key length", () => {
        (0, vitest_1.expect)(() => new vault_js_1.AgentVault("0xdeadbeef")).toThrow("32 bytes");
    });
    (0, vitest_1.it)("throws on private key without 0x prefix treated as wrong length", () => {
        // 63 hex chars — odd length => invalid
        const bad = ("0x" + "a".repeat(63));
        (0, vitest_1.expect)(() => new vault_js_1.AgentVault(bad)).toThrow();
    });
});
// ─── seal / unseal ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("AgentVault seal/unseal", () => {
    let vault;
    (0, vitest_1.beforeEach)(() => {
        vault = new vault_js_1.AgentVault(TEST_PRIVATE_KEY);
    });
    (0, vitest_1.it)("seal returns a Uint8Array", async () => {
        const encrypted = await vault.seal({ foo: "bar" });
        (0, vitest_1.expect)(encrypted).toBeInstanceOf(Uint8Array);
    });
    (0, vitest_1.it)("seal/unseal roundtrip — simple object", async () => {
        const credentials = { openaiKey: "sk-test123", model: "gpt-4" };
        const encrypted = await vault.seal(credentials);
        const decrypted = await vault.unseal(encrypted);
        (0, vitest_1.expect)(decrypted).toEqual(credentials);
    });
    (0, vitest_1.it)("seal/unseal roundtrip — nested object", async () => {
        const credentials = {
            arweaveKey: { kty: "RSA", n: "abc123", e: "AQAB" },
            apiKeys: { openai: "sk-x", anthropic: "sk-ant-y" },
            count: 42,
            flag: true,
        };
        const encrypted = await vault.seal(credentials);
        const decrypted = await vault.unseal(encrypted);
        (0, vitest_1.expect)(decrypted).toEqual(credentials);
    });
    (0, vitest_1.it)("seal/unseal roundtrip — empty object", async () => {
        const encrypted = await vault.seal({});
        const decrypted = await vault.unseal(encrypted);
        (0, vitest_1.expect)(decrypted).toEqual({});
    });
    (0, vitest_1.it)("seal/unseal roundtrip — unicode values", async () => {
        const credentials = { msg: "héllo wörld 🔐", lang: "de" };
        const encrypted = await vault.seal(credentials);
        const decrypted = await vault.unseal(encrypted);
        (0, vitest_1.expect)(decrypted).toEqual(credentials);
    });
    (0, vitest_1.it)("each seal call produces different ciphertext (random IV + ephemeral key)", async () => {
        const credentials = { secret: "same-value" };
        const enc1 = await vault.seal(credentials);
        const enc2 = await vault.seal(credentials);
        // Should differ due to random IV and ephemeral key
        (0, vitest_1.expect)(Buffer.from(enc1).toString("hex")).not.toBe(Buffer.from(enc2).toString("hex"));
    });
    (0, vitest_1.it)("encrypted blob has correct minimum length", async () => {
        const encrypted = await vault.seal({ x: 1 });
        // 33 (pubkey) + 12 (IV) + 16 (tag) + at least 1 byte ciphertext
        (0, vitest_1.expect)(encrypted.length).toBeGreaterThan(33 + 12 + 16);
    });
    (0, vitest_1.it)("unseal fails with wrong private key", async () => {
        const encrypted = await vault.seal({ secret: "mine" });
        const wrongVault = new vault_js_1.AgentVault(OTHER_PRIVATE_KEY);
        await (0, vitest_1.expect)(wrongVault.unseal(encrypted)).rejects.toThrow();
    });
    (0, vitest_1.it)("unseal fails with corrupted data", async () => {
        const encrypted = await vault.seal({ secret: "mine" });
        // Flip a byte in the ciphertext area
        const corrupted = new Uint8Array(encrypted);
        corrupted[corrupted.length - 1] ^= 0xff;
        await (0, vitest_1.expect)(vault.unseal(corrupted)).rejects.toThrow();
    });
    (0, vitest_1.it)("unseal fails with too-short data", async () => {
        const tooShort = new Uint8Array(10);
        await (0, vitest_1.expect)(vault.unseal(tooShort)).rejects.toThrow("too short");
    });
    (0, vitest_1.it)("unseal fails with invalid ephemeral pubkey", async () => {
        const encrypted = await vault.seal({ x: 1 });
        const bad = new Uint8Array(encrypted);
        // Zero out the ephemeral pubkey bytes
        bad.fill(0, 0, 33);
        await (0, vitest_1.expect)(vault.unseal(bad)).rejects.toThrow();
    });
});
// ─── store / load ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("AgentVault store/load", () => {
    let vault;
    (0, vitest_1.beforeEach)(() => {
        vault = new vault_js_1.AgentVault(TEST_PRIVATE_KEY);
    });
    (0, vitest_1.it)("store calls arweave.uploadFile and returns ar:// hash", async () => {
        const arweave = makeMockArweave();
        const hash = await vault.store({ apiKey: "secret" }, arweave);
        (0, vitest_1.expect)(hash).toBe("ar://QmTestHash123");
        (0, vitest_1.expect)(arweave.uploadFile).toHaveBeenCalledOnce();
        // Should upload as binary
        const [data, contentType] = arweave.uploadFile.mock.calls[0];
        (0, vitest_1.expect)(data).toBeInstanceOf(Uint8Array);
        (0, vitest_1.expect)(contentType).toBe("application/octet-stream");
    });
    (0, vitest_1.it)("store sets Inkd-Vault tag", async () => {
        const arweave = makeMockArweave();
        await vault.store({ x: 1 }, arweave);
        const [, , tags] = arweave.uploadFile.mock.calls[0];
        (0, vitest_1.expect)(tags).toMatchObject({ "Inkd-Vault": "true" });
    });
    (0, vitest_1.it)("load strips ar:// prefix and calls downloadData", async () => {
        const credentials = { key: "loaded-value" };
        const encrypted = await vault.seal(credentials);
        const arweave = makeMockArweave(encrypted);
        const loaded = await vault.load("ar://QmTestHash123", arweave);
        (0, vitest_1.expect)(arweave.downloadData).toHaveBeenCalledWith("QmTestHash123");
        (0, vitest_1.expect)(loaded).toEqual(credentials);
    });
    (0, vitest_1.it)("load works without ar:// prefix", async () => {
        const credentials = { bare: "hash" };
        const encrypted = await vault.seal(credentials);
        const arweave = makeMockArweave(encrypted);
        const loaded = await vault.load("QmBareHash", arweave);
        (0, vitest_1.expect)(arweave.downloadData).toHaveBeenCalledWith("QmBareHash");
        (0, vitest_1.expect)(loaded).toEqual(credentials);
    });
    (0, vitest_1.it)("store/load full roundtrip", async () => {
        const credentials = {
            arweaveKey: { kty: "RSA", n: "bignum", e: "AQAB" },
            openaiKey: "sk-abc",
            balance: 9.99,
        };
        // Capture what was uploaded, then serve it back on download
        let uploadedBytes;
        const arweave = {
            uploadFile: vitest_1.vi.fn().mockImplementation(async (data) => {
                uploadedBytes = data;
                return { hash: "QmRoundtrip", url: "https://arweave.net/QmRoundtrip" };
            }),
            downloadData: vitest_1.vi.fn().mockImplementation(async () => {
                return Buffer.from(uploadedBytes);
            }),
        };
        const hash = await vault.store(credentials, arweave);
        (0, vitest_1.expect)(hash).toBe("ar://QmRoundtrip");
        const loaded = await vault.load(hash, arweave);
        (0, vitest_1.expect)(loaded).toEqual(credentials);
    });
    (0, vitest_1.it)("load fails if data was sealed by a different vault", async () => {
        const otherVault = new vault_js_1.AgentVault(OTHER_PRIVATE_KEY);
        const encrypted = await otherVault.seal({ secret: "theirs" });
        const arweave = makeMockArweave(encrypted);
        await (0, vitest_1.expect)(vault.load("ar://QmSomething", arweave)).rejects.toThrow();
    });
});
// ─── two-vault cross-encryption ──────────────────────────────────────────────
(0, vitest_1.describe)("AgentVault cross-key isolation", () => {
    (0, vitest_1.it)("vault A cannot unseal vault B's credentials", async () => {
        const vaultA = new vault_js_1.AgentVault(TEST_PRIVATE_KEY);
        const vaultB = new vault_js_1.AgentVault(OTHER_PRIVATE_KEY);
        const encryptedByA = await vaultA.seal({ owner: "A" });
        const encryptedByB = await vaultB.seal({ owner: "B" });
        // Each can unseal its own
        (0, vitest_1.expect)(await vaultA.unseal(encryptedByA)).toEqual({ owner: "A" });
        (0, vitest_1.expect)(await vaultB.unseal(encryptedByB)).toEqual({ owner: "B" });
        // Neither can unseal the other's
        await (0, vitest_1.expect)(vaultB.unseal(encryptedByA)).rejects.toThrow();
        await (0, vitest_1.expect)(vaultA.unseal(encryptedByB)).rejects.toThrow();
    });
});
// ─── Branch coverage: unseal JSON.parse catch (vault.ts L134-135) ────────────
/**
 * Helper: construct a valid ECIES blob whose *plaintext* is arbitrary bytes
 * (not the JSON.stringify output that seal() always produces).
 *
 * Replicates vault.ts seal() but accepts a raw Uint8Array plaintext instead of
 * a credentials object. This is the only way to reach the
 * `JSON.parse(TextDecoder.decode(plaintext))` catch branch in unseal().
 */
async function sealRaw(plaintext, recipientPrivKey) {
    // Derive recipient public key from private key
    function hexToBytes(hex) {
        const b = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2)
            b[i / 2] = parseInt(hex.slice(i, i + 2), 16);
        return b;
    }
    const privBytes = hexToBytes(recipientPrivKey.startsWith("0x") ? recipientPrivKey.slice(2) : recipientPrivKey);
    const recipientPubKey = secp256k1_1.secp256k1.getPublicKey(privBytes, true); // compressed
    const ephemeralPrivKey = secp256k1_1.secp256k1.utils.randomPrivateKey();
    const ephemeralPubKey = secp256k1_1.secp256k1.getPublicKey(ephemeralPrivKey, true);
    const sharedPoint = secp256k1_1.secp256k1.getSharedSecret(ephemeralPrivKey, recipientPubKey);
    const sharedSecret = sharedPoint.slice(1, 33); // x-coord only
    const aesKey = (0, hkdf_1.hkdf)(sha256_1.sha256, sharedSecret, undefined, undefined, 32);
    const iv = (0, webcrypto_1.randomBytes)(12);
    const cipher = (0, aes_1.gcm)(aesKey, iv);
    const cipherWithTag = cipher.encrypt(plaintext);
    // Pack: [ephemeralPubKey(33)][iv(12)][ciphertext+tag]
    const result = new Uint8Array(ephemeralPubKey.length + iv.length + cipherWithTag.length);
    result.set(ephemeralPubKey, 0);
    result.set(iv, ephemeralPubKey.length);
    result.set(cipherWithTag, ephemeralPubKey.length + iv.length);
    return result;
}
// ─── Branch coverage: constructor L55 + load L167 ────────────────────────────
(0, vitest_1.describe)("AgentVault branch coverage — constructor + load ternaries", () => {
    (0, vitest_1.it)("L55: accepts private key without 0x prefix (startsWith false branch)", () => {
        // TypeScript type is `0x${string}` but at runtime the code strips '0x' only if present.
        // Pass 64-hex-char key without the prefix to cover the else branch.
        const rawHex = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        // Cast to satisfy the type parameter; runtime behaviour under test is the ternary
        const vault = new vault_js_1.AgentVault(rawHex);
        (0, vitest_1.expect)(vault).toBeInstanceOf(vault_js_1.AgentVault);
    });
    (0, vitest_1.it)("L167: load handles ArrayBuffer returned by downloadData (instanceof false branch)", async () => {
        const vault = new vault_js_1.AgentVault(TEST_PRIVATE_KEY);
        const credentials = { coverage: "arraybuffer-branch" };
        const encrypted = await vault.seal(credentials);
        // Return a plain ArrayBuffer, not a Uint8Array / Buffer
        const ab = encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength);
        const arweave = {
            uploadFile: vitest_1.vi.fn(),
            downloadData: vitest_1.vi.fn().mockResolvedValue(ab),
        };
        const loaded = await vault.load("ar://QmAB", arweave);
        (0, vitest_1.expect)(loaded).toEqual(credentials);
    });
});
// ─── Branch coverage: unseal JSON.parse catch (vault.ts L134-135) ────────────
(0, vitest_1.describe)("AgentVault unseal — JSON.parse catch branch (vault.ts L134-135)", () => {
    (0, vitest_1.it)("throws EncryptionError('Decrypted data is not valid JSON') when plaintext is valid UTF-8 but not JSON", async () => {
        // Craft a blob that decrypts successfully (right key, valid crypto) but
        // whose plaintext is NOT valid JSON — triggers the second catch in unseal().
        const vault = new vault_js_1.AgentVault(TEST_PRIVATE_KEY);
        const nonJsonPlaintext = new TextEncoder().encode("not valid json !!!");
        const blob = await sealRaw(nonJsonPlaintext, TEST_PRIVATE_KEY);
        await (0, vitest_1.expect)(vault.unseal(blob)).rejects.toThrow("Decrypted data is not valid JSON");
    });
    (0, vitest_1.it)("throws EncryptionError for binary plaintext that is not UTF-8 JSON", async () => {
        // Random binary bytes — definitely not valid JSON
        const vault = new vault_js_1.AgentVault(TEST_PRIVATE_KEY);
        const binaryPlaintext = new Uint8Array([0x80, 0x81, 0x82, 0xff, 0xfe, 0x00, 0x01]);
        const blob = await sealRaw(binaryPlaintext, TEST_PRIVATE_KEY);
        await (0, vitest_1.expect)(vault.unseal(blob)).rejects.toThrow("Decrypted data is not valid JSON");
    });
});
//# sourceMappingURL=vault.test.js.map