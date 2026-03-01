/**
 * @file index.ts
 * @description Inkd Protocol SDK — the decentralized ownership layer for AI agents.
 *
 *              @inkd/sdk provides a TypeScript client for minting, purchasing,
 *              burning, and managing data tokens on the InkdVault contract (Base).
 *
 * @example
 * ```ts
 * import { InkdClient } from "@inkd/sdk";
 *
 * const inkd = new InkdClient({
 *   contractAddress: "0x...",
 *   chainId: 84532,
 * });
 * ```
 */

export { InkdClient } from "./InkdClient";
export { ArweaveClient } from "./arweave";
export {
  PassthroughEncryption,
  LitEncryptionProvider,
  type IEncryptionProvider,
} from "./encryption";
export { INKD_VAULT_ABI } from "./abi";
export type {
  DataToken,
  TokenData,
  AccessGrant,
  MintOptions,
  BatchMintOptions,
  UploadResult,
  InkdClientConfig,
  TransactionResult,
  BatchTransactionResult,
  EncryptionConfig,
  EncryptedData,
} from "./types";
