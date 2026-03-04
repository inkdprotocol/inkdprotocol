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
- [AgentVault](#agentvault)
  - [Overview](#overview-1)
  - [Installation](#installation-1)
  - [Constructor](#constructor)
  - [seal](#seal)
  - [unseal](#unseal)
  - [store](#store)
  - [load](#load)
  - [Full Vault Example](#full-vault-example)
- [Types](#types)
- [Error Handling](#error-handling)
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

---

## AgentVault

### Overview

`AgentVault` is a wallet-key encrypted credential store for AI agents. It lets an agent seal its secrets (API keys, private keys, Arweave JWKs, bearer tokens) into an encrypted binary blob using ECIES, then optionally persist them on Arweave. Only the wallet that sealed the vault can unseal it.

**Encryption stack:**
- **Key agreement:** ECDH over secp256k1 with an ephemeral keypair
- **Key derivation:** HKDF-SHA256 over the ECDH shared secret
- **Symmetric encryption:** AES-256-GCM (authenticated — tamper-evident)

Binary blob layout:

```
[33 bytes] ephemeral compressed secp256k1 public key
[12 bytes] AES-GCM IV (nonce)
[16 bytes] AES-GCM authentication tag  ← appended by @noble/ciphers
[N  bytes] ciphertext
```

Because each `seal()` generates a fresh ephemeral keypair and random IV, two calls with identical input produce different ciphertexts (semantic security).

### Installation

AgentVault ships inside `@inkd/sdk`. No additional install needed, but it depends on `@noble/curves` and `@noble/ciphers` — both are direct dependencies of the SDK.

```bash
npm install @inkd/sdk
```

```typescript
import { AgentVault } from "@inkd/sdk";
```

### Constructor

```typescript
const vault = new AgentVault(privateKey: `0x${string}`)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `privateKey` | `` `0x${string}` `` | 32-byte (64 hex char) EVM private key |

**Throws** `EncryptionError` if the key is not exactly 32 bytes.

```typescript
const vault = new AgentVault(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
```

> ⚠️ Never hard-code private keys. Load from environment variables or a secrets manager.

---

### seal

```typescript
vault.seal(credentials: Record<string, unknown>): Promise<Uint8Array>
```

Encrypts a JSON-serialisable object with the vault's wallet public key.

| Parameter | Type | Description |
|-----------|------|-------------|
| `credentials` | `Record<string, unknown>` | Any JSON-serialisable object |

**Returns** `Promise<Uint8Array>` — binary blob ready for Arweave upload or local storage.

```typescript
const encrypted = await vault.seal({
  openaiKey:   "sk-proj-...",
  anthropicKey: "sk-ant-...",
  arweaveJwk:  { kty: "RSA", n: "...", e: "AQAB", /* ... */ },
  balance:     42.5,
});

// encrypted is a Uint8Array — store it however you like
await fs.writeFile("vault.bin", encrypted);
```

---

### unseal

```typescript
vault.unseal(encrypted: Uint8Array): Promise<Record<string, unknown>>
```

Decrypts a blob previously sealed by this vault's private key.

| Parameter | Type | Description |
|-----------|------|-------------|
| `encrypted` | `Uint8Array` | Binary blob from `seal()` or `load()` |

**Returns** `Promise<Record<string, unknown>>` — the original credentials object.

**Throws** `EncryptionError` if:
- The blob is too short (corrupted or wrong format)
- The ephemeral public key is invalid
- The AES-GCM auth tag fails (wrong key or tampered data)
- The decrypted bytes are not valid JSON

```typescript
const creds = await vault.unseal(encrypted) as {
  openaiKey: string;
  anthropicKey: string;
};

// Use your decrypted credentials
const openai = new OpenAI({ apiKey: creds.openaiKey });
```

---

### store

```typescript
vault.store(
  credentials: Record<string, unknown>,
  arweave: ArweaveClient
): Promise<string>
```

Seals credentials and uploads the encrypted blob to Arweave in one call.

| Parameter | Type | Description |
|-----------|------|-------------|
| `credentials` | `Record<string, unknown>` | Credentials to encrypt and store |
| `arweave` | `ArweaveClient` | Connected Arweave client from `vault.connectArweave()` |

**Returns** `Promise<string>` — Arweave hash in `ar://` format (e.g. `ar://Qm...`).

Tags written: `Inkd-Vault: true`, `Inkd-Version: 1`

```typescript
const inkd = new InkdClient({ /* ... */ });
await inkd.connectArweave(arweaveJwk);

const vaultHash = await vault.store(
  { openaiKey: "sk-...", balance: 1.0 },
  inkd.arweave
);

console.log("Vault stored at:", vaultHash);
// ar://QmXyz...
```

---

### load

```typescript
vault.load(
  arweaveHash: string,
  arweave: ArweaveClient
): Promise<Record<string, unknown>>
```

Fetches an encrypted blob from Arweave and unseals it.

| Parameter | Type | Description |
|-----------|------|-------------|
| `arweaveHash` | `string` | `ar://Qm...` hash or raw Arweave transaction ID |
| `arweave` | `ArweaveClient` | Connected Arweave client |

**Returns** `Promise<Record<string, unknown>>` — the original credentials object.

```typescript
// Load by ar:// hash
const creds = await vault.load("ar://QmXyz...", inkd.arweave);

// Or with a bare transaction ID
const creds = await vault.load("QmXyz...", inkd.arweave);
```

---

### Full Vault Example

End-to-end: seal → store → load → unseal, with an `InkdClient` providing the Arweave connection.

```typescript
import { InkdClient, AgentVault } from "@inkd/sdk";

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const ARWEAVE_JWK = JSON.parse(process.env.ARWEAVE_JWK!);

async function storeAgentSecrets() {
  // Set up the Inkd client with Arweave
  const inkd = new InkdClient({
    tokenAddress:    "0x...",
    registryAddress: "0x...",
    treasuryAddress: "0x...",
    chainId: 84532,
  });
  await inkd.connectArweave(ARWEAVE_JWK);

  // Create a vault from the agent's wallet key
  const vault = new AgentVault(PRIVATE_KEY);

  // Seal and store on Arweave
  const vaultHash = await vault.store(
    {
      openaiKey:    "sk-proj-abc123",
      anthropicKey: "sk-ant-xyz789",
      arweaveJwk:   ARWEAVE_JWK,
      config: { model: "claude-opus-4", maxTokens: 8192 },
    },
    inkd.arweave
  );

  console.log("Vault on Arweave:", vaultHash);
  // e.g. ar://QmABCDEFGH...

  // Later, in another session: retrieve and unseal
  const creds = await vault.load(vaultHash, inkd.arweave) as {
    openaiKey: string;
    anthropicKey: string;
    config: { model: string; maxTokens: number };
  };

  console.log("Loaded model config:", creds.config.model);
}
```

#### Cross-agent credential sharing

Because ECIES encrypts to a *public key*, you can seal credentials for a different agent's wallet:

```typescript
const myVault = new AgentVault(MY_PRIVATE_KEY);

// Encrypt a handoff package specifically for agent B's public key
// (Create a vault from agent B's address by using their known private key, OR
//  send via the Inkd Protocol x402 handoff API — see HTTP_API.md)

// To seal FOR your own key (most common — self-custody):
const encrypted = await myVault.seal({ handoffToken: "xyz", taskId: "42" });
// Only MY_PRIVATE_KEY can unseal this
```

---

## Changelog

| Version | Changes |
|---------|---------|
| `0.1.0` | Initial release — InkdClient, TypeScript types, React hooks |
| `0.2.0` | Event subscriptions (`watchEvent` wrappers), Multicall3 batch reads |
| `0.10.0` | LitEncryptionProvider, InkdClient.connectArweave, full SDK test suite |
| `0.10.8` | AgentVault — ECIES wallet-key credential storage (seal/unseal/store/load) |

---

*SDK Reference — Inkd Protocol — March 2026*
