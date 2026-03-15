/**
 * @file index.test.ts
 * Unit tests for the CLI entry-point router (src/index.ts).
 *
 * Strategy: import `main` (exported for testability), mock all command
 * modules with vi.mock, stub process.argv, and assert correct dispatch.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Mock all command modules before importing main ───────────────────────────

vi.mock("../commands/init.js", () => ({ cmdInit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../commands/status.js", () => ({ cmdStatus: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../commands/project.js", () => ({
  cmdProjectCreate:  vi.fn().mockResolvedValue(undefined),
  cmdProjectGet:     vi.fn().mockResolvedValue(undefined),
  cmdProjectList:    vi.fn().mockResolvedValue(undefined),
  cmdProjectTransfer:vi.fn().mockResolvedValue(undefined),
  cmdProjectCollab:  vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../commands/version.js", () => ({
  cmdVersionPush: vi.fn().mockResolvedValue(undefined),
  cmdVersionList: vi.fn().mockResolvedValue(undefined),
  cmdVersionShow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../commands/agent.js", () => ({
  cmdAgentList:   vi.fn().mockResolvedValue(undefined),
  cmdAgentLookup: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../commands/token.js",  () => ({ cmdToken:  vi.fn().mockResolvedValue(undefined) }));
vi.mock("../commands/search.js", () => ({ cmdSearch: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../commands/watch.js",  () => ({ cmdWatch:  vi.fn().mockResolvedValue(undefined) }));
vi.mock("../commands/agentd.js", () => ({ cmdAgentd: vi.fn().mockResolvedValue(undefined) }));

// ─── Import main (and mocked commands for assertion) ─────────────────────────

import { main }                              from "../index.js";
import { cmdInit }                           from "../commands/init.js";
import { cmdStatus }                         from "../commands/status.js";
import {
  cmdProjectCreate, cmdProjectGet, cmdProjectList,
  _cmdProjectTransfer, _cmdProjectCollab,
}                                            from "../commands/project.js";
import { cmdVersionPush, cmdVersionList, cmdVersionShow } from "../commands/version.js";
import { cmdAgentList, cmdAgentLookup }      from "../commands/agent.js";
import { cmdToken }                          from "../commands/token.js";
import { cmdSearch }                         from "../commands/search.js";
import { cmdWatch }                          from "../commands/watch.js";
import { cmdAgentd }                         from "../commands/agentd.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Set process.argv as if the user ran: inkd <args> */
function setArgv(...args: string[]): void {
  process.argv = ["/usr/bin/node", "/usr/local/bin/inkd", ...args];
}

// ─── Setup/teardown ───────────────────────────────────────────────────────────

let consoleLog: ReturnType<typeof vi.spyOn>;
let consoleError: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;
let processExit: ReturnType<typeof vi.spyOn>;
const originalArgv = process.argv.slice();

beforeEach(() => {
  consoleLog   = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn  = vi.spyOn(console, "warn").mockImplementation(() => {});
  processExit  = vi.spyOn(process, "exit").mockImplementation((_code?: number | string | null) => {
    throw new Error(`process.exit(${_code})`);
  }) as unknown as ReturnType<typeof vi.spyOn>;
  vi.clearAllMocks();
  // Re-stub exit after clearAllMocks
  processExit = vi.spyOn(process, "exit").mockImplementation((_code?: number | string | null) => {
    throw new Error(`process.exit(${_code})`);
  }) as unknown as ReturnType<typeof vi.spyOn>;
  consoleLog   = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.argv = originalArgv.slice();
  vi.restoreAllMocks();
});

// ─── Help / version flags ─────────────────────────────────────────────────────

describe("showHelp / help routing", () => {
  it("prints help when no command given", async () => {
    setArgv();
    await main();
    expect(consoleLog).toHaveBeenCalled();
    const output = (consoleLog.mock.calls.flat().join("\n"));
    expect(output).toContain("inkd");
    expect(output).toContain("USAGE");
  });

  it("routes 'help' command to showHelp", async () => {
    setArgv("help");
    await main();
    expect(consoleLog).toHaveBeenCalled();
    const output = consoleLog.mock.calls.flat().join("\n");
    expect(output).toContain("COMMANDS");
  });

  it("routes '--help' flag to showHelp", async () => {
    setArgv("--help");
    await main();
    expect(consoleLog).toHaveBeenCalled();
  });

  it("routes '-h' flag to showHelp", async () => {
    setArgv("-h");
    await main();
    expect(consoleLog).toHaveBeenCalled();
  });

  it("prints version for --version flag", async () => {
    setArgv("--version");
    await main();
    expect(consoleLog).toHaveBeenCalledWith("0.1.0");
  });

  it("prints version for -v flag", async () => {
    setArgv("-v");
    await main();
    expect(consoleLog).toHaveBeenCalledWith("0.1.0");
  });
});

// ─── init ─────────────────────────────────────────────────────────────────────

describe("init routing", () => {
  it("calls cmdInit with no extra args", async () => {
    setArgv("init");
    await main();
    expect(cmdInit).toHaveBeenCalledWith([]);
  });

  it("calls cmdInit with extra flags forwarded", async () => {
    setArgv("init", "--mainnet");
    await main();
    expect(cmdInit).toHaveBeenCalledWith(["--mainnet"]);
  });
});

// ─── status ───────────────────────────────────────────────────────────────────

describe("status routing", () => {
  it("calls cmdStatus", async () => {
    setArgv("status");
    await main();
    expect(cmdStatus).toHaveBeenCalled();
  });
});

// ─── project ──────────────────────────────────────────────────────────────────

describe("project routing", () => {
  it("routes 'project create' to cmdProjectCreate", async () => {
    setArgv("project", "create", "--name", "my-agent");
    await main();
    expect(cmdProjectCreate).toHaveBeenCalledWith(["--name", "my-agent"]);
  });

  it("routes 'project get' to cmdProjectGet with args", async () => {
    setArgv("project", "get", "42");
    await main();
    expect(cmdProjectGet).toHaveBeenCalledWith(["42"]);
  });

  it("routes 'project list' to cmdProjectList", async () => {
    setArgv("project", "list", "0xDEAD");
    await main();
    expect(cmdProjectList).toHaveBeenCalledWith(["0xDEAD"]);
  });

  it("'project transfer' shows deprecated error", async () => {
    setArgv("project", "transfer", "--id", "1", "--to", "0xABCD");
    await expect(main()).rejects.toThrow("process.exit(1)");
    expect(consoleError).toHaveBeenCalled();
  });

  it("'project collab' shows deprecated error", async () => {
    setArgv("project", "collab", "add", "--id", "1", "--address", "0xF00D");
    await expect(main()).rejects.toThrow("process.exit(1)");
    expect(consoleError).toHaveBeenCalled();
  });

  it("exits(1) on unknown project sub-command", async () => {
    setArgv("project", "unknown-sub");
    await expect(main()).rejects.toThrow("process.exit(1)");
    expect(consoleError).toHaveBeenCalled();
  });
});

// ─── version ──────────────────────────────────────────────────────────────────

describe("version routing", () => {
  it("routes 'version push' to cmdVersionPush", async () => {
    setArgv("version", "push", "--id", "1", "--hash", "abc", "--tag", "v0.1.0");
    await main();
    expect(cmdVersionPush).toHaveBeenCalledWith(["--id", "1", "--hash", "abc", "--tag", "v0.1.0"]);
  });

  it("routes 'version list' to cmdVersionList", async () => {
    setArgv("version", "list", "1");
    await main();
    expect(cmdVersionList).toHaveBeenCalledWith(["1"]);
  });

  it("routes 'version show' to cmdVersionShow", async () => {
    setArgv("version", "show", "--id", "1", "--index", "0");
    await main();
    expect(cmdVersionShow).toHaveBeenCalledWith(["--id", "1", "--index", "0"]);
  });

  it("exits(1) on unknown version sub-command", async () => {
    setArgv("version", "bad-sub");
    await expect(main()).rejects.toThrow("process.exit(1)");
    expect(consoleError).toHaveBeenCalled();
  });
});

// ─── agent ────────────────────────────────────────────────────────────────────

describe("agent routing", () => {
  it("routes 'agent list' to cmdAgentList", async () => {
    setArgv("agent", "list", "--limit", "50");
    await main();
    expect(cmdAgentList).toHaveBeenCalledWith(["--limit", "50"]);
  });

  it("routes 'agent lookup' to cmdAgentLookup", async () => {
    setArgv("agent", "lookup", "my-agent");
    await main();
    expect(cmdAgentLookup).toHaveBeenCalledWith(["my-agent"]);
  });

  it("exits(1) on unknown agent sub-command", async () => {
    setArgv("agent", "delete");
    await expect(main()).rejects.toThrow("process.exit(1)");
    expect(consoleError).toHaveBeenCalled();
  });
});

// ─── token ────────────────────────────────────────────────────────────────────

describe("token routing", () => {
  it("routes 'token balance' to cmdToken", async () => {
    setArgv("token", "balance");
    await main();
    expect(cmdToken).toHaveBeenCalledWith(["balance"]);
  });

  it("routes 'token approve 5' to cmdToken with args", async () => {
    setArgv("token", "approve", "5");
    await main();
    expect(cmdToken).toHaveBeenCalledWith(["approve", "5"]);
  });
});

// ─── search ───────────────────────────────────────────────────────────────────

describe("search routing", () => {
  it("routes 'search trading bot' to cmdSearch", async () => {
    setArgv("search", "trading bot", "--agents");
    await main();
    expect(cmdSearch).toHaveBeenCalledWith(["trading bot", "--agents"]);
  });
});

// ─── watch ────────────────────────────────────────────────────────────────────

describe("watch routing", () => {
  it("routes 'watch versions' to cmdWatch", async () => {
    setArgv("watch", "versions", "--poll", "5000");
    await main();
    expect(cmdWatch).toHaveBeenCalledWith(["versions", "--poll", "5000"]);
  });
});

// ─── agentd ───────────────────────────────────────────────────────────────────

describe("agentd routing", () => {
  it("routes 'agentd start' to cmdAgentd", async () => {
    setArgv("agentd", "start", "--once");
    await main();
    expect(cmdAgentd).toHaveBeenCalledWith(["start", "--once"]);
  });

  it("routes 'agentd status' to cmdAgentd", async () => {
    setArgv("agentd", "status");
    await main();
    expect(cmdAgentd).toHaveBeenCalledWith(["status"]);
  });
});

// ─── Unknown command ──────────────────────────────────────────────────────────

describe("unknown command", () => {
  it("exits(1) and prints error for unrecognised top-level command", async () => {
    setArgv("foobar");
    await expect(main()).rejects.toThrow("process.exit(1)");
    expect(consoleError).toHaveBeenCalled();
    const errorOutput = consoleError.mock.calls.flat().join(" ");
    expect(errorOutput).toContain("foobar");
  });
});

// ─── Async error propagation ─────────────────────────────────────────────────

describe("async error propagation", () => {
  it("re-throws when a command rejects", async () => {
    const boom = new Error("network failure");
    (cmdStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce(boom);
    setArgv("status");
    await expect(main()).rejects.toThrow("network failure");
  });
});
