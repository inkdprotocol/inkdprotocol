/**
 * @file crypto.ts
 * @description Content encryption for private Inkd projects.
 *
 * Flow for private projects:
 *   1. Generate random AES-256-GCM content key
 *   2. Encrypt content with that key
 *   3. Wrap the AES key with ECIES for each authorized wallet
 *   4. Build access manifest (stored on Arweave, hash on-chain)
 *
 * Encryption: AES-256-GCM for content + ECIES (secp256k1) for key wrapping
 * Binary layout (ECIES wrapped key):
 *   [33 bytes] ephemeral compressed public key
 *   [12 bytes] AES-GCM IV
 *   [16 bytes] AES-GCM auth tag
 *   [32 bytes] encrypted AES key
 */

import crypto from 'node:crypto'
import { secp256k1 } from '@noble/curves/secp256k1'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address } from 'viem'

// ── AES-256-GCM Content Encryption ──────────────────────────────────────────

export interface EncryptedContent {
  /** base64-encoded encrypted content */
  ciphertext: string
  /** base64-encoded IV (12 bytes) */
  iv: string
  /** base64-encoded auth tag (16 bytes) */
  tag: string
}

export function generateContentKey(): Buffer {
  return crypto.randomBytes(32)
}

export function encryptContent(data: Buffer, key: Buffer): EncryptedContent {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: ciphertext.toString('base64'),
    iv:         iv.toString('base64'),
    tag:        tag.toString('base64'),
  }
}

export function decryptContent(encrypted: EncryptedContent, key: Buffer): Buffer {
  const iv         = Buffer.from(encrypted.iv, 'base64')
  const tag        = Buffer.from(encrypted.tag, 'base64')
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64')
  const decipher   = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// ── ECIES Key Wrapping ───────────────────────────────────────────────────────

export interface WrappedKey {
  /** Compressed secp256k1 public key of recipient (hex) */
  recipientPublicKey: string
  /** base64-encoded ECIES-wrapped AES key */
  wrappedKey: string
}

/**
 * Wrap an AES key for a recipient's compressed public key.
 * Returns base64-encoded blob: ephemeralPubKey(33) | iv(12) | tag(16) | encryptedKey(32)
 */
export function wrapKey(aesKey: Buffer, recipientCompressedPubKey: string): string {
  const recipientPub = Buffer.from(recipientCompressedPubKey, 'hex')

  // Generate ephemeral keypair
  const ephemeralPrivKey = secp256k1.utils.randomPrivateKey()
  const ephemeralPubKey  = secp256k1.getPublicKey(ephemeralPrivKey, true) // compressed

  // ECDH shared secret
  const sharedPoint  = secp256k1.getSharedSecret(ephemeralPrivKey, recipientPub)
  const sharedSecret = sharedPoint.slice(1) // remove prefix byte

  // HKDF to derive AES-256-GCM key for key wrapping
  const wrapKey = Buffer.from(hkdf(sha256, sharedSecret, undefined, new TextEncoder().encode('inkd-key-wrap-v1'), 32))

  // Encrypt the AES key
  const iv     = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', wrapKey, iv)
  const encrypted = Buffer.concat([cipher.update(aesKey), cipher.final()])
  const tag    = cipher.getAuthTag()

  // Pack: ephemeralPubKey(33) | iv(12) | tag(16) | encrypted(32)
  const packed = Buffer.concat([
    Buffer.from(ephemeralPubKey),
    iv,
    tag,
    encrypted,
  ])
  return packed.toString('base64')
}

/**
 * Unwrap an ECIES-wrapped AES key using the recipient's private key.
 */
export function unwrapKey(wrappedKeyB64: string, recipientPrivKeyHex: string): Buffer {
  const packed = Buffer.from(wrappedKeyB64, 'base64')

  const ephemeralPubKey = packed.subarray(0, 33)
  const iv              = packed.subarray(33, 45)
  const tag             = packed.subarray(45, 61)
  const encrypted       = packed.subarray(61)

  const privKeyBytes = Buffer.from(recipientPrivKeyHex.replace('0x', ''), 'hex')

  // ECDH shared secret
  const sharedPoint  = secp256k1.getSharedSecret(privKeyBytes, ephemeralPubKey)
  const sharedSecret = sharedPoint.slice(1)

  // HKDF
  const wrapKey = Buffer.from(hkdf(sha256, sharedSecret, undefined, new TextEncoder().encode('inkd-key-wrap-v1'), 32))

  const decipher = crypto.createDecipheriv('aes-256-gcm', wrapKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

// ── Public Key Derivation ────────────────────────────────────────────────────

/**
 * Derive compressed secp256k1 public key from a private key.
 */
export function privateKeyToCompressedPublicKey(privateKeyHex: string): string {
  const privBytes = Buffer.from(privateKeyHex.replace('0x', ''), 'hex')
  return Buffer.from(secp256k1.getPublicKey(privBytes, true)).toString('hex')
}

// ── Access Manifest ──────────────────────────────────────────────────────────

export interface AccessManifestRecipient {
  address:    Address
  publicKey:  string
  wrappedKey: string
}

export interface AccessManifest {
  schema:     'inkd/access-manifest/v1'
  projectId:  number
  algorithm:  'aes-256-gcm+ecies-secp256k1'
  contentKey: {
    recipients: AccessManifestRecipient[]
  }
  createdAt:  string
  updatedAt:  string
}

export function buildAccessManifest(
  projectId: number,
  aesKey: Buffer,
  recipients: Array<{ address: Address; compressedPublicKey: string }>
): AccessManifest {
  const now = new Date().toISOString()
  return {
    schema:    'inkd/access-manifest/v1',
    projectId,
    algorithm: 'aes-256-gcm+ecies-secp256k1',
    contentKey: {
      recipients: recipients.map(r => ({
        address:    r.address,
        publicKey:  r.compressedPublicKey,
        wrappedKey: wrapKey(aesKey, r.compressedPublicKey),
      })),
    },
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Add a new recipient to an existing access manifest (given the owner's private key to unwrap).
 */
export function addRecipientToManifest(
  manifest: AccessManifest,
  ownerPrivateKeyHex: string,
  newRecipient: { address: Address; compressedPublicKey: string }
): AccessManifest {
  // Find owner's wrapped key entry
  const ownerPubKey = privateKeyToCompressedPublicKey(ownerPrivateKeyHex)
  const ownerEntry  = manifest.contentKey.recipients.find(r => r.publicKey === ownerPubKey)
  if (!ownerEntry) throw new Error('Owner not found in access manifest')

  // Unwrap the AES key
  const aesKey = unwrapKey(ownerEntry.wrappedKey, ownerPrivateKeyHex)

  return {
    ...manifest,
    updatedAt: new Date().toISOString(),
    contentKey: {
      recipients: [
        ...manifest.contentKey.recipients,
        {
          address:    newRecipient.address,
          publicKey:  newRecipient.compressedPublicKey,
          wrappedKey: wrapKey(aesKey, newRecipient.compressedPublicKey),
        },
      ],
    },
  }
}
