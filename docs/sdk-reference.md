# SDK Reference

Complete API reference for `@inkd/sdk`.

```bash
npm install @inkd/sdk viem
```

---

## Table of Contents

- [InkdClient](#inkdclient)
  - [Constructor](#constructor)
  - [Token Methods](#token-methods)
  - [Project Methods](#project-methods)
  - [Version Methods](#version-methods)
  - [Discovery Methods](#discovery-methods)
- [React Hooks](#react-hooks)
- [Types](#types)
- [Error Classes](#error-classes)
- [ArweaveClient](#arweaveclient)
- [Contract Addresses](#contract-addresses)

---

## InkdClient

The primary entrypoint for interacting with Inkd Protocol contracts.

### Import

```typescript
import { InkdClient } from "@inkd/sdk";
```

### Constructor

```typescript
new InkdClient(options: InkdClientOptions): InkdClient
```

```typescript
interface InkdClientOptions {
  /** Viem WalletClient (signer). Required for write operations. */
  walletClient: WalletClient;

  /** Network to connect to. Default: "testnet". */
  network?: "mainnet" | "testnet";

  /** Custom RPC URL. Defaults to the public Base RPC. */
  rpcUrl?: string;
}
```

**Example:**

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Server-side / Node.js
const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const inkd = new InkdClient({ walletClient, network: "testnet" });

// Browser / wagmi
import { useWalletClient } from "wagmi";
const { data: walletClient } = useWalletClient();
const inkd = new InkdClient({ walletClient: walletClient!, network: "mainnet" });
```

---

## Token Methods

### `approveToken(amount?)`

```typescript
async approveToken(amount?: bigint): Promise<Hash>
```

Approve the `InkdRegistry` to spend $INKD from your wallet. Must be called before `createProject()`.

Default `amount` is `parseEther("1")` (exactly 1 $INKD). Pass a larger value to batch-approve for multiple future projects.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `amount` | `bigint` | `1000000000000000000n` | Amount of $INKD to approve (in wei) |

**Returns:** Transaction hash

**Example:**

```typescript
// Approve for 1 project
const tx = await inkd.approveToken();

// Pre-approve for 10 projects
const tx = await inkd.approveToken(parseEther("10"));
```

---

### `tokenBalance(address?)`

```typescript
async tokenBalance(address?: Address): Promise<bigint>
```

Get the $INKD balance of an address. Defaults to the connected wallet's address.

**Returns:** Balance in wei (divide by `1e18` for human-readable INKD)

**Example:**

```typescript
const balance = await inkd.tokenBalance();
console.log(`${Number(balance) / 1e18} INKD`);

// Check another address
const theirBalance = await inkd.tokenBalance("0xSomeAddress");
```

---

## Project Methods

### `createProject(opts)`

```typescript
async createProject(opts: CreateProjectOptions): Promise<Hash>
```

```typescript
interface CreateProjectOptions {
  /** Project name. Lowercased on-chain. Must be globally unique. */
  name: string;

  /** Project description. */
  description: string;

  /** SPDX license identifier. Default: "MIT". */
  license?: string;

  /** Arweave transaction ID of the README. Default: "". */
  readmeHash?: string;

  /** Whether the project is publicly discoverable. Default: true. */
  isPublic?: boolean;

  /** Whether this is an AI agent tool. Default: false. */
  isAgent?: boolean;

  /** API endpoint for agent discovery. Only used if isAgent = true. */
  agentEndpoint?: string;
}
```

Create a new project, locking 1 $INKD. Call `approveToken()` first.

**Returns:** Transaction hash

**Throws:**
- ERC-20 error if insufficient balance or allowance
- Contract reverts with `NameTaken`, `EmptyName` (see [errors](#error-classes))

**Example:**

```typescript
// Standard project
const tx = await inkd.createProject({
  name: "my-library",
  description: "A TypeScript utility library",
  license: "MIT",
  isPublic: true,
});

// AI agent tool
const agentTx = await inkd.createProject({
  name: "gpt-pr-reviewer",
  description: "Reviews pull requests and suggests improvements",
  license: "Apache-2.0",
  isPublic: true,
  isAgent: true,
  agentEndpoint: "https://api.example.com/v1/review",
});
```

---

### `getProject(projectId)`

```typescript
async getProject(projectId: bigint): Promise<Project>
```

Fetch full project data by ID.

**Returns:** [`Project`](#project) struct

**Example:**

```typescript
const project = await inkd.getProject(1n);
console.log(project.name);        // "my-library"
console.log(project.owner);       // "0x..."
console.log(project.versionCount); // 3n
console.log(project.exists);      // true (false if ID not found)
```

---

### `getOwnerProjects(address)`

```typescript
async getOwnerProjects(address: Address): Promise<readonly bigint[]>
```

Get all project IDs owned by an address.

**Example:**

```typescript
const [myAddress] = await walletClient.getAddresses();
const projectIds = await inkd.getOwnerProjects(myAddress);
// [1n, 5n, 12n]

const projects = await Promise.all(
  projectIds.map((id) => inkd.getProject(id))
);
```

---

### `transferProject(projectId, newOwner)`

```typescript
async transferProject(projectId: bigint, newOwner: Address): Promise<Hash>
```

Transfer project ownership. Costs `transferFee` ETH (default: 0.005 ETH). The fee is fetched automatically from the contract.

**Returns:** Transaction hash

**Example:**

```typescript
const tx = await inkd.transferProject(1n, "0xNewOwnerAddress");
```

---

### `addCollaborator(projectId, collaborator)`

```typescript
async addCollaborator(projectId: bigint, collaborator: Address): Promise<Hash>
```

Grant an address permission to push versions. Owner only. Gas only — no ETH fee.

**Returns:** Transaction hash

**Example:**

```typescript
await inkd.addCollaborator(1n, "0xCollaboratorAddress");
```

---

## Version Methods

### `pushVersion(projectId, opts)`

```typescript
async pushVersion(
  projectId: bigint,
  opts: PushVersionOptions
): Promise<Hash>
```

```typescript
interface PushVersionOptions {
  /** Arweave transaction ID of the uploaded content. */
  arweaveHash: string;

  /** Version label. Semver recommended: "1.0.0", "2.0.0-beta.1". */
  versionTag: string;

  /** Human-readable changelog for this version. Default: "". */
  changelog?: string;
}
```

Push a new version. Costs `versionFee` ETH (default: 0.001 ETH). Fee is fetched from the contract automatically.

**Returns:** Transaction hash

**Throws:** Contract revert if insufficient fee, not owner/collaborator, or project not found.

**Example:**

```typescript
const tx = await inkd.pushVersion(1n, {
  arweaveHash: "7nZsLsGtYfaXvbq3JkMpTnHrWdCeAiBsKoU9fQvXmgE",
  versionTag: "2.1.0",
  changelog: "Fixed memory leak in stream handler. Added retry logic.",
});
```

---

### `getVersions(projectId)`

```typescript
async getVersions(projectId: bigint): Promise<readonly Version[]>
```

Get all versions for a project.

**Returns:** Array of [`Version`](#version) objects, ordered by push time (oldest first).

**Example:**

```typescript
const versions = await inkd.getVersions(1n);

for (const v of versions) {
  const url = `https://arweave.net/${v.arweaveHash}`;
  console.log(`[${v.versionTag}] ${url}`);
  console.log(`  By: ${v.pushedBy}`);
  console.log(`  At: ${new Date(Number(v.pushedAt) * 1000).toISOString()}`);
  console.log(`  ${v.changelog}`);
}
```

---

### `getVersionFee()`

```typescript
async getVersionFee(): Promise<bigint>
```

Get the current ETH cost to push a version.

**Example:**

```typescript
const fee = await inkd.getVersionFee();
console.log(`Version fee: ${Number(fee) / 1e18} ETH`);
// Version fee: 0.001 ETH
```

---

## Discovery Methods

### `getAgentProjects(offset, limit)`

```typescript
async getAgentProjects(
  offset?: bigint,
  limit?: bigint
): Promise<readonly bigint[]>
```

Discover all registered AI agent projects. Paginated.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `offset` | `0n` | Number of results to skip |
| `limit` | `100n` | Max results to return |

**Returns:** Array of project IDs for agent projects.

**Example:**

```typescript
// Get all agent tools (first page)
const agentIds = await inkd.getAgentProjects(0n, 50n);

// Fetch their details
const agents = await Promise.all(
  agentIds.map((id) => inkd.getProject(id))
);

for (const agent of agents) {
  console.log(`${agent.name}: ${agent.agentEndpoint}`);
}

// Next page
const page2 = await inkd.getAgentProjects(50n, 50n);
```

---

## React Hooks

### `useInkd(config)`

```typescript
function useInkd(config: InkdClientConfig): UseInkdReturn
```

```typescript
interface InkdClientConfig {
  tokenAddress: Address;
  vaultAddress: Address;
  registryAddress: Address;
  chainId: 8453 | 84532;
}

interface UseInkdReturn {
  client: InkdClient;
  connected: boolean;
  connect: (walletClient: WalletClient, publicClient: PublicClient) => void;
  connectArweave: (privateKey: string) => Promise<void>;
  mintToken: (quantity?: number) => Promise<TransactionResult>;
  inscribe: (tokenId: bigint, data: Buffer | Uint8Array | string, options?: InscribeOptions) => Promise<InscribeResult>;
  getToken: (tokenId: bigint) => Promise<InkdTokenData>;
  getInscriptions: (tokenId: bigint) => Promise<Inscription[]>;
  hasInkdToken: (address: Address) => Promise<boolean>;
  getStats: () => Promise<ProtocolStats>;
  error: Error | null;
}
```

Main React hook for Inkd Protocol. Manages client state, connection, and error handling.

**Example:**

```tsx
import { useInkd } from "@inkd/sdk";
import { usePublicClient, useWalletClient } from "wagmi";

function InkdDashboard() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const {
    client,
    connected,
    connect,
    mintToken,
    inscribe,
    getInscriptions,
    error,
  } = useInkd({
    tokenAddress: "0xTOKEN_ADDRESS",
    vaultAddress: "0xVAULT_ADDRESS",
    registryAddress: "0xREGISTRY_ADDRESS",
    chainId: 84532, // Base Sepolia
  });

  useEffect(() => {
    if (walletClient && publicClient) {
      connect(walletClient, publicClient);
    }
  }, [walletClient, publicClient]);

  const handleMint = async () => {
    const { tokenId } = await mintToken();
    console.log("Minted:", tokenId);
  };

  return (
    <div>
      <p>Connected: {connected ? "yes" : "no"}</p>
      {error && <p>Error: {error.message}</p>}
      <button onClick={handleMint}>Mint InkdToken</button>
    </div>
  );
}
```

---

### `useToken(client, tokenId)`

```typescript
function useToken(client: InkdClient, tokenId: bigint): UseTokenReturn

interface UseTokenReturn {
  token: InkdTokenData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

Fetches token data with loading state. Re-fetches when `tokenId` changes.

**Example:**

```tsx
const { token, loading, refetch } = useToken(client, 42n);

if (loading) return <p>Loading...</p>;
return (
  <div>
    <p>Owner: {token?.owner}</p>
    <p>Inscriptions: {token?.inscriptionCount}</p>
    <button onClick={refetch}>Refresh</button>
  </div>
);
```

---

### `useInscriptions(client, tokenId)`

```typescript
function useInscriptions(client: InkdClient, tokenId: bigint): UseInscriptionsReturn

interface UseInscriptionsReturn {
  inscriptions: Inscription[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  activeCount: number; // count of non-removed inscriptions
}
```

**Example:**

```tsx
const { inscriptions, activeCount, loading } = useInscriptions(client, tokenId);

return (
  <ul>
    {inscriptions
      .filter((i) => !i.isRemoved)
      .map((i, idx) => (
        <li key={idx}>
          <a href={`https://arweave.net/${i.arweaveHash}`}>{i.name}</a>
          <span>{i.contentType}</span>
        </li>
      ))}
  </ul>
);
```

---

### `useInkdHolder(client, address)`

```typescript
function useInkdHolder(client: InkdClient, address: Address): UseInkdHolderReturn

interface UseInkdHolderReturn {
  isHolder: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

Gate content or features to InkdToken holders.

**Example:**

```tsx
const { isHolder, loading } = useInkdHolder(client, userAddress);

if (loading) return null;
if (!isHolder) return <p>You need an InkdToken to access this.</p>;
return <PremiumContent />;
```

---

## Types

### `Project`

```typescript
interface Project {
  id: bigint;
  name: string;
  description: string;
  license: string;
  readmeHash: string;
  agentEndpoint: string;
  owner: Address;
  isAgent: boolean;
  isPublic: boolean;
  createdAt: bigint;    // Unix timestamp
  versionCount: bigint;
  exists: boolean;
}
```

### `Version`

```typescript
interface Version {
  projectId: bigint;
  arweaveHash: string; // Arweave transaction ID
  versionTag: string;
  changelog: string;
  pushedBy: Address;
  pushedAt: bigint;   // Unix timestamp
}
```

### `InkdTokenData`

```typescript
interface InkdTokenData {
  tokenId: bigint;
  owner: Address;
  mintedAt: bigint;
  inscriptionCount: number;
  tokenURI: string; // on-chain SVG metadata URI
}
```

### `Inscription`

```typescript
interface Inscription {
  arweaveHash: string;  // Arweave transaction ID
  contentType: string;  // MIME type
  size: bigint;         // bytes
  name: string;         // human-readable label
  createdAt: bigint;    // Unix timestamp
  isRemoved: boolean;   // soft-deleted flag
  version: bigint;      // update count
}
```

### `ProtocolStats`

```typescript
interface ProtocolStats {
  totalTokens: bigint;
  totalInscriptions: bigint;
  totalVolume: bigint; // total ETH in wei through marketplace
  totalSales: bigint;
}
```

### `InscribeOptions`

```typescript
interface InscribeOptions {
  contentType?: string;          // MIME type. Default: "application/octet-stream"
  name?: string;                 // Human label. Default: "inscription-{timestamp}"
  tags?: Record<string, string>; // Extra Arweave upload tags
  value?: bigint;                // ETH value for protocol fee
}
```

### `TransactionResult`

```typescript
interface TransactionResult {
  hash: Address;        // Transaction hash
  tokenId?: bigint;     // If applicable
}
```

### `InscribeResult`

```typescript
interface InscribeResult {
  hash: Address;           // On-chain transaction hash
  inscriptionIndex: bigint; // Index of inscription on token
  upload: UploadResult;    // Arweave upload details
}

interface UploadResult {
  hash: string;   // Arweave transaction ID
  url: string;    // Full gateway URL: https://arweave.net/{hash}
  size: number;   // Bytes uploaded
}
```

### `ContentType` enum

```typescript
enum ContentType {
  JSON        = "application/json",
  PlainText   = "text/plain",
  Markdown    = "text/markdown",
  HTML        = "text/html",
  JavaScript  = "application/javascript",
  TypeScript  = "application/typescript",
  PNG         = "image/png",
  JPEG        = "image/jpeg",
  SVG         = "image/svg+xml",
  GIF         = "image/gif",
  WebP        = "image/webp",
  PDF         = "application/pdf",
  Binary      = "application/octet-stream",
  YAML        = "application/yaml",
  WASM        = "application/wasm",
}
```

---

## Error Classes

All errors extend `InkdError` which extends `Error`. Each has a `.code` string for programmatic handling.

```typescript
import {
  InkdError,
  ClientNotConnected,
  ArweaveNotConnected,
  NotInkdHolder,
  InsufficientFunds,
  TokenNotFound,
  InscriptionNotFound,
  NotTokenOwner,
  TransactionFailed,
  MaxSupplyReached,
  EncryptionError,
  UploadError,
} from "@inkd/sdk";
```

### Handling Errors

```typescript
try {
  await inkd.createProject({ name: "test", description: "..." });
} catch (err) {
  if (err instanceof InkdError) {
    switch (err.code) {
      case "CLIENT_NOT_CONNECTED":
        // Call inkd.connect() first
        break;
      case "INSUFFICIENT_FUNDS":
        const e = err as InsufficientFunds;
        console.log(`Need ${e.required} wei, have ${e.available} wei`);
        break;
      default:
        console.error(`Inkd error [${err.code}]: ${err.message}`);
    }
  }
}
```

### Error Reference

| Class | Code | Thrown When |
|-------|------|-------------|
| `ClientNotConnected` | `CLIENT_NOT_CONNECTED` | `connect()` not called |
| `ArweaveNotConnected` | `ARWEAVE_NOT_CONNECTED` | `connectArweave()` not called |
| `NotInkdHolder` | `NOT_INKD_HOLDER` | Address holds no InkdToken |
| `InsufficientFunds` | `INSUFFICIENT_FUNDS` | Balance too low |
| `TokenNotFound` | `TOKEN_NOT_FOUND` | Token ID doesn't exist |
| `InscriptionNotFound` | `INSCRIPTION_NOT_FOUND` | Invalid inscription index |
| `NotTokenOwner` | `NOT_TOKEN_OWNER` | Caller doesn't own the token |
| `TransactionFailed` | `TRANSACTION_FAILED` | On-chain tx reverted |
| `MaxSupplyReached` | `MAX_SUPPLY_REACHED` | NFT mint cap hit |
| `EncryptionError` | `ENCRYPTION_ERROR` | Lit Protocol failure |
| `UploadError` | `UPLOAD_ERROR` | Arweave upload failure |

---

## ArweaveClient

Lower-level Arweave integration using Irys. Used internally by `InkdClient.inscribe()`.

```typescript
import { ArweaveClient } from "@inkd/sdk";

const arweave = new ArweaveClient(
  "https://node2.irys.xyz",  // Irys node URL
  "0xYOUR_PRIVATE_KEY",      // Ethereum private key for Irys auth
  "https://arweave.net"      // Arweave gateway (default)
);

await arweave.connect();
```

### Methods

#### `uploadFile(data, contentType, tags?) → UploadResult`

Upload raw bytes to Arweave.

```typescript
const result = await arweave.uploadFile(
  Buffer.from('{"hello": "world"}'),
  "application/json",
  { "Project": "my-project", "Version": "1.0.0" }
);
console.log(result.hash); // Arweave tx ID
console.log(result.url);  // https://arweave.net/{hash}
```

#### `downloadData(hash) → Buffer`

Fetch data from Arweave by transaction ID.

```typescript
const data = await arweave.downloadData("AbC123...");
const parsed = JSON.parse(data.toString());
```

#### `getUploadPrice(bytes) → bigint`

Get the price to upload `bytes` bytes, in wei.

```typescript
const price = await arweave.getUploadPrice(1024 * 100); // 100KB
console.log(`Cost: ${Number(price) / 1e18} ETH`);
```

#### `getUrl(hash) → string`

Get the full gateway URL for an Arweave hash.

```typescript
const url = arweave.getUrl("AbC123...");
// "https://arweave.net/AbC123..."
```

---

## Contract Addresses

```typescript
import { ADDRESSES } from "@inkd/sdk";

console.log(ADDRESSES.mainnet.token);    // Base mainnet InkdToken
console.log(ADDRESSES.mainnet.registry); // Base mainnet InkdRegistry
console.log(ADDRESSES.mainnet.treasury); // Base mainnet InkdTreasury

console.log(ADDRESSES.testnet.token);    // Base Sepolia InkdToken
console.log(ADDRESSES.testnet.registry); // Base Sepolia InkdRegistry
console.log(ADDRESSES.testnet.treasury); // Base Sepolia InkdTreasury
```

> Addresses are bundled in the SDK and updated with each release. Always use the latest SDK version for correct addresses post-mainnet launch.
