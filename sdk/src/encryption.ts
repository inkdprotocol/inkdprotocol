/**
 * @file encryption.ts
 * @description Lit Protocol integration for token-gated encryption.
 *              V1 uses passthrough (no encryption). V2 will use Lit Protocol
 *              so only the InkdToken owner can decrypt inscribed data.
 */

import type { EncryptionConfig, EncryptedData, Address } from "./types";
import { EncryptionError } from "./errors";

/**
 * Encryption provider interface.
 * V1 uses passthrough. V2 will use Lit Protocol.
 */
export interface IEncryptionProvider {
  /** Encrypt data before upload. */
  encrypt(data: Uint8Array, tokenId: bigint, contractAddress: Address): Promise<EncryptedData>;

  /** Decrypt data after download. Only works if caller holds the token. */
  decrypt(encryptedData: EncryptedData, tokenId: bigint, contractAddress: Address): Promise<Uint8Array>;
}

/**
 * V1 passthrough encryption — data is stored unencrypted.
 * Swappable with LitEncryptionProvider in V2.
 */
export class PassthroughEncryption implements IEncryptionProvider {
  async encrypt(data: Uint8Array, _tokenId: bigint, _contractAddress: Address): Promise<EncryptedData> {
    return {
      ciphertext: data,
      encryptedSymmetricKey: "",
      accessControlConditions: [],
    };
  }

  async decrypt(encryptedData: EncryptedData, _tokenId: bigint, _contractAddress: Address): Promise<Uint8Array> {
    return encryptedData.ciphertext;
  }
}

/**
 * Lit Protocol encryption provider (V2).
 * Encrypts data so only the ERC-721 InkdToken owner can decrypt it.
 *
 * @example
 * ```ts
 * const encryption = new LitEncryptionProvider({ network: "datil", chain: "base" });
 * await encryption.connect();
 *
 * const encrypted = await encryption.encryptForToken(data, tokenId);
 * const decrypted = await encryption.decryptWithToken(encrypted, tokenId);
 * ```
 */
export class LitEncryptionProvider implements IEncryptionProvider {
  private config: EncryptionConfig;
  private connected = false;

  constructor(config: EncryptionConfig) {
    this.config = config;
  }

  /** Connect to the Lit Protocol network. */
  async connect(): Promise<void> {
    // V2: Initialize LitNodeClient
    // const client = new LitNodeClient({ litNetwork: this.config.network });
    // await client.connect();
    throw new EncryptionError(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }

  /** Encrypt data for a specific InkdToken. Only the token owner can decrypt. */
  async encryptForToken(data: Uint8Array, tokenId: bigint, contractAddress?: Address): Promise<EncryptedData> {
    return this.encrypt(data, tokenId, contractAddress ?? ("0x0" as Address));
  }

  /** Decrypt data using InkdToken ownership proof. */
  async decryptWithToken(encryptedData: EncryptedData, tokenId: bigint, contractAddress?: Address): Promise<Uint8Array> {
    return this.decrypt(encryptedData, tokenId, contractAddress ?? ("0x0" as Address));
  }

  async encrypt(_data: Uint8Array, _tokenId: bigint, _contractAddress: Address): Promise<EncryptedData> {
    // V2: Build ERC-721 access control conditions
    // const accessControlConditions = [{
    //   contractAddress,
    //   standardContractType: "ERC721",
    //   chain: this.config.chain,
    //   method: "ownerOf",
    //   parameters: [tokenId.toString()],
    //   returnValueTest: { comparator: "=", value: ":userAddress" },
    // }];
    throw new EncryptionError(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }

  async decrypt(_encryptedData: EncryptedData, _tokenId: bigint, _contractAddress: Address): Promise<Uint8Array> {
    throw new EncryptionError(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }
}
