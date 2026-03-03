# Inkd Protocol — SDK Reference

Complete reference for `@inkd/sdk` — the TypeScript SDK for interacting with Inkd Protocol.

---

## Installation

```bash
npm install @inkd/sdk viem
# or
yarn add @inkd/sdk viem
# or
pnpm add @inkd/sdk viem
```

**Peer dependencies:** `viem >= 2.0.0`

---

## Table of Contents

- [InkdClient](#inkdclient)
  - [Configuration](#configuration)
  - [Connection](#connection)
  - [Token Operations](#token-operations)
  - [Registry Operations](#registry-operations)
  - [Version Operations](#version-operations)
  - [Collaborator Management](#collaborator-management)
- [Types](#types)
- [Error Handling](#error-handling)
- [Event Subscriptions](#event-subscriptions)
  - [watchProjectCreated](#watchprojectcreated)
  - [watchVersionPushed](#watchversionpushed)
  - [watchRegistryEvents](#watchregistryevents)
- [Batch Reads (Multicall)](#batch-reads-multicall)
  - [batchGetProjects](#batchgetprojects)
  - [batchGetVersions](#batchgetversions)
  - [batchGetFees](#batchgetfees)
  - [batchGetProjectsWithVersions](#batchgetprojectswithversions)
- [React Hooks](#react-hooks)
- [Full Examples](#full-examples)

---

## InkdClient

The primary interface for all Inkd Protocol interactions.

```typescript
import { InkdClient } from "@inkd/sdk";
```

### Configuration

```typescript
const inkd = new InkdClient({
  tokenAddress:    "0x...",  // $INKD ERC-20 contract address
  registryAddress: "0x...",  // InkdRegistry proxy address
  treasuryAddress: "0x...",  // InkdTreasury proxy address
  chainId: 84532,            // 8453 = Base Mainnet, 84532 = Base Sepolia
});
```

#### `InkdClientConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenAddress` | `` `0x${string}` `` | ✅ | $INKD ERC-20 token contract |
| `registryAddress` | `` `0x${string}` `` | ✅ | InkdRegistry proxy contract |
| `treasuryAddress` | `` `0x${string}` `` | ✅ | InkdTreasury proxy contract |
| `chainId` | `8453 \| 84532` | ✅ | Target network chain ID |

---

### Connection

#### `connect(walletClient, publicClient): void`

Connect viem clients for signing transactions and reading chain state.

```typescript
import { createWalletClient, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xPRIVATE_KEY");

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

inkd.connect(walletClient, publicClient);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletClient` | `WalletClient` | viem wallet client with account attached |
| `publicClient` | `PublicClient` | viem public client for reads |

**Throws:** Nothing — but subsequent write calls will throw `ClientNotConnected` if skipped.

---

### Token Operations

#### `approveInkdForRegistry(amount?: bigint): Promise<TransactionResult>`

Approve InkdRegistry to spend $INKD on your behalf. Required before `createProject()`.

```typescript
// Approve exactly 1 $INKD (default)
await inkd.approveInkdForRegistry();

// Approve 5 $INKD for multiple projects
await inkd.approveInkdForRegistry(parseEther("5"));
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `amount` | `bigint?` | `parseEther("1")` | Amount to approve |

Returns: `{ hash: string }` — transaction hash.

---

#### `getInkdBalance(address?: Address): Promise<bigint>`

Get $INKD balance for an address.

```typescript
const balance = await inkd.getInkdBalance();         // connected wallet
const balance = await inkd.getInkdBalance("0x...");  // any address
```

Returns: Raw balance in wei (18 decimals). Use `formatEther(balance)` to display.

---

#### `getInkdAllowance(owner: Address, spender: Address): Promise<bigint>`

Check $INKD allowance.

```typescript
const allowance = await inkd.getInkdAllowance(myAddress, registryAddress);
```

---

### Registry Operations

#### `createProject(options): Promise<{ projectId: bigint, hash: string }>`

Create a new project. Locks 1 $INKD from caller. Project name must be unique (globally, case-insensitive).

```typescript
const { projectId } = await inkd.createProject({
  name: "my-ai-agent",
  description: "Autonomous trading agent for Base DeFi",
  license: "MIT",
  isPublic: true,
  readmeHash: "",            // Optional: Arweave hash of README
  isAgent: true,
  agentEndpoint: "https://my-agent.xyz/api",
});

console.log("Project ID:", projectId.toString());
```

**`CreateProjectOptions`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Unique project name (auto-lowercased) |
| `description` | `string` | ✅ | Short description |
| `license` | `string` | ✅ | SPDX identifier (e.g. `"MIT"`) |
| `isPublic` | `boolean` | ✅ | Publicly listed? |
| `readmeHash` | `string` | ✅ | Arweave hash of README (use `""` if none) |
| `isAgent` | `boolean` | ✅ | Is this an AI agent project? |
| `agentEndpoint` | `string` | ✅ | Agent API URL (use `""` if not agent) |

**Throws:**
- `ClientNotConnected` — call `connect()` first
- Contract errors: `NameTaken`, `EmptyName` (passed through from chain)

---

#### `getProject(projectId: bigint): Promise<Project>`

Fetch a project by ID.

```typescript
const project = await inkd.getProject(1n);
console.log(project.name);         // "my-ai-agent"
console.log(project.owner);        // "0x..."
console.log(project.versionCount); // 3n
```

Returns: Full `Project` struct (see [Types](#types)).

**Throws:** `ProjectNotFound` (via contract revert) if ID doesn't exist.

---

#### `getOwnerProjects(owner?: Address): Promise<bigint[]>`

Get all project IDs owned by an address.

```typescript
const projectIds = await inkd.getOwnerProjects();          // connected wallet
const projectIds = await inkd.getOwnerProjects("0x...");   // any address
```

Returns: Array of project ID bigints.

---

#### `getAgentProjects(offset?: bigint, limit?: bigint): Promise<Project[]>`

Paginated list of AI agent projects.

```typescript
const agents = await inkd.getAgentProjects(0n, 20n);  // first 20
const agents = await inkd.getAgentProjects(20n, 20n); // next 20
```

> Note: This is O(n) on-chain. Use pagination for performance.

---

#### `setVisibility(projectId: bigint, isPublic: boolean): Promise<TransactionResult>`

Toggle project visibility. Owner only.

```typescript
await inkd.setVisibility(1n, false); // make private
```

---

#### `setReadme(projectId: bigint, arweaveHash: string): Promise<TransactionResult>`

Update the project README Arweave hash. Owner only.

```typescript
await inkd.setReadme(1n, "arweaveHashOfUpdatedReadme");
```

---

#### `setAgentEndpoint(projectId: bigint, endpoint: string): Promise<TransactionResult>`

Update the agent's public API endpoint. Owner only.

```typescript
await inkd.setAgentEndpoint(1n, "https://new-endpoint.xyz/api");
```

---

#### `transferProject(projectId: bigint, newOwner: Address, options?): Promise<TransactionResult>`

Transfer project ownership. Requires ETH (default: `transferFee`).

```typescript
await inkd.transferProject(1n, "0xNewOwner", {
  value: parseEther("0.005"), // must be >= transferFee
});
```

**Throws:** `InsufficientFee` if value < `transferFee`.

---

### Version Operations

#### `pushVersion(projectId: bigint, options): Promise<TransactionResult>`

Push a new version to a project. Requires ETH (default: `versionFee`).

```typescript
await inkd.pushVersion(1n, {
  arweaveHash: "txIdFromArweave",
  versionTag: "v1.0.0",
  changelog: "Bug fixes and performance improvements",
  value: parseEther("0.001"), // optional: defaults to current versionFee
});
```

**`PushVersionOptions`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `arweaveHash` | `string` | ✅ | Arweave transaction ID |
| `versionTag` | `string` | ✅ | Semantic version (e.g. `"v1.0.0"`) |
| `changelog` | `string` | ✅ | Release notes |
| `value` | `bigint?` | ❌ | ETH to send (defaults to `versionFee`) |

**Throws:**
- `ProjectNotFound`
- `NotOwnerOrCollaborator`
- `InsufficientFee`

---

#### `getVersion(projectId: bigint, versionIndex: bigint): Promise<Version>`

Fetch a specific version by index (0-based).

```typescript
const v = await inkd.getVersion(1n, 0n); // first version
console.log(v.versionTag);   // "v0.1.0"
console.log(v.arweaveHash);  // "abc123..."
console.log(v.pushedAt);     // 1740000000n (unix)
```

---

#### `getVersionCount(projectId: bigint): Promise<bigint>`

Total number of versions for a project.

```typescript
const count = await inkd.getVersionCount(1n);
```

---

#### `getAllVersions(projectId: bigint): Promise<Version[]>`

Convenience helper — fetches all versions for a project.

```typescript
const versions = await inkd.getAllVersions(1n);
versions.forEach(v => console.log(v.versionTag));
```

---

### Collaborator Management

#### `addCollaborator(projectId: bigint, collaborator: Address): Promise<TransactionResult>`

Add a collaborator who can push versions. Owner only.

```typescript
await inkd.addCollaborator(1n, "0xCollaboratorAddress");
```

**Throws:** `AlreadyCollaborator`, `CannotAddOwner`, `ZeroAddress`

---

#### `removeCollaborator(projectId: bigint, collaborator: Address): Promise<TransactionResult>`

Remove a collaborator. Owner only.

```typescript
await inkd.removeCollaborator(1n, "0xCollaboratorAddress");
```

**Throws:** `NotCollaborator`

---

#### `getCollaborators(projectId: bigint): Promise<Address[]>`

Get all collaborators for a project.

```typescript
const collabs = await inkd.getCollaborators(1n);
```

---

#### `isCollaborator(projectId: bigint, user: Address): Promise<boolean>`

Check if an address is a collaborator.

```typescript
const canPush = await inkd.isCollaborator(1n, "0x...");
```

---

## Types

```typescript
type Address = `0x${string}`;

interface InkdClientConfig {
  tokenAddress:    Address;
  registryAddress: Address;
  treasuryAddress: Address;
  chainId:         8453 | 84532;
}

interface Project {
  id:            bigint;
  name:          string;
  description:   string;
  license:       string;
  readmeHash:    string;
  owner:         Address;
  isPublic:      boolean;
  isAgent:       boolean;
  agentEndpoint: string;
  createdAt:     bigint;   // Unix timestamp
  versionCount:  bigint;
  exists:        boolean;
}

interface Version {
  projectId:   bigint;
  arweaveHash: string;
  versionTag:  string;
  changelog:   string;
  pushedBy:    Address;
  pushedAt:    bigint;  // Unix timestamp
}

interface TransactionResult {
  hash: string;
}
```

---

## Error Handling

All errors extend `InkdError` (base class).

```typescript
import {
  InkdError,
  ClientNotConnected,
  ProjectNotFound,
  NotOwner,
  InsufficientFee,
  NameTaken,
} from "@inkd/sdk";
```

### Error Reference

| Error Class | When Thrown |
|-------------|-------------|
| `ClientNotConnected` | Write call before `connect()` |
| `ProjectNotFound` | Invalid project ID |
| `NotOwner` | Caller is not project owner |
| `NotOwnerOrCollaborator` | No write permission |
| `InsufficientFee` | Not enough ETH sent |
| `NameTaken` | Project name already registered |
| `EmptyName` | Empty project name |
| `AlreadyCollaborator` | Address already collaborator |
| `NotCollaborator` | Address not a collaborator |
| `CannotAddOwner` | Tried to add owner as collaborator |
| `ZeroAddress` | Zero address passed as parameter |
| `FeeExceedsMax` | Admin set fee above protocol max |
| `TransactionFailed` | On-chain transaction reverted |
| `UploadError` | Arweave upload failed |

### Example

```typescript
import { InkdClient, NameTaken, InsufficientFee } from "@inkd/sdk";

try {
  const { projectId } = await inkd.createProject({ name: "taken-name", ... });
} catch (err) {
  if (err instanceof NameTaken) {
    console.error("Project name already taken. Choose another.");
  } else if (err instanceof InsufficientFee) {
    console.error("Not enough ETH. Send at least:", formatEther(err.requiredFee));
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

---

---

## Event Subscriptions

Import from `@inkd/sdk` or directly from `@inkd/sdk/events`:

```ts
import { watchProjectCreated, watchVersionPushed, watchRegistryEvents } from "@inkd/sdk";
```

Event subscriptions use viem's `watchContractEvent` under the hood, which polls `getLogs` on a configurable interval (default ~4 s on most public RPCs). All watchers return an **unsubscribe function** — call it to stop polling and release resources.

---

### `watchProjectCreated`

Subscribe to `ProjectCreated` events emitted when a new project is registered.

```ts
function watchProjectCreated(
  publicClient: PublicClient,
  registryAddress: Address,
  onEvent: (event: ProjectCreatedEvent) => void,
  filter?: ProjectCreatedFilter
): Unwatch
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `publicClient` | `PublicClient` | Connected viem public client (Base or Base Sepolia) |
| `registryAddress` | `Address` | Address of the deployed InkdRegistry proxy contract |
| `onEvent` | `(event: ProjectCreatedEvent) => void` | Callback invoked for each matching event |
| `filter` | `ProjectCreatedFilter?` | Optional filter — `{ owner?: Address }` |

**Returns:** `Unwatch` — call to stop the subscription.

**`ProjectCreatedEvent` shape:**

```ts
interface ProjectCreatedEvent {
  projectId: bigint;   // Auto-incrementing on-chain project ID
  owner:     Address;  // Project creator address
  name:      string;   // Project name (as stored on-chain)
  license:   string;   // SPDX license identifier, e.g. "MIT"
  _log:      unknown;  // Raw viem log for block/tx metadata
}
```

**Example:**

```ts
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { watchProjectCreated } from "@inkd/sdk";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

// Watch all new projects
const unwatch = watchProjectCreated(
  publicClient,
  "0xYourRegistryAddress",
  (event) => {
    console.log(`New project #${event.projectId}: "${event.name}" by ${event.owner}`);
  }
);

// Watch only projects owned by a specific address
const unwatchFiltered = watchProjectCreated(
  publicClient,
  "0xYourRegistryAddress",
  (event) => console.log(event.name),
  { owner: "0xSpecificOwner" }
);

// Stop watching
unwatch();
unwatchFiltered();
```

---

### `watchVersionPushed`

Subscribe to `VersionPushed` events emitted when a new version is pushed to a project.

```ts
function watchVersionPushed(
  publicClient: PublicClient,
  registryAddress: Address,
  onEvent: (event: VersionPushedEvent) => void,
  filter?: VersionPushedFilter
): Unwatch
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `publicClient` | `PublicClient` | Connected viem public client |
| `registryAddress` | `Address` | Address of the deployed InkdRegistry proxy contract |
| `onEvent` | `(event: VersionPushedEvent) => void` | Callback invoked for each matching event |
| `filter` | `VersionPushedFilter?` | Optional filter — `{ projectId?: bigint }` |

**Returns:** `Unwatch` — call to stop the subscription.

**`VersionPushedEvent` shape:**

```ts
interface VersionPushedEvent {
  projectId:    bigint;   // ID of the project that received the version
  arweaveHash:  string;   // Arweave transaction hash of the uploaded artifact
  versionTag:   string;   // Human-readable tag, e.g. "v1.2.0" or "checkpoint-42"
  pushedBy:     Address;  // Address that called pushVersion()
  _log:         unknown;  // Raw viem log
}
```

**Example:**

```ts
// Watch all version pushes across the registry
const unwatch = watchVersionPushed(publicClient, registryAddress, (event) => {
  console.log(`Project #${event.projectId} → ${event.versionTag} (${event.arweaveHash})`);
});

// Watch only versions for a specific project
const unwatchProject42 = watchVersionPushed(
  publicClient,
  registryAddress,
  (event) => console.log("New version:", event.versionTag),
  { projectId: 42n }
);
```

---

### `watchRegistryEvents`

Convenience helper to subscribe to **both** `ProjectCreated` and `VersionPushed` in a single call.

```ts
function watchRegistryEvents(
  publicClient: PublicClient,
  registryAddress: Address,
  handlers: {
    onProjectCreated?:     (event: ProjectCreatedEvent) => void;
    onVersionPushed?:      (event: VersionPushedEvent) => void;
    projectCreatedFilter?: ProjectCreatedFilter;
    versionPushedFilter?:  VersionPushedFilter;
  }
): { unwatchAll: Unwatch }
```

**Returns:** `{ unwatchAll }` — calling `unwatchAll()` stops both subscriptions at once.

**Example:**

```ts
const { unwatchAll } = watchRegistryEvents(publicClient, registryAddress, {
  onProjectCreated: (e) => console.log("Created:", e.name),
  onVersionPushed:  (e) => console.log("Version:", e.versionTag),
  versionPushedFilter: { projectId: 7n },  // Only versions for project 7
});

// Later
unwatchAll();
```

---

## Batch Reads (Multicall)

Import from `@inkd/sdk` or directly from `@inkd/sdk/multicall`:

```ts
import { batchGetProjects, batchGetVersions, batchGetFees, batchGetProjectsWithVersions } from "@inkd/sdk";
```

All batch helpers use **Multicall3** (`0xcA11bde05977b3631167028862bE2a173976CA11`), deployed on both Base and Base Sepolia. This means N project reads = **1 RPC call** instead of N.

Individual results are wrapped in a `BatchResult<T>` shape:

```ts
interface BatchResult<T> {
  data:     T | null;   // Decoded value, or null if the call reverted
  success:  boolean;    // true = call succeeded
  error?:   string;     // Revert reason (only present when success = false)
}
```

---

### `batchGetProjects`

Fetch multiple projects by ID in a **single RPC call**.

```ts
async function batchGetProjects(
  publicClient: PublicClient,
  registryAddress: Address,
  projectIds: bigint[]
): Promise<BatchResult<ProjectData>[]>
```

Projects that don't exist return `{ success: false, data: null }`. Results are in the **same order** as the input `projectIds` array.

**Example:**

```ts
const results = await batchGetProjects(publicClient, registryAddress, [1n, 2n, 3n, 4n, 5n]);

for (const result of results) {
  if (result.success && result.data) {
    console.log(result.data.name, result.data.owner);
  }
}
```

**`ProjectData` shape:**

```ts
interface ProjectData {
  id:             bigint;
  name:           string;
  description:    string;
  license:        string;
  readmeHash:     string;
  owner:          Address;
  isPublic:       boolean;
  isAgent:        boolean;
  agentEndpoint:  string;
  createdAt:      bigint;
  versionCount:   bigint;
  exists:         boolean;
}
```

---

### `batchGetVersions`

Fetch all versions for multiple projects in a **single RPC call**.

```ts
async function batchGetVersions(
  publicClient: PublicClient,
  registryAddress: Address,
  projectIds: bigint[]
): Promise<BatchResult<VersionData[]>[]>
```

**Example:**

```ts
const results = await batchGetVersions(publicClient, registryAddress, [1n, 2n, 3n]);

for (const result of results) {
  if (result.success && result.data) {
    console.log(`${result.data.length} versions`);
  }
}
```

---

### `batchGetFees`

Fetch `versionFee`, `transferFee`, and `TOKEN_LOCK_AMOUNT` in a **single RPC call**.

```ts
async function batchGetFees(
  publicClient: PublicClient,
  registryAddress: Address
): Promise<RegistryFees>
```

Throws if any of the three calls reverts (should never happen on a valid registry deployment).

**`RegistryFees` shape:**

```ts
interface RegistryFees {
  versionFee:       bigint;  // Wei required to push a new version
  transferFee:      bigint;  // Wei required to transfer project ownership
  tokenLockAmount:  bigint;  // $INKD tokens locked per project on creation
}
```

**Example:**

```ts
const { versionFee, transferFee, tokenLockAmount } = await batchGetFees(
  publicClient,
  registryAddress
);

console.log("Version fee:", formatEther(versionFee), "ETH");
console.log("Transfer fee:", formatEther(transferFee), "ETH");
console.log("Lock amount:", formatUnits(tokenLockAmount, 18), "INKD");
```

---

### `batchGetProjectsWithVersions`

Hydrate multiple projects **and** their versions in **two RPC calls** (one projects batch + one versions batch) instead of `2N` individual calls.

```ts
async function batchGetProjectsWithVersions(
  publicClient: PublicClient,
  registryAddress: Address,
  projectIds: bigint[]
): Promise<Array<{
  project:  BatchResult<ProjectData>;
  versions: BatchResult<VersionData[]>;
}>>
```

**Example:**

```ts
const hydrated = await batchGetProjectsWithVersions(
  publicClient,
  registryAddress,
  [1n, 2n, 3n]
);

for (const { project, versions } of hydrated) {
  if (project.success && project.data) {
    console.log(project.data.name, "—", versions.data?.length ?? 0, "versions");
  }
}
```

---

## React Hooks

```typescript
import { useInkd, useProject, useProjectVersions, useOwnerProjects } from "@inkd/sdk/react";
```

### `useInkd(config)`

Full client with wallet integration.

```tsx
const { inkd, connected, connect } = useInkd({
  tokenAddress:    "0x...",
  registryAddress: "0x...",
  treasuryAddress: "0x...",
  chainId: 84532,
});
```

### `useProject(projectId)`

Fetch and subscribe to a project.

```tsx
const { project, loading, error } = useProject(1n);

if (loading) return <Spinner />;
if (error) return <Error message={error.message} />;

return <div>{project.name} — {project.versionCount.toString()} versions</div>;
```

### `useProjectVersions(projectId)`

Fetch all versions for a project.

```tsx
const { versions, loading } = useProjectVersions(1n);

return (
  <ul>
    {versions.map((v, i) => (
      <li key={i}>{v.versionTag} — {v.changelog}</li>
    ))}
  </ul>
);
```

### `useOwnerProjects(owner?)`

Fetch projects owned by an address.

```tsx
const { projectIds, loading } = useOwnerProjects(); // connected wallet

return <p>You own {projectIds.length} projects</p>;
```

---

## Full Examples

### Create a Project and Push a Version

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

  const inkd = new InkdClient({
    tokenAddress:    "0xINKD_TOKEN",
    registryAddress: "0xINKD_REGISTRY",
    treasuryAddress: "0xINKD_TREASURY",
    chainId: 84532,
  });

  inkd.connect(walletClient, publicClient);

  // Check balance
  const balance = await inkd.getInkdBalance();
  console.log("$INKD balance:", formatEther(balance));

  // Approve 1 $INKD
  console.log("Approving $INKD...");
  await inkd.approveInkdForRegistry();

  // Create project
  console.log("Creating project...");
  const { projectId } = await inkd.createProject({
    name: "my-autonomous-agent",
    description: "An AI agent that trades on Base",
    license: "MIT",
    isPublic: true,
    readmeHash: "",
    isAgent: true,
    agentEndpoint: "https://agent.example.com/api/v1",
  });

  console.log("Project ID:", projectId.toString());

  // Push first version
  console.log("Pushing v0.1.0...");
  const { hash } = await inkd.pushVersion(projectId, {
    arweaveHash: "arweave-tx-id-of-your-upload",
    versionTag: "v0.1.0",
    changelog: "Initial release — basic trading logic",
  });

  console.log("Version pushed! TX:", hash);

  // Read it back
  const project = await inkd.getProject(projectId);
  console.log("Project:", project.name, "— versions:", project.versionCount.toString());
}

main().catch(console.error);
```

---

### Multi-Agent Collaboration

```typescript
// Agent A creates project and adds Agent B as collaborator
const { projectId } = await inkdA.createProject({ name: "shared-memory", ... });
await inkdA.addCollaborator(projectId, agentBAddress);

// Agent B can now push versions (but not transfer or add collaborators)
await inkdB.pushVersion(projectId, {
  arweaveHash: "agentB-memory-snapshot",
  versionTag: "v0.2.0",
  changelog: "Agent B added trading strategy memory",
});

// Agent A removes Agent B when done
await inkdA.removeCollaborator(projectId, agentBAddress);
```

---

### Iterate All Versions

```typescript
const count = await inkd.getVersionCount(projectId);
const allVersions = [];

for (let i = 0n; i < count; i++) {
  const version = await inkd.getVersion(projectId, i);
  allVersions.push(version);
}

// Or use the helper
const allVersions = await inkd.getAllVersions(projectId);

// Latest version
const latest = allVersions[allVersions.length - 1];
console.log("Latest:", latest.versionTag, "—", latest.arweaveHash);
```

---

### Discover Agent Projects

```typescript
// Paginate through all agent projects
let offset = 0n;
const limit = 10n;
let agents = [];

while (true) {
  const page = await inkd.getAgentProjects(offset, limit);
  if (page.length === 0) break;
  agents = agents.concat(page);
  offset += limit;
}

console.log(`Found ${agents.length} agent projects`);
agents.forEach(a => {
  console.log(`  - ${a.name} (${a.agentEndpoint})`);
});
```

---

## Changelog

| Version | Changes |
|---------|---------|
| `0.2.0` | Event subscriptions (`watchProjectCreated`, `watchVersionPushed`, `watchRegistryEvents`) |
| `0.2.0` | Batch reads via Multicall3 (`batchGetProjects`, `batchGetVersions`, `batchGetFees`, `batchGetProjectsWithVersions`) |
| `0.1.0` | Initial release — InkdClient, TypeScript types, React hooks |

---

*SDK Reference — Inkd Protocol — March 2026*
