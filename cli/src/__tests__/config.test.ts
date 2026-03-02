/**
 * @file config.test.ts
 * Unit tests for CLI config module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { mkdtempSync, rmSync } from "fs";

// We import the module under test after potential env manipulation
// so we use dynamic imports inside tests where needed.
import {
  DEFAULT_CONFIG,
  loadConfig,
  writeConfig,
  requirePrivateKey,
  error,
  RED,
  GREEN,
  YELLOW,
  CYAN,
  BOLD,
  DIM,
  RESET,
  ADDRESSES,
} from "../config.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), "inkd-cli-test-"));
}

// ─── DEFAULT_CONFIG ───────────────────────────────────────────────────────────

describe("DEFAULT_CONFIG", () => {
  it("defaults to testnet", () => {
    expect(DEFAULT_CONFIG.network).toBe("testnet");
  });

  it("has no privateKey by default", () => {
    expect(DEFAULT_CONFIG.privateKey).toBeUndefined();
  });

  it("has no rpcUrl by default", () => {
    expect(DEFAULT_CONFIG.rpcUrl).toBeUndefined();
  });
});

// ─── ADDRESSES ───────────────────────────────────────────────────────────────

describe("ADDRESSES", () => {
  it("has mainnet and testnet keys", () => {
    expect(ADDRESSES).toHaveProperty("mainnet");
    expect(ADDRESSES).toHaveProperty("testnet");
  });

  it("each network has token, registry, treasury fields", () => {
    for (const net of ["mainnet", "testnet"] as const) {
      expect(ADDRESSES[net]).toHaveProperty("token");
      expect(ADDRESSES[net]).toHaveProperty("registry");
      expect(ADDRESSES[net]).toHaveProperty("treasury");
    }
  });
});

// ─── loadConfig ───────────────────────────────────────────────────────────────

describe("loadConfig()", () => {
  let tmpDir: string;
  let originalCwd: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
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

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("returns testnet default when no config file and no env vars", () => {
    const cfg = loadConfig();
    expect(cfg.network).toBe("testnet");
    expect(cfg.privateKey).toBeUndefined();
    expect(cfg.rpcUrl).toBeUndefined();
  });

  it("reads inkd.config.json when present", () => {
    writeFileSync(
      path.join(tmpDir, "inkd.config.json"),
      JSON.stringify({ network: "mainnet", rpcUrl: "https://mainnet.example.com" }),
      "utf-8"
    );
    const cfg = loadConfig();
    expect(cfg.network).toBe("mainnet");
    expect(cfg.rpcUrl).toBe("https://mainnet.example.com");
  });

  it("env var INKD_NETWORK overrides config file", () => {
    writeFileSync(
      path.join(tmpDir, "inkd.config.json"),
      JSON.stringify({ network: "mainnet" }),
      "utf-8"
    );
    process.env["INKD_NETWORK"] = "testnet";
    const cfg = loadConfig();
    expect(cfg.network).toBe("testnet");
  });

  it("env var INKD_RPC_URL overrides config file", () => {
    writeFileSync(
      path.join(tmpDir, "inkd.config.json"),
      JSON.stringify({ rpcUrl: "https://file-rpc.example.com" }),
      "utf-8"
    );
    process.env["INKD_RPC_URL"] = "https://env-rpc.example.com";
    const cfg = loadConfig();
    expect(cfg.rpcUrl).toBe("https://env-rpc.example.com");
  });

  it("env var INKD_PRIVATE_KEY overrides config file privateKey", () => {
    const fileKey = "0x" + "a".repeat(64);
    const envKey  = "0x" + "b".repeat(64);
    writeFileSync(
      path.join(tmpDir, "inkd.config.json"),
      JSON.stringify({ privateKey: fileKey }),
      "utf-8"
    );
    process.env["INKD_PRIVATE_KEY"] = envKey;
    const cfg = loadConfig();
    expect(cfg.privateKey).toBe(envKey);
  });

  it("reads privateKey from config file when env not set", () => {
    const key = "0x" + "c".repeat(64);
    writeFileSync(
      path.join(tmpDir, "inkd.config.json"),
      JSON.stringify({ privateKey: key }),
      "utf-8"
    );
    const cfg = loadConfig();
    expect(cfg.privateKey).toBe(key);
  });
});

// ─── writeConfig ──────────────────────────────────────────────────────────────

describe("writeConfig()", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a valid JSON file", () => {
    writeConfig({ network: "mainnet", rpcUrl: "https://example.com" });
    const filePath = path.join(tmpDir, "inkd.config.json");
    expect(existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(parsed.network).toBe("mainnet");
    expect(parsed.rpcUrl).toBe("https://example.com");
  });

  it("never persists privateKey to file", () => {
    writeConfig({ network: "testnet", privateKey: "0x" + "d".repeat(64) });
    const filePath = path.join(tmpDir, "inkd.config.json");
    const contents = readFileSync(filePath, "utf-8");
    expect(contents).not.toContain("privateKey");
    expect(contents).not.toContain("d".repeat(64));
  });

  it("file ends with newline", () => {
    writeConfig({ network: "testnet" });
    const filePath = path.join(tmpDir, "inkd.config.json");
    const contents = readFileSync(filePath, "utf-8");
    expect(contents.endsWith("\n")).toBe(true);
  });

  it("is pretty-printed (2-space indent)", () => {
    writeConfig({ network: "testnet", rpcUrl: "https://x.com" });
    const filePath = path.join(tmpDir, "inkd.config.json");
    const contents = readFileSync(filePath, "utf-8");
    expect(contents).toMatch(/^\{/);
    expect(contents).toContain("  ");
  });
});

// ─── requirePrivateKey ────────────────────────────────────────────────────────

describe("requirePrivateKey()", () => {
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env["INKD_PRIVATE_KEY"];
    delete process.env["INKD_PRIVATE_KEY"];
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env["INKD_PRIVATE_KEY"];
    else process.env["INKD_PRIVATE_KEY"] = savedEnv;
  });

  it("returns the key from config when present", () => {
    const key = "0x" + "e".repeat(64);
    const result = requirePrivateKey({ network: "testnet", privateKey: key });
    expect(result).toBe(key);
  });

  it("prepends 0x when key has no prefix", () => {
    const raw = "f".repeat(64);
    const result = requirePrivateKey({ network: "testnet", privateKey: raw });
    expect(result).toBe(`0x${raw}`);
  });

  it("returns key from env when config has none", () => {
    const key = "0x" + "1".repeat(64);
    process.env["INKD_PRIVATE_KEY"] = key;
    const result = requirePrivateKey({ network: "testnet" });
    expect(result).toBe(key);
  });

  it("exits when no key is available", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    expect(() => requirePrivateKey({ network: "testnet" })).toThrow();
    mockExit.mockRestore();
  });
});

// ─── ANSI colour exports ──────────────────────────────────────────────────────

describe("ANSI colour exports", () => {
  it("exports string values for all colour constants", () => {
    for (const val of [RED, GREEN, YELLOW, CYAN, BOLD, DIM, RESET]) {
      expect(typeof val).toBe("string");
    }
  });
});
