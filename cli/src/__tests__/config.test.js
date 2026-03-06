"use strict";
/**
 * @file config.test.ts
 * Unit tests for CLI config module.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_2 = require("fs");
// We import the module under test after potential env manipulation
// so we use dynamic imports inside tests where needed.
const config_js_1 = require("../config.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeTmpDir() {
    return (0, fs_2.mkdtempSync)(path_1.default.join(os_1.default.tmpdir(), "inkd-cli-test-"));
}
// ─── DEFAULT_CONFIG ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("DEFAULT_CONFIG", () => {
    (0, vitest_1.it)("defaults to testnet", () => {
        (0, vitest_1.expect)(config_js_1.DEFAULT_CONFIG.network).toBe("testnet");
    });
    (0, vitest_1.it)("has no privateKey by default", () => {
        (0, vitest_1.expect)(config_js_1.DEFAULT_CONFIG.privateKey).toBeUndefined();
    });
    (0, vitest_1.it)("has no rpcUrl by default", () => {
        (0, vitest_1.expect)(config_js_1.DEFAULT_CONFIG.rpcUrl).toBeUndefined();
    });
});
// ─── ADDRESSES ───────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ADDRESSES", () => {
    (0, vitest_1.it)("has mainnet and testnet keys", () => {
        (0, vitest_1.expect)(config_js_1.ADDRESSES).toHaveProperty("mainnet");
        (0, vitest_1.expect)(config_js_1.ADDRESSES).toHaveProperty("testnet");
    });
    (0, vitest_1.it)("each network has token, registry, treasury fields", () => {
        for (const net of ["mainnet", "testnet"]) {
            (0, vitest_1.expect)(config_js_1.ADDRESSES[net]).toHaveProperty("token");
            (0, vitest_1.expect)(config_js_1.ADDRESSES[net]).toHaveProperty("registry");
            (0, vitest_1.expect)(config_js_1.ADDRESSES[net]).toHaveProperty("treasury");
        }
    });
});
// ─── loadConfig ───────────────────────────────────────────────────────────────
(0, vitest_1.describe)("loadConfig()", () => {
    let tmpDir;
    let originalCwd;
    let savedEnv;
    (0, vitest_1.beforeEach)(() => {
        tmpDir = makeTmpDir();
        originalCwd = process.cwd();
        process.chdir(tmpDir);
        savedEnv = {
            INKD_PRIVATE_KEY: process.env["INKD_PRIVATE_KEY"],
            INKD_RPC_URL: process.env["INKD_RPC_URL"],
            INKD_NETWORK: process.env["INKD_NETWORK"],
        };
        delete process.env["INKD_PRIVATE_KEY"];
        delete process.env["INKD_RPC_URL"];
        delete process.env["INKD_NETWORK"];
    });
    (0, vitest_1.afterEach)(() => {
        process.chdir(originalCwd);
        (0, fs_2.rmSync)(tmpDir, { recursive: true, force: true });
        for (const [k, v] of Object.entries(savedEnv)) {
            if (v === undefined)
                delete process.env[k];
            else
                process.env[k] = v;
        }
    });
    (0, vitest_1.it)("returns testnet default when no config file and no env vars", () => {
        const cfg = (0, config_js_1.loadConfig)();
        (0, vitest_1.expect)(cfg.network).toBe("testnet");
        (0, vitest_1.expect)(cfg.privateKey).toBeUndefined();
        (0, vitest_1.expect)(cfg.rpcUrl).toBeUndefined();
    });
    (0, vitest_1.it)("reads inkd.config.json when present", () => {
        (0, fs_1.writeFileSync)(path_1.default.join(tmpDir, "inkd.config.json"), JSON.stringify({ network: "mainnet", rpcUrl: "https://mainnet.example.com" }), "utf-8");
        const cfg = (0, config_js_1.loadConfig)();
        (0, vitest_1.expect)(cfg.network).toBe("mainnet");
        (0, vitest_1.expect)(cfg.rpcUrl).toBe("https://mainnet.example.com");
    });
    (0, vitest_1.it)("env var INKD_NETWORK overrides config file", () => {
        (0, fs_1.writeFileSync)(path_1.default.join(tmpDir, "inkd.config.json"), JSON.stringify({ network: "mainnet" }), "utf-8");
        process.env["INKD_NETWORK"] = "testnet";
        const cfg = (0, config_js_1.loadConfig)();
        (0, vitest_1.expect)(cfg.network).toBe("testnet");
    });
    (0, vitest_1.it)("env var INKD_RPC_URL overrides config file", () => {
        (0, fs_1.writeFileSync)(path_1.default.join(tmpDir, "inkd.config.json"), JSON.stringify({ rpcUrl: "https://file-rpc.example.com" }), "utf-8");
        process.env["INKD_RPC_URL"] = "https://env-rpc.example.com";
        const cfg = (0, config_js_1.loadConfig)();
        (0, vitest_1.expect)(cfg.rpcUrl).toBe("https://env-rpc.example.com");
    });
    (0, vitest_1.it)("env var INKD_PRIVATE_KEY overrides config file privateKey", () => {
        const fileKey = "0x" + "a".repeat(64);
        const envKey = "0x" + "b".repeat(64);
        (0, fs_1.writeFileSync)(path_1.default.join(tmpDir, "inkd.config.json"), JSON.stringify({ privateKey: fileKey }), "utf-8");
        process.env["INKD_PRIVATE_KEY"] = envKey;
        const cfg = (0, config_js_1.loadConfig)();
        (0, vitest_1.expect)(cfg.privateKey).toBe(envKey);
    });
    (0, vitest_1.it)("reads privateKey from config file when env not set", () => {
        const key = "0x" + "c".repeat(64);
        (0, fs_1.writeFileSync)(path_1.default.join(tmpDir, "inkd.config.json"), JSON.stringify({ privateKey: key }), "utf-8");
        const cfg = (0, config_js_1.loadConfig)();
        (0, vitest_1.expect)(cfg.privateKey).toBe(key);
    });
});
// ─── writeConfig ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("writeConfig()", () => {
    let tmpDir;
    let originalCwd;
    (0, vitest_1.beforeEach)(() => {
        tmpDir = makeTmpDir();
        originalCwd = process.cwd();
        process.chdir(tmpDir);
    });
    (0, vitest_1.afterEach)(() => {
        process.chdir(originalCwd);
        (0, fs_2.rmSync)(tmpDir, { recursive: true, force: true });
    });
    (0, vitest_1.it)("writes a valid JSON file", () => {
        (0, config_js_1.writeConfig)({ network: "mainnet", rpcUrl: "https://example.com" });
        const filePath = path_1.default.join(tmpDir, "inkd.config.json");
        (0, vitest_1.expect)((0, fs_1.existsSync)(filePath)).toBe(true);
        const parsed = JSON.parse((0, fs_1.readFileSync)(filePath, "utf-8"));
        (0, vitest_1.expect)(parsed.network).toBe("mainnet");
        (0, vitest_1.expect)(parsed.rpcUrl).toBe("https://example.com");
    });
    (0, vitest_1.it)("never persists privateKey to file", () => {
        (0, config_js_1.writeConfig)({ network: "testnet", privateKey: "0x" + "d".repeat(64) });
        const filePath = path_1.default.join(tmpDir, "inkd.config.json");
        const contents = (0, fs_1.readFileSync)(filePath, "utf-8");
        (0, vitest_1.expect)(contents).not.toContain("privateKey");
        (0, vitest_1.expect)(contents).not.toContain("d".repeat(64));
    });
    (0, vitest_1.it)("file ends with newline", () => {
        (0, config_js_1.writeConfig)({ network: "testnet" });
        const filePath = path_1.default.join(tmpDir, "inkd.config.json");
        const contents = (0, fs_1.readFileSync)(filePath, "utf-8");
        (0, vitest_1.expect)(contents.endsWith("\n")).toBe(true);
    });
    (0, vitest_1.it)("is pretty-printed (2-space indent)", () => {
        (0, config_js_1.writeConfig)({ network: "testnet", rpcUrl: "https://x.com" });
        const filePath = path_1.default.join(tmpDir, "inkd.config.json");
        const contents = (0, fs_1.readFileSync)(filePath, "utf-8");
        (0, vitest_1.expect)(contents).toMatch(/^\{/);
        (0, vitest_1.expect)(contents).toContain("  ");
    });
});
// ─── requirePrivateKey ────────────────────────────────────────────────────────
(0, vitest_1.describe)("requirePrivateKey()", () => {
    let savedEnv;
    (0, vitest_1.beforeEach)(() => {
        savedEnv = process.env["INKD_PRIVATE_KEY"];
        delete process.env["INKD_PRIVATE_KEY"];
    });
    (0, vitest_1.afterEach)(() => {
        if (savedEnv === undefined)
            delete process.env["INKD_PRIVATE_KEY"];
        else
            process.env["INKD_PRIVATE_KEY"] = savedEnv;
    });
    (0, vitest_1.it)("returns the key from config when present", () => {
        const key = "0x" + "e".repeat(64);
        const result = (0, config_js_1.requirePrivateKey)({ network: "testnet", privateKey: key });
        (0, vitest_1.expect)(result).toBe(key);
    });
    (0, vitest_1.it)("prepends 0x when key has no prefix", () => {
        const raw = "f".repeat(64);
        const result = (0, config_js_1.requirePrivateKey)({ network: "testnet", privateKey: raw });
        (0, vitest_1.expect)(result).toBe(`0x${raw}`);
    });
    (0, vitest_1.it)("returns key from env when config has none", () => {
        const key = "0x" + "1".repeat(64);
        process.env["INKD_PRIVATE_KEY"] = key;
        const result = (0, config_js_1.requirePrivateKey)({ network: "testnet" });
        (0, vitest_1.expect)(result).toBe(key);
    });
    (0, vitest_1.it)("exits when no key is available", () => {
        const mockExit = vitest_1.vi.spyOn(process, "exit").mockImplementation(() => {
            throw new Error("process.exit called");
        });
        (0, vitest_1.expect)(() => (0, config_js_1.requirePrivateKey)({ network: "testnet" })).toThrow();
        mockExit.mockRestore();
    });
});
// ─── ANSI colour exports ──────────────────────────────────────────────────────
(0, vitest_1.describe)("ANSI colour exports", () => {
    (0, vitest_1.it)("exports string values for all colour constants", () => {
        for (const val of [config_js_1.RED, config_js_1.GREEN, config_js_1.YELLOW, config_js_1.CYAN, config_js_1.BOLD, config_js_1.DIM, config_js_1.RESET]) {
            (0, vitest_1.expect)(typeof val).toBe("string");
        }
    });
});
// ─── loadConfig() — JSON parse error branch (line 31 in config.ts) ──────────
(0, vitest_1.describe)("loadConfig() — invalid JSON in config file", () => {
    let tmpDir;
    let originalCwd;
    let savedEnv;
    (0, vitest_1.beforeEach)(() => {
        tmpDir = (0, fs_2.mkdtempSync)(path_1.default.join(os_1.default.tmpdir(), "inkd-cfg-err-"));
        originalCwd = process.cwd();
        process.chdir(tmpDir);
        savedEnv = {
            INKD_PRIVATE_KEY: process.env["INKD_PRIVATE_KEY"],
            INKD_RPC_URL: process.env["INKD_RPC_URL"],
            INKD_NETWORK: process.env["INKD_NETWORK"],
        };
        delete process.env["INKD_PRIVATE_KEY"];
        delete process.env["INKD_RPC_URL"];
        delete process.env["INKD_NETWORK"];
    });
    (0, vitest_1.afterEach)(() => {
        process.chdir(originalCwd);
        (0, fs_2.rmSync)(tmpDir, { recursive: true, force: true });
        for (const [k, v] of Object.entries(savedEnv)) {
            if (v === undefined)
                delete process.env[k];
            else
                process.env[k] = v;
        }
    });
    (0, vitest_1.it)("calls error() and continues when inkd.config.json contains invalid JSON", () => {
        // Write a corrupt config file — JSON.parse will throw, hitting the catch branch
        (0, fs_1.writeFileSync)(path_1.default.join(tmpDir, "inkd.config.json"), "{ this is: not valid JSON !!!", "utf-8");
        // error() calls process.exit(1) — mock it so we can observe the call
        const mockExit = vitest_1.vi.spyOn(process, "exit").mockImplementation((_) => {
            throw new Error("process.exit called");
        });
        const mockConsoleError = vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        // loadConfig() should call error() which calls process.exit(1)
        (0, vitest_1.expect)(() => (0, config_js_1.loadConfig)()).toThrow("process.exit called");
        // Verify error was reported (via console.error inside error())
        (0, vitest_1.expect)(mockConsoleError).toHaveBeenCalledWith(vitest_1.expect.stringContaining("Failed to parse"));
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
    });
});
//# sourceMappingURL=config.test.js.map