/**
 * @file InkdClient.ts
 * @description Main client class for interacting with the Inkd Protocol.
 *              Handles InkdToken minting, InkdVault inscriptions, and InkdRegistry operations.
 */

import type { PublicClient, WalletClient, Account, Chain, Transport } from "viem";
import { INKD_TOKEN_ABI, INKD_VAULT_ABI, INKD_REGISTRY_ABI } from "./abi";
import { ArweaveClient } from "./arweave";
import { PassthroughEncryption, type IEncryptionProvider } from "./encryption";
import { ClientNotConnected, ArweaveNotConnected } from "./errors";
import type {
  Address,
  InkdClientConfig,
  InkdTokenData,
  Inscription,
  ProtocolStats,
  MintOptions,
  InscribeOptions,
  InscribeResult,
  InscribeCostEstimate,
  TransactionResult,
  BatchTransactionResult,
} from "./types";

/**
 * The main Inkd Protocol client.
 *
 * @example
 * ```ts
 * import { InkdClient } from "@inkd/sdk";
 * import { createWalletClient, createPublicClient, http } from "viem";
 * import { baseSepolia } from "viem/chains";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const inkd = new InkdClient({
 *   tokenAddress: "0x...",
 *   vaultAddress: "0x...",
 *   registryAddress: "0x...",
 *   chainId: 84532,
 * });
 *
 * inkd.connect(walletClient, publicClient);
 * await inkd.connectArweave("private-key");
 *
 * // Mint an InkdToken
 * const { tokenId } = await inkd.mintToken();
 *
 * // Inscribe data on it
 * const result = await inkd.inscribe(tokenId, Buffer.from("agent brain data"), {
 *   contentType: "application/json",
 *   name: "brain.json",
 * });
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

  // ─── Connection ───────────────────────────────────────────────────────

  /** Connect wallet and public clients for on-chain interaction. */
  connect(
    walletClient: WalletClient<Transport, Chain, Account>,
    publicClient: PublicClient
  ): void {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
  }

  /** Connect Arweave storage client for file uploads. */
  async connectArweave(
    privateKey: string,
    irysUrl?: string,
    gateway?: string
  ): Promise<void> {
    this.arweave = new ArweaveClient(
      irysUrl ?? "https://node2.irys.xyz",
      privateKey,
      gateway ?? "https://arweave.net"
    );
    await this.arweave.connect();
  }

  /** Set a custom encryption provider (for Lit Protocol integration). */
  setEncryptionProvider(provider: IEncryptionProvider): void {
    this.encryption = provider;
  }

  // ─── InkdToken: Minting ───────────────────────────────────────────────

  /** Mint a single InkdToken. Returns the new token ID. */
  async mintToken(options?: MintOptions): Promise<TransactionResult> {
    this.requireWallet();

    const mintPrice = await this.publicClient!.readContract({
      address: this.config.tokenAddress,
      abi: INKD_TOKEN_ABI,
      functionName: "mintPrice",
    });

    if (options?.quantity && options.quantity > 1) {
      const result = await this.batchMintTokens(options.quantity);
      return { hash: result.hash, tokenId: result.tokenIds[0] };
    }

    const hash = await this.walletClient!.writeContract({
      address: this.config.tokenAddress,
      abi: INKD_TOKEN_ABI,
      functionName: "mint",
      value: mintPrice as bigint,
    });

    const receipt = await this.publicClient!.waitForTransactionReceipt({ hash });
    const tokenId = this.extractTokenIdFromLogs(receipt.logs);

    return { hash, tokenId };
  }

  /** Batch mint multiple InkdTokens (max 10). */
  private async batchMintTokens(quantity: number): Promise<BatchTransactionResult> {
    this.requireWallet();

    const mintPrice = (await this.publicClient!.readContract({
      address: this.config.tokenAddress,
      abi: INKD_TOKEN_ABI,
      functionName: "mintPrice",
    })) as bigint;

    const hash = await this.walletClient!.writeContract({
      address: this.config.tokenAddress,
      abi: INKD_TOKEN_ABI,
      functionName: "batchMint",
      args: [BigInt(quantity)],
      value: mintPrice * BigInt(quantity),
    });

    const receipt = await this.publicClient!.waitForTransactionReceipt({ hash });
    const tokenIds = this.extractAllTokenIdsFromLogs(receipt.logs);

    return { hash, tokenIds };
  }

  // ─── InkdVault: Inscriptions ──────────────────────────────────────────

  /** Inscribe data onto your InkdToken. Uploads to Arweave first. */
  async inscribe(
    tokenId: bigint,
    data: Buffer | Uint8Array | string,
    options?: InscribeOptions
  ): Promise<InscribeResult> {
    this.requireWallet();
    this.requireArweave();

    const rawData = typeof data === "string" ? Buffer.from(data) : data;
    const contentType = options?.contentType ?? "application/octet-stream";
    const name = options?.name ?? `inscription-${Date.now()}`;

    // Encrypt (passthrough in V1)
    const encrypted = await this.encryption.encrypt(
      rawData instanceof Buffer ? new Uint8Array(rawData) : rawData,
      tokenId,
      this.config.tokenAddress
    );

    // Upload to Arweave
    const upload = await this.arweave!.uploadFile(
      encrypted.ciphertext,
      contentType,
      options?.tags
    );

    // Inscribe on-chain
    const hash = await this.walletClient!.writeContract({
      address: this.config.vaultAddress,
      abi: INKD_VAULT_ABI,
      functionName: "inscribe",
      args: [tokenId, upload.hash, contentType, BigInt(upload.size), name],
      value: options?.value ?? 0n,
    });

    const receipt = await this.publicClient!.waitForTransactionReceipt({ hash });
    const inscriptionIndex = this.extractInscriptionIndexFromLogs(receipt.logs);

    return { hash, inscriptionIndex, upload };
  }

  /** Get all inscriptions on a token. */
  async getInscriptions(tokenId: bigint): Promise<Inscription[]> {
    this.requirePublic();

    const result = await this.publicClient!.readContract({
      address: this.config.vaultAddress,
      abi: INKD_VAULT_ABI,
      functionName: "getInscriptions",
      args: [tokenId],
    });

    return (result as Array<{
      arweaveHash: string;
      contentType: string;
      size: bigint;
      name: string;
      createdAt: bigint;
      isRemoved: boolean;
      version: bigint;
    }>).map((i) => ({
      arweaveHash: i.arweaveHash,
      contentType: i.contentType,
      size: i.size,
      name: i.name,
      createdAt: i.createdAt,
      isRemoved: i.isRemoved,
      version: i.version,
    }));
  }

  /** Remove (soft-delete) an inscription. */
  async removeInscription(tokenId: bigint, index: number): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.config.vaultAddress,
      abi: INKD_VAULT_ABI,
      functionName: "removeInscription",
      args: [tokenId, BigInt(index)],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });
    return { hash, tokenId };
  }

  /** Update an inscription with new data (creates a new version). */
  async updateInscription(
    tokenId: bigint,
    index: number,
    newData: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<TransactionResult> {
    this.requireWallet();
    this.requireArweave();

    const rawData = typeof newData === "string" ? Buffer.from(newData) : newData;
    const ct = contentType ?? "application/octet-stream";

    const encrypted = await this.encryption.encrypt(
      rawData instanceof Buffer ? new Uint8Array(rawData) : rawData,
      tokenId,
      this.config.tokenAddress
    );

    const upload = await this.arweave!.uploadFile(encrypted.ciphertext, ct);

    const hash = await this.walletClient!.writeContract({
      address: this.config.vaultAddress,
      abi: INKD_VAULT_ABI,
      functionName: "updateInscription",
      args: [tokenId, BigInt(index), upload.hash],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });
    return { hash, tokenId };
  }

  // ─── InkdVault: Access ────────────────────────────────────────────────

  /** Grant temporary read access to a wallet. */
  async grantAccess(
    tokenId: bigint,
    wallet: Address,
    durationSeconds: number
  ): Promise<TransactionResult> {
    this.requireWallet();

    const block = await this.publicClient!.getBlock();
    const expiresAt = block.timestamp + BigInt(durationSeconds);

    const hash = await this.walletClient!.writeContract({
      address: this.config.vaultAddress,
      abi: INKD_VAULT_ABI,
      functionName: "grantReadAccess",
      args: [tokenId, wallet, expiresAt],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });
    return { hash, tokenId };
  }

  /** Revoke read access from a wallet. */
  async revokeAccess(tokenId: bigint, wallet: Address): Promise<TransactionResult> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.config.vaultAddress,
      abi: INKD_VAULT_ABI,
      functionName: "revokeAccess",
      args: [tokenId, wallet],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });
    return { hash, tokenId };
  }

  // ─── InkdRegistry: Marketplace ────────────────────────────────────────

  /** List an InkdToken for sale on the marketplace. */
  async listForSale(tokenId: bigint, price: bigint): Promise<TransactionResult> {
    this.requireWallet();

    // Approve registry to transfer token
    await this.walletClient!.writeContract({
      address: this.config.tokenAddress,
      abi: INKD_TOKEN_ABI,
      functionName: "approve",
      args: [this.config.registryAddress, tokenId],
    });

    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "listForSale",
      args: [tokenId, price],
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });
    return { hash, tokenId };
  }

  /** Buy an InkdToken from the marketplace. */
  async buyToken(tokenId: bigint): Promise<TransactionResult> {
    this.requireWallet();

    const listing = await this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "listings",
      args: [tokenId],
    }) as [bigint, string, bigint, bigint, boolean];

    const price = listing[2];

    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "buyToken",
      args: [tokenId],
      value: price,
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });
    return { hash, tokenId };
  }

  // ─── Queries ──────────────────────────────────────────────────────────

  /** Get token data for a specific InkdToken. */
  async getToken(tokenId: bigint): Promise<InkdTokenData> {
    this.requirePublic();

    const [owner, mintedAtVal, inscCount, uri] = await Promise.all([
      this.publicClient!.readContract({
        address: this.config.tokenAddress,
        abi: INKD_TOKEN_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      }),
      this.publicClient!.readContract({
        address: this.config.tokenAddress,
        abi: INKD_TOKEN_ABI,
        functionName: "mintedAt",
        args: [tokenId],
      }),
      this.publicClient!.readContract({
        address: this.config.tokenAddress,
        abi: INKD_TOKEN_ABI,
        functionName: "inscriptionCount",
        args: [tokenId],
      }),
      this.publicClient!.readContract({
        address: this.config.tokenAddress,
        abi: INKD_TOKEN_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      }),
    ]);

    return {
      tokenId,
      owner: owner as Address,
      mintedAt: mintedAtVal as bigint,
      inscriptionCount: Number(inscCount as bigint),
      tokenURI: uri as string,
    };
  }

  /** Get all InkdTokens owned by an address. */
  async getTokensByOwner(address: Address): Promise<InkdTokenData[]> {
    this.requirePublic();

    const tokenIds = (await this.publicClient!.readContract({
      address: this.config.tokenAddress,
      abi: INKD_TOKEN_ABI,
      functionName: "getTokensByOwner",
      args: [address],
    })) as bigint[];

    return Promise.all(tokenIds.map((id) => this.getToken(id)));
  }

  /** Check if an address holds at least one InkdToken. */
  async hasInkdToken(address: Address): Promise<boolean> {
    this.requirePublic();

    return (await this.publicClient!.readContract({
      address: this.config.tokenAddress,
      abi: INKD_TOKEN_ABI,
      functionName: "isInkdHolder",
      args: [address],
    })) as boolean;
  }

  /** Estimate the cost of inscribing data. */
  async estimateInscribeCost(fileSize: number): Promise<InscribeCostEstimate> {
    this.requirePublic();

    const feeBps = (await this.publicClient!.readContract({
      address: this.config.vaultAddress,
      abi: INKD_VAULT_ABI,
      functionName: "protocolFeeBps",
    })) as bigint;

    // Rough gas estimate for inscribe
    const gasEstimate = 150_000n;
    const gasPrice = 1_000_000n; // ~1 gwei on Base
    const gas = gasEstimate * gasPrice;

    // Arweave cost estimate (rough: ~0.00001 ETH per KB)
    const arweave = BigInt(Math.ceil(fileSize / 1024)) * 10_000_000_000_000n;

    // Protocol fee on a typical 0.01 ETH value
    const typicalValue = 10_000_000_000_000_000n; // 0.01 ETH
    const protocolFee = (typicalValue * feeBps) / 10_000n;

    const total = gas + arweave + protocolFee;

    return { gas, arweave, protocolFee, total };
  }

  /** Get protocol-wide statistics from the registry. */
  async getStats(): Promise<ProtocolStats> {
    this.requirePublic();

    const [totalTokens, totalInscriptions, totalVolume, totalSales] =
      (await this.publicClient!.readContract({
        address: this.config.registryAddress,
        abi: INKD_REGISTRY_ABI,
        functionName: "getStats",
      })) as [bigint, bigint, bigint, bigint];

    return { totalTokens, totalInscriptions, totalVolume, totalSales };
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private requireWallet(): void {
    if (!this.walletClient || !this.publicClient) throw new ClientNotConnected();
  }

  private requirePublic(): void {
    if (!this.publicClient) throw new ClientNotConnected();
  }

  private requireArweave(): void {
    if (!this.arweave) throw new ArweaveNotConnected();
  }

  private extractTokenIdFromLogs(logs: readonly unknown[]): bigint | undefined {
    for (const log of logs) {
      const l = log as { topics?: readonly string[] };
      // Transfer event: topic[0]=Transfer, topic[1]=from, topic[2]=to, topic[3]=tokenId
      if (l.topics && l.topics.length >= 4) {
        try {
          return BigInt(l.topics[3]);
        } catch {
          continue;
        }
      }
    }
    return undefined;
  }

  private extractAllTokenIdsFromLogs(logs: readonly unknown[]): bigint[] {
    const tokenIds: bigint[] = [];
    for (const log of logs) {
      const l = log as { topics?: readonly string[] };
      if (l.topics && l.topics.length >= 4) {
        try {
          tokenIds.push(BigInt(l.topics[3]));
        } catch {
          continue;
        }
      }
    }
    return tokenIds;
  }

  private extractInscriptionIndexFromLogs(logs: readonly unknown[]): bigint {
    for (const log of logs) {
      const l = log as { topics?: readonly string[] };
      // Inscribed event: topic[0]=Inscribed, topic[1]=tokenId, topic[2]=inscriptionIndex
      if (l.topics && l.topics.length >= 3) {
        try {
          return BigInt(l.topics[2]);
        } catch {
          continue;
        }
      }
    }
    return 0n;
  }
}
