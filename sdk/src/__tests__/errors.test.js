"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errors_1 = require("../errors");
(0, vitest_1.describe)("InkdError (base)", () => {
    (0, vitest_1.it)("sets message and code", () => {
        const err = new errors_1.InkdError("test error", "TEST_CODE");
        (0, vitest_1.expect)(err.message).toBe("test error");
        (0, vitest_1.expect)(err.code).toBe("TEST_CODE");
        (0, vitest_1.expect)(err.name).toBe("InkdError");
        (0, vitest_1.expect)(err).toBeInstanceOf(Error);
    });
});
(0, vitest_1.describe)("NotInkdHolder", () => {
    (0, vitest_1.it)("includes address in message and sets .address", () => {
        const addr = "0xdeadbeef";
        const err = new errors_1.NotInkdHolder(addr);
        (0, vitest_1.expect)(err.address).toBe(addr);
        (0, vitest_1.expect)(err.code).toBe("NOT_INKD_HOLDER");
        (0, vitest_1.expect)(err.message).toContain(addr);
        (0, vitest_1.expect)(err.name).toBe("NotInkdHolder");
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.InkdError);
    });
});
(0, vitest_1.describe)("InsufficientFunds", () => {
    (0, vitest_1.it)("stores required and available amounts", () => {
        const required = 1000000n;
        const available = 500000n;
        const err = new errors_1.InsufficientFunds(required, available);
        (0, vitest_1.expect)(err.required).toBe(required);
        (0, vitest_1.expect)(err.available).toBe(available);
        (0, vitest_1.expect)(err.code).toBe("INSUFFICIENT_FUNDS");
        (0, vitest_1.expect)(err.message).toContain("1000000 wei");
        (0, vitest_1.expect)(err.message).toContain("500000 wei");
    });
});
(0, vitest_1.describe)("TokenNotFound", () => {
    (0, vitest_1.it)("includes token ID in message", () => {
        const err = new errors_1.TokenNotFound(42n);
        (0, vitest_1.expect)(err.tokenId).toBe(42n);
        (0, vitest_1.expect)(err.code).toBe("TOKEN_NOT_FOUND");
        (0, vitest_1.expect)(err.message).toContain("#42");
    });
});
(0, vitest_1.describe)("InscriptionNotFound", () => {
    (0, vitest_1.it)("includes tokenId and index", () => {
        const err = new errors_1.InscriptionNotFound(7n, 3);
        (0, vitest_1.expect)(err.tokenId).toBe(7n);
        (0, vitest_1.expect)(err.index).toBe(3);
        (0, vitest_1.expect)(err.code).toBe("INSCRIPTION_NOT_FOUND");
        (0, vitest_1.expect)(err.message).toContain("#7");
        (0, vitest_1.expect)(err.message).toContain("3");
    });
});
(0, vitest_1.describe)("NotTokenOwner", () => {
    (0, vitest_1.it)("includes tokenId and caller", () => {
        const caller = "0xabc123";
        const err = new errors_1.NotTokenOwner(99n, caller);
        (0, vitest_1.expect)(err.tokenId).toBe(99n);
        (0, vitest_1.expect)(err.caller).toBe(caller);
        (0, vitest_1.expect)(err.code).toBe("NOT_TOKEN_OWNER");
        (0, vitest_1.expect)(err.message).toContain(caller);
        (0, vitest_1.expect)(err.message).toContain("#99");
    });
});
(0, vitest_1.describe)("ClientNotConnected", () => {
    (0, vitest_1.it)("has correct code and name", () => {
        const err = new errors_1.ClientNotConnected();
        (0, vitest_1.expect)(err.code).toBe("CLIENT_NOT_CONNECTED");
        (0, vitest_1.expect)(err.name).toBe("ClientNotConnected");
        (0, vitest_1.expect)(err.message).toContain("connect()");
    });
});
(0, vitest_1.describe)("ArweaveNotConnected", () => {
    (0, vitest_1.it)("has correct code and name", () => {
        const err = new errors_1.ArweaveNotConnected();
        (0, vitest_1.expect)(err.code).toBe("ARWEAVE_NOT_CONNECTED");
        (0, vitest_1.expect)(err.name).toBe("ArweaveNotConnected");
        (0, vitest_1.expect)(err.message).toContain("connectArweave()");
    });
});
(0, vitest_1.describe)("TransactionFailed", () => {
    (0, vitest_1.it)("stores optional txHash", () => {
        const hash = "0xabc";
        const err = new errors_1.TransactionFailed("reverted", hash);
        (0, vitest_1.expect)(err.txHash).toBe(hash);
        (0, vitest_1.expect)(err.code).toBe("TRANSACTION_FAILED");
    });
    (0, vitest_1.it)("works without txHash", () => {
        const err = new errors_1.TransactionFailed("unknown error");
        (0, vitest_1.expect)(err.txHash).toBeUndefined();
    });
});
(0, vitest_1.describe)("MaxSupplyReached", () => {
    (0, vitest_1.it)("mentions 10,000 supply cap", () => {
        const err = new errors_1.MaxSupplyReached();
        (0, vitest_1.expect)(err.code).toBe("MAX_SUPPLY_REACHED");
        (0, vitest_1.expect)(err.message).toContain("10,000");
    });
});
(0, vitest_1.describe)("EncryptionError", () => {
    (0, vitest_1.it)("passes message through", () => {
        const err = new errors_1.EncryptionError("bad key");
        (0, vitest_1.expect)(err.code).toBe("ENCRYPTION_ERROR");
        (0, vitest_1.expect)(err.message).toBe("bad key");
    });
});
(0, vitest_1.describe)("UploadError", () => {
    (0, vitest_1.it)("passes message through", () => {
        const err = new errors_1.UploadError("ENOENT");
        (0, vitest_1.expect)(err.code).toBe("UPLOAD_ERROR");
        (0, vitest_1.expect)(err.message).toBe("ENOENT");
    });
});
(0, vitest_1.describe)("Error inheritance chain", () => {
    (0, vitest_1.it)("all errors are instanceof InkdError and Error", () => {
        const errors = [
            new errors_1.NotInkdHolder("0x0"),
            new errors_1.InsufficientFunds(0n, 0n),
            new errors_1.TokenNotFound(0n),
            new errors_1.InscriptionNotFound(0n, 0),
            new errors_1.NotTokenOwner(0n, "0x0"),
            new errors_1.ClientNotConnected(),
            new errors_1.ArweaveNotConnected(),
            new errors_1.TransactionFailed("test"),
            new errors_1.MaxSupplyReached(),
            new errors_1.EncryptionError("test"),
            new errors_1.UploadError("test"),
        ];
        for (const e of errors) {
            (0, vitest_1.expect)(e).toBeInstanceOf(errors_1.InkdError);
            (0, vitest_1.expect)(e).toBeInstanceOf(Error);
        }
    });
});
//# sourceMappingURL=errors.test.js.map