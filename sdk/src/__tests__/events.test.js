"use strict";
/**
 * @file events.test.ts
 * @description Unit tests for the InkdRegistry event subscription wrappers
 *   (watchProjectCreated, watchVersionPushed, watchRegistryEvents).
 *
 * All tests are pure unit tests — no network, no RPC.
 * viem's watchContractEvent is mocked via vi.fn().
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const events_js_1 = require("../events.js");
// ─── Fixtures ─────────────────────────────────────────────────────────────────
const REGISTRY = "0xRegistryAddress000000000000000000000001";
const OWNER = "0xOwnerAddress0000000000000000000000000003";
const COLLAB = "0xCollabAddress000000000000000000000000004";
/** Factory: create a minimal mock PublicClient */
function makePublicClient() {
    const unwatch = vitest_1.vi.fn();
    const client = {
        watchContractEvent: vitest_1.vi.fn().mockReturnValue(unwatch),
    };
    return client;
}
/**
 * Simulate the watcher firing logs by extracting the onLogs callback
 * that was passed to watchContractEvent and calling it.
 */
function fireOnLogs(client, callIndex, logs) {
    const callArgs = client.watchContractEvent.mock.calls[callIndex][0];
    callArgs.onLogs(logs);
}
/** Build a synthetic ProjectCreated log */
function makeProjectCreatedLog(overrides = {}) {
    return {
        eventName: "ProjectCreated",
        args: {
            projectId: 1n,
            owner: OWNER,
            name: "test-project",
            license: "MIT",
            ...overrides,
        },
        blockNumber: 100n,
        transactionHash: "0xabc",
    };
}
/** Build a synthetic VersionPushed log */
function makeVersionPushedLog(overrides = {}) {
    return {
        eventName: "VersionPushed",
        args: {
            projectId: 1n,
            arweaveHash: "ar://abc123",
            versionTag: "v1.0.0",
            pushedBy: OWNER,
            ...overrides,
        },
        blockNumber: 101n,
        transactionHash: "0xdef",
    };
}
// ─── watchProjectCreated ──────────────────────────────────────────────────────
(0, vitest_1.describe)("watchProjectCreated", () => {
    let client;
    (0, vitest_1.beforeEach)(() => {
        client = makePublicClient();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("calls watchContractEvent with correct address and eventName", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        (0, vitest_1.expect)(client.watchContractEvent).toHaveBeenCalledOnce();
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.address).toBe(REGISTRY);
        (0, vitest_1.expect)(opts.eventName).toBe("ProjectCreated");
    });
    (0, vitest_1.it)("returns the unwatch function from watchContractEvent", () => {
        const cb = vitest_1.vi.fn();
        const unwatch = (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        (0, vitest_1.expect)(typeof unwatch).toBe("function");
        unwatch();
        // The mock's return value (inner unwatch) should have been called
        const innerUnwatch = client.watchContractEvent.mock.results[0].value;
        (0, vitest_1.expect)(innerUnwatch).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("invokes the callback with decoded ProjectCreatedEvent", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        fireOnLogs(client, 0, [makeProjectCreatedLog()]);
        (0, vitest_1.expect)(cb).toHaveBeenCalledOnce();
        const evt = cb.mock.calls[0][0];
        (0, vitest_1.expect)(evt.projectId).toBe(1n);
        (0, vitest_1.expect)(evt.owner).toBe(OWNER);
        (0, vitest_1.expect)(evt.name).toBe("test-project");
        (0, vitest_1.expect)(evt.license).toBe("MIT");
        (0, vitest_1.expect)(evt._log).toBeDefined();
    });
    (0, vitest_1.it)("fires the callback once per log entry in a batch", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        fireOnLogs(client, 0, [
            makeProjectCreatedLog({ projectId: 1n, name: "proj-1" }),
            makeProjectCreatedLog({ projectId: 2n, name: "proj-2" }),
            makeProjectCreatedLog({ projectId: 3n, name: "proj-3" }),
        ]);
        (0, vitest_1.expect)(cb).toHaveBeenCalledTimes(3);
        (0, vitest_1.expect)(cb.mock.calls[0][0].projectId).toBe(1n);
        (0, vitest_1.expect)(cb.mock.calls[1][0].projectId).toBe(2n);
        (0, vitest_1.expect)(cb.mock.calls[2][0].projectId).toBe(3n);
    });
    (0, vitest_1.it)("handles empty log batches without calling the callback", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        fireOnLogs(client, 0, []);
        (0, vitest_1.expect)(cb).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("passes owner filter as args to watchContractEvent", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb, { owner: OWNER });
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.args).toEqual({ owner: OWNER });
    });
    (0, vitest_1.it)("passes no args when owner filter is omitted", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.args).toBeUndefined();
    });
    (0, vitest_1.it)("handles logs with missing args gracefully (fallback to defaults)", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        // Log with no args field
        fireOnLogs(client, 0, [{ eventName: "ProjectCreated" }]);
        (0, vitest_1.expect)(cb).toHaveBeenCalledOnce();
        const evt = cb.mock.calls[0][0];
        (0, vitest_1.expect)(evt.projectId).toBe(0n);
        (0, vitest_1.expect)(evt.owner).toBe("0x");
        (0, vitest_1.expect)(evt.name).toBe("");
        (0, vitest_1.expect)(evt.license).toBe("");
    });
    (0, vitest_1.it)("passes the raw log as _log", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        const rawLog = makeProjectCreatedLog();
        fireOnLogs(client, 0, [rawLog]);
        (0, vitest_1.expect)(cb.mock.calls[0][0]._log).toBe(rawLog);
    });
    (0, vitest_1.it)("handles different projectId values", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb);
        fireOnLogs(client, 0, [makeProjectCreatedLog({ projectId: 999n })]);
        (0, vitest_1.expect)(cb.mock.calls[0][0].projectId).toBe(999n);
    });
    (0, vitest_1.it)("handles multiple calls with different owners in filter", () => {
        const cb1 = vitest_1.vi.fn();
        const cb2 = vitest_1.vi.fn();
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb1, { owner: OWNER });
        (0, events_js_1.watchProjectCreated)(client, REGISTRY, cb2, { owner: COLLAB });
        (0, vitest_1.expect)(client.watchContractEvent).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(client.watchContractEvent.mock.calls[0][0].args).toEqual({ owner: OWNER });
        (0, vitest_1.expect)(client.watchContractEvent.mock.calls[1][0].args).toEqual({ owner: COLLAB });
    });
});
// ─── watchVersionPushed ───────────────────────────────────────────────────────
(0, vitest_1.describe)("watchVersionPushed", () => {
    let client;
    (0, vitest_1.beforeEach)(() => {
        client = makePublicClient();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("calls watchContractEvent with correct address and eventName", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        (0, vitest_1.expect)(client.watchContractEvent).toHaveBeenCalledOnce();
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.address).toBe(REGISTRY);
        (0, vitest_1.expect)(opts.eventName).toBe("VersionPushed");
    });
    (0, vitest_1.it)("returns the unwatch function", () => {
        const cb = vitest_1.vi.fn();
        const unwatch = (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        (0, vitest_1.expect)(typeof unwatch).toBe("function");
        unwatch();
        const innerUnwatch = client.watchContractEvent.mock.results[0].value;
        (0, vitest_1.expect)(innerUnwatch).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("invokes the callback with decoded VersionPushedEvent", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        fireOnLogs(client, 0, [makeVersionPushedLog()]);
        (0, vitest_1.expect)(cb).toHaveBeenCalledOnce();
        const evt = cb.mock.calls[0][0];
        (0, vitest_1.expect)(evt.projectId).toBe(1n);
        (0, vitest_1.expect)(evt.arweaveHash).toBe("ar://abc123");
        (0, vitest_1.expect)(evt.versionTag).toBe("v1.0.0");
        (0, vitest_1.expect)(evt.pushedBy).toBe(OWNER);
        (0, vitest_1.expect)(evt._log).toBeDefined();
    });
    (0, vitest_1.it)("fires once per log in a batch", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        fireOnLogs(client, 0, [
            makeVersionPushedLog({ versionTag: "v0.1.0" }),
            makeVersionPushedLog({ versionTag: "v0.2.0" }),
        ]);
        (0, vitest_1.expect)(cb).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(cb.mock.calls[0][0].versionTag).toBe("v0.1.0");
        (0, vitest_1.expect)(cb.mock.calls[1][0].versionTag).toBe("v0.2.0");
    });
    (0, vitest_1.it)("handles empty batches silently", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        fireOnLogs(client, 0, []);
        (0, vitest_1.expect)(cb).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("passes projectId filter as args", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb, { projectId: 42n });
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.args).toEqual({ projectId: 42n });
    });
    (0, vitest_1.it)("passes no args when filter is omitted", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.args).toBeUndefined();
    });
    (0, vitest_1.it)("passes no args when filter is empty object", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb, {});
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.args).toBeUndefined();
    });
    (0, vitest_1.it)("handles logs with missing args gracefully", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        fireOnLogs(client, 0, [{ eventName: "VersionPushed" }]);
        (0, vitest_1.expect)(cb).toHaveBeenCalledOnce();
        const evt = cb.mock.calls[0][0];
        (0, vitest_1.expect)(evt.projectId).toBe(0n);
        (0, vitest_1.expect)(evt.arweaveHash).toBe("");
        (0, vitest_1.expect)(evt.versionTag).toBe("");
        (0, vitest_1.expect)(evt.pushedBy).toBe("0x");
    });
    (0, vitest_1.it)("passes the raw log as _log", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb);
        const rawLog = makeVersionPushedLog();
        fireOnLogs(client, 0, [rawLog]);
        (0, vitest_1.expect)(cb.mock.calls[0][0]._log).toBe(rawLog);
    });
    (0, vitest_1.it)("handles projectId=0n in filter correctly", () => {
        const cb = vitest_1.vi.fn();
        (0, events_js_1.watchVersionPushed)(client, REGISTRY, cb, { projectId: 0n });
        const opts = client.watchContractEvent.mock.calls[0][0];
        // 0n is a valid filter value — should not be treated as falsy/omitted
        (0, vitest_1.expect)(opts.args).toEqual({ projectId: 0n });
    });
});
// ─── watchRegistryEvents (batch helper) ───────────────────────────────────────
(0, vitest_1.describe)("watchRegistryEvents", () => {
    let client;
    (0, vitest_1.beforeEach)(() => {
        client = makePublicClient();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("subscribes to both events when both handlers are provided", () => {
        const onCreated = vitest_1.vi.fn();
        const onPushed = vitest_1.vi.fn();
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onProjectCreated: onCreated,
            onVersionPushed: onPushed,
        });
        (0, vitest_1.expect)(client.watchContractEvent).toHaveBeenCalledTimes(2);
        const calls = client.watchContractEvent.mock.calls.map((c) => c[0].eventName);
        (0, vitest_1.expect)(calls).toContain("ProjectCreated");
        (0, vitest_1.expect)(calls).toContain("VersionPushed");
    });
    (0, vitest_1.it)("subscribes to only ProjectCreated when only that handler is given", () => {
        const onCreated = vitest_1.vi.fn();
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onProjectCreated: onCreated,
        });
        (0, vitest_1.expect)(client.watchContractEvent).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(client.watchContractEvent.mock.calls[0][0].eventName).toBe("ProjectCreated");
    });
    (0, vitest_1.it)("subscribes to only VersionPushed when only that handler is given", () => {
        const onPushed = vitest_1.vi.fn();
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onVersionPushed: onPushed,
        });
        (0, vitest_1.expect)(client.watchContractEvent).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(client.watchContractEvent.mock.calls[0][0].eventName).toBe("VersionPushed");
    });
    (0, vitest_1.it)("subscribes to neither when no handlers are given", () => {
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {});
        (0, vitest_1.expect)(client.watchContractEvent).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("unwatchAll calls both inner unwatch functions", () => {
        const unwatch1 = vitest_1.vi.fn();
        const unwatch2 = vitest_1.vi.fn();
        client.watchContractEvent
            .mockReturnValueOnce(unwatch1)
            .mockReturnValueOnce(unwatch2);
        const { unwatchAll } = (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onProjectCreated: vitest_1.vi.fn(),
            onVersionPushed: vitest_1.vi.fn(),
        });
        unwatchAll();
        (0, vitest_1.expect)(unwatch1).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(unwatch2).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("unwatchAll is idempotent — can be called multiple times", () => {
        const { unwatchAll } = (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onProjectCreated: vitest_1.vi.fn(),
        });
        // Should not throw on repeated calls
        (0, vitest_1.expect)(() => {
            unwatchAll();
            unwatchAll();
        }).not.toThrow();
    });
    (0, vitest_1.it)("forwards projectCreatedFilter to watchProjectCreated", () => {
        const onCreated = vitest_1.vi.fn();
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onProjectCreated: onCreated,
            projectCreatedFilter: { owner: OWNER },
        });
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.args).toEqual({ owner: OWNER });
    });
    (0, vitest_1.it)("forwards versionPushedFilter to watchVersionPushed", () => {
        const onPushed = vitest_1.vi.fn();
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onVersionPushed: onPushed,
            versionPushedFilter: { projectId: 7n },
        });
        const opts = client.watchContractEvent.mock.calls[0][0];
        (0, vitest_1.expect)(opts.args).toEqual({ projectId: 7n });
    });
    (0, vitest_1.it)("delivers ProjectCreated events to the correct handler", () => {
        const onCreated = vitest_1.vi.fn();
        const onPushed = vitest_1.vi.fn();
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onProjectCreated: onCreated,
            onVersionPushed: onPushed,
        });
        // Find the call index for ProjectCreated
        const createdIdx = client.watchContractEvent.mock.calls.findIndex((c) => c[0].eventName === "ProjectCreated");
        fireOnLogs(client, createdIdx, [makeProjectCreatedLog()]);
        (0, vitest_1.expect)(onCreated).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(onPushed).not.toHaveBeenCalled();
        (0, vitest_1.expect)(onCreated.mock.calls[0][0].name).toBe("test-project");
    });
    (0, vitest_1.it)("delivers VersionPushed events to the correct handler", () => {
        const onCreated = vitest_1.vi.fn();
        const onPushed = vitest_1.vi.fn();
        (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {
            onProjectCreated: onCreated,
            onVersionPushed: onPushed,
        });
        const pushedIdx = client.watchContractEvent.mock.calls.findIndex((c) => c[0].eventName === "VersionPushed");
        fireOnLogs(client, pushedIdx, [makeVersionPushedLog()]);
        (0, vitest_1.expect)(onPushed).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(onCreated).not.toHaveBeenCalled();
        (0, vitest_1.expect)(onPushed.mock.calls[0][0].versionTag).toBe("v1.0.0");
    });
    (0, vitest_1.it)("returns unwatchAll as a function", () => {
        const { unwatchAll } = (0, events_js_1.watchRegistryEvents)(client, REGISTRY, {});
        (0, vitest_1.expect)(typeof unwatchAll).toBe("function");
    });
});
//# sourceMappingURL=events.test.js.map