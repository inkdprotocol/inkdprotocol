/**
 * @file multicall.test.ts
 * @description Unit tests for multicall.ts — Multicall3 batch read helpers.
 *
 * All tests are pure unit tests — no network, no RPC.
 * viem's publicClient.multicall is mocked via vi.fn().
 */

import { describe, it, expect, vi } from "vitest";
import {
  batchGetProjects,
  batchGetVersions,
  batchGetFees,
  batchGetProjectsWithVersions,
  type ProjectData,
  type VersionData,
  type RegistryFees,
  type BatchResult,
} from "../multicall.js";
import type { PublicClient } from "viem";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REGISTRY = "0xRegistryAddress000000000000000000000001" as const;
const OWNER    = "0xOwnerAddress0000000000000000000000000003" as const;

function makeProjectData(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: 1n,
    name: "test-project",
    description: "A test project",
    license: "MIT",
    readmeHash: "ar://readme",
    owner: OWNER,
    isPublic: true,
    isAgent: false,
    agentEndpoint: "",
    createdAt: 1000n,
    versionCount: 2n,
    exists: true,
    ...overrides,
  };
}

function makeVersionData(overrides: Partial<VersionData> = {}): VersionData {
  return {
    projectId: 1n,
    arweaveHash: "ar://abc123",
    versionTag: "v1.0.0",
    changelog: "Initial release",
    pushedBy: OWNER,
    pushedAt: 2000n,
    ...overrides,
  };
}

/** Factory: create a mock PublicClient with a controllable multicall */
function makePublicClient(
  multicallImpl: (..._args: unknown[]) => Promise<unknown[]>
): PublicClient {
  return {
    multicall: vi.fn().mockImplementation(multicallImpl),
  } as unknown as PublicClient;
}

/** Build a viem multicall success result */
function successResult(result: unknown) {
  return { result, status: "success" as const };
}

/** Build a viem multicall failure result */
function failureResult(error: string) {
  return { result: undefined, status: "failure" as const, error: new Error(error) };
}

// ─── batchGetProjects ─────────────────────────────────────────────────────────

describe("batchGetProjects", () => {
  it("returns empty array when given no project IDs", async () => {
    const client = makePublicClient(async () => []);
    const result = await batchGetProjects(client, REGISTRY, []);
    expect(result).toEqual([]);
    expect((client.multicall as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("calls multicall with one entry per project ID", async () => {
    const p1 = makeProjectData({ id: 1n });
    const p2 = makeProjectData({ id: 2n, name: "project-two" });
    const client = makePublicClient(async () => [successResult(p1), successResult(p2)]);

    await batchGetProjects(client, REGISTRY, [1n, 2n]);

    const calls = (client.multicall as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    const contracts = calls[0][0].contracts as { args: bigint[] }[];
    expect(contracts).toHaveLength(2);
    expect(contracts[0].args[0]).toBe(1n);
    expect(contracts[1].args[0]).toBe(2n);
  });

  it("passes allowFailure: true", async () => {
    const client = makePublicClient(async () => [successResult(makeProjectData())]);
    await batchGetProjects(client, REGISTRY, [1n]);
    const callArg = (client.multicall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.allowFailure).toBe(true);
  });

  it("returns success results with correct data", async () => {
    const p1 = makeProjectData({ id: 1n, name: "alpha" });
    const p2 = makeProjectData({ id: 2n, name: "beta" });
    const client = makePublicClient(async () => [successResult(p1), successResult(p2)]);

    const results = await batchGetProjects(client, REGISTRY, [1n, 2n]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].data?.name).toBe("alpha");
    expect(results[1].success).toBe(true);
    expect(results[1].data?.name).toBe("beta");
  });

  it("returns failure result for reverted calls", async () => {
    const client = makePublicClient(async () => [
      successResult(makeProjectData({ id: 1n })),
      failureResult("Project does not exist"),
    ]);

    const results = await batchGetProjects(client, REGISTRY, [1n, 999n]);

    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].data).toBeNull();
    expect(results[1].error).toContain("Project does not exist");
  });

  it("handles all-failure responses gracefully", async () => {
    const client = makePublicClient(async () => [
      failureResult("revert 1"),
      failureResult("revert 2"),
    ]);

    const results = await batchGetProjects(client, REGISTRY, [1n, 2n]);
    expect(results.every((r) => !r.success)).toBe(true);
    expect(results.every((r) => r.data === null)).toBe(true);
  });

  it("preserves order of results matching input IDs", async () => {
    const projects = [3n, 1n, 2n].map((id) => makeProjectData({ id, name: `project-${id}` }));
    const client = makePublicClient(async () => projects.map(successResult));

    const results = await batchGetProjects(client, REGISTRY, [3n, 1n, 2n]);
    expect(results[0].data?.id).toBe(3n);
    expect(results[1].data?.id).toBe(1n);
    expect(results[2].data?.id).toBe(2n);
  });

  it("passes the registry address to every multicall contract entry", async () => {
    const client = makePublicClient(async () => [successResult(makeProjectData())]);
    await batchGetProjects(client, REGISTRY, [1n]);

    const contracts = (client.multicall as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .contracts as { address: string }[];
    expect(contracts[0].address).toBe(REGISTRY);
  });

  it("handles a single project ID", async () => {
    const p = makeProjectData({ id: 42n });
    const client = makePublicClient(async () => [successResult(p)]);
    const results = await batchGetProjects(client, REGISTRY, [42n]);
    expect(results).toHaveLength(1);
    expect(results[0].data?.id).toBe(42n);
  });

  it("handles large batches (100 IDs)", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => BigInt(i + 1));
    const mockResults = ids.map((id) => successResult(makeProjectData({ id })));
    const client = makePublicClient(async () => mockResults);

    const results = await batchGetProjects(client, REGISTRY, ids);
    expect(results).toHaveLength(100);
    expect(results.every((r) => r.success)).toBe(true);
  });
});

// ─── batchGetVersions ─────────────────────────────────────────────────────────

describe("batchGetVersions", () => {
  it("returns empty array when given no project IDs", async () => {
    const client = makePublicClient(async () => []);
    const result = await batchGetVersions(client, REGISTRY, []);
    expect(result).toEqual([]);
  });

  it("calls multicall with getVersions for each project ID", async () => {
    const v1 = [makeVersionData({ projectId: 1n })];
    const v2 = [makeVersionData({ projectId: 2n }), makeVersionData({ projectId: 2n, versionTag: "v1.1.0" })];
    const client = makePublicClient(async () => [successResult(v1), successResult(v2)]);

    await batchGetVersions(client, REGISTRY, [1n, 2n]);

    const contracts = (client.multicall as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .contracts as { functionName: string; args: bigint[] }[];
    expect(contracts[0].functionName).toBe("getVersions");
    expect(contracts[0].args[0]).toBe(1n);
    expect(contracts[1].args[0]).toBe(2n);
  });

  it("returns arrays of versions per project", async () => {
    const v1 = [makeVersionData({ projectId: 1n })];
    const v2 = [makeVersionData({ projectId: 2n }), makeVersionData({ projectId: 2n, versionTag: "v2.0.0" })];
    const client = makePublicClient(async () => [successResult(v1), successResult(v2)]);

    const results = await batchGetVersions(client, REGISTRY, [1n, 2n]);

    expect(results[0].success).toBe(true);
    expect(results[0].data).toHaveLength(1);
    expect(results[1].success).toBe(true);
    expect(results[1].data).toHaveLength(2);
    expect(results[1].data![1].versionTag).toBe("v2.0.0");
  });

  it("handles failure for a project ID that doesn't exist", async () => {
    const client = makePublicClient(async () => [
      successResult([makeVersionData()]),
      failureResult("invalid project"),
    ]);

    const results = await batchGetVersions(client, REGISTRY, [1n, 999n]);
    expect(results[1].success).toBe(false);
    expect(results[1].data).toBeNull();
  });

  it("returns empty version arrays for projects with no versions", async () => {
    const client = makePublicClient(async () => [successResult([])]);
    const results = await batchGetVersions(client, REGISTRY, [1n]);
    expect(results[0].success).toBe(true);
    expect(results[0].data).toEqual([]);
  });
});

// ─── batchGetFees ─────────────────────────────────────────────────────────────

describe("batchGetFees", () => {
  it("fetches versionFee, transferFee, and tokenLockAmount in one call", async () => {
    const client = makePublicClient(async () => [
      successResult(100n),
      successResult(200n),
      successResult(1000n),
    ]);

    const fees: RegistryFees = await batchGetFees(client, REGISTRY);

    expect(fees.versionFee).toBe(100n);
    expect(fees.transferFee).toBe(200n);
    expect(fees.tokenLockAmount).toBe(1000n);
  });

  it("calls multicall with allowFailure: false", async () => {
    const client = makePublicClient(async () => [
      successResult(1n),
      successResult(2n),
      successResult(3n),
    ]);

    await batchGetFees(client, REGISTRY);

    const callArg = (client.multicall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.allowFailure).toBe(false);
  });

  it("makes exactly one multicall with 3 contract entries", async () => {
    const client = makePublicClient(async () => [
      successResult(1n),
      successResult(2n),
      successResult(3n),
    ]);

    await batchGetFees(client, REGISTRY);

    const calls = (client.multicall as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].contracts).toHaveLength(3);
  });

  it("all three contracts use the registry address", async () => {
    const client = makePublicClient(async () => [
      successResult(1n),
      successResult(2n),
      successResult(3n),
    ]);

    await batchGetFees(client, REGISTRY);

    const contracts = (client.multicall as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .contracts as { address: string }[];
    expect(contracts.every((c) => c.address === REGISTRY)).toBe(true);
  });

  it("returns zero bigints as defaults on missing results", async () => {
    // Simulate multicall returning undefined result fields
    const client = makePublicClient(async () => [
      { result: undefined, status: "success" },
      { result: undefined, status: "success" },
      { result: undefined, status: "success" },
    ]);

    const fees = await batchGetFees(client, REGISTRY);
    expect(fees.versionFee).toBe(0n);
    expect(fees.transferFee).toBe(0n);
    expect(fees.tokenLockAmount).toBe(0n);
  });

  it("includes correct functionNames: versionFee, transferFee, TOKEN_LOCK_AMOUNT", async () => {
    const client = makePublicClient(async () => [
      successResult(1n),
      successResult(2n),
      successResult(3n),
    ]);

    await batchGetFees(client, REGISTRY);

    const contracts = (client.multicall as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .contracts as { functionName: string }[];
    expect(contracts[0].functionName).toBe("versionFee");
    expect(contracts[1].functionName).toBe("transferFee");
    expect(contracts[2].functionName).toBe("TOKEN_LOCK_AMOUNT");
  });
});

// ─── batchGetProjectsWithVersions ─────────────────────────────────────────────

describe("batchGetProjectsWithVersions", () => {
  it("returns empty array when given no project IDs", async () => {
    const client = makePublicClient(async () => []);
    const results = await batchGetProjectsWithVersions(client, REGISTRY, []);
    expect(results).toEqual([]);
  });

  it("returns combined project + versions for each ID", async () => {
    const p1 = makeProjectData({ id: 1n, name: "alpha" });
    const v1 = [makeVersionData({ projectId: 1n })];
    const p2 = makeProjectData({ id: 2n, name: "beta" });
    const v2 = [makeVersionData({ projectId: 2n }), makeVersionData({ projectId: 2n, versionTag: "v2.0.0" })];

    // batchGetProjectsWithVersions calls batchGetProjects + batchGetVersions via Promise.all
    // Both use publicClient.multicall — mock returns in call order.
    let callCount = 0;
    const client = {
      multicall: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return [successResult(p1), successResult(p2)];  // projects batch
        return [successResult(v1), successResult(v2)];                        // versions batch
      }),
    } as unknown as PublicClient;

    const results = await batchGetProjectsWithVersions(client, REGISTRY, [1n, 2n]);

    expect(results).toHaveLength(2);
    expect(results[0].project.data?.name).toBe("alpha");
    expect(results[0].versions.data).toHaveLength(1);
    expect(results[1].project.data?.name).toBe("beta");
    expect(results[1].versions.data).toHaveLength(2);
  });

  it("makes exactly 2 multicall invocations (projects + versions)", async () => {
    const p = makeProjectData();
    const v = [makeVersionData()];
    let callCount = 0;
    const client = {
      multicall: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return [successResult(p)];
        return [successResult(v)];
      }),
    } as unknown as PublicClient;

    await batchGetProjectsWithVersions(client, REGISTRY, [1n]);

    expect((client.multicall as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("preserves ordering of input IDs in output", async () => {
    const ids = [5n, 3n, 1n];
    const projects = ids.map((id) => makeProjectData({ id, name: `p-${id}` }));
    const versions = ids.map((id) => [makeVersionData({ projectId: id })]);
    let callCount = 0;
    const client = {
      multicall: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return projects.map(successResult);
        return versions.map(successResult);
      }),
    } as unknown as PublicClient;

    const results = await batchGetProjectsWithVersions(client, REGISTRY, ids);

    expect(results[0].project.data?.id).toBe(5n);
    expect(results[1].project.data?.id).toBe(3n);
    expect(results[2].project.data?.id).toBe(1n);
  });

  it("handles partial failures — failed project returns null data", async () => {
    const p1 = makeProjectData({ id: 1n });
    let callCount = 0;
    const client = {
      multicall: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return [successResult(p1), failureResult("not found")];
        return [successResult([makeVersionData()]), failureResult("not found")];
      }),
    } as unknown as PublicClient;

    const results = await batchGetProjectsWithVersions(client, REGISTRY, [1n, 99n]);

    expect(results[0].project.success).toBe(true);
    expect(results[1].project.success).toBe(false);
    expect(results[1].project.data).toBeNull();
    expect(results[1].versions.success).toBe(false);
  });
});

// ─── BatchResult type shape ───────────────────────────────────────────────────

describe("BatchResult type contract", () => {
  it("success result has data and success=true", async () => {
    const p = makeProjectData();
    const client = makePublicClient(async () => [successResult(p)]);
    const results = await batchGetProjects(client, REGISTRY, [1n]);

    const r: BatchResult<ProjectData> = results[0];
    expect(r.success).toBe(true);
    expect(r.data).not.toBeNull();
    expect(r.error).toBeUndefined();
  });

  it("failure result has null data and success=false", async () => {
    const client = makePublicClient(async () => [failureResult("boom")]);
    const results = await batchGetProjects(client, REGISTRY, [1n]);

    const r: BatchResult<ProjectData> = results[0];
    expect(r.success).toBe(false);
    expect(r.data).toBeNull();
    expect(r.error).toBe("boom");
  });
});
