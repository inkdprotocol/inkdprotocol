/**
 * @file errors.ts
 * @description Custom error classes for the Inkd Protocol SDK.
 */

/** Base error class for all Inkd SDK errors. */
export class InkdError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "InkdError";
    this.code = code;
  }
}

/** Thrown when a wallet does not hold any InkdToken. */
export class NotInkdHolder extends InkdError {
  public readonly address: string;

  constructor(address: string) {
    super(
      `Address ${address} does not hold any InkdToken. Mint or purchase one first.`,
      "NOT_INKD_HOLDER"
    );
    this.name = "NotInkdHolder";
    this.address = address;
  }
}

/** Thrown when there are insufficient funds for an operation. */
export class InsufficientFunds extends InkdError {
  public readonly required: bigint;
  public readonly available: bigint;

  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient funds: need ${required} wei, have ${available} wei`,
      "INSUFFICIENT_FUNDS"
    );
    this.name = "InsufficientFunds";
    this.required = required;
    this.available = available;
  }
}

/** Thrown when a token ID does not exist. */
export class TokenNotFound extends InkdError {
  public readonly tokenId: bigint;

  constructor(tokenId: bigint) {
    super(`InkdToken #${tokenId} does not exist`, "TOKEN_NOT_FOUND");
    this.name = "TokenNotFound";
    this.tokenId = tokenId;
  }
}

/** Thrown when an inscription index is out of bounds. */
export class InscriptionNotFound extends InkdError {
  public readonly tokenId: bigint;
  public readonly index: number;

  constructor(tokenId: bigint, index: number) {
    super(
      `Inscription ${index} not found on InkdToken #${tokenId}`,
      "INSCRIPTION_NOT_FOUND"
    );
    this.name = "InscriptionNotFound";
    this.tokenId = tokenId;
    this.index = index;
  }
}

/** Thrown when the caller is not the owner of the token. */
export class NotTokenOwner extends InkdError {
  public readonly tokenId: bigint;
  public readonly caller: string;

  constructor(tokenId: bigint, caller: string) {
    super(
      `Address ${caller} is not the owner of InkdToken #${tokenId}`,
      "NOT_TOKEN_OWNER"
    );
    this.name = "NotTokenOwner";
    this.tokenId = tokenId;
    this.caller = caller;
  }
}

/** Thrown when the client is not connected. */
export class ClientNotConnected extends InkdError {
  constructor() {
    super(
      "InkdClient is not connected. Call connect() first.",
      "CLIENT_NOT_CONNECTED"
    );
    this.name = "ClientNotConnected";
  }
}

/** Thrown when the Arweave client is not connected. */
export class ArweaveNotConnected extends InkdError {
  constructor() {
    super(
      "Arweave client is not connected. Call connectArweave() first.",
      "ARWEAVE_NOT_CONNECTED"
    );
    this.name = "ArweaveNotConnected";
  }
}

/** Thrown when a transaction fails on-chain. */
export class TransactionFailed extends InkdError {
  public readonly txHash?: string;

  constructor(message: string, txHash?: string) {
    super(message, "TRANSACTION_FAILED");
    this.name = "TransactionFailed";
    this.txHash = txHash;
  }
}

/** Thrown when max supply has been reached. */
export class MaxSupplyReached extends InkdError {
  constructor() {
    super(
      "InkdToken max supply of 10,000 has been reached",
      "MAX_SUPPLY_REACHED"
    );
    this.name = "MaxSupplyReached";
  }
}

/** Thrown when encryption/decryption fails. */
export class EncryptionError extends InkdError {
  constructor(message: string) {
    super(message, "ENCRYPTION_ERROR");
    this.name = "EncryptionError";
  }
}

/** Thrown when an Arweave upload fails. */
export class UploadError extends InkdError {
  constructor(message: string) {
    super(message, "UPLOAD_ERROR");
    this.name = "UploadError";
  }
}
