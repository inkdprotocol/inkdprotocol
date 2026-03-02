/**
 * @file init.test.ts
 * Unit tests for `inkd init` command.
 * Tests filesystem scaffold behaviour without touching the blockchain.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import os from "os";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return mkdtempSync(join(os.tmpdir(), "inkd-init-test-"));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("cmdInit", () => {
  let tmpDir: string;
  let originalCwd: string;
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("creates inkd.config.json in cwd by default (testnet)", async () => {
    const { cmdInit } = await import("../commands/init.js");
    await cmdInit([]);

    const configPath = join(tmpDir, "inkd.config.json");
    expect(existsSync(configPath)).toBe(true);
    const data = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(data.network).toBe("testnet");
  });

  it("creates mainnet config with --mainnet flag", async () => {
    const { cmdInit } = await import("../commands/init.js");
    await cmdInit(["--mainnet"]);

    const configPath = join(tmpDir, "inkd.config.json");
    expect(existsSync(configPath)).toBe(true);
    const data = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(data.network).toBe("mainnet");
  });

  it("does NOT overwrite existing config without --force", async () => {
    const { cmdInit } = await import("../commands/init.js");

    // First init creates the file
    await cmdInit([]);
    const configPath = join(tmpDir, "inkd.config.json");
    const firstContent = readFileSync(configPath, "utf-8");

    // Second init without --force should warn and not overwrite
    const consoleWarn = vi.spyOn(console, "error").mockImplementation(() => {});
    await cmdInit(["--mainnet"]);
    const secondContent = readFileSync(configPath, "utf-8");

    // Content should be identical — mainnet was NOT applied
    expect(secondContent).toBe(firstContent);
    consoleWarn.mockRestore();
  });

  it("overwrites existing config with --force flag", async () => {
    const { cmdInit } = await import("../commands/init.js");

    // First: testnet
    await cmdInit([]);

    // Second: mainnet with --force
    await cmdInit(["--mainnet", "--force"]);

    const configPath = join(tmpDir, "inkd.config.json");
    const data = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(data.network).toBe("mainnet");
  });

  it("prints success message after creation", async () => {
    const { cmdInit } = await import("../commands/init.js");
    await cmdInit([]);

    // One of the console.log calls should mention inkd.config.json
    const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/inkd\.config\.json/);
  });

  it("prints next steps after creation", async () => {
    const { cmdInit } = await import("../commands/init.js");
    await cmdInit([]);

    const logged = consoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/INKD_PRIVATE_KEY/);
    expect(logged).toMatch(/inkd status/);
  });
});
