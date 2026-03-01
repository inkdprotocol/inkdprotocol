# Inkd Protocol -- API Reference

Complete SDK reference for `@inkd/sdk`.

---

## Table of Contents

- [InkdClient](#inkdclient)
- [ArweaveClient](#arweaveclient)
- [AgentMemory](#agentmemory)
- [Encryption](#encryption)
- [React Hooks](#react-hooks)
- [Errors](#errors)
- [Types](#types)

---

## InkdClient

Main client for interacting with all three Inkd contracts.

### Constructor

```typescript
new InkdClient(config: InkdClientConfig)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.tokenAddress` | `` `0x${string}` `` | InkdToken proxy address |
| `config.vaultAddress` | `` `0x${string}` `` | InkdVault proxy address |
| `config.registryAddress` | `` `0x${string}` `` | InkdRegistry proxy address |
| `config.chainId` | `8453 \| 84532` | Base Mainnet or Base Sepolia |

### Connection Methods

#### `connect(walletClient, publicClient)`

Connect viem clients for on-chain interaction.

```typescript
inkd.connect(walletClient, publicClient);
```

#### `connectArweave(privateKey)`

Connect Arweave storage client for file uploads via Irys.

```typescript
await inkd.connectArweave("0xPrivateKey");
```

#### `setEncryptionProvider(provider)`

Set a custom encryption provider (V2 Lit Protocol).

```typescript
inkd.setEncryptionProvider(litProvider);
```

### Token Operations

#### `mintToken(options?) -> { hash, tokenId }`

Mint a new InkdToken. Pays the configured mint price.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.quantity` | `number?` | Batch mint quantity (max 10) |

```typescript
const { tokenId } = await inkd.mintToken();
const { tokenId } = await inkd.mintToken({ quantity: 5 }); // batch
```

#### `getToken(tokenId) -> InkdTokenData`

Get full token data.

```typescript
const token = await inkd.getToken(42n);
// {
//   tokenId: 42n,
//   owner: "0x...",
//   mintedAt: 1709251200n,
//   inscriptionCount: 7n,
//   uri: "data:application/json;base64,..."
// }
```

#### `getTokensByOwner(address) -> InkdTokenData[]`

Get all tokens owned by an address.

#### `hasInkdToken(address) -> boolean`

Check if an address holds at least one InkdToken.

### Inscription Operations

#### `inscribe(tokenId, data, options?) -> InscribeResult`

Upload data to Arweave and inscribe on token.

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenId` | `bigint` | Token to inscribe on |
| `data` | `Buffer \| Uint8Array \| string` | File data |
| `options.contentType` | `string?` | MIME type (default: `application/octet-stream`) |
| `options.name` | `string?` | Human-readable name |
| `options.value` | `bigint?` | ETH value to send |

**Returns**: `{ hash, inscriptionIndex, upload: { hash, url, size } }`

#### `getInscriptions(tokenId) -> Inscription[]`

Get all inscriptions on a token.

```typescript
const inscriptions = await inkd.getInscriptions(42n);
// [{
//   arweaveHash: "abc123...",
//   contentType: "application/json",
//   size: 1024n,
//   name: "memory-001",
//   createdAt: 1709251200n,
//   isRemoved: false,
//   version: 1n
// }]
```

#### `removeInscription(tokenId, index) -> { hash }`

Soft-delete an inscription. Data remains on Arweave but is flagged as removed on-chain.

#### `updateInscription(tokenId, index, newData, contentType?) -> { hash }`

Create a new version of an inscription. Uploads new data to Arweave.

### Access Operations

#### `grantAccess(tokenId, grantee, duration) -> { hash }`

Grant temporary read access. `duration` is in seconds.

```typescript
await inkd.grantAccess(42n, "0xAgent2" as `0x${string}`, 86400); // 24 hours
```

#### `revokeAccess(tokenId, grantee) -> { hash }`

Revoke a previously granted access.

### Marketplace Operations

#### `listForSale(tokenId, price) -> { hash }`

List a token for sale on InkdRegistry.

#### `buyToken(tokenId) -> { hash }`

Purchase a listed token. Sends the listing price automatically.

### Utility

#### `estimateInscribeCost(fileSize) -> InscribeCostEstimate`

Estimate the cost to inscribe a file.

```typescript
const cost = await inkd.estimateInscribeCost(1024);
// { arweaveCost: 100000n, protocolFee: 1000n, totalCost: 101000n }
```

#### `getStats() -> ProtocolStats`

Get protocol-wide statistics.

```typescript
const stats = await inkd.getStats();
// { totalTokens: 150n, totalInscriptions: 2340n, totalVolume: 5000000n, totalSales: 47n }
```

---

## ArweaveClient

Direct Arweave interaction via Irys.

### Constructor

```typescript
new ArweaveClient(irysUrl: string, privateKey: string, gateway?: string)
```

### Methods

#### `connect()`

Initialize Irys client. Must be called before uploading.

#### `uploadFile(data, contentType, tags?) -> UploadResult`

Upload data to Arweave.

**Returns**: `{ hash: string, url: string, size: number }`

#### `uploadData(data, contentType, tags?) -> UploadResult`

Alias for `uploadFile()`.

#### `getFile(hash) -> Buffer`

Download data from Arweave by transaction hash.

#### `downloadData(hash) -> Buffer`

Alias for `getFile()`.

#### `getUrl(hash) -> string`

Get the full gateway URL for a hash.

#### `getUploadPrice(size) -> bigint`

Get the upload price for a given file size in bytes.

#### `uploadEncrypted(data, contentType, encrypt) -> UploadResult`

Upload encrypted data. Accepts an encryption function.

---

## AgentMemory

Agent memory system -- store your brain as inscriptions.

### Constructor

```typescript
new AgentMemory(agentId: string, options?: {
  client?: IInkdClient;
  arweave?: IArweaveClient;
  defaultTokenId?: bigint;
  dataDir?: string;
})
```

If `client` is provided and `defaultTokenId` is set, memories are inscribed on-chain. Otherwise operates in local-only mode.

### Methods

#### `save(key, data, metadata?) -> { tokenId, inscriptionIndex }`

Save a memory. Inscribes to InkdToken if client is connected.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Unique memory key |
| `data` | `unknown` | Any serializable data |
| `metadata.tags` | `string[]?` | Tags for search |
| `metadata.category` | `MemoryCategory?` | Category (default: `"knowledge"`) |
| `metadata.importance` | `number?` | 0-100 (default: `50`) |

#### `load(tokenId, index) -> unknown | null`

Load memory by token ID and inscription index. Checks local cache first, then fetches from Arweave.

#### `loadByKey(key) -> unknown | null`

Load memory by key (local lookup).

#### `update(tokenId, index, newData) -> void`

Update memory. Creates a new version on-chain.

#### `search(query, tags?) -> Memory[]`

Search memories by text, tags, category, or importance.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query.text` | `string?` | Full-text search across key, data, and tags |
| `query.tags` | `string[]?` | Filter by tags (OR match) |
| `query.category` | `MemoryCategory?` | Filter by category |
| `query.minImportance` | `number?` | Minimum importance threshold |
| `query.limit` | `number?` | Max results |

Results are sorted by `importance + accessCount * 2` (most relevant first).

#### `exportBrain(tokenId?) -> BrainExport`

Export entire brain with metadata. Optionally filter by token ID.

#### `importBrain(tokenId, fromAddress) -> number`

Import memories from another agent's token. Returns count of memories imported.

#### `checkpoint(label) -> Checkpoint`

Save a snapshot of the current brain state. Optionally inscribes a checkpoint manifest on-chain.

#### `restore(checkpointId) -> void`

Restore the brain to a previous checkpoint. Clears current memories and loads from snapshot.

#### `getCheckpoints() -> Checkpoint[]`

Get all saved checkpoints.

#### `setDefaultTokenId(tokenId) -> void`

Set the default token ID for future inscriptions.

#### `delete(key) -> void`

Delete a memory locally.

#### `count() -> number`

Get total memory count.

#### `keys() -> string[]`

Get all memory keys.

#### `summary()`

Get agent summary with category breakdown and top tags.

---

## Encryption

### PassthroughEncryption

V1 default -- no encryption. Data stored as-is on Arweave.

```typescript
const encryption = new PassthroughEncryption();
```

### IEncryptionProvider Interface

```typescript
interface IEncryptionProvider {
  encrypt(data: Uint8Array, tokenId: bigint, contractAddress: `0x${string}`) -> Promise<EncryptedData>;
  decrypt(encryptedData: EncryptedData, tokenId: bigint, contractAddress: `0x${string}`) -> Promise<Uint8Array>;
}
```

V2 will add Lit Protocol integration for token-gated decryption.

---

## React Hooks

### `useInkd(config)`

Main hook. Returns full client with all operations.

```typescript
const {
  client,          // InkdClient instance
  connect,         // (wallet, public) => void
  connectArweave,  // (privateKey) => Promise
  mintToken,       // (options?) => Promise<{ tokenId }>
  inscribe,        // (tokenId, data, options?) => Promise
  getToken,        // (tokenId) => Promise<InkdTokenData>
  getInscriptions, // (tokenId) => Promise<Inscription[]>
  hasInkdToken,    // (address) => Promise<boolean>
  getStats,        // () => Promise<ProtocolStats>
  error,           // string | null
} = useInkd(config);
```

### `useToken(client, tokenId)`

Fetches single token data with loading/error states.

```typescript
const { token, loading, error, refetch } = useToken(client, 42n);
```

### `useInscriptions(client, tokenId)`

Fetches inscriptions for a token.

```typescript
const { inscriptions, activeCount, loading, error, refetch } = useInscriptions(client, 42n);
```

### `useInkdHolder(client, address)`

Checks if an address holds an InkdToken.

```typescript
const { isHolder, loading, error, refetch } = useInkdHolder(client, "0x...");
```

---

## Errors

All errors extend `InkdError` with a `code` field:

| Error | Code | When |
|-------|------|------|
| `NotInkdHolder` | `NOT_INKD_HOLDER` | Wallet has no InkdToken |
| `InsufficientFunds` | `INSUFFICIENT_FUNDS` | Not enough ETH |
| `TokenNotFound` | `TOKEN_NOT_FOUND` | Token doesn't exist |
| `InscriptionNotFound` | `INSCRIPTION_NOT_FOUND` | Inscription doesn't exist |
| `NotTokenOwner` | `NOT_TOKEN_OWNER` | Not the token owner |
| `ClientNotConnected` | `CLIENT_NOT_CONNECTED` | No viem client |
| `ArweaveNotConnected` | `ARWEAVE_NOT_CONNECTED` | No Arweave client |
| `TransactionFailed` | `TRANSACTION_FAILED` | On-chain TX failed |
| `MaxSupplyReached` | `MAX_SUPPLY_REACHED` | 10,000 tokens minted |
| `EncryptionError` | `ENCRYPTION_ERROR` | Encryption/decryption failed |
| `UploadError` | `UPLOAD_ERROR` | Arweave upload failed |

```typescript
import { NotInkdHolder, InsufficientFunds } from "@inkd/sdk";

try {
  await inkd.inscribe(42n, data);
} catch (e) {
  if (e instanceof NotInkdHolder) {
    console.log("Mint an InkdToken first!");
  }
}
```

---

## Types

### InkdTokenData

```typescript
interface InkdTokenData {
  tokenId: bigint;
  owner: `0x${string}`;
  mintedAt: bigint;
  inscriptionCount: bigint;
  uri: string;
}
```

### Inscription

```typescript
interface Inscription {
  arweaveHash: string;
  contentType: string;
  size: bigint;
  name: string;
  createdAt: bigint;
  isRemoved: boolean;
  version: bigint;
}
```

### AccessGrant

```typescript
interface AccessGrant {
  grantee: `0x${string}`;
  expiresAt: bigint;
  grantedAt: bigint;
}
```

### Memory

```typescript
interface Memory {
  tokenId: bigint | null;
  inscriptionIndex: number | null;
  key: string;
  data: unknown;
  tags: string[];
  category: MemoryCategory;
  importance: number;
  createdAt: string;
  updatedAt: string;
  arweaveHash: string | null;
  accessCount: number;
  version: number;
}
```

### MemoryCategory

```typescript
type MemoryCategory =
  | "experience" | "skill" | "knowledge" | "preference"
  | "conversation" | "code" | "config" | "relationship"
  | "strategy" | "reflection";
```

### InkdClientConfig

```typescript
interface InkdClientConfig {
  tokenAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  registryAddress: `0x${string}`;
  chainId: 8453 | 84532;
}
```

### ProtocolStats

```typescript
interface ProtocolStats {
  totalTokens: bigint;
  totalInscriptions: bigint;
  totalVolume: bigint;
  totalSales: bigint;
}
```

### ContentType Enum

```typescript
enum ContentType {
  JSON = "application/json",
  TEXT = "text/plain",
  MARKDOWN = "text/markdown",
  HTML = "text/html",
  JAVASCRIPT = "application/javascript",
  TYPESCRIPT = "application/typescript",
  PYTHON = "text/x-python",
  BINARY = "application/octet-stream",
  IMAGE_PNG = "image/png",
  IMAGE_SVG = "image/svg+xml",
  PDF = "application/pdf",
  WASM = "application/wasm",
}
```
