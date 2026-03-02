/**
 * @file events.test.ts
 * @description Unit tests for the InkdRegistry event subscription wrappers
 *   (watchProjectCreated, watchVersionPushed, watchRegistryEvents).
 *
 * All tests are pure unit tests — no network, no RPC.
 * viem's watchContractEvent is mocked via vi.fn().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  watchProjectCreated,
  watchVersionPushed,
  watchRegistryEvents,
  type ProjectCreatedEvent,
  type VersionPushedEvent,
} from "../events.js";
import type { PublicClient } from "viem";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REGISTRY = "0xRegistryAddress000000000000000000000001" as const;
const OWNER    = "0xOwnerAddress0000000000000000000000000003" as const;
const COLLAB   = "0xCollabAddress000000000000000000000000004" as const;

/** Factory: create a minimal mock PublicClient */
function makePublicClient(): PublicClient & {
  watchContractEvent: ReturnType<typeof vi.fn>;
} {
  const unwatch = vi.fn();
  const client = {
    watchContractEvent: vi.fn().mockReturnValue(unwatch),
  } as unknown as PublicClient & { watchContractEvent: ReturnType<typeof vi.fn> };
  return client;
}

/**
 * Simulate the watcher firing logs by extracting the onLogs callback
 * that was passed to watchContractEvent and calling it.
 */
function fireOnLogs(
  client: { watchContractEvent: ReturnType<typeof vi.fn> },
  callIndex: number,
  logs: unknown[]
) {
  const callArgs = client.watchContractEvent.mock.calls[callIndex][0];
  callArgs.onLogs(logs);
}

/** Build a synthetic ProjectCreated log */
function makeProjectCreatedLog(overrides: Partial<Record<string, unknown>> = {}) {
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
function makeVersionPushedLog(overrides: Partial<Record<string, unknown>> = {}) {
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

describe("watchProjectCreated", () => {
  let client: ReturnType<typeof makePublicClient>;

  beforeEach(() => {
    client = makePublicClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls watchContractEvent with correct address and eventName", () => {
    const cb = vi.fn();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    expect(client.watchContractEvent).toHaveBeenCalledOnce();
    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.address).toBe(REGISTRY);
    expect(opts.eventName).toBe("ProjectCreated");
  });

  it("returns the unwatch function from watchContractEvent", () => {
    const cb = vi.fn();
    const unwatch = watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);
    expect(typeof unwatch).toBe("function");
    unwatch();
    // The mock's return value (inner unwatch) should have been called
    const innerUnwatch = client.watchContractEvent.mock.results[0].value;
    expect(innerUnwatch).toHaveBeenCalledOnce();
  });

  it("invokes the callback with decoded ProjectCreatedEvent", () => {
    const cb = vi.fn<[ProjectCreatedEvent], void>();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    fireOnLogs(client, 0, [makeProjectCreatedLog()]);

    expect(cb).toHaveBeenCalledOnce();
    const evt = cb.mock.calls[0][0];
    expect(evt.projectId).toBe(1n);
    expect(evt.owner).toBe(OWNER);
    expect(evt.name).toBe("test-project");
    expect(evt.license).toBe("MIT");
    expect(evt._log).toBeDefined();
  });

  it("fires the callback once per log entry in a batch", () => {
    const cb = vi.fn();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    fireOnLogs(client, 0, [
      makeProjectCreatedLog({ projectId: 1n, name: "proj-1" }),
      makeProjectCreatedLog({ projectId: 2n, name: "proj-2" }),
      makeProjectCreatedLog({ projectId: 3n, name: "proj-3" }),
    ]);

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls[0][0].projectId).toBe(1n);
    expect(cb.mock.calls[1][0].projectId).toBe(2n);
    expect(cb.mock.calls[2][0].projectId).toBe(3n);
  });

  it("handles empty log batches without calling the callback", () => {
    const cb = vi.fn();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    fireOnLogs(client, 0, []);

    expect(cb).not.toHaveBeenCalled();
  });

  it("passes owner filter as args to watchContractEvent", () => {
    const cb = vi.fn();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb, { owner: OWNER });

    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.args).toEqual({ owner: OWNER });
  });

  it("passes no args when owner filter is omitted", () => {
    const cb = vi.fn();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.args).toBeUndefined();
  });

  it("handles logs with missing args gracefully (fallback to defaults)", () => {
    const cb = vi.fn<[ProjectCreatedEvent], void>();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    // Log with no args field
    fireOnLogs(client, 0, [{ eventName: "ProjectCreated" }]);

    expect(cb).toHaveBeenCalledOnce();
    const evt = cb.mock.calls[0][0];
    expect(evt.projectId).toBe(0n);
    expect(evt.owner).toBe("0x");
    expect(evt.name).toBe("");
    expect(evt.license).toBe("");
  });

  it("passes the raw log as _log", () => {
    const cb = vi.fn<[ProjectCreatedEvent], void>();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    const rawLog = makeProjectCreatedLog();
    fireOnLogs(client, 0, [rawLog]);

    expect(cb.mock.calls[0][0]._log).toBe(rawLog);
  });

  it("handles different projectId values", () => {
    const cb = vi.fn<[ProjectCreatedEvent], void>();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb);

    fireOnLogs(client, 0, [makeProjectCreatedLog({ projectId: 999n })]);

    expect(cb.mock.calls[0][0].projectId).toBe(999n);
  });

  it("handles multiple calls with different owners in filter", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb1, { owner: OWNER });
    watchProjectCreated(client as unknown as PublicClient, REGISTRY, cb2, { owner: COLLAB });

    expect(client.watchContractEvent).toHaveBeenCalledTimes(2);
    expect(client.watchContractEvent.mock.calls[0][0].args).toEqual({ owner: OWNER });
    expect(client.watchContractEvent.mock.calls[1][0].args).toEqual({ owner: COLLAB });
  });
});

// ─── watchVersionPushed ───────────────────────────────────────────────────────

describe("watchVersionPushed", () => {
  let client: ReturnType<typeof makePublicClient>;

  beforeEach(() => {
    client = makePublicClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls watchContractEvent with correct address and eventName", () => {
    const cb = vi.fn();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);

    expect(client.watchContractEvent).toHaveBeenCalledOnce();
    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.address).toBe(REGISTRY);
    expect(opts.eventName).toBe("VersionPushed");
  });

  it("returns the unwatch function", () => {
    const cb = vi.fn();
    const unwatch = watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);
    expect(typeof unwatch).toBe("function");
    unwatch();
    const innerUnwatch = client.watchContractEvent.mock.results[0].value;
    expect(innerUnwatch).toHaveBeenCalledOnce();
  });

  it("invokes the callback with decoded VersionPushedEvent", () => {
    const cb = vi.fn<[VersionPushedEvent], void>();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);

    fireOnLogs(client, 0, [makeVersionPushedLog()]);

    expect(cb).toHaveBeenCalledOnce();
    const evt = cb.mock.calls[0][0];
    expect(evt.projectId).toBe(1n);
    expect(evt.arweaveHash).toBe("ar://abc123");
    expect(evt.versionTag).toBe("v1.0.0");
    expect(evt.pushedBy).toBe(OWNER);
    expect(evt._log).toBeDefined();
  });

  it("fires once per log in a batch", () => {
    const cb = vi.fn();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);

    fireOnLogs(client, 0, [
      makeVersionPushedLog({ versionTag: "v0.1.0" }),
      makeVersionPushedLog({ versionTag: "v0.2.0" }),
    ]);

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[0][0].versionTag).toBe("v0.1.0");
    expect(cb.mock.calls[1][0].versionTag).toBe("v0.2.0");
  });

  it("handles empty batches silently", () => {
    const cb = vi.fn();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);
    fireOnLogs(client, 0, []);
    expect(cb).not.toHaveBeenCalled();
  });

  it("passes projectId filter as args", () => {
    const cb = vi.fn();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb, { projectId: 42n });

    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.args).toEqual({ projectId: 42n });
  });

  it("passes no args when filter is omitted", () => {
    const cb = vi.fn();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);

    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.args).toBeUndefined();
  });

  it("passes no args when filter is empty object", () => {
    const cb = vi.fn();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb, {});

    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.args).toBeUndefined();
  });

  it("handles logs with missing args gracefully", () => {
    const cb = vi.fn<[VersionPushedEvent], void>();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);

    fireOnLogs(client, 0, [{ eventName: "VersionPushed" }]);

    expect(cb).toHaveBeenCalledOnce();
    const evt = cb.mock.calls[0][0];
    expect(evt.projectId).toBe(0n);
    expect(evt.arweaveHash).toBe("");
    expect(evt.versionTag).toBe("");
    expect(evt.pushedBy).toBe("0x");
  });

  it("passes the raw log as _log", () => {
    const cb = vi.fn<[VersionPushedEvent], void>();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb);

    const rawLog = makeVersionPushedLog();
    fireOnLogs(client, 0, [rawLog]);

    expect(cb.mock.calls[0][0]._log).toBe(rawLog);
  });

  it("handles projectId=0n in filter correctly", () => {
    const cb = vi.fn();
    watchVersionPushed(client as unknown as PublicClient, REGISTRY, cb, { projectId: 0n });

    const opts = client.watchContractEvent.mock.calls[0][0];
    // 0n is a valid filter value — should not be treated as falsy/omitted
    expect(opts.args).toEqual({ projectId: 0n });
  });
});

// ─── watchRegistryEvents (batch helper) ───────────────────────────────────────

describe("watchRegistryEvents", () => {
  let client: ReturnType<typeof makePublicClient>;

  beforeEach(() => {
    client = makePublicClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to both events when both handlers are provided", () => {
    const onCreated = vi.fn();
    const onPushed = vi.fn();

    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onProjectCreated: onCreated,
      onVersionPushed: onPushed,
    });

    expect(client.watchContractEvent).toHaveBeenCalledTimes(2);

    const calls = client.watchContractEvent.mock.calls.map((c) => c[0].eventName);
    expect(calls).toContain("ProjectCreated");
    expect(calls).toContain("VersionPushed");
  });

  it("subscribes to only ProjectCreated when only that handler is given", () => {
    const onCreated = vi.fn();

    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onProjectCreated: onCreated,
    });

    expect(client.watchContractEvent).toHaveBeenCalledTimes(1);
    expect(client.watchContractEvent.mock.calls[0][0].eventName).toBe("ProjectCreated");
  });

  it("subscribes to only VersionPushed when only that handler is given", () => {
    const onPushed = vi.fn();

    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onVersionPushed: onPushed,
    });

    expect(client.watchContractEvent).toHaveBeenCalledTimes(1);
    expect(client.watchContractEvent.mock.calls[0][0].eventName).toBe("VersionPushed");
  });

  it("subscribes to neither when no handlers are given", () => {
    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {});
    expect(client.watchContractEvent).not.toHaveBeenCalled();
  });

  it("unwatchAll calls both inner unwatch functions", () => {
    const unwatch1 = vi.fn();
    const unwatch2 = vi.fn();
    client.watchContractEvent
      .mockReturnValueOnce(unwatch1)
      .mockReturnValueOnce(unwatch2);

    const { unwatchAll } = watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onProjectCreated: vi.fn(),
      onVersionPushed: vi.fn(),
    });

    unwatchAll();

    expect(unwatch1).toHaveBeenCalledOnce();
    expect(unwatch2).toHaveBeenCalledOnce();
  });

  it("unwatchAll is idempotent — can be called multiple times", () => {
    const { unwatchAll } = watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onProjectCreated: vi.fn(),
    });

    // Should not throw on repeated calls
    expect(() => {
      unwatchAll();
      unwatchAll();
    }).not.toThrow();
  });

  it("forwards projectCreatedFilter to watchProjectCreated", () => {
    const onCreated = vi.fn();

    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onProjectCreated: onCreated,
      projectCreatedFilter: { owner: OWNER },
    });

    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.args).toEqual({ owner: OWNER });
  });

  it("forwards versionPushedFilter to watchVersionPushed", () => {
    const onPushed = vi.fn();

    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onVersionPushed: onPushed,
      versionPushedFilter: { projectId: 7n },
    });

    const opts = client.watchContractEvent.mock.calls[0][0];
    expect(opts.args).toEqual({ projectId: 7n });
  });

  it("delivers ProjectCreated events to the correct handler", () => {
    const onCreated = vi.fn<[ProjectCreatedEvent], void>();
    const onPushed  = vi.fn();

    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onProjectCreated: onCreated,
      onVersionPushed: onPushed,
    });

    // Find the call index for ProjectCreated
    const createdIdx = client.watchContractEvent.mock.calls.findIndex(
      (c) => c[0].eventName === "ProjectCreated"
    );
    fireOnLogs(client, createdIdx, [makeProjectCreatedLog()]);

    expect(onCreated).toHaveBeenCalledOnce();
    expect(onPushed).not.toHaveBeenCalled();
    expect(onCreated.mock.calls[0][0].name).toBe("test-project");
  });

  it("delivers VersionPushed events to the correct handler", () => {
    const onCreated = vi.fn();
    const onPushed  = vi.fn<[VersionPushedEvent], void>();

    watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {
      onProjectCreated: onCreated,
      onVersionPushed: onPushed,
    });

    const pushedIdx = client.watchContractEvent.mock.calls.findIndex(
      (c) => c[0].eventName === "VersionPushed"
    );
    fireOnLogs(client, pushedIdx, [makeVersionPushedLog()]);

    expect(onPushed).toHaveBeenCalledOnce();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onPushed.mock.calls[0][0].versionTag).toBe("v1.0.0");
  });

  it("returns unwatchAll as a function", () => {
    const { unwatchAll } = watchRegistryEvents(client as unknown as PublicClient, REGISTRY, {});
    expect(typeof unwatchAll).toBe("function");
  });
});
