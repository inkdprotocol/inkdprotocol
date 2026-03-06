"use strict";
/**
 * @file index.test.ts
 * Unit tests for the CLI entry-point router (src/index.ts).
 *
 * Strategy: import `main` (exported for testability), mock all command
 * modules with vi.mock, stub process.argv, and assert correct dispatch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ─── Mock all command modules before importing main ───────────────────────────
vitest_1.vi.mock("../commands/init.js", () => ({ cmdInit: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock("../commands/status.js", () => ({ cmdStatus: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock("../commands/project.js", () => ({
    cmdProjectCreate: vitest_1.vi.fn().mockResolvedValue(undefined),
    cmdProjectGet: vitest_1.vi.fn().mockResolvedValue(undefined),
    cmdProjectList: vitest_1.vi.fn().mockResolvedValue(undefined),
    cmdProjectTransfer: vitest_1.vi.fn().mockResolvedValue(undefined),
    cmdProjectCollab: vitest_1.vi.fn().mockResolvedValue(undefined),
}));
vitest_1.vi.mock("../commands/version.js", () => ({
    cmdVersionPush: vitest_1.vi.fn().mockResolvedValue(undefined),
    cmdVersionList: vitest_1.vi.fn().mockResolvedValue(undefined),
    cmdVersionShow: vitest_1.vi.fn().mockResolvedValue(undefined),
}));
vitest_1.vi.mock("../commands/agent.js", () => ({
    cmdAgentList: vitest_1.vi.fn().mockResolvedValue(undefined),
    cmdAgentLookup: vitest_1.vi.fn().mockResolvedValue(undefined),
}));
vitest_1.vi.mock("../commands/token.js", () => ({ cmdToken: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock("../commands/search.js", () => ({ cmdSearch: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock("../commands/watch.js", () => ({ cmdWatch: vitest_1.vi.fn().mockResolvedValue(undefined) }));
vitest_1.vi.mock("../commands/agentd.js", () => ({ cmdAgentd: vitest_1.vi.fn().mockResolvedValue(undefined) }));
// ─── Import main (and mocked commands for assertion) ─────────────────────────
const index_js_1 = require("../index.js");
const init_js_1 = require("../commands/init.js");
const status_js_1 = require("../commands/status.js");
const project_js_1 = require("../commands/project.js");
const version_js_1 = require("../commands/version.js");
const agent_js_1 = require("../commands/agent.js");
const token_js_1 = require("../commands/token.js");
const search_js_1 = require("../commands/search.js");
const watch_js_1 = require("../commands/watch.js");
const agentd_js_1 = require("../commands/agentd.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Set process.argv as if the user ran: inkd <args> */
function setArgv(...args) {
    process.argv = ["/usr/bin/node", "/usr/local/bin/inkd", ...args];
}
// ─── Setup/teardown ───────────────────────────────────────────────────────────
let consoleLog;
let consoleError;
let consoleWarn;
let processExit;
const originalArgv = process.argv.slice();
(0, vitest_1.beforeEach)(() => {
    consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
    consoleError = vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
    consoleWarn = vitest_1.vi.spyOn(console, "warn").mockImplementation(() => { });
    processExit = vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error(`process.exit(${_code})`);
    });
    vitest_1.vi.clearAllMocks();
    // Re-stub exit after clearAllMocks
    processExit = vitest_1.vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error(`process.exit(${_code})`);
    });
    consoleLog = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
    consoleError = vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
});
(0, vitest_1.afterEach)(() => {
    process.argv = originalArgv.slice();
    vitest_1.vi.restoreAllMocks();
});
// ─── Help / version flags ─────────────────────────────────────────────────────
(0, vitest_1.describe)("showHelp / help routing", () => {
    (0, vitest_1.it)("prints help when no command given", async () => {
        setArgv();
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(consoleLog).toHaveBeenCalled();
        const output = (consoleLog.mock.calls.flat().join("\n"));
        (0, vitest_1.expect)(output).toContain("inkd");
        (0, vitest_1.expect)(output).toContain("USAGE");
    });
    (0, vitest_1.it)("routes 'help' command to showHelp", async () => {
        setArgv("help");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(consoleLog).toHaveBeenCalled();
        const output = consoleLog.mock.calls.flat().join("\n");
        (0, vitest_1.expect)(output).toContain("COMMANDS");
    });
    (0, vitest_1.it)("routes '--help' flag to showHelp", async () => {
        setArgv("--help");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(consoleLog).toHaveBeenCalled();
    });
    (0, vitest_1.it)("routes '-h' flag to showHelp", async () => {
        setArgv("-h");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(consoleLog).toHaveBeenCalled();
    });
    (0, vitest_1.it)("prints version for --version flag", async () => {
        setArgv("--version");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(consoleLog).toHaveBeenCalledWith("0.1.0");
    });
    (0, vitest_1.it)("prints version for -v flag", async () => {
        setArgv("-v");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(consoleLog).toHaveBeenCalledWith("0.1.0");
    });
});
// ─── init ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("init routing", () => {
    (0, vitest_1.it)("calls cmdInit with no extra args", async () => {
        setArgv("init");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(init_js_1.cmdInit).toHaveBeenCalledWith([]);
    });
    (0, vitest_1.it)("calls cmdInit with extra flags forwarded", async () => {
        setArgv("init", "--mainnet");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(init_js_1.cmdInit).toHaveBeenCalledWith(["--mainnet"]);
    });
});
// ─── status ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("status routing", () => {
    (0, vitest_1.it)("calls cmdStatus", async () => {
        setArgv("status");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(status_js_1.cmdStatus).toHaveBeenCalled();
    });
});
// ─── project ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("project routing", () => {
    (0, vitest_1.it)("routes 'project create' to cmdProjectCreate", async () => {
        setArgv("project", "create", "--name", "my-agent");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(project_js_1.cmdProjectCreate).toHaveBeenCalledWith(["--name", "my-agent"]);
    });
    (0, vitest_1.it)("routes 'project get' to cmdProjectGet with args", async () => {
        setArgv("project", "get", "42");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(project_js_1.cmdProjectGet).toHaveBeenCalledWith(["42"]);
    });
    (0, vitest_1.it)("routes 'project list' to cmdProjectList", async () => {
        setArgv("project", "list", "0xDEAD");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(project_js_1.cmdProjectList).toHaveBeenCalledWith(["0xDEAD"]);
    });
    (0, vitest_1.it)("routes 'project transfer' to cmdProjectTransfer", async () => {
        setArgv("project", "transfer", "--id", "1", "--to", "0xABCD");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(project_js_1.cmdProjectTransfer).toHaveBeenCalledWith(["--id", "1", "--to", "0xABCD"]);
    });
    (0, vitest_1.it)("routes 'project collab' to cmdProjectCollab", async () => {
        setArgv("project", "collab", "add", "--id", "1", "--address", "0xF00D");
        await (0, index_js_1.main)();
        // rest = ["collab","add","--id","1","--address","0xF00D"]; rest.slice(1) drops "collab"
        (0, vitest_1.expect)(project_js_1.cmdProjectCollab).toHaveBeenCalledWith(["add", "--id", "1", "--address", "0xF00D"]);
    });
    (0, vitest_1.it)("exits(1) on unknown project sub-command", async () => {
        setArgv("project", "unknown-sub");
        await (0, vitest_1.expect)((0, index_js_1.main)()).rejects.toThrow("process.exit(1)");
        (0, vitest_1.expect)(consoleError).toHaveBeenCalled();
    });
});
// ─── version ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("version routing", () => {
    (0, vitest_1.it)("routes 'version push' to cmdVersionPush", async () => {
        setArgv("version", "push", "--id", "1", "--hash", "abc", "--tag", "v0.1.0");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(version_js_1.cmdVersionPush).toHaveBeenCalledWith(["--id", "1", "--hash", "abc", "--tag", "v0.1.0"]);
    });
    (0, vitest_1.it)("routes 'version list' to cmdVersionList", async () => {
        setArgv("version", "list", "1");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(version_js_1.cmdVersionList).toHaveBeenCalledWith(["1"]);
    });
    (0, vitest_1.it)("routes 'version show' to cmdVersionShow", async () => {
        setArgv("version", "show", "--id", "1", "--index", "0");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(version_js_1.cmdVersionShow).toHaveBeenCalledWith(["--id", "1", "--index", "0"]);
    });
    (0, vitest_1.it)("exits(1) on unknown version sub-command", async () => {
        setArgv("version", "bad-sub");
        await (0, vitest_1.expect)((0, index_js_1.main)()).rejects.toThrow("process.exit(1)");
        (0, vitest_1.expect)(consoleError).toHaveBeenCalled();
    });
});
// ─── agent ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("agent routing", () => {
    (0, vitest_1.it)("routes 'agent list' to cmdAgentList", async () => {
        setArgv("agent", "list", "--limit", "50");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(agent_js_1.cmdAgentList).toHaveBeenCalledWith(["--limit", "50"]);
    });
    (0, vitest_1.it)("routes 'agent lookup' to cmdAgentLookup", async () => {
        setArgv("agent", "lookup", "my-agent");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(agent_js_1.cmdAgentLookup).toHaveBeenCalledWith(["my-agent"]);
    });
    (0, vitest_1.it)("exits(1) on unknown agent sub-command", async () => {
        setArgv("agent", "delete");
        await (0, vitest_1.expect)((0, index_js_1.main)()).rejects.toThrow("process.exit(1)");
        (0, vitest_1.expect)(consoleError).toHaveBeenCalled();
    });
});
// ─── token ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("token routing", () => {
    (0, vitest_1.it)("routes 'token balance' to cmdToken", async () => {
        setArgv("token", "balance");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(token_js_1.cmdToken).toHaveBeenCalledWith(["balance"]);
    });
    (0, vitest_1.it)("routes 'token approve 5' to cmdToken with args", async () => {
        setArgv("token", "approve", "5");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(token_js_1.cmdToken).toHaveBeenCalledWith(["approve", "5"]);
    });
});
// ─── search ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("search routing", () => {
    (0, vitest_1.it)("routes 'search trading bot' to cmdSearch", async () => {
        setArgv("search", "trading bot", "--agents");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(search_js_1.cmdSearch).toHaveBeenCalledWith(["trading bot", "--agents"]);
    });
});
// ─── watch ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("watch routing", () => {
    (0, vitest_1.it)("routes 'watch versions' to cmdWatch", async () => {
        setArgv("watch", "versions", "--poll", "5000");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(watch_js_1.cmdWatch).toHaveBeenCalledWith(["versions", "--poll", "5000"]);
    });
});
// ─── agentd ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("agentd routing", () => {
    (0, vitest_1.it)("routes 'agentd start' to cmdAgentd", async () => {
        setArgv("agentd", "start", "--once");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(agentd_js_1.cmdAgentd).toHaveBeenCalledWith(["start", "--once"]);
    });
    (0, vitest_1.it)("routes 'agentd status' to cmdAgentd", async () => {
        setArgv("agentd", "status");
        await (0, index_js_1.main)();
        (0, vitest_1.expect)(agentd_js_1.cmdAgentd).toHaveBeenCalledWith(["status"]);
    });
});
// ─── Unknown command ──────────────────────────────────────────────────────────
(0, vitest_1.describe)("unknown command", () => {
    (0, vitest_1.it)("exits(1) and prints error for unrecognised top-level command", async () => {
        setArgv("foobar");
        await (0, vitest_1.expect)((0, index_js_1.main)()).rejects.toThrow("process.exit(1)");
        (0, vitest_1.expect)(consoleError).toHaveBeenCalled();
        const errorOutput = consoleError.mock.calls.flat().join(" ");
        (0, vitest_1.expect)(errorOutput).toContain("foobar");
    });
});
// ─── Async error propagation ─────────────────────────────────────────────────
(0, vitest_1.describe)("async error propagation", () => {
    (0, vitest_1.it)("re-throws when a command rejects", async () => {
        const boom = new Error("network failure");
        status_js_1.cmdStatus.mockRejectedValueOnce(boom);
        setArgv("status");
        await (0, vitest_1.expect)((0, index_js_1.main)()).rejects.toThrow("network failure");
    });
});
//# sourceMappingURL=index.test.js.map