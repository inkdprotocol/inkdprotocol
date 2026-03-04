/**
 * @file vault.test.ts
 * @description Tests for AgentVault — ECIES wallet-key credential storage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentVault } from "../vault.js";

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
