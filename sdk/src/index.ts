/**
 * @file index.ts
 * @description Inkd Protocol SDK — the ownership layer for AI agents on Base.
 *
 * @example
 * ```ts
 * import { InkdClient } from "@inkd/sdk";
 *
 * const inkd = new InkdClient({
 *   tokenAddress: "0x...",
 *   vaultAddress: "0x...",
 *   registryAddress: "0x...",
 *   chainId: 84532,
 * });
 * ```
 */

// Core client
export { InkdClient } from "./InkdClient";

// Arweave
export { ArweaveClient } from "./arweave";

// Encryption
export {
  PassthroughEncryption,
  LitEncryptionProvider,
  type IEncryptionProvider,
} from "./encryption";

// ABIs
export { INKD_TOKEN_ABI, INKD_VAULT_ABI, INKD_REGISTRY_ABI } from "./abi";

// Errors
export {
  InkdError,
  NotInkdHolder,
  InsufficientFunds,
  TokenNotFound,
  InscriptionNotFound,
  NotTokenOwner,
  ClientNotConnected,
  ArweaveNotConnected,
  TransactionFailed,
  MaxSupplyReached,
  EncryptionError,
  UploadError,
} from "./errors";

// React hooks
export { useInkd, useToken, useInscriptions, useInkdHolder } from "./hooks";

// Types
export {
  ContentType,
  type Address,
  type InkdClientConfig,
  type InkdTokenData,
  type Inscription,
  type AccessGrant,
  type SaleData,
  type TokenRegistration,
  type ProtocolStats,
  type MintOptions,
  type InscribeOptions,
  type InscribeResult,
  type InscribeCostEstimate,
  type TransactionResult,
  type BatchTransactionResult,
  type UploadResult,
  type EncryptionConfig,
  type EncryptedData,
} from "./types";
