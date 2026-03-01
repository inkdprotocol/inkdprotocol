/**
 * @file types.ts
 * @description Core TypeScript types for the Inkd Protocol SDK.
 */

// ─── Address Type ─────────────────────────────────────────────────────────────

export type Address = `0x${string}`;

// ─── Content Types ────────────────────────────────────────────────────────────

/** Common content type values for inscriptions. */
export enum ContentType {
  JSON = "application/json",
  PlainText = "text/plain",
  Markdown = "text/markdown",
  HTML = "text/html",
  CSS = "text/css",
  JavaScript = "application/javascript",
  TypeScript = "application/typescript",
  PNG = "image/png",
  JPEG = "image/jpeg",
  SVG = "image/svg+xml",
  GIF = "image/gif",
  WebP = "image/webp",
  PDF = "application/pdf",
  Binary = "application/octet-stream",
  YAML = "application/yaml",
  XML = "application/xml",
  CSV = "text/csv",
  WASM = "application/wasm",
}

// ─── On-Chain Types ───────────────────────────────────────────────────────────

/** InkdToken data as stored on-chain. */
export interface InkdTokenData {
  /** Unique on-chain token identifier. */
  tokenId: bigint;
  /** Current owner address. */
  owner: Address;
  /** Timestamp when the token was minted. */
  mintedAt: bigint;
  /** Number of active inscriptions on this token. */
  inscriptionCount: number;
  /** Token metadata URI (on-chain SVG). */
  tokenURI: string;
}

/** A single inscription stored on an InkdToken. */
export interface Inscription {
  /** Arweave transaction ID. */
  arweaveHash: string;
  /** MIME type of the data. */
  contentType: string;
  /** File size in bytes. */
  size: bigint;
  /** Human-readable name. */
  name: string;
  /** Timestamp of creation. */
  createdAt: bigint;
  /** Whether the inscription has been soft-deleted. */
  isRemoved: boolean;
  /** Current version number. */
  version: bigint;
}

/** Access grant for temporary read access. */
export interface AccessGrant {
  /** Wallet with access. */
  grantee: Address;
  /** Expiry timestamp. */
  expiresAt: bigint;
  /** When access was granted. */
  grantedAt: bigint;
}

/** Marketplace listing data. */
export interface SaleData {
  /** Token ID being sold. */
  tokenId: bigint;
  /** Seller address. */
  seller: Address;
  /** Price in wei. */
  price: bigint;
  /** When the listing was created. */
  listedAt: bigint;
  /** Whether the listing is active. */
  active: boolean;
}

/** Registry registration data. */
export interface TokenRegistration {
  /** Token ID. */
  tokenId: bigint;
  /** Owner address. */
  owner: Address;
  /** Whether the token is publicly discoverable. */
  isPublic: boolean;
  /** Registration timestamp. */
  registeredAt: bigint;
}

/** Protocol-wide statistics. */
export interface ProtocolStats {
  /** Total registered tokens. */
  totalTokens: bigint;
  /** Total tracked inscriptions. */
  totalInscriptions: bigint;
  /** Total sales volume in wei. */
  totalVolume: bigint;
  /** Total completed sales. */
  totalSales: bigint;
}

// ─── Client Config ────────────────────────────────────────────────────────────

/** Configuration for the InkdClient. */
export interface InkdClientConfig {
  /** InkdToken proxy contract address. */
  tokenAddress: Address;
  /** InkdVault proxy contract address. */
  vaultAddress: Address;
  /** InkdRegistry proxy contract address. */
  registryAddress: Address;
  /** Chain ID (8453 = Base Mainnet, 84532 = Base Sepolia). */
  chainId: 8453 | 84532;
}

/** Options for inscribing data. */
export interface InscribeOptions {
  /** Content type of the file. */
  contentType?: string;
  /** Human-readable name. */
  name?: string;
  /** Arweave upload tags. */
  tags?: Record<string, string>;
  /** ETH value to send (for protocol fee). */
  value?: bigint;
}

/** Options for minting tokens. */
export interface MintOptions {
  /** Number of tokens to mint (for batch mint). */
  quantity?: number;
}

// ─── Transaction Types ────────────────────────────────────────────────────────

/** Result of a successful on-chain transaction. */
export interface TransactionResult {
  /** Transaction hash. */
  hash: Address;
  /** Token ID (if applicable). */
  tokenId?: bigint;
}

/** Result of a batch mint transaction. */
export interface BatchTransactionResult {
  /** Transaction hash. */
  hash: Address;
  /** Array of minted token IDs. */
  tokenIds: bigint[];
}

/** Result of an inscription operation. */
export interface InscribeResult {
  /** Transaction hash. */
  hash: Address;
  /** Inscription index on the token. */
  inscriptionIndex: bigint;
  /** Arweave upload result. */
  upload: UploadResult;
}

// ─── Arweave Types ────────────────────────────────────────────────────────────

/** Result of an Arweave upload. */
export interface UploadResult {
  /** Arweave transaction hash. */
  hash: string;
  /** Full Arweave gateway URL. */
  url: string;
  /** Size of uploaded data in bytes. */
  size: number;
}

// ─── Encryption Types ─────────────────────────────────────────────────────────

/** Encryption configuration for Lit Protocol integration. */
export interface EncryptionConfig {
  /** Lit Protocol network to use. */
  network: "datil" | "datil-dev" | "datil-test";
  /** Chain for access control conditions. */
  chain: string;
}

/** Result of encrypting data via Lit Protocol. */
export interface EncryptedData {
  /** Encrypted data blob. */
  ciphertext: Uint8Array;
  /** Encrypted symmetric key. */
  encryptedSymmetricKey: string;
  /** Access control conditions for decryption. */
  accessControlConditions: unknown[];
}

/** Cost estimate for an inscription operation. */
export interface InscribeCostEstimate {
  /** Estimated gas cost in wei. */
  gas: bigint;
  /** Arweave storage cost in wei. */
  arweave: bigint;
  /** Protocol fee in wei. */
  protocolFee: bigint;
  /** Total estimated cost in wei. */
  total: bigint;
}
