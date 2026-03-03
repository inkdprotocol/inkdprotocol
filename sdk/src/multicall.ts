/**
 * @file multicall.ts
 * @description Multicall3-powered batch reads for InkdRegistry.
 *              Fetches multiple projects or versions in a single RPC round-trip,
 *              dramatically reducing latency when listing/paginating projects.
 *
 * Uses viem's built-in `multicall` helper, which targets Multicall3
 * (0xcA11bde05977b3631167028862bE2a173976CA11 — deployed on Base and Base Sepolia).
 *
 * @example
 * ```ts
 * import { batchGetProjects, batchGetFees } from "@inkd/sdk";
 * import { createPublicClient, http } from "viem";
 * import { baseSepolia } from "viem/chains";
 *
 * const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
 *
 * // Fetch 5 projects in one RPC call
 * const projects = await batchGetProjects(publicClient, "0xRegistry...", [1n, 2n, 3n, 4n, 5n]);
 *
 * // Fetch both fees in one RPC call
 * const fees = await batchGetFees(publicClient, "0xRegistry...");
 * console.log("Version fee:", fees.versionFee);
 * console.log("Transfer fee:", fees.transferFee);
 * ```
 */

import type { PublicClient } from "viem";
import { INKD_REGISTRY_ABI } from "./ProjectRegistry.js";
import type { Address } from "./ProjectRegistry.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Decoded on-chain project data. Mirrors the InkdRegistry.Project struct. */
export interface ProjectData {
  id: bigint;
  name: string;
  description: string;
  license: string;
  readmeHash: string;
  owner: Address;
  isPublic: boolean;
  isAgent: boolean;
  agentEndpoint: string;
  createdAt: bigint;
  versionCount: bigint;
  exists: boolean;
}

/** Decoded on-chain version data. Mirrors the InkdRegistry.Version struct. */
export interface VersionData {
  projectId: bigint;
  arweaveHash: string;
  versionTag: string;
  changelog: string;
  pushedBy: Address;
  pushedAt: bigint;
}

/** Protocol fee snapshot fetched in a single multicall. */
export interface RegistryFees {
  /** Fee in wei required to push a new version. */
  versionFee: bigint;
  /** Fee in wei required to transfer project ownership. */
  transferFee: bigint;
  /** Amount of $INKD tokens locked per project on creation. */
  tokenLockAmount: bigint;
}

/** Result wrapper for individual multicall calls that may fail. */
export interface BatchResult<T> {
  /** The decoded value, or null if the call reverted/failed. */
  data: T | null;
  /** True if the call succeeded. */
  success: boolean;
  /** Revert reason or error message, if the call failed. */
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Coerce a raw multicall result into a typed BatchResult<T>.
 * Handles both viem's `{ result, status }` shape and raw revert cases.
 */
function coerceResult<T>(raw: {
  result?: unknown;
  status?: "success" | "failure";
  error?: unknown;
}): BatchResult<T> {
  if (raw.status === "failure" || raw.status === undefined && raw.result === undefined) {
    return {
      data: null,
      success: false,
      error: raw.error instanceof Error ? raw.error.message : String(raw.error ?? "unknown"),
    };
  }
  return {
    data: raw.result as T,
    success: true,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch multiple projects by their on-chain IDs in a **single RPC call**.
 *
 * Projects that don't exist (reverted getProject call) will have
 * `success: false` and `data: null` in the returned array.
 *
 * @param publicClient   A connected viem PublicClient (Base or Base Sepolia).
 * @param registryAddress  Address of the deployed InkdRegistry contract.
 * @param projectIds  Array of project IDs to fetch (bigint).
 * @returns Promise resolving to a `BatchResult<ProjectData>[]` in the same order.
 *
 * @example
 * ```ts
 * const results = await batchGetProjects(client, registry, [1n, 2n, 3n]);
 * for (const r of results) {
 *   if (r.success && r.data) console.log(r.data.name);
 * }
 * ```
 */
export async function batchGetProjects(
  publicClient: PublicClient,
  registryAddress: Address,
  projectIds: bigint[]
): Promise<BatchResult<ProjectData>[]> {
  if (projectIds.length === 0) return [];

  const contracts = projectIds.map((id) => ({
    address: registryAddress,
    abi: INKD_REGISTRY_ABI,
    functionName: "getProject" as const,
    args: [id] as const,
  }));

  const results = await (publicClient as unknown as {
    multicall: (opts: {
      contracts: typeof contracts;
      allowFailure: boolean;
    }) => Promise<{ result?: unknown; status?: "success" | "failure"; error?: unknown }[]>;
  }).multicall({
    contracts,
    allowFailure: true,
  });

  return results.map((raw) => coerceResult<ProjectData>(raw));
}

/**
 * Fetch the latest versions for multiple projects in a **single RPC call**.
 *
 * Each element in the returned array corresponds to the project ID at the
 * same index. Failed calls return `{ success: false, data: null }`.
 *
 * @param publicClient   A connected viem PublicClient.
 * @param registryAddress  Address of the deployed InkdRegistry contract.
 * @param projectIds  Array of project IDs whose versions to fetch.
 * @returns Promise resolving to `BatchResult<VersionData[]>[]` in the same order.
 */
export async function batchGetVersions(
  publicClient: PublicClient,
  registryAddress: Address,
  projectIds: bigint[]
): Promise<BatchResult<VersionData[]>[]> {
  if (projectIds.length === 0) return [];

  const contracts = projectIds.map((id) => ({
    address: registryAddress,
    abi: INKD_REGISTRY_ABI,
    functionName: "getVersions" as const,
    args: [id] as const,
  }));

  const results = await (publicClient as unknown as {
    multicall: (opts: {
      contracts: typeof contracts;
      allowFailure: boolean;
    }) => Promise<{ result?: unknown; status?: "success" | "failure"; error?: unknown }[]>;
  }).multicall({
    contracts,
    allowFailure: true,
  });

  return results.map((raw) => coerceResult<VersionData[]>(raw));
}

/**
 * Fetch versionFee, transferFee, and TOKEN_LOCK_AMOUNT in a **single RPC call**.
 *
 * Useful before any write operation (create project, push version, transfer)
 * to confirm the required fee without extra round-trips.
 *
 * @param publicClient   A connected viem PublicClient.
 * @param registryAddress  Address of the deployed InkdRegistry contract.
 * @returns `RegistryFees` with all three fee values.
 * @throws  If any of the three calls reverts (should never happen on a valid registry).
 *
 * @example
 * ```ts
 * const { versionFee, transferFee, tokenLockAmount } = await batchGetFees(client, registry);
 * ```
 */
export async function batchGetFees(
  publicClient: PublicClient,
  registryAddress: Address
): Promise<RegistryFees> {
  const contracts = [
    {
      address: registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "versionFee" as const,
      args: [] as const,
    },
    {
      address: registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "transferFee" as const,
      args: [] as const,
    },
    {
      address: registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "TOKEN_LOCK_AMOUNT" as const,
      args: [] as const,
    },
  ] as const;

  const results = await (publicClient as unknown as {
    multicall: (opts: {
      contracts: typeof contracts;
      allowFailure: boolean;
    }) => Promise<{ result?: unknown; status?: "success" | "failure" }[]>;
  }).multicall({
    contracts,
    allowFailure: false,
  });

  return {
    versionFee: (results[0].result ?? 0n) as bigint,
    transferFee: (results[1].result ?? 0n) as bigint,
    tokenLockAmount: (results[2].result ?? 0n) as bigint,
  };
}

/**
 * Fetch projects AND their versions for multiple IDs in **two RPC calls** (projects batch, then versions batch).
 *
 * This is more efficient than fetching each project + versions individually (2N+N calls → 2 calls).
 *
 * @param publicClient   A connected viem PublicClient.
 * @param registryAddress  Address of the deployed InkdRegistry contract.
 * @param projectIds  Array of project IDs to hydrate.
 * @returns Array of `{ project, versions }` objects in the same order as input IDs.
 */
export async function batchGetProjectsWithVersions(
  publicClient: PublicClient,
  registryAddress: Address,
  projectIds: bigint[]
): Promise<Array<{ project: BatchResult<ProjectData>; versions: BatchResult<VersionData[]> }>> {
  if (projectIds.length === 0) return [];

  const [projects, versions] = await Promise.all([
    batchGetProjects(publicClient, registryAddress, projectIds),
    batchGetVersions(publicClient, registryAddress, projectIds),
  ]);

  return projectIds.map((_, i) => ({
    project: projects[i],
    versions: versions[i],
  }));
}
