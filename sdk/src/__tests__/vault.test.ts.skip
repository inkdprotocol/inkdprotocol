/**
 * @file vault.test.ts
 * @description Tests for AgentVault — ECIES wallet-key credential storage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentVault } from "../vault.js";
import { secp256k1 } from "@noble/curves/secp256k1";
import { gcm } from "@noble/ciphers/aes";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/ciphers/webcrypto";

// Anvil test key #0 — safe for tests, never use in prod
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
// Different key — used to test wrong-key failures
const OTHER_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockArweave(downloadData?: Uint8Array) {
  return {
    uploadFile: vi.fn().mockResolvedValue({ hash: "QmTestHash123", url: "https://arweave.net/QmTestHash123" }),
    downloadData: vi.fn().mockResolvedValue(downloadData ?? Buffer.alloc(0)),
    connect: vi.fn(),
  };
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe("AgentVault constructor", () => {
  it("creates a vault from a valid private key", () => {
    expect(() => new AgentVault(TEST_PRIVATE_KEY)).not.toThrow();
  });

  it("throws on invalid private key length", () => {
    expect(() => new AgentVault("0xdeadbeef" as `0x${string}`)).toThrow("32 bytes");
  });

  it("throws on private key without 0x prefix treated as wrong length", () => {
    // 63 hex chars — odd length => invalid
    const bad = ("0x" + "a".repeat(63)) as `0x${string}`;
    expect(() => new AgentVault(bad)).toThrow();
  });
});

// ─── seal / unseal ───────────────────────────────────────────────────────────

describe("AgentVault seal/unseal", () => {
  let vault: AgentVault;

  beforeEach(() => {
    vault = new AgentVault(TEST_PRIVATE_KEY);
  });

  it("seal returns a Uint8Array", async () => {
    const encrypted = await vault.seal({ foo: "bar" });
    expect(encrypted).toBeInstanceOf(Uint8Array);
  });

  it("seal/unseal roundtrip — simple object", async () => {
    const credentials = { openaiKey: "sk-test123", model: "gpt-4" };
    const encrypted = await vault.seal(credentials);
    const decrypted = await vault.unseal(encrypted);
    expect(decrypted).toEqual(credentials);
  });

  it("seal/unseal roundtrip — nested object", async () => {
    const credentials = {
      arweaveKey: { kty: "RSA", n: "abc123", e: "AQAB" },
      apiKeys: { openai: "sk-x", anthropic: "sk-ant-y" },
      count: 42,
      flag: true,
    };
    const encrypted = await vault.seal(credentials);
    const decrypted = await vault.unseal(encrypted);
    expect(decrypted).toEqual(credentials);
  });

  it("seal/unseal roundtrip — empty object", async () => {
    const encrypted = await vault.seal({});
    const decrypted = await vault.unseal(encrypted);
    expect(decrypted).toEqual({});
  });

  it("seal/unseal roundtrip — unicode values", async () => {
    const credentials = { msg: "héllo wörld 🔐", lang: "de" };
    const encrypted = await vault.seal(credentials);
    const decrypted = await vault.unseal(encrypted);
    expect(decrypted).toEqual(credentials);
  });

  it("each seal call produces different ciphertext (random IV + ephemeral key)", async () => {
    const credentials = { secret: "same-value" };
    const enc1 = await vault.seal(credentials);
    const enc2 = await vault.seal(credentials);
    // Should differ due to random IV and ephemeral key
    expect(Buffer.from(enc1).toString("hex")).not.toBe(Buffer.from(enc2).toString("hex"));
  });

  it("encrypted blob has correct minimum length", async () => {
    const encrypted = await vault.seal({ x: 1 });
    // 33 (pubkey) + 12 (IV) + 16 (tag) + at least 1 byte ciphertext
    expect(encrypted.length).toBeGreaterThan(33 + 12 + 16);
  });

  it("unseal fails with wrong private key", async () => {
    const encrypted = await vault.seal({ secret: "mine" });
    const wrongVault = new AgentVault(OTHER_PRIVATE_KEY);
    await expect(wrongVault.unseal(encrypted)).rejects.toThrow();
  });

  it("unseal fails with corrupted data", async () => {
    const encrypted = await vault.seal({ secret: "mine" });
    // Flip a byte in the ciphertext area
    const corrupted = new Uint8Array(encrypted);
    corrupted[corrupted.length - 1] ^= 0xff;
    await expect(vault.unseal(corrupted)).rejects.toThrow();
  });

  it("unseal fails with too-short data", async () => {
    const tooShort = new Uint8Array(10);
    await expect(vault.unseal(tooShort)).rejects.toThrow("too short");
  });

  it("unseal fails with invalid ephemeral pubkey", async () => {
    const encrypted = await vault.seal({ x: 1 });
    const bad = new Uint8Array(encrypted);
    // Zero out the ephemeral pubkey bytes
    bad.fill(0, 0, 33);
    await expect(vault.unseal(bad)).rejects.toThrow();
  });
});

// ─── store / load ────────────────────────────────────────────────────────────

describe("AgentVault store/load", () => {
  let vault: AgentVault;

  beforeEach(() => {
    vault = new AgentVault(TEST_PRIVATE_KEY);
  });

  it("store calls arweave.uploadFile and returns ar:// hash", async () => {
    const arweave = makeMockArweave();
    const hash = await vault.store({ apiKey: "secret" }, arweave as never);
    expect(hash).toBe("ar://QmTestHash123");
    expect(arweave.uploadFile).toHaveBeenCalledOnce();
    // Should upload as binary
    const [data, contentType] = arweave.uploadFile.mock.calls[0];
    expect(data).toBeInstanceOf(Uint8Array);
    expect(contentType).toBe("application/octet-stream");
  });

  it("store sets Inkd-Vault tag", async () => {
    const arweave = makeMockArweave();
    await vault.store({ x: 1 }, arweave as never);
    const [, , tags] = arweave.uploadFile.mock.calls[0];
    expect(tags).toMatchObject({ "Inkd-Vault": "true" });
  });

  it("load strips ar:// prefix and calls downloadData", async () => {
    const credentials = { key: "loaded-value" };
    const encrypted = await vault.seal(credentials);
    const arweave = makeMockArweave(encrypted);

    const loaded = await vault.load("ar://QmTestHash123", arweave as never);
    expect(arweave.downloadData).toHaveBeenCalledWith("QmTestHash123");
    expect(loaded).toEqual(credentials);
  });

  it("load works without ar:// prefix", async () => {
    const credentials = { bare: "hash" };
    const encrypted = await vault.seal(credentials);
    const arweave = makeMockArweave(encrypted);

    const loaded = await vault.load("QmBareHash", arweave as never);
    expect(arweave.downloadData).toHaveBeenCalledWith("QmBareHash");
    expect(loaded).toEqual(credentials);
  });

  it("store/load full roundtrip", async () => {
    const credentials = {
      arweaveKey: { kty: "RSA", n: "bignum", e: "AQAB" },
      openaiKey: "sk-abc",
      balance: 9.99,
    };

    // Capture what was uploaded, then serve it back on download
    let uploadedBytes: Uint8Array | undefined;
    const arweave = {
      uploadFile: vi.fn().mockImplementation(async (data: Uint8Array) => {
        uploadedBytes = data;
        return { hash: "QmRoundtrip", url: "https://arweave.net/QmRoundtrip" };
      }),
      downloadData: vi.fn().mockImplementation(async () => {
        return Buffer.from(uploadedBytes!);
      }),
    };

    const hash = await vault.store(credentials, arweave as never);
    expect(hash).toBe("ar://QmRoundtrip");

    const loaded = await vault.load(hash, arweave as never);
    expect(loaded).toEqual(credentials);
  });

  it("load fails if data was sealed by a different vault", async () => {
    const otherVault = new AgentVault(OTHER_PRIVATE_KEY);
    const encrypted = await otherVault.seal({ secret: "theirs" });
    const arweave = makeMockArweave(encrypted);

    await expect(vault.load("ar://QmSomething", arweave as never)).rejects.toThrow();
  });
});

// ─── two-vault cross-encryption ──────────────────────────────────────────────

describe("AgentVault cross-key isolation", () => {
  it("vault A cannot unseal vault B's credentials", async () => {
    const vaultA = new AgentVault(TEST_PRIVATE_KEY);
    const vaultB = new AgentVault(OTHER_PRIVATE_KEY);

    const encryptedByA = await vaultA.seal({ owner: "A" });
    const encryptedByB = await vaultB.seal({ owner: "B" });

    // Each can unseal its own
    expect(await vaultA.unseal(encryptedByA)).toEqual({ owner: "A" });
    expect(await vaultB.unseal(encryptedByB)).toEqual({ owner: "B" });

    // Neither can unseal the other's
    await expect(vaultB.unseal(encryptedByA)).rejects.toThrow();
    await expect(vaultA.unseal(encryptedByB)).rejects.toThrow();
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
async function sealRaw(plaintext: Uint8Array, recipientPrivKey: string): Promise<Uint8Array> {
  // Derive recipient public key from private key
  function hexToBytes(hex: string): Uint8Array {
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    return b;
  }
  const privBytes = hexToBytes(recipientPrivKey.startsWith("0x") ? recipientPrivKey.slice(2) : recipientPrivKey);
  const recipientPubKey = secp256k1.getPublicKey(privBytes, true); // compressed

  const ephemeralPrivKey = secp256k1.utils.randomPrivateKey();
  const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivKey, true);

  const sharedPoint = secp256k1.getSharedSecret(ephemeralPrivKey, recipientPubKey);
  const sharedSecret = sharedPoint.slice(1, 33); // x-coord only
  const aesKey = hkdf(sha256, sharedSecret, undefined, undefined, 32);

  const iv = randomBytes(12);
  const cipher = gcm(aesKey, iv);
  const cipherWithTag = cipher.encrypt(plaintext);

  // Pack: [ephemeralPubKey(33)][iv(12)][ciphertext+tag]
  const result = new Uint8Array(ephemeralPubKey.length + iv.length + cipherWithTag.length);
  result.set(ephemeralPubKey, 0);
  result.set(iv, ephemeralPubKey.length);
  result.set(cipherWithTag, ephemeralPubKey.length + iv.length);
  return result;
}

// ─── Branch coverage: constructor L55 + load L167 ────────────────────────────

describe("AgentVault branch coverage — constructor + load ternaries", () => {
  it("L55: accepts private key without 0x prefix (startsWith false branch)", () => {
    // TypeScript type is `0x${string}` but at runtime the code strips '0x' only if present.
    // Pass 64-hex-char key without the prefix to cover the else branch.
    const rawHex = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    // Cast to satisfy the type parameter; runtime behaviour under test is the ternary
    const vault = new AgentVault(rawHex as `0x${string}`);
    expect(vault).toBeInstanceOf(AgentVault);
  });

  it("L167: load handles ArrayBuffer returned by downloadData (instanceof false branch)", async () => {
    const vault = new AgentVault(TEST_PRIVATE_KEY);
    const credentials = { coverage: "arraybuffer-branch" };
    const encrypted = await vault.seal(credentials);

    // Return a plain ArrayBuffer, not a Uint8Array / Buffer
    const ab = encrypted.buffer.slice(
      encrypted.byteOffset,
      encrypted.byteOffset + encrypted.byteLength
    );
    const arweave = {
      uploadFile: vi.fn(),
      downloadData: vi.fn().mockResolvedValue(ab),
    };

    const loaded = await vault.load("ar://QmAB", arweave as never);
    expect(loaded).toEqual(credentials);
  });
});

// ─── Branch coverage: unseal JSON.parse catch (vault.ts L134-135) ────────────

describe("AgentVault unseal — JSON.parse catch branch (vault.ts L134-135)", () => {
  it("throws EncryptionError('Decrypted data is not valid JSON') when plaintext is valid UTF-8 but not JSON", async () => {
    // Craft a blob that decrypts successfully (right key, valid crypto) but
    // whose plaintext is NOT valid JSON — triggers the second catch in unseal().
    const vault = new AgentVault(TEST_PRIVATE_KEY);
    const nonJsonPlaintext = new TextEncoder().encode("not valid json !!!");
    const blob = await sealRaw(nonJsonPlaintext, TEST_PRIVATE_KEY);

    await expect(vault.unseal(blob)).rejects.toThrow("Decrypted data is not valid JSON");
  });

  it("throws EncryptionError for binary plaintext that is not UTF-8 JSON", async () => {
    // Random binary bytes — definitely not valid JSON
    const vault = new AgentVault(TEST_PRIVATE_KEY);
    const binaryPlaintext = new Uint8Array([0x80, 0x81, 0x82, 0xff, 0xfe, 0x00, 0x01]);
    const blob = await sealRaw(binaryPlaintext, TEST_PRIVATE_KEY);

    await expect(vault.unseal(blob)).rejects.toThrow("Decrypted data is not valid JSON");
  });
});

// ─── Multi-Wallet Access ──────────────────────────────────────────────────────

describe("AgentVault — multi-wallet access", () => {
  const GRANTEE_PRIVATE_KEY = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`;

  it("AgentVault.getPublicKey returns 66-char hex string (compressed secp256k1)", () => {
    const pubKey = AgentVault.getPublicKey(TEST_PRIVATE_KEY);
    expect(typeof pubKey).toBe("string");
    expect(pubKey.length).toBe(66); // 33 bytes = 66 hex chars
    expect(pubKey.startsWith("02") || pubKey.startsWith("03")).toBe(true);
  });

  it("getPublicKey is deterministic", () => {
    expect(AgentVault.getPublicKey(TEST_PRIVATE_KEY)).toBe(AgentVault.getPublicKey(TEST_PRIVATE_KEY));
  });

  it("sealForPublicKey produces blob that grantee can unseal", async () => {
    const credentials = { secret: "multi-wallet-test", value: 42 };
    const granteePubKey = AgentVault.getPublicKey(GRANTEE_PRIVATE_KEY);
    const blob = await AgentVault.sealForPublicKey(credentials, granteePubKey);

    const granteeVault = new AgentVault(GRANTEE_PRIVATE_KEY);
    const result = await granteeVault.unseal(blob);
    expect(result).toEqual(credentials);
  });

  it("sealForPublicKey blob cannot be unsealed by a different key", async () => {
    const credentials = { secret: "only-for-grantee" };
    const granteePubKey = AgentVault.getPublicKey(GRANTEE_PRIVATE_KEY);
    const blob = await AgentVault.sealForPublicKey(credentials, granteePubKey);

    const wrongVault = new AgentVault(TEST_PRIVATE_KEY);
    await expect(wrongVault.unseal(blob)).rejects.toThrow();
  });

  it("sealForPublicKey throws on invalid public key length", async () => {
    await expect(
      AgentVault.sealForPublicKey({ x: 1 }, "deadbeef")
    ).rejects.toThrow("33 bytes");
  });

  it("grantAccess re-encrypts blob so grantee can read owner credentials", async () => {
    const credentials = { apiKey: "owner-secret-key", nested: { a: 1 } };
    const ownerVault = new AgentVault(TEST_PRIVATE_KEY);
    const ownerBlob = await ownerVault.seal(credentials);

    const granteePubKey = AgentVault.getPublicKey(GRANTEE_PRIVATE_KEY);
    const granteeBlob = await ownerVault.grantAccess(granteePubKey, ownerBlob);

    const granteeVault = new AgentVault(GRANTEE_PRIVATE_KEY);
    const result = await granteeVault.unseal(granteeBlob);
    expect(result).toEqual(credentials);
  });

  it("grantAccess owner blob remains unchanged (original still decryptable)", async () => {
    const credentials = { token: "owner-token" };
    const ownerVault = new AgentVault(TEST_PRIVATE_KEY);
    const ownerBlob = await ownerVault.seal(credentials);

    const granteePubKey = AgentVault.getPublicKey(GRANTEE_PRIVATE_KEY);
    await ownerVault.grantAccess(granteePubKey, ownerBlob); // side-effect free

    // Owner can still decrypt original
    const result = await ownerVault.unseal(ownerBlob);
    expect(result).toEqual(credentials);
  });

  it("grantAccess produces a different blob than the original", async () => {
    const ownerVault = new AgentVault(TEST_PRIVATE_KEY);
    const blob = await ownerVault.seal({ x: 1 });
    const granteePubKey = AgentVault.getPublicKey(GRANTEE_PRIVATE_KEY);
    const granteeBlob = await ownerVault.grantAccess(granteePubKey, blob);
    expect(Buffer.from(blob).toString("hex")).not.toBe(Buffer.from(granteeBlob).toString("hex"));
  });

  it("buildAccessManifest constructs a valid manifest", () => {
    const manifest = AgentVault.buildAccessManifest(
      6,
      [{ walletAddress: "0xABC", encryptedBlobRef: "ar://xyz", grantedBy: "0xOwner" }],
      "0xOwner"
    );
    expect(manifest.$schema).toBe("https://inkdprotocol.com/schemas/access-manifest/v1.json");
    expect(manifest.projectId).toBe(6);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0].walletAddress).toBe("0xABC");
    expect(manifest.entries[0].encryptedBlobRef).toBe("ar://xyz");
    expect(manifest.entries[0].grantedBy).toBe("0xOwner");
    expect(typeof manifest.entries[0].grantedAt).toBe("string");
    expect(typeof manifest.updatedAt).toBe("string");
  });

  it("buildAccessManifest supports multiple entries", () => {
    const manifest = AgentVault.buildAccessManifest(1, [
      { walletAddress: "0xA", encryptedBlobRef: "ar://a", grantedBy: "0xO" },
      { walletAddress: "0xB", encryptedBlobRef: "ar://b", grantedBy: "0xO" },
    ]);
    expect(manifest.entries).toHaveLength(2);
  });
});
