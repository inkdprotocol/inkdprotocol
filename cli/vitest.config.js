"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        globals: true,
        environment: "node",
        pool: "forks", // process.chdir() not supported in workers
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.ts"],
            exclude: ["src/**/__tests__/**", "src/**/*.test.ts"],
        },
    },
});
//# sourceMappingURL=vitest.config.js.map