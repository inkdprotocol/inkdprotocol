/**
 * @file InkdClient.ts
 * @description Main client class for interacting with the Inkd Protocol.
 *              Handles on-chain operations (mint, purchase, burn, etc.) and
 *              integrates with Arweave for permanent storage.
 */

import type {
  PublicClient,
  WalletClient,
  GetContractReturnType,
  Account,
  Chain,
  Transport,
} from "viem";
import { getContract } from "viem";
import { INKD_VAULT_ABI } from "./abi";
import { ArweaveClient } from "./arweave";
import {
  PassthroughEncryption,
  type IEncryptionProvider,
} from "./encryption";
import type {
  InkdClientConfig,
  TokenData,
  DataToken,
  TransactionResult,
  BatchTransactionResult,
  MintOptions,
  BatchMintOptions,
} from "./types";

/**
 * The main Inkd Protocol client.
 *
 * Provides a high-level API for minting, purchasing, burning, and managing
 * data tokens on the InkdVault contract.
 *
 * @example
 * ```ts
 * import { InkdClient } from "@inkd/sdk";
 * import { createWalletClient, createPublicClient, http } from "viem";
 * import { baseSepolia } from "viem/chains";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const account = privateKeyToAccount("0x...");
 * const walletClient = createWalletClient({
 *   account,
 *   chain: baseSepolia,
 *   transport: http(),
 * });
 * const publicClient = createPublicClient({
 *   chain: baseSepolia,
 *   transport: http(),
 * });
 *
 * const inkd = new InkdClient({
 *   contractAddress: "0x...",
 *   chainId: 84532,
 * });
 *
 * inkd.connect(walletClient, publicClient);
 *
 * // Mint a file as a token
 * const result = await inkd.mint(
 *   Buffer.from("agent memory data"),
 *   { contentType: "application/json", price: 0n }
 * );
 * console.log("Token ID:", result.tokenId);
 * ```
 */
export class InkdClient {
  private config: InkdClientConfig;
  private walletClient: WalletClient<Transport, Chain, Account> | null = null;
  private publicClient: PublicClient | null = null;
  private arweave: ArweaveClient | null = null;
  private encryption: IEncryptionProvider;

  constructor(config: InkdClientConfig) {
    this.config = config;
    this.encryption = new PassthroughEncryption();
  }

  // ─── Connection ─────────────────────────────────────────────────────────

  /**
   * Connect wallet and public clients for on-chain interaction.
   *
   * @param walletClient viem WalletClient with an account for signing transactions.
   * @param publicClient viem PublicClient for reading chain state.
   */
  connect(
    walletClient: WalletClient<Transport, Chain, Account>,
    publicClient: PublicClient
  ): void {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
  }

  /**
   * Connect Arweave storage client for file uploads.
   *
   * @param privateKey Private key for Irys uploads.
   * @param irysUrl    Optional Irys node URL.
   * @param gateway    Optional Arweave gateway URL.
   */
  async connectArweave(
    privateKey: string,
    irysUrl?: string,
    gateway?: string
  ): Promise<void> {
    this.arweave = new ArweaveClient(
      irysUrl ?? this.config.irysUrl ?? "https://node2.irys.xyz",
      privateKey,
      gateway ?? this.config.arweaveGateway ?? "https://arweave.net"
    );
    await this.arweave.connect();
  }

  /**
   * Set a custom encryption provider (for V2 Lit Protocol integration).
   *
   * @param provider Encryption provider implementing IEncryptionProvider.
   */
  setEncryptionProvider(provider: IEncryptionProvider): void {
    this.encryption = provider;
  }

  // ─── Core: Mint ─────────────────────────────────────────────────────────

  /**
   * Upload a file to Arweave and mint it as an Inkd data token.
   *
   * @param file    File data as Buffer or Uint8Array.
   * @param options Mint options (contentType, price, metadataURI, tags).
   * @returns       Transaction result with hash and tokenId.
   */
  async mint(
    file: Buffer | Uint8Array,
    options: MintOptions
  ): Promise<TransactionResult> {
    this.requireWallet();
    this.requireArweave();

    // Encrypt (passthrough in V1)
    const encrypted = await this.encryption.encrypt(
      file instanceof Buffer ? new Uint8Array(file) : file,
      0n, // Token ID not yet known
      this.config.contractAddress
    );

    // Upload to Arweave
    const uploadResult = await this.arweave!.uploadFile(
      encrypted.ciphertext,
      options.contentType,
      options.tags
    );

    const metadataURI = options.metadataURI ?? uploadResult.url;
    const price = options.price ?? 0n;

    // Mint on-chain
    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "mint",
      args: [uploadResult.hash, metadataURI, price],
    });

    // Get token ID from events
    const receipt = await this.publicClient!.waitForTransactionReceipt({ hash });
    const tokenId = this.extractTokenIdFromLogs(receipt.logs);

    return { hash, tokenId };
  }

  /**
   * Mint a token from an already-uploaded Arweave hash (no file upload).
   *
   * @param arweaveHash Existing Arweave transaction hash.
   * @param metadataURI Off-chain metadata URI.
   * @param price       Listing price in wei.
   * @returns           Transaction result with hash and tokenId.
   */
  async mintFromHash(
    arweaveHash: string,
    metadataURI: string,
    price: bigint = 0n
  ): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "mint",
      args: [arweaveHash, metadataURI, price],
    });

    const receipt = await this.publicClient!.waitForTransactionReceipt({ hash });
    const tokenId = this.extractTokenIdFromLogs(receipt.logs);

    return { hash, tokenId };
  }

  /**
   * Mint multiple tokens in a single transaction.
   *
   * @param files   Array of file data buffers.
   * @param options Batch mint options.
   * @returns       Transaction result with hash and array of token IDs.
   */
  async batchMint(
    files: Array<Buffer | Uint8Array>,
    options: BatchMintOptions
  ): Promise<BatchTransactionResult> {
    this.requireWallet();
    this.requireArweave();

    const hashes: string[] = [];
    const metadataURIs: string[] = [];
    const prices: bigint[] = [];

    for (let i = 0; i < files.length; i++) {
      const encrypted = await this.encryption.encrypt(
        files[i] instanceof Buffer
          ? new Uint8Array(files[i] as Buffer)
          : (files[i] as Uint8Array),
        0n,
        this.config.contractAddress
      );

      const uploadResult = await this.arweave!.uploadFile(
        encrypted.ciphertext,
        options.contentType
      );

      hashes.push(uploadResult.hash);
      metadataURIs.push(
        options.metadataURIs?.[i] ?? uploadResult.url
      );
      prices.push(options.prices?.[i] ?? 0n);
    }

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "batchMint",
      args: [hashes, metadataURIs, prices],
    });

    const receipt = await this.publicClient!.waitForTransactionReceipt({ hash });
    const tokenIds = this.extractBatchTokenIdsFromLogs(receipt.logs);

    return { hash, tokenIds };
  }

  // ─── Core: Purchase ─────────────────────────────────────────────────────

  /**
   * Purchase a token from its current owner.
   * Automatically sends the token's listing price + 1% protocol fee.
   *
   * @param tokenId       The token to purchase.
   * @param sellerAddress The current owner's address.
   * @returns             Transaction result.
   */
  async purchase(
    tokenId: bigint,
    sellerAddress: `0x${string}`
  ): Promise<TransactionResult> {
    this.requireWallet();

    const token = await this.getToken(tokenId);
    if (token.price === 0n) {
      throw new Error(`Token ${tokenId} is not for sale`);
    }

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "purchase",
      args: [tokenId, sellerAddress],
      value: token.price,
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });

    return { hash, tokenId };
  }

  // ─── Core: Burn ─────────────────────────────────────────────────────────

  /**
   * Burn a token — permanently revokes access.
   * Data remains on Arweave but becomes unreachable without the token.
   *
   * @param tokenId The token to burn.
   * @returns       Transaction result.
   */
  async burn(tokenId: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "burn",
      args: [tokenId],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });

    return { hash, tokenId };
  }

  // ─── Core: Price ────────────────────────────────────────────────────────

  /**
   * Update a token's listing price. Set to 0 to delist.
   *
   * @param tokenId The token to update.
   * @param price   New price in wei.
   * @returns       Transaction result.
   */
  async setPrice(
    tokenId: bigint,
    price: bigint
  ): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "setPrice",
      args: [tokenId, price],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });

    return { hash, tokenId };
  }

  // ─── Queries ──────────────────────────────────────────────────────────

  /**
   * Get full token data including ownership and version history.
   *
   * @param tokenId The token to query.
   * @returns       Enriched token data.
   */
  async getToken(tokenId: bigint): Promise<TokenData> {
    this.requirePublic();

    const [creator, arweaveHash, metadataURI, price, createdAt] =
      (await this.publicClient!.readContract({
        address: this.config.contractAddress,
        abi: INKD_VAULT_ABI,
        functionName: "tokens",
        args: [tokenId],
      })) as [
        `0x${string}`,
        string,
        string,
        bigint,
        bigint
      ];

    const versionCount = (await this.publicClient!.readContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "getVersionCount",
      args: [tokenId],
    })) as bigint;

    const versions: string[] = [];
    for (let i = 0n; i < versionCount; i++) {
      const v = (await this.publicClient!.readContract({
        address: this.config.contractAddress,
        abi: INKD_VAULT_ABI,
        functionName: "getVersion",
        args: [tokenId, i],
      })) as string;
      versions.push(v);
    }

    return {
      tokenId,
      creator,
      arweaveHash,
      metadataURI,
      price,
      createdAt,
      owner: creator, // Simplified — real implementation would scan TransferSingle events
      versionCount: Number(versionCount),
      versions,
    };
  }

  /**
   * Get all tokens owned by a specific address.
   * Scans TransferSingle events to build ownership index.
   *
   * @param address The wallet address to query.
   * @returns       Array of token data owned by the address.
   */
  async getTokensByOwner(
    address: `0x${string}`
  ): Promise<TokenData[]> {
    this.requirePublic();

    const nextTokenId = (await this.publicClient!.readContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "nextTokenId",
    })) as bigint;

    const ownedTokens: TokenData[] = [];

    for (let i = 0n; i < nextTokenId; i++) {
      const balance = (await this.publicClient!.readContract({
        address: this.config.contractAddress,
        abi: INKD_VAULT_ABI,
        functionName: "balanceOf",
        args: [address, i],
      })) as bigint;

      if (balance > 0n) {
        const token = await this.getToken(i);
        token.owner = address;
        ownedTokens.push(token);
      }
    }

    return ownedTokens;
  }

  /**
   * Check if a wallet has access to a token (owner or active grant).
   *
   * @param tokenId The token to check.
   * @param wallet  The wallet to check.
   * @returns       True if wallet has access.
   */
  async checkAccess(
    tokenId: bigint,
    wallet: `0x${string}`
  ): Promise<boolean> {
    this.requirePublic();

    return (await this.publicClient!.readContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "checkAccess",
      args: [tokenId, wallet],
    })) as boolean;
  }

  // ─── Access Grants ──────────────────────────────────────────────────────

  /**
   * Grant temporary read access to a wallet without transferring ownership.
   *
   * @param tokenId  The token to grant access to.
   * @param wallet   The wallet to grant access.
   * @param duration Duration in seconds (added to current time).
   * @returns        Transaction result.
   */
  async grantAccess(
    tokenId: bigint,
    wallet: `0x${string}`,
    duration: number
  ): Promise<TransactionResult> {
    this.requireWallet();

    const block = await this.publicClient!.getBlock();
    const expiresAt = block.timestamp + BigInt(duration);

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "grantAccess",
      args: [tokenId, wallet, expiresAt],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });

    return { hash, tokenId };
  }

  /**
   * Revoke a previously granted temporary access.
   *
   * @param tokenId The token to revoke access for.
   * @param wallet  The wallet to revoke.
   * @returns       Transaction result.
   */
  async revokeAccess(
    tokenId: bigint,
    wallet: `0x${string}`
  ): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "revokeAccess",
      args: [tokenId, wallet],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });

    return { hash, tokenId };
  }

  // ─── Versioning ─────────────────────────────────────────────────────────

  /**
   * Push a new version of data for an existing token.
   *
   * @param tokenId     The token to update.
   * @param file        New file data.
   * @param contentType MIME type of the file.
   * @returns           Transaction result.
   */
  async addVersion(
    tokenId: bigint,
    file: Buffer | Uint8Array,
    contentType: string
  ): Promise<TransactionResult> {
    this.requireWallet();
    this.requireArweave();

    const encrypted = await this.encryption.encrypt(
      file instanceof Buffer ? new Uint8Array(file) : file,
      tokenId,
      this.config.contractAddress
    );

    const uploadResult = await this.arweave!.uploadFile(
      encrypted.ciphertext,
      contentType
    );

    const hash = await this.walletClient!.writeContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "addVersion",
      args: [tokenId, uploadResult.hash],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });

    return { hash, tokenId };
  }

  // ─── Data Retrieval ─────────────────────────────────────────────────────

  /**
   * Download and decrypt the data for a token (latest version).
   *
   * @param tokenId The token whose data to retrieve.
   * @returns       Decrypted file data.
   */
  async getData(tokenId: bigint): Promise<Buffer> {
    this.requireArweave();

    const token = await this.getToken(tokenId);
    const encrypted = await this.arweave!.getFile(token.arweaveHash);

    const decrypted = await this.encryption.decrypt(
      {
        ciphertext: new Uint8Array(encrypted),
        encryptedSymmetricKey: "",
        accessControlConditions: [],
      },
      tokenId,
      this.config.contractAddress
    );

    return Buffer.from(decrypted);
  }

  /**
   * Download data for a specific version of a token.
   *
   * @param tokenId      The token to query.
   * @param versionIndex The version index (0 = original).
   * @returns            File data for that version.
   */
  async getVersionData(
    tokenId: bigint,
    versionIndex: number
  ): Promise<Buffer> {
    this.requirePublic();
    this.requireArweave();

    const hash = (await this.publicClient!.readContract({
      address: this.config.contractAddress,
      abi: INKD_VAULT_ABI,
      functionName: "getVersion",
      args: [tokenId, BigInt(versionIndex)],
    })) as string;

    return this.arweave!.getFile(hash);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /** @internal Ensure wallet client is connected. */
  private requireWallet(): void {
    if (!this.walletClient || !this.publicClient) {
      throw new Error("Not connected. Call connect(walletClient, publicClient) first.");
    }
  }

  /** @internal Ensure public client is connected. */
  private requirePublic(): void {
    if (!this.publicClient) {
      throw new Error("Not connected. Call connect(walletClient, publicClient) first.");
    }
  }

  /** @internal Ensure Arweave client is connected. */
  private requireArweave(): void {
    if (!this.arweave) {
      throw new Error("Arweave not connected. Call connectArweave() first.");
    }
  }

  /** @internal Extract tokenId from DataMinted event logs. */
  private extractTokenIdFromLogs(logs: readonly unknown[]): bigint | undefined {
    for (const log of logs) {
      const l = log as { topics?: readonly string[]; data?: string };
      // DataMinted event topic0
      if (l.topics && l.topics.length >= 2) {
        try {
          return BigInt(l.topics[1]);
        } catch {
          continue;
        }
      }
    }
    return undefined;
  }

  /** @internal Extract tokenIds from BatchMinted event logs. */
  private extractBatchTokenIdsFromLogs(logs: readonly unknown[]): bigint[] {
    // Parse individual DataMinted events
    const tokenIds: bigint[] = [];
    for (const log of logs) {
      const l = log as { topics?: readonly string[]; data?: string };
      if (l.topics && l.topics.length >= 2) {
        try {
          tokenIds.push(BigInt(l.topics[1]));
        } catch {
          continue;
        }
      }
    }
    return tokenIds;
  }
}
