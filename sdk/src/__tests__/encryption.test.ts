import { describe, it, expect } from "vitest";
import { PassthroughEncryption } from "../encryption";
import type { EncryptedData } from "../types";

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
