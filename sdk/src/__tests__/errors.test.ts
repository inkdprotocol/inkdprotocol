import { describe, it, expect } from "vitest";
import {
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
} from "../errors";

describe("InkdError (base)", () => {
  it("sets message and code", () => {
    const err = new InkdError("test error", "TEST_CODE");
    expect(err.message).toBe("test error");
    expect(err.code).toBe("TEST_CODE");
    expect(err.name).toBe("InkdError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("NotInkdHolder", () => {
  it("includes address in message and sets .address", () => {
    const addr = "0xdeadbeef";
    const err = new NotInkdHolder(addr);
    expect(err.address).toBe(addr);
    expect(err.code).toBe("NOT_INKD_HOLDER");
    expect(err.message).toContain(addr);
    expect(err.name).toBe("NotInkdHolder");
    expect(err).toBeInstanceOf(InkdError);
  });
});

describe("InsufficientFunds", () => {
  it("stores required and available amounts", () => {
    const required = 1_000_000n;
    const available = 500_000n;
    const err = new InsufficientFunds(required, available);
    expect(err.required).toBe(required);
    expect(err.available).toBe(available);
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
    expect(err.message).toContain("1000000 wei");
    expect(err.message).toContain("500000 wei");
  });
});

describe("TokenNotFound", () => {
  it("includes token ID in message", () => {
    const err = new TokenNotFound(42n);
    expect(err.tokenId).toBe(42n);
    expect(err.code).toBe("TOKEN_NOT_FOUND");
    expect(err.message).toContain("#42");
  });
});

describe("InscriptionNotFound", () => {
  it("includes tokenId and index", () => {
    const err = new InscriptionNotFound(7n, 3);
    expect(err.tokenId).toBe(7n);
    expect(err.index).toBe(3);
    expect(err.code).toBe("INSCRIPTION_NOT_FOUND");
    expect(err.message).toContain("#7");
    expect(err.message).toContain("3");
  });
});

describe("NotTokenOwner", () => {
  it("includes tokenId and caller", () => {
    const caller = "0xabc123";
    const err = new NotTokenOwner(99n, caller);
    expect(err.tokenId).toBe(99n);
    expect(err.caller).toBe(caller);
    expect(err.code).toBe("NOT_TOKEN_OWNER");
    expect(err.message).toContain(caller);
    expect(err.message).toContain("#99");
  });
});

describe("ClientNotConnected", () => {
  it("has correct code and name", () => {
    const err = new ClientNotConnected();
    expect(err.code).toBe("CLIENT_NOT_CONNECTED");
    expect(err.name).toBe("ClientNotConnected");
    expect(err.message).toContain("connect()");
  });
});

describe("ArweaveNotConnected", () => {
  it("has correct code and name", () => {
    const err = new ArweaveNotConnected();
    expect(err.code).toBe("ARWEAVE_NOT_CONNECTED");
    expect(err.name).toBe("ArweaveNotConnected");
    expect(err.message).toContain("connectArweave()");
  });
});

describe("TransactionFailed", () => {
  it("stores optional txHash", () => {
    const hash = "0xabc";
    const err = new TransactionFailed("reverted", hash);
    expect(err.txHash).toBe(hash);
    expect(err.code).toBe("TRANSACTION_FAILED");
  });

  it("works without txHash", () => {
    const err = new TransactionFailed("unknown error");
    expect(err.txHash).toBeUndefined();
  });
});

describe("MaxSupplyReached", () => {
  it("mentions 10,000 supply cap", () => {
    const err = new MaxSupplyReached();
    expect(err.code).toBe("MAX_SUPPLY_REACHED");
    expect(err.message).toContain("10,000");
  });
});

describe("EncryptionError", () => {
  it("passes message through", () => {
    const err = new EncryptionError("bad key");
    expect(err.code).toBe("ENCRYPTION_ERROR");
    expect(err.message).toBe("bad key");
  });
});

describe("UploadError", () => {
  it("passes message through", () => {
    const err = new UploadError("ENOENT");
    expect(err.code).toBe("UPLOAD_ERROR");
    expect(err.message).toBe("ENOENT");
  });
});

describe("Error inheritance chain", () => {
  it("all errors are instanceof InkdError and Error", () => {
    const errors = [
      new NotInkdHolder("0x0"),
      new InsufficientFunds(0n, 0n),
      new TokenNotFound(0n),
      new InscriptionNotFound(0n, 0),
      new NotTokenOwner(0n, "0x0"),
      new ClientNotConnected(),
      new ArweaveNotConnected(),
      new TransactionFailed("test"),
      new MaxSupplyReached(),
      new EncryptionError("test"),
      new UploadError("test"),
    ];

    for (const e of errors) {
      expect(e).toBeInstanceOf(InkdError);
      expect(e).toBeInstanceOf(Error);
    }
  });
});
