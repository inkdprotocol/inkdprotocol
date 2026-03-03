import { describe, it, expect } from "vitest";
import { PassthroughEncryption, LitEncryptionProvider } from "../encryption";
import { EncryptionError } from "../errors";
import type { EncryptedData, EncryptionConfig } from "../types";

const CONTRACT = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TOKEN_ID = 1n;

function makeEncryptedData(data: Uint8Array): EncryptedData {
  return { ciphertext: data, encryptedSymmetricKey: "", accessControlConditions: [] };
}

describe("PassthroughEncryption", () => {
  const provider = new PassthroughEncryption();

  it("encrypt: returns ciphertext identical to input", async () => {
    const input = new Uint8Array([1, 2, 3, 4, 5]);
    const result = await provider.encrypt(input, TOKEN_ID, CONTRACT);
    expect(result.ciphertext).toEqual(input);
    expect(result.encryptedSymmetricKey).toBe("");
    expect(result.accessControlConditions).toEqual([]);
  });

  it("encrypt: handles empty data", async () => {
    const input = new Uint8Array(0);
    const result = await provider.encrypt(input, TOKEN_ID, CONTRACT);
    expect(result.ciphertext.length).toBe(0);
  });

  it("encrypt: handles large payloads (100 KB)", async () => {
    const input = new Uint8Array(100_000).fill(0xff);
    const result = await provider.encrypt(input, TOKEN_ID, CONTRACT);
    expect(result.ciphertext.length).toBe(100_000);
    expect(result.ciphertext[99_999]).toBe(0xff);
  });

  it("decrypt: returns ciphertext unchanged", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const encrypted = makeEncryptedData(bytes);
    const decrypted = await provider.decrypt(encrypted, TOKEN_ID, CONTRACT);
    expect(decrypted).toEqual(bytes);
  });

  it("round-trip: encrypt then decrypt yields original", async () => {
    const original = new TextEncoder().encode("agent brain v0.1");
    const encryptResult = await provider.encrypt(original, TOKEN_ID, CONTRACT);
    const restored = await provider.decrypt(encryptResult, TOKEN_ID, CONTRACT);
    expect(restored).toEqual(original);
  });

  it("round-trip with JSON payload", async () => {
    const payload = JSON.stringify({ type: "agent-brain", version: 1, slots: 64 });
    const input = new TextEncoder().encode(payload);
    const encryptResult = await provider.encrypt(input, TOKEN_ID, CONTRACT);
    const restored = await provider.decrypt(encryptResult, TOKEN_ID, CONTRACT);
    const decoded = new TextDecoder().decode(restored);
    expect(JSON.parse(decoded)).toEqual({ type: "agent-brain", version: 1, slots: 64 });
  });

  it("works with different token IDs without cross-contamination", async () => {
    const data1 = new Uint8Array([1, 1, 1]);
    const data2 = new Uint8Array([2, 2, 2]);

    const r1 = await provider.encrypt(data1, 1n, CONTRACT);
    const r2 = await provider.encrypt(data2, 2n, CONTRACT);

    expect(r1.ciphertext).toEqual(data1);
    expect(r2.ciphertext).toEqual(data2);
  });
});

// ---------------------------------------------------------------------------
// LitEncryptionProvider — V1 stub (all methods throw EncryptionError)
// ---------------------------------------------------------------------------

const LIT_CONFIG: EncryptionConfig = { network: "datil", chain: "base" };
const LIT_TOKEN_ID = 42n;

function litFixture() {
  return new LitEncryptionProvider(LIT_CONFIG);
}

function makeLitEncryptedData(data: Uint8Array): EncryptedData {
  return { ciphertext: data, encryptedSymmetricKey: "key", accessControlConditions: [] };
}

describe("LitEncryptionProvider — constructor", () => {
  it("instantiates without throwing", () => {
    expect(() => new LitEncryptionProvider(LIT_CONFIG)).not.toThrow();
  });

  it("accepts datil-dev and datil-test network variants", () => {
    const cfgDev: EncryptionConfig = { network: "datil-dev", chain: "base-sepolia" };
    const cfgTest: EncryptionConfig = { network: "datil-test", chain: "polygon" };
    expect(() => new LitEncryptionProvider(cfgDev)).not.toThrow();
    expect(() => new LitEncryptionProvider(cfgTest)).not.toThrow();
  });
});

describe("LitEncryptionProvider — connect()", () => {
  it("throws EncryptionError", async () => {
    const provider = litFixture();
    await expect(provider.connect()).rejects.toThrow(EncryptionError);
  });

  it("error message mentions V2", async () => {
    const provider = litFixture();
    await expect(provider.connect()).rejects.toThrow(/V2/);
  });

  it("error message mentions PassthroughEncryption", async () => {
    const provider = litFixture();
    await expect(provider.connect()).rejects.toThrow(/PassthroughEncryption/);
  });
});

describe("LitEncryptionProvider — encrypt()", () => {
  it("throws EncryptionError", async () => {
    const provider = litFixture();
    await expect(
      provider.encrypt(new Uint8Array([1, 2, 3]), LIT_TOKEN_ID, CONTRACT)
    ).rejects.toThrow(EncryptionError);
  });

  it("error message mentions V2", async () => {
    const provider = litFixture();
    await expect(
      provider.encrypt(new Uint8Array(), LIT_TOKEN_ID, CONTRACT)
    ).rejects.toThrow(/V2/);
  });

  it("throws even with empty data", async () => {
    const provider = litFixture();
    await expect(
      provider.encrypt(new Uint8Array(0), 0n, CONTRACT)
    ).rejects.toBeInstanceOf(EncryptionError);
  });
});

describe("LitEncryptionProvider — decrypt()", () => {
  it("throws EncryptionError", async () => {
    const provider = litFixture();
    const enc = makeLitEncryptedData(new Uint8Array([5, 6, 7]));
    await expect(
      provider.decrypt(enc, LIT_TOKEN_ID, CONTRACT)
    ).rejects.toThrow(EncryptionError);
  });

  it("error message mentions V2", async () => {
    const provider = litFixture();
    const enc = makeLitEncryptedData(new Uint8Array([0]));
    await expect(
      provider.decrypt(enc, LIT_TOKEN_ID, CONTRACT)
    ).rejects.toThrow(/V2/);
  });
});

describe("LitEncryptionProvider — encryptForToken()", () => {
  it("throws EncryptionError (delegates to encrypt)", async () => {
    const provider = litFixture();
    await expect(
      provider.encryptForToken(new Uint8Array([1, 2]), LIT_TOKEN_ID)
    ).rejects.toThrow(EncryptionError);
  });

  it("uses default address 0x0 when contractAddress omitted", async () => {
    const provider = litFixture();
    // Still throws — but the default param path is exercised
    await expect(
      provider.encryptForToken(new Uint8Array(), LIT_TOKEN_ID, undefined)
    ).rejects.toBeInstanceOf(EncryptionError);
  });

  it("uses provided contractAddress when supplied", async () => {
    const provider = litFixture();
    await expect(
      provider.encryptForToken(new Uint8Array([9]), LIT_TOKEN_ID, CONTRACT)
    ).rejects.toBeInstanceOf(EncryptionError);
  });
});

describe("LitEncryptionProvider — decryptWithToken()", () => {
  it("throws EncryptionError (delegates to decrypt)", async () => {
    const provider = litFixture();
    const enc = makeLitEncryptedData(new Uint8Array([3, 2, 1]));
    await expect(
      provider.decryptWithToken(enc, LIT_TOKEN_ID)
    ).rejects.toThrow(EncryptionError);
  });

  it("uses default address 0x0 when contractAddress omitted", async () => {
    const provider = litFixture();
    const enc = makeLitEncryptedData(new Uint8Array());
    await expect(
      provider.decryptWithToken(enc, LIT_TOKEN_ID, undefined)
    ).rejects.toBeInstanceOf(EncryptionError);
  });

  it("uses provided contractAddress when supplied", async () => {
    const provider = litFixture();
    const enc = makeLitEncryptedData(new Uint8Array([1]));
    await expect(
      provider.decryptWithToken(enc, LIT_TOKEN_ID, CONTRACT)
    ).rejects.toBeInstanceOf(EncryptionError);
  });
});
