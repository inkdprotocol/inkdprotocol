/**
 * AES-256-GCM encryption for private Arweave uploads.
 *
 * The encryption key is derived from the user's wallet private key
 * via HKDF-SHA256 — no extra key management needed.
 *
 * Encrypted format (binary):
 *   [4 bytes: "INKD"] [1 byte: version=1] [16 bytes: salt] [12 bytes: iv] [N bytes: ciphertext] [16 bytes: auth tag]
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto'

const MAGIC   = Buffer.from('INKD')
const VERSION = 1

/**
 * Derive a 256-bit AES key from a wallet private key + salt.
 * Uses HMAC-SHA256 as a simple KDF (no external dep).
 */
function deriveKey(privateKey: string, salt: Buffer): Buffer {
  const keyMaterial = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
  return createHmac('sha256', Buffer.from(keyMaterial, 'hex'))
    .update(salt)
    .digest()
}

/**
 * Encrypt a buffer with AES-256-GCM using a key derived from the wallet private key.
 * Returns the encrypted envelope as a Buffer.
 */
export function encryptBuffer(plaintext: Buffer, privateKey: string): Buffer {
  const salt = randomBytes(16)
  const iv   = randomBytes(12)
  const key  = deriveKey(privateKey, salt)

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([
    MAGIC,
    Buffer.from([VERSION]),
    salt,
    iv,
    encrypted,
    tag,
  ])
}

/**
 * Decrypt an encrypted envelope produced by encryptBuffer.
 * Throws if the magic bytes, version, or auth tag are invalid.
 */
export function decryptBuffer(envelope: Buffer, privateKey: string): Buffer {
  if (envelope.length < 4 + 1 + 16 + 12 + 16) {
    throw new Error('Invalid encrypted envelope: too short')
  }

  const magic = envelope.subarray(0, 4)
  if (!magic.equals(MAGIC)) {
    throw new Error('Invalid encrypted envelope: bad magic bytes')
  }

  const version = envelope[4]
  if (version !== VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`)
  }

  const salt       = envelope.subarray(5, 21)
  const iv         = envelope.subarray(21, 33)
  const tag        = envelope.subarray(envelope.length - 16)
  const ciphertext = envelope.subarray(33, envelope.length - 16)

  const key = deriveKey(privateKey, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/** Returns true if the buffer looks like an INKD-encrypted envelope. */
export function isEncrypted(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 4).equals(MAGIC) && buf[4] === VERSION
}
