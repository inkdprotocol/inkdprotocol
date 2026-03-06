"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const types_1 = require("../types");
// These are compile-time checks — if the file compiles, the types are correct.
// Runtime tests verify the enum values are stable.
(0, vitest_1.describe)("ContentType enum", () => {
    (0, vitest_1.it)("has correct MIME strings for common types", () => {
        (0, vitest_1.expect)(types_1.ContentType.JSON).toBe("application/json");
        (0, vitest_1.expect)(types_1.ContentType.PlainText).toBe("text/plain");
        (0, vitest_1.expect)(types_1.ContentType.Markdown).toBe("text/markdown");
        (0, vitest_1.expect)(types_1.ContentType.HTML).toBe("text/html");
        (0, vitest_1.expect)(types_1.ContentType.PNG).toBe("image/png");
        (0, vitest_1.expect)(types_1.ContentType.JPEG).toBe("image/jpeg");
        (0, vitest_1.expect)(types_1.ContentType.SVG).toBe("image/svg+xml");
        (0, vitest_1.expect)(types_1.ContentType.Binary).toBe("application/octet-stream");
        (0, vitest_1.expect)(types_1.ContentType.WASM).toBe("application/wasm");
    });
    (0, vitest_1.it)("covers all 18 expected content types", () => {
        const types = Object.values(types_1.ContentType);
        (0, vitest_1.expect)(types).toHaveLength(18);
    });
    (0, vitest_1.it)("all values are non-empty strings", () => {
        for (const value of Object.values(types_1.ContentType)) {
            (0, vitest_1.expect)(typeof value).toBe("string");
            (0, vitest_1.expect)(value.length).toBeGreaterThan(0);
        }
    });
    (0, vitest_1.it)("all values follow <type>/<subtype> format", () => {
        for (const value of Object.values(types_1.ContentType)) {
            (0, vitest_1.expect)(value).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
        }
    });
});
//# sourceMappingURL=types.test.js.map