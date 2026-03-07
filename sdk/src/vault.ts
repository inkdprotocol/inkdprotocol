/**
 * @file vault.ts
 * @description AgentVault — wallet-key encrypted credential storage.
 *
 * Lets an AI agent encrypt its own credentials (API keys, private keys, secrets)
 * using its EVM wallet private key. Encrypted blobs are stored on Arweave.
 * Only the wallet owner can decrypt.
 *
 * Multi-wallet access: use `grantAccess(granteePublicKey, blob)` to re-encrypt
 * a sealed blob for a second wallet. Store the re-encrypted blob on Arweave and
 * record the reference in an `AccessManifest` (uploaded via `projectAccessManifest`
 * on InkdRegistryV2).
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
 * // Grant access to another wallet
 * const granteePublicKey = AgentVault.getPublicKey('0x...')
 * const granteeBlob = await vault.grantAccess(granteePublicKey, encrypted)
 *
 * // Store on Arweave + retrieve
 * const hash = await vault.store(creds, arweaveClient)  // → "ar://Qm..."
 * const loaded = await vault.load(hash, arweaveClient)
 * ```
 */

// ─── AccessManifest ───────────────────────────────────────────────────────────

export interface AccessManifestEntry {
  /** Wallet address of the grantee (checksummed or lowercase). */
  walletAddress: string;
  /** Arweave URI (ar://...) of the re-encrypted blob for this grantee. */
  encryptedBlobRef: string;
  /** ISO timestamp of when access was granted. */
  grantedAt: string;
  /** Wallet address of the owner who granted access. */
  grantedBy: string;
}

export interface AccessManifest {
  $schema: "https://inkdprotocol.com/schemas/access-manifest/v1.json";
  projectId: number;
  entries: AccessManifestEntry[];
  updatedAt: string;
}

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
   * Derive the compressed secp256k1 public key from a private key.
   * Returns a hex string (66 chars, no 0x prefix) suitable for `grantAccess`.
   */
  static getPublicKey(privateKey: `0x${string}`): string {
    const hex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const privBytes = hexToBytes(hex);
    const pubBytes = secp256k1.getPublicKey(privBytes, true); // compressed 33 bytes
    return bytesToHex(pubBytes);
  }

  /**
   * Encrypt credentials for a specific public key (no private key needed).
   * The recipient can decrypt with their corresponding `AgentVault.unseal()`.
   *
   * @param credentials - The credentials to encrypt.
   * @param recipientPublicKeyHex - Compressed secp256k1 public key (33 bytes, 66 hex chars).
   */
  static async sealForPublicKey(
    credentials: Record<string, unknown>,
    recipientPublicKeyHex: string
  ): Promise<Uint8Array> {
    const recipientPubKey = hexToBytes(
      recipientPublicKeyHex.startsWith("0x")
        ? recipientPublicKeyHex.slice(2)
        : recipientPublicKeyHex
    );
    if (recipientPubKey.length !== 33) {
      throw new EncryptionError("Recipient public key must be 33 bytes (compressed secp256k1)");
    }

    const plaintext = new TextEncoder().encode(JSON.stringify(credentials));
    const ephemeralPrivKey = secp256k1.utils.randomPrivateKey();
    const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivKey, true);
    const sharedPoint = secp256k1.getSharedSecret(ephemeralPrivKey, recipientPubKey);
    const sharedSecret = sharedPoint.slice(1, 33);
    const aesKey = hkdf(sha256, sharedSecret, undefined, undefined, 32);
    const iv = randomBytes(IV_LENGTH);
    const cipher = gcm(aesKey, iv);
    const cipherWithTag = cipher.encrypt(plaintext);

    const result = new Uint8Array(ephemeralPubKey.length + iv.length + cipherWithTag.length);
    result.set(ephemeralPubKey, 0);
    result.set(iv, ephemeralPubKey.length);
    result.set(cipherWithTag, ephemeralPubKey.length + iv.length);
    return result;
  }

  /**
   * Re-encrypt a sealed blob for a different wallet.
   * Decrypts with the caller's private key, then re-encrypts for the grantee.
   *
   * @param granteePublicKeyHex - Grantee's compressed public key (use `AgentVault.getPublicKey`).
   * @param blob - The sealed blob to re-encrypt.
   * @returns A new sealed blob that only the grantee can decrypt.
   *
   * @example
   * ```ts
   * const granteeKey = AgentVault.getPublicKey('0x...')
   * const granteeBlob = await ownerVault.grantAccess(granteeKey, ownerBlob)
   * const ref = await arweave.uploadFile(granteeBlob, ...)
   * ```
   */
  async grantAccess(
    granteePublicKeyHex: string,
    blob: Uint8Array
  ): Promise<Uint8Array> {
    const credentials = await this.unseal(blob);
    return AgentVault.sealForPublicKey(credentials, granteePublicKeyHex);
  }

  /**
   * Build an AccessManifest object for upload to Arweave.
   * Upload this JSON to Arweave and store the txid in `InkdRegistryV2.setAccessManifest`.
   *
   * @param projectId - On-chain project ID.
   * @param entries - Array of grantee entries (wallet address + arweave ref).
   * @param ownerAddress - Wallet address of the owner (for `grantedBy` default).
   */
  static buildAccessManifest(
    projectId: number,
    entries: Omit<AccessManifestEntry, "grantedAt">[],
    ownerAddress?: string
  ): AccessManifest {
    const now = new Date().toISOString();
    return {
      $schema: "https://inkdprotocol.com/schemas/access-manifest/v1.json",
      projectId,
      entries: entries.map((e) => ({
        ...e,
        grantedBy: e.grantedBy || ownerAddress || "",
        grantedAt: now,
      })),
      updatedAt: now,
    };
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
