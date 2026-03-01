/**
 * @file encryption.ts
 * @description Lit Protocol integration stub for decentralized encryption.
 *              Full implementation planned for V2. This module provides the interface
 *              and a passthrough implementation for V1.
 *
 *              In V2, data will be encrypted before Arweave upload and only
 *              decryptable by the token holder via Lit Protocol access control.
 */

import type { EncryptionConfig, EncryptedData } from "./types";

/**
 * Encryption provider interface.
 * V1 uses a passthrough (no encryption). V2 will use Lit Protocol.
 */
export interface IEncryptionProvider {
  /** Encrypt data before upload. */
  encrypt(
    data: Uint8Array,
    tokenId: bigint,
    contractAddress: `0x${string}`
  ): Promise<EncryptedData>;

  /** Decrypt data after download. Only works if caller holds the token. */
  decrypt(
    encryptedData: EncryptedData,
    tokenId: bigint,
    contractAddress: `0x${string}`
  ): Promise<Uint8Array>;
}

/**
 * V1 passthrough encryption — data is stored unencrypted.
 * Swappable with LitEncryptionProvider in V2.
 *
 * @example
 * ```ts
 * const encryption = new PassthroughEncryption();
 * const encrypted = await encryption.encrypt(data, 0n, "0x...");
 * // encrypted.ciphertext === data (no actual encryption)
 * ```
 */
export class PassthroughEncryption implements IEncryptionProvider {
  async encrypt(
    data: Uint8Array,
    _tokenId: bigint,
    _contractAddress: `0x${string}`
  ): Promise<EncryptedData> {
    return {
      ciphertext: data,
      encryptedSymmetricKey: "",
      accessControlConditions: [],
    };
  }

  async decrypt(
    encryptedData: EncryptedData,
    _tokenId: bigint,
    _contractAddress: `0x${string}`
  ): Promise<Uint8Array> {
    return encryptedData.ciphertext;
  }
}

/**
 * Lit Protocol encryption provider (V2).
 * Encrypts data so only the ERC-1155 token holder can decrypt it.
 *
 * @example
 * ```ts
 * const config: EncryptionConfig = {
 *   network: "cayenne",
 *   chain: "base",
 * };
 * const encryption = new LitEncryptionProvider(config);
 * await encryption.connect();
 *
 * const encrypted = await encryption.encrypt(data, tokenId, contractAddress);
 * // Upload encrypted.ciphertext to Arweave
 * // Store encrypted.encryptedSymmetricKey + accessControlConditions in metadata
 *
 * const decrypted = await encryption.decrypt(encrypted, tokenId, contractAddress);
 * ```
 */
export class LitEncryptionProvider implements IEncryptionProvider {
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig) {
    this.config = config;
  }

  /**
   * Connect to the Lit Protocol network.
   * Must be called before encrypt/decrypt operations.
   */
  async connect(): Promise<void> {
    // V2: Initialize LitNodeClient
    // const client = new LitNodeClient({ litNetwork: this.config.network });
    // await client.connect();
    throw new Error(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }

  async encrypt(
    _data: Uint8Array,
    _tokenId: bigint,
    _contractAddress: `0x${string}`
  ): Promise<EncryptedData> {
    // V2: Build access control conditions based on ERC-1155 balance
    // const accessControlConditions = [{
    //   contractAddress,
    //   standardContractType: "ERC1155",
    //   chain: this.config.chain,
    //   method: "balanceOf",
    //   parameters: [":userAddress", tokenId.toString()],
    //   returnValueTest: { comparator: ">=", value: "1" },
    // }];
    // const { ciphertext, encryptedSymmetricKey } = await LitJsSdk.encryptString(...)
    throw new Error(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }

  async decrypt(
    _encryptedData: EncryptedData,
    _tokenId: bigint,
    _contractAddress: `0x${string}`
  ): Promise<Uint8Array> {
    // V2: Decrypt using Lit Protocol with wallet signature
    throw new Error(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }

  /**
   * Build ERC-1155 access control conditions for a specific token.
   * @internal V2 helper method.
   */
  private buildAccessControlConditions(
    tokenId: bigint,
    contractAddress: `0x${string}`
  ): unknown[] {
    return [
      {
        contractAddress,
        standardContractType: "ERC1155",
        chain: this.config.chain,
        method: "balanceOf",
        parameters: [":userAddress", tokenId.toString()],
        returnValueTest: { comparator: ">=", value: "1" },
      },
    ];
  }
}
