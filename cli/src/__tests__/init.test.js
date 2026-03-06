"use strict";
/**
 * @file init.test.ts
 * Unit tests for `inkd init` command.
 * Tests filesystem scaffold behaviour without touching the blockchain.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = __importDefault(require("os"));
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeTmpDir() {
    return (0, fs_1.mkdtempSync)((0, path_1.join)(os_1.default.tmpdir(), "inkd-init-test-"));
}
// ─── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("cmdInit", () => {
    let tmpDir;
    let originalCwd;
    let consoleLog;
    (0, vitest_1.beforeEach)(() => {
        tmpDir = makeTmpDir();
        originalCwd = process.cwd();
        process.chdir(tmpDir);
        consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
    });
    (0, vitest_1.afterEach)(() => {
        process.chdir(originalCwd);
        (0, fs_1.rmSync)(tmpDir, { recursive: true, force: true });
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("creates inkd.config.json in cwd by default (testnet)", async () => {
        const { cmdInit } = await Promise.resolve().then(() => __importStar(require("../commands/init.js")));
        await cmdInit([]);
        const configPath = (0, path_1.join)(tmpDir, "inkd.config.json");
        (0, vitest_1.expect)((0, fs_1.existsSync)(configPath)).toBe(true);
        const data = JSON.parse((0, fs_1.readFileSync)(configPath, "utf-8"));
        (0, vitest_1.expect)(data.network).toBe("testnet");
    });
    (0, vitest_1.it)("creates mainnet config with --mainnet flag", async () => {
        const { cmdInit } = await Promise.resolve().then(() => __importStar(require("../commands/init.js")));
        await cmdInit(["--mainnet"]);
        const configPath = (0, path_1.join)(tmpDir, "inkd.config.json");
        (0, vitest_1.expect)((0, fs_1.existsSync)(configPath)).toBe(true);
        const data = JSON.parse((0, fs_1.readFileSync)(configPath, "utf-8"));
        (0, vitest_1.expect)(data.network).toBe("mainnet");
    });
    (0, vitest_1.it)("does NOT overwrite existing config without --force", async () => {
        const { cmdInit } = await Promise.resolve().then(() => __importStar(require("../commands/init.js")));
        // First init creates the file
        await cmdInit([]);
        const configPath = (0, path_1.join)(tmpDir, "inkd.config.json");
        const firstContent = (0, fs_1.readFileSync)(configPath, "utf-8");
        // Second init without --force should warn and not overwrite
        const consoleWarn = vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        await cmdInit(["--mainnet"]);
        const secondContent = (0, fs_1.readFileSync)(configPath, "utf-8");
        // Content should be identical — mainnet was NOT applied
        (0, vitest_1.expect)(secondContent).toBe(firstContent);
        consoleWarn.mockRestore();
    });
    (0, vitest_1.it)("overwrites existing config with --force flag", async () => {
        const { cmdInit } = await Promise.resolve().then(() => __importStar(require("../commands/init.js")));
        // First: testnet
        await cmdInit([]);
        // Second: mainnet with --force
        await cmdInit(["--mainnet", "--force"]);
        const configPath = (0, path_1.join)(tmpDir, "inkd.config.json");
        const data = JSON.parse((0, fs_1.readFileSync)(configPath, "utf-8"));
        (0, vitest_1.expect)(data.network).toBe("mainnet");
    });
    (0, vitest_1.it)("prints success message after creation", async () => {
        const { cmdInit } = await Promise.resolve().then(() => __importStar(require("../commands/init.js")));
        await cmdInit([]);
        // One of the console.log calls should mention inkd.config.json
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/inkd\.config\.json/);
    });
    (0, vitest_1.it)("prints next steps after creation", async () => {
        const { cmdInit } = await Promise.resolve().then(() => __importStar(require("../commands/init.js")));
        await cmdInit([]);
        const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
        (0, vitest_1.expect)(logged).toMatch(/INKD_PRIVATE_KEY/);
        (0, vitest_1.expect)(logged).toMatch(/inkd status/);
    });
});
//# sourceMappingURL=init.test.js.map