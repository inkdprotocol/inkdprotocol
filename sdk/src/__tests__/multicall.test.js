"use strict";
/**
 * @file multicall.test.ts
 * @description Unit tests for multicall.ts — Multicall3 batch read helpers.
 *
 * All tests are pure unit tests — no network, no RPC.
 * viem's publicClient.multicall is mocked via vi.fn().
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const multicall_js_1 = require("../multicall.js");
// ─── Fixtures ─────────────────────────────────────────────────────────────────
const REGISTRY = "0xRegistryAddress000000000000000000000001";
const OWNER = "0xOwnerAddress0000000000000000000000000003";
function makeProjectData(overrides = {}) {
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
function makeVersionData(overrides = {}) {
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
function makePublicClient(multicallImpl) {
    return {
        multicall: vitest_1.vi.fn().mockImplementation(multicallImpl),
    };
}
/** Build a viem multicall success result */
function successResult(result) {
    return { result, status: "success" };
}
/** Build a viem multicall failure result */
function failureResult(error) {
    return { result: undefined, status: "failure", error: new Error(error) };
}
// ─── batchGetProjects ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("batchGetProjects", () => {
    (0, vitest_1.it)("returns empty array when given no project IDs", async () => {
        const client = makePublicClient(async () => []);
        const result = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, []);
        (0, vitest_1.expect)(result).toEqual([]);
        (0, vitest_1.expect)(client.multicall.mock.calls.length).toBe(0);
    });
    (0, vitest_1.it)("calls multicall with one entry per project ID", async () => {
        const p1 = makeProjectData({ id: 1n });
        const p2 = makeProjectData({ id: 2n, name: "project-two" });
        const client = makePublicClient(async () => [successResult(p1), successResult(p2)]);
        await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n, 2n]);
        const calls = client.multicall.mock.calls;
        (0, vitest_1.expect)(calls).toHaveLength(1);
        const contracts = calls[0][0].contracts;
        (0, vitest_1.expect)(contracts).toHaveLength(2);
        (0, vitest_1.expect)(contracts[0].args[0]).toBe(1n);
        (0, vitest_1.expect)(contracts[1].args[0]).toBe(2n);
    });
    (0, vitest_1.it)("passes allowFailure: true", async () => {
        const client = makePublicClient(async () => [successResult(makeProjectData())]);
        await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n]);
        const callArg = client.multicall.mock.calls[0][0];
        (0, vitest_1.expect)(callArg.allowFailure).toBe(true);
    });
    (0, vitest_1.it)("returns success results with correct data", async () => {
        const p1 = makeProjectData({ id: 1n, name: "alpha" });
        const p2 = makeProjectData({ id: 2n, name: "beta" });
        const client = makePublicClient(async () => [successResult(p1), successResult(p2)]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n, 2n]);
        (0, vitest_1.expect)(results).toHaveLength(2);
        (0, vitest_1.expect)(results[0].success).toBe(true);
        (0, vitest_1.expect)(results[0].data?.name).toBe("alpha");
        (0, vitest_1.expect)(results[1].success).toBe(true);
        (0, vitest_1.expect)(results[1].data?.name).toBe("beta");
    });
    (0, vitest_1.it)("returns failure result for reverted calls", async () => {
        const client = makePublicClient(async () => [
            successResult(makeProjectData({ id: 1n })),
            failureResult("Project does not exist"),
        ]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n, 999n]);
        (0, vitest_1.expect)(results[0].success).toBe(true);
        (0, vitest_1.expect)(results[1].success).toBe(false);
        (0, vitest_1.expect)(results[1].data).toBeNull();
        (0, vitest_1.expect)(results[1].error).toContain("Project does not exist");
    });
    (0, vitest_1.it)("handles all-failure responses gracefully", async () => {
        const client = makePublicClient(async () => [
            failureResult("revert 1"),
            failureResult("revert 2"),
        ]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n, 2n]);
        (0, vitest_1.expect)(results.every((r) => !r.success)).toBe(true);
        (0, vitest_1.expect)(results.every((r) => r.data === null)).toBe(true);
    });
    (0, vitest_1.it)("preserves order of results matching input IDs", async () => {
        const projects = [3n, 1n, 2n].map((id) => makeProjectData({ id, name: `project-${id}` }));
        const client = makePublicClient(async () => projects.map(successResult));
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [3n, 1n, 2n]);
        (0, vitest_1.expect)(results[0].data?.id).toBe(3n);
        (0, vitest_1.expect)(results[1].data?.id).toBe(1n);
        (0, vitest_1.expect)(results[2].data?.id).toBe(2n);
    });
    (0, vitest_1.it)("passes the registry address to every multicall contract entry", async () => {
        const client = makePublicClient(async () => [successResult(makeProjectData())]);
        await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n]);
        const contracts = client.multicall.mock.calls[0][0]
            .contracts;
        (0, vitest_1.expect)(contracts[0].address).toBe(REGISTRY);
    });
    (0, vitest_1.it)("handles a single project ID", async () => {
        const p = makeProjectData({ id: 42n });
        const client = makePublicClient(async () => [successResult(p)]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [42n]);
        (0, vitest_1.expect)(results).toHaveLength(1);
        (0, vitest_1.expect)(results[0].data?.id).toBe(42n);
    });
    (0, vitest_1.it)("handles large batches (100 IDs)", async () => {
        const ids = Array.from({ length: 100 }, (_, i) => BigInt(i + 1));
        const mockResults = ids.map((id) => successResult(makeProjectData({ id })));
        const client = makePublicClient(async () => mockResults);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, ids);
        (0, vitest_1.expect)(results).toHaveLength(100);
        (0, vitest_1.expect)(results.every((r) => r.success)).toBe(true);
    });
});
// ─── batchGetVersions ─────────────────────────────────────────────────────────
(0, vitest_1.describe)("batchGetVersions", () => {
    (0, vitest_1.it)("returns empty array when given no project IDs", async () => {
        const client = makePublicClient(async () => []);
        const result = await (0, multicall_js_1.batchGetVersions)(client, REGISTRY, []);
        (0, vitest_1.expect)(result).toEqual([]);
    });
    (0, vitest_1.it)("calls multicall with getVersions for each project ID", async () => {
        const v1 = [makeVersionData({ projectId: 1n })];
        const v2 = [makeVersionData({ projectId: 2n }), makeVersionData({ projectId: 2n, versionTag: "v1.1.0" })];
        const client = makePublicClient(async () => [successResult(v1), successResult(v2)]);
        await (0, multicall_js_1.batchGetVersions)(client, REGISTRY, [1n, 2n]);
        const contracts = client.multicall.mock.calls[0][0]
            .contracts;
        (0, vitest_1.expect)(contracts[0].functionName).toBe("getVersions");
        (0, vitest_1.expect)(contracts[0].args[0]).toBe(1n);
        (0, vitest_1.expect)(contracts[1].args[0]).toBe(2n);
    });
    (0, vitest_1.it)("returns arrays of versions per project", async () => {
        const v1 = [makeVersionData({ projectId: 1n })];
        const v2 = [makeVersionData({ projectId: 2n }), makeVersionData({ projectId: 2n, versionTag: "v2.0.0" })];
        const client = makePublicClient(async () => [successResult(v1), successResult(v2)]);
        const results = await (0, multicall_js_1.batchGetVersions)(client, REGISTRY, [1n, 2n]);
        (0, vitest_1.expect)(results[0].success).toBe(true);
        (0, vitest_1.expect)(results[0].data).toHaveLength(1);
        (0, vitest_1.expect)(results[1].success).toBe(true);
        (0, vitest_1.expect)(results[1].data).toHaveLength(2);
        (0, vitest_1.expect)(results[1].data[1].versionTag).toBe("v2.0.0");
    });
    (0, vitest_1.it)("handles failure for a project ID that doesn't exist", async () => {
        const client = makePublicClient(async () => [
            successResult([makeVersionData()]),
            failureResult("invalid project"),
        ]);
        const results = await (0, multicall_js_1.batchGetVersions)(client, REGISTRY, [1n, 999n]);
        (0, vitest_1.expect)(results[1].success).toBe(false);
        (0, vitest_1.expect)(results[1].data).toBeNull();
    });
    (0, vitest_1.it)("returns empty version arrays for projects with no versions", async () => {
        const client = makePublicClient(async () => [successResult([])]);
        const results = await (0, multicall_js_1.batchGetVersions)(client, REGISTRY, [1n]);
        (0, vitest_1.expect)(results[0].success).toBe(true);
        (0, vitest_1.expect)(results[0].data).toEqual([]);
    });
});
// ─── batchGetFees ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("batchGetFees", () => {
    (0, vitest_1.it)("fetches versionFee, transferFee, and tokenLockAmount in one call", async () => {
        const client = makePublicClient(async () => [
            successResult(100n),
            successResult(200n),
            successResult(1000n),
        ]);
        const fees = await (0, multicall_js_1.batchGetFees)(client, REGISTRY);
        (0, vitest_1.expect)(fees.versionFee).toBe(100n);
        (0, vitest_1.expect)(fees.transferFee).toBe(200n);
        (0, vitest_1.expect)(fees.tokenLockAmount).toBe(1000n);
    });
    (0, vitest_1.it)("calls multicall with allowFailure: false", async () => {
        const client = makePublicClient(async () => [
            successResult(1n),
            successResult(2n),
            successResult(3n),
        ]);
        await (0, multicall_js_1.batchGetFees)(client, REGISTRY);
        const callArg = client.multicall.mock.calls[0][0];
        (0, vitest_1.expect)(callArg.allowFailure).toBe(false);
    });
    (0, vitest_1.it)("makes exactly one multicall with 3 contract entries", async () => {
        const client = makePublicClient(async () => [
            successResult(1n),
            successResult(2n),
            successResult(3n),
        ]);
        await (0, multicall_js_1.batchGetFees)(client, REGISTRY);
        const calls = client.multicall.mock.calls;
        (0, vitest_1.expect)(calls).toHaveLength(1);
        (0, vitest_1.expect)(calls[0][0].contracts).toHaveLength(3);
    });
    (0, vitest_1.it)("all three contracts use the registry address", async () => {
        const client = makePublicClient(async () => [
            successResult(1n),
            successResult(2n),
            successResult(3n),
        ]);
        await (0, multicall_js_1.batchGetFees)(client, REGISTRY);
        const contracts = client.multicall.mock.calls[0][0]
            .contracts;
        (0, vitest_1.expect)(contracts.every((c) => c.address === REGISTRY)).toBe(true);
    });
    (0, vitest_1.it)("returns zero bigints as defaults on missing results", async () => {
        // Simulate multicall returning undefined result fields
        const client = makePublicClient(async () => [
            { result: undefined, status: "success" },
            { result: undefined, status: "success" },
            { result: undefined, status: "success" },
        ]);
        const fees = await (0, multicall_js_1.batchGetFees)(client, REGISTRY);
        (0, vitest_1.expect)(fees.versionFee).toBe(0n);
        (0, vitest_1.expect)(fees.transferFee).toBe(0n);
        (0, vitest_1.expect)(fees.tokenLockAmount).toBe(0n);
    });
    (0, vitest_1.it)("includes correct functionNames: versionFee, transferFee, TOKEN_LOCK_AMOUNT", async () => {
        const client = makePublicClient(async () => [
            successResult(1n),
            successResult(2n),
            successResult(3n),
        ]);
        await (0, multicall_js_1.batchGetFees)(client, REGISTRY);
        const contracts = client.multicall.mock.calls[0][0]
            .contracts;
        (0, vitest_1.expect)(contracts[0].functionName).toBe("versionFee");
        (0, vitest_1.expect)(contracts[1].functionName).toBe("transferFee");
        (0, vitest_1.expect)(contracts[2].functionName).toBe("TOKEN_LOCK_AMOUNT");
    });
});
// ─── batchGetProjectsWithVersions ─────────────────────────────────────────────
(0, vitest_1.describe)("batchGetProjectsWithVersions", () => {
    (0, vitest_1.it)("returns empty array when given no project IDs", async () => {
        const client = makePublicClient(async () => []);
        const results = await (0, multicall_js_1.batchGetProjectsWithVersions)(client, REGISTRY, []);
        (0, vitest_1.expect)(results).toEqual([]);
    });
    (0, vitest_1.it)("returns combined project + versions for each ID", async () => {
        const p1 = makeProjectData({ id: 1n, name: "alpha" });
        const v1 = [makeVersionData({ projectId: 1n })];
        const p2 = makeProjectData({ id: 2n, name: "beta" });
        const v2 = [makeVersionData({ projectId: 2n }), makeVersionData({ projectId: 2n, versionTag: "v2.0.0" })];
        // batchGetProjectsWithVersions calls batchGetProjects + batchGetVersions via Promise.all
        // Both use publicClient.multicall — mock returns in call order.
        let callCount = 0;
        const client = {
            multicall: vitest_1.vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1)
                    return [successResult(p1), successResult(p2)]; // projects batch
                return [successResult(v1), successResult(v2)]; // versions batch
            }),
        };
        const results = await (0, multicall_js_1.batchGetProjectsWithVersions)(client, REGISTRY, [1n, 2n]);
        (0, vitest_1.expect)(results).toHaveLength(2);
        (0, vitest_1.expect)(results[0].project.data?.name).toBe("alpha");
        (0, vitest_1.expect)(results[0].versions.data).toHaveLength(1);
        (0, vitest_1.expect)(results[1].project.data?.name).toBe("beta");
        (0, vitest_1.expect)(results[1].versions.data).toHaveLength(2);
    });
    (0, vitest_1.it)("makes exactly 2 multicall invocations (projects + versions)", async () => {
        const p = makeProjectData();
        const v = [makeVersionData()];
        let callCount = 0;
        const client = {
            multicall: vitest_1.vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1)
                    return [successResult(p)];
                return [successResult(v)];
            }),
        };
        await (0, multicall_js_1.batchGetProjectsWithVersions)(client, REGISTRY, [1n]);
        (0, vitest_1.expect)(client.multicall.mock.calls).toHaveLength(2);
    });
    (0, vitest_1.it)("preserves ordering of input IDs in output", async () => {
        const ids = [5n, 3n, 1n];
        const projects = ids.map((id) => makeProjectData({ id, name: `p-${id}` }));
        const versions = ids.map((id) => [makeVersionData({ projectId: id })]);
        let callCount = 0;
        const client = {
            multicall: vitest_1.vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1)
                    return projects.map(successResult);
                return versions.map(successResult);
            }),
        };
        const results = await (0, multicall_js_1.batchGetProjectsWithVersions)(client, REGISTRY, ids);
        (0, vitest_1.expect)(results[0].project.data?.id).toBe(5n);
        (0, vitest_1.expect)(results[1].project.data?.id).toBe(3n);
        (0, vitest_1.expect)(results[2].project.data?.id).toBe(1n);
    });
    (0, vitest_1.it)("handles partial failures — failed project returns null data", async () => {
        const p1 = makeProjectData({ id: 1n });
        let callCount = 0;
        const client = {
            multicall: vitest_1.vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1)
                    return [successResult(p1), failureResult("not found")];
                return [successResult([makeVersionData()]), failureResult("not found")];
            }),
        };
        const results = await (0, multicall_js_1.batchGetProjectsWithVersions)(client, REGISTRY, [1n, 99n]);
        (0, vitest_1.expect)(results[0].project.success).toBe(true);
        (0, vitest_1.expect)(results[1].project.success).toBe(false);
        (0, vitest_1.expect)(results[1].project.data).toBeNull();
        (0, vitest_1.expect)(results[1].versions.success).toBe(false);
    });
});
// ─── BatchResult type shape ───────────────────────────────────────────────────
(0, vitest_1.describe)("BatchResult type contract", () => {
    (0, vitest_1.it)("success result has data and success=true", async () => {
        const p = makeProjectData();
        const client = makePublicClient(async () => [successResult(p)]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n]);
        const r = results[0];
        (0, vitest_1.expect)(r.success).toBe(true);
        (0, vitest_1.expect)(r.data).not.toBeNull();
        (0, vitest_1.expect)(r.error).toBeUndefined();
    });
    (0, vitest_1.it)("failure result has null data and success=false", async () => {
        const client = makePublicClient(async () => [failureResult("boom")]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n]);
        const r = results[0];
        (0, vitest_1.expect)(r.success).toBe(false);
        (0, vitest_1.expect)(r.data).toBeNull();
        (0, vitest_1.expect)(r.error).toBe("boom");
    });
    (0, vitest_1.it)("failure with a string (non-Error) error coerces it via String()", async () => {
        // Covers the `raw.error instanceof Error → false` branch in coerceResult
        // i.e. `String(raw.error ?? "unknown")` with a defined string value
        const client = makePublicClient(async () => [
            // testing non-Error error path in coerceResult (string instead of Error object)
            { result: undefined, status: "failure", error: "plain string error" },
        ]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n]);
        (0, vitest_1.expect)(results[0].success).toBe(false);
        (0, vitest_1.expect)(results[0].data).toBeNull();
        (0, vitest_1.expect)(results[0].error).toBe("plain string error");
    });
    (0, vitest_1.it)("result with undefined status + undefined result is treated as failure with 'unknown' error", async () => {
        // Covers the `raw.status === undefined && raw.result === undefined` branch
        // and the `raw.error ?? "unknown"` fallback (error is also undefined here)
        const client = makePublicClient(async () => [
            // testing implicit-failure path (no status, no result)
            { result: undefined },
        ]);
        const results = await (0, multicall_js_1.batchGetProjects)(client, REGISTRY, [1n]);
        (0, vitest_1.expect)(results[0].success).toBe(false);
        (0, vitest_1.expect)(results[0].data).toBeNull();
        (0, vitest_1.expect)(results[0].error).toBe("unknown");
    });
});
//# sourceMappingURL=multicall.test.js.map