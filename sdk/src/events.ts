/**
 * @file events.ts
 * @description viem watchContractEvent wrappers for InkdRegistry.sol events.
 *              Provides typed, reactive subscriptions to ProjectCreated and
 *              VersionPushed — the two core lifecycle events of the protocol.
 *
 * @example
 * ```ts
 * import { watchProjectCreated, watchVersionPushed } from "@inkd/sdk/events";
 * import { createPublicClient, http } from "viem";
 * import { baseSepolia } from "viem/chains";
 *
 * const publicClient = createPublicClient({
 *   chain: baseSepolia,
 *   transport: http(),
 * });
 *
 * // Subscribe to all new projects
 * const unwatch = watchProjectCreated(publicClient, "0xRegistry...", (event) => {
 *   console.log("New project:", event.projectId, event.name, "by", event.owner);
 * });
 *
 * // Filter to a specific project's versions
 * const unwatch2 = watchVersionPushed(
 *   publicClient,
 *   "0xRegistry...",
 *   (event) => console.log("Version pushed:", event.versionTag, event.arweaveHash),
 *   { projectId: 42n }
 * );
 *
 * // Stop watching
 * unwatch();
 * unwatch2();
 * ```
 */

import type { PublicClient } from "viem";
import { INKD_REGISTRY_ABI } from "./ProjectRegistry.js";
import type { Address } from "./ProjectRegistry.js";

// ─── Event Types ──────────────────────────────────────────────────────────────

/**
 * Decoded ProjectCreated event payload.
 * Emitted by InkdRegistry.sol when a new project is registered.
 */
export interface ProjectCreatedEvent {
  /** On-chain project identifier (auto-incrementing). */
  projectId: bigint;
  /** Initial project owner address. */
  owner: Address;
  /** Project name as stored on-chain. */
  name: string;
  /** SPDX license identifier (e.g. "MIT"). */
  license: string;
  /** Raw viem log metadata (block, tx hash, etc.). */
  _log: unknown;
}

/**
 * Decoded VersionPushed event payload.
 * Emitted by InkdRegistry.sol when a new version is pushed to a project.
 */
export interface VersionPushedEvent {
  /** ID of the project that received the new version. */
  projectId: bigint;
  /** Arweave transaction hash of the uploaded artifact. */
  arweaveHash: string;
  /** Human-readable version tag, e.g. "v1.2.0" or "checkpoint-42". */
  versionTag: string;
  /** Address that called pushVersion(). */
  pushedBy: Address;
  /** Raw viem log metadata (block, tx hash, etc.). */
  _log: unknown;
}

/**
 * Unsubscribe function returned by all watch* helpers.
 * Call to stop polling / disconnect the underlying filter.
 */
export type Unwatch = () => void;

/**
 * Optional filters for watchProjectCreated.
 * Only indexed arguments can be filtered at the RPC level.
 */
export interface ProjectCreatedFilter {
  /** Filter events by project owner address. */
  owner?: Address;
}

/**
 * Optional filters for watchVersionPushed.
 * Only indexed arguments can be filtered at the RPC level.
 */
export interface VersionPushedFilter {
  /** Filter events by project ID. */
  projectId?: bigint;
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to ProjectCreated events from InkdRegistry.
 *
 * Uses viem's watchContractEvent under the hood, which polls getLogs
 * on a configurable interval (default 4 s on most public RPCs).
 *
 * @param publicClient  A connected viem PublicClient.
 * @param registryAddress  Address of the InkdRegistry proxy contract.
 * @param onEvent  Callback invoked for each matching event.
 * @param filter   Optional indexed-arg filters (owner).
 * @returns An unsubscribe function — call it to stop watching.
 */
export function watchProjectCreated(
  publicClient: PublicClient,
  registryAddress: Address,
  onEvent: (event: ProjectCreatedEvent) => void,
  filter?: ProjectCreatedFilter
): Unwatch {
  return publicClient.watchContractEvent({
    address: registryAddress,
    abi: INKD_REGISTRY_ABI,
    eventName: "ProjectCreated",
    args: filter?.owner ? { owner: filter.owner } : undefined,
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        onEvent({
          projectId: (args.projectId as bigint) ?? 0n,
          owner: (args.owner as Address) ?? ("0x" as Address),
          name: (args.name as string) ?? "",
          license: (args.license as string) ?? "",
          _log: log,
        });
      }
    },
  });
}

/**
 * Subscribe to VersionPushed events from InkdRegistry.
 *
 * @param publicClient  A connected viem PublicClient.
 * @param registryAddress  Address of the InkdRegistry proxy contract.
 * @param onEvent  Callback invoked for each matching event.
 * @param filter   Optional indexed-arg filters (projectId).
 * @returns An unsubscribe function — call it to stop watching.
 */
export function watchVersionPushed(
  publicClient: PublicClient,
  registryAddress: Address,
  onEvent: (event: VersionPushedEvent) => void,
  filter?: VersionPushedFilter
): Unwatch {
  return publicClient.watchContractEvent({
    address: registryAddress,
    abi: INKD_REGISTRY_ABI,
    eventName: "VersionPushed",
    args: filter?.projectId !== undefined ? { projectId: filter.projectId } : undefined,
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        onEvent({
          projectId: (args.projectId as bigint) ?? 0n,
          arweaveHash: (args.arweaveHash as string) ?? "",
          versionTag: (args.versionTag as string) ?? "",
          pushedBy: (args.pushedBy as Address) ?? ("0x" as Address),
          _log: log,
        });
      }
    },
  });
}

// ─── Batch Helper ─────────────────────────────────────────────────────────────

/**
 * Watch both ProjectCreated and VersionPushed in one call.
 *
 * @example
 * ```ts
 * const { unwatchAll } = watchRegistryEvents(publicClient, "0xRegistry...", {
 *   onProjectCreated: (e) => console.log("Created:", e.name),
 *   onVersionPushed:  (e) => console.log("Version:", e.versionTag),
 * });
 *
 * // Stop both
 * unwatchAll();
 * ```
 */
export function watchRegistryEvents(
  publicClient: PublicClient,
  registryAddress: Address,
  handlers: {
    onProjectCreated?: (event: ProjectCreatedEvent) => void;
    onVersionPushed?: (event: VersionPushedEvent) => void;
    projectCreatedFilter?: ProjectCreatedFilter;
    versionPushedFilter?: VersionPushedFilter;
  }
): { unwatchAll: Unwatch } {
  const cleanups: Unwatch[] = [];

  if (handlers.onProjectCreated) {
    cleanups.push(
      watchProjectCreated(
        publicClient,
        registryAddress,
        handlers.onProjectCreated,
        handlers.projectCreatedFilter
      )
    );
  }

  if (handlers.onVersionPushed) {
    cleanups.push(
      watchVersionPushed(
        publicClient,
        registryAddress,
        handlers.onVersionPushed,
        handlers.versionPushedFilter
      )
    );
  }

  return {
    unwatchAll: () => cleanups.forEach((fn) => fn()),
  };
}
