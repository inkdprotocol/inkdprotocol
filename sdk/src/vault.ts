/**
 * @file vault.ts
 * @description AgentVault — wallet-key encrypted credential storage.
 *
 * Lets an AI agent encrypt its own credentials (API keys, private keys, secrets)
 * using its EVM wallet private key. Encrypted blobs are stored on Arweave.
 * Only the wallet owner can decrypt.
 *
 * Encryption: ECIES (ECDH secp256k1 + HKDF-SHA256 + AES-256-GCM)
 *
 * Binary layout:
 *   [33 bytes] ephemeral compressed public key
 *   [12 bytes] AES-GCM IV (nonce)
 *   [16 bytes] AES-GCM auth tag
 *   [N  bytes] ciphertext
 *
 * @example
 * ```ts
 * const vault = new AgentVault(process.env.PRIVATE_KEY as `0x${string}`)
 *
 * // Seal credentials
 * const encrypted = await vault.seal({ openaiKey: "sk-...", arweaveKey: { kty: "RSA", ... } })
 *
 * // Unseal credentials
 * const creds = await vault.unseal(encrypted)
 *
 * // Store on Arweave + retrieve
 * const hash = await vault.store(creds, arweaveClient)  // → "ar://Qm..."
 * const loaded = await vault.load(hash, arweaveClient)
 * ```
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { gcm } from "@noble/ciphers/aes";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/ciphers/webcrypto";
import type { ArweaveClient } from "./arweave.js";
import { EncryptionError } from "./errors.js";

const EPHEMERAL_PUBKEY_LENGTH = 33; // compressed secp256k1
const IV_LENGTH = 12;               // AES-GCM nonce
const TAG_LENGTH = 16;              // AES-GCM auth tag
const HEADER_LENGTH = EPHEMERAL_PUBKEY_LENGTH + IV_LENGTH; // tag is appended by noble after ciphertext

/**
 * Wallet-key encrypted credential vault for AI agents.
 * Uses ECIES so only the private key holder can decrypt.
 */
export class AgentVault {
  private privateKeyBytes: Uint8Array;
  private publicKeyBytes: Uint8Array;

  constructor(privateKey: `0x${string}`) {
    const hex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    if (hex.length !== 64) {
      throw new EncryptionError("Private key must be 32 bytes (64 hex chars)");
    }
    this.privateKeyBytes = hexToBytes(hex);
    this.publicKeyBytes = secp256k1.getPublicKey(this.privateKeyBytes, true); // compressed
  }

  /**
   * Encrypt credentials with this wallet's public key.
   * Returns a binary blob ready for Arweave upload.
   */
  async seal(credentials: Record<string, unknown>): Promise<Uint8Array> {
    const plaintext = new TextEncoder().encode(JSON.stringify(credentials));

    // Generate ephemeral keypair
    const ephemeralPrivKey = secp256k1.utils.randomPrivateKey();
    const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivKey, true);

    // ECDH: shared secret between ephemeral key and recipient's public key
    const sharedPoint = secp256k1.getSharedSecret(ephemeralPrivKey, this.publicKeyBytes);
    const sharedSecret = sharedPoint.slice(1, 33); // x-coordinate only (32 bytes)

    // HKDF: derive 32-byte AES key from shared secret
    const aesKey = hkdf(sha256, sharedSecret, undefined, undefined, 32);

    // AES-256-GCM encrypt
    const iv = randomBytes(IV_LENGTH);
    const cipher = gcm(aesKey, iv);
    const cipherWithTag = cipher.encrypt(plaintext); // noble appends 16-byte tag

    // Pack: [ephemeralPubKey][iv][ciphertext+tag]
    const result = new Uint8Array(ephemeralPubKey.length + iv.length + cipherWithTag.length);
    result.set(ephemeralPubKey, 0);
    result.set(iv, ephemeralPubKey.length);
    result.set(cipherWithTag, ephemeralPubKey.length + iv.length);

    return result;
  }

  /**
   * Decrypt a sealed blob using this wallet's private key.
   */
  async unseal(encrypted: Uint8Array): Promise<Record<string, unknown>> {
    if (encrypted.length < HEADER_LENGTH + TAG_LENGTH + 1) {
      throw new EncryptionError("Encrypted data too short — corrupted or wrong format");
    }

    // Unpack
    const ephemeralPubKey = encrypted.slice(0, EPHEMERAL_PUBKEY_LENGTH);
    const iv = encrypted.slice(EPHEMERAL_PUBKEY_LENGTH, EPHEMERAL_PUBKEY_LENGTH + IV_LENGTH);
    const cipherWithTag = encrypted.slice(HEADER_LENGTH);

    // ECDH: shared secret using our private key + ephemeral public key
    let sharedPoint: Uint8Array;
    try {
      sharedPoint = secp256k1.getSharedSecret(this.privateKeyBytes, ephemeralPubKey);
    } catch {
      throw new EncryptionError("Failed to compute shared secret — invalid ephemeral public key");
    }
    const sharedSecret = sharedPoint.slice(1, 33);

    // HKDF: same derivation as seal
    const aesKey = hkdf(sha256, sharedSecret, undefined, undefined, 32);

    // AES-256-GCM decrypt
    let plaintext: Uint8Array;
    try {
      const cipher = gcm(aesKey, iv);
      plaintext = cipher.decrypt(cipherWithTag);
    } catch {
      throw new EncryptionError(
        "Decryption failed — wrong key or corrupted data"
      );
    }

    try {
      return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
    } catch {
      throw new EncryptionError("Decrypted data is not valid JSON");
    }
  }

  /**
   * Seal credentials and upload to Arweave.
   * Returns the Arweave hash (ar://...).
   */
  async store(
    credentials: Record<string, unknown>,
    arweave: ArweaveClient
  ): Promise<string> {
    const encrypted = await this.seal(credentials);
    const result = await arweave.uploadFile(encrypted, "application/octet-stream", {
      "Inkd-Vault": "true",
      "Inkd-Version": "1",
    });
    return `ar://${result.hash}`;
  }

  /**
   * Fetch from Arweave and unseal.
   * Accepts an ar:// hash or raw Arweave transaction ID.
   */
  async load(
    arweaveHash: string,
    arweave: ArweaveClient
  ): Promise<Record<string, unknown>> {
    const hash = arweaveHash.startsWith("ar://")
      ? arweaveHash.slice(5)
      : arweaveHash;

    const data = await arweave.downloadData(hash);
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
    return this.unseal(bytes);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
