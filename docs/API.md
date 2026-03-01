# Inkd Protocol — API Reference

Complete SDK reference for `@inkd/sdk`.

---

## Table of Contents

- [InkdClient](#inkdclient)
- [ArweaveClient](#arweaveclient)
- [AgentMemory](#agentmemory)
- [Encryption](#encryption)
- [Types](#types)

---

## InkdClient

Main client for interacting with the InkdVault contract.

### Constructor

```typescript
new InkdClient(config: InkdClientConfig)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.contractAddress` | `` `0x${string}` `` | InkdVault proxy contract address |
| `config.chainId` | `8453 \| 84532` | Base Mainnet or Base Sepolia |
| `config.irysUrl` | `string?` | Irys node URL (default: `https://node2.irys.xyz`) |
| `config.arweaveGateway` | `string?` | Arweave gateway URL (default: `https://arweave.net`) |

### Connection Methods

#### `connect(walletClient, publicClient)`

Connect viem clients for on-chain interaction.

```typescript
inkd.connect(walletClient, publicClient);
```

#### `connectArweave(privateKey, irysUrl?, gateway?)`

Connect Arweave storage client for file uploads.

```typescript
await inkd.connectArweave("0xPrivateKey");
```

#### `setEncryptionProvider(provider)`

Set a custom encryption provider (V2 Lit Protocol).

```typescript
inkd.setEncryptionProvider(new LitEncryptionProvider({ network: "cayenne", chain: "base" }));
```

### Mint Methods

#### `mint(file, options) → TransactionResult`

Upload file to Arweave and mint as token.

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | `Buffer \| Uint8Array` | File data |
| `options.contentType` | `string` | MIME type |
| `options.price` | `bigint?` | Listing price (default: `0n`) |
| `options.metadataURI` | `string?` | Custom metadata URI |
| `options.tags` | `Record<string, string>?` | Arweave tags |

**Returns**: `{ hash: 0x..., tokenId: bigint }`

#### `mintFromHash(arweaveHash, metadataURI, price?) → TransactionResult`

Mint from an existing Arweave hash (no upload).

#### `batchMint(files, options) → BatchTransactionResult`

Mint multiple tokens in a single transaction.

**Returns**: `{ hash: 0x..., tokenIds: bigint[] }`

### Purchase & Transfer

#### `purchase(tokenId, sellerAddress) → TransactionResult`

Purchase a token. Automatically sends the listing price.

#### `burn(tokenId) → TransactionResult`

Burn a token permanently.

#### `setPrice(tokenId, price) → TransactionResult`

Update listing price. Set to `0n` to delist.

### Queries

#### `getToken(tokenId) → TokenData`

Get full token data with version history.

```typescript
const token = await inkd.getToken(0n);
// {
//   tokenId: 0n,
//   creator: "0x...",
//   arweaveHash: "abc123",
//   metadataURI: "ipfs://...",
//   price: 1000000000000000000n,
//   createdAt: 1709251200n,
//   owner: "0x...",
//   versionCount: 3,
//   versions: ["hash-v0", "hash-v1", "hash-v2"]
// }
```

#### `getTokensByOwner(address) → TokenData[]`

Get all tokens owned by an address.

#### `checkAccess(tokenId, wallet) → boolean`

Check if a wallet has access (owner or active grant).

### Access Grants

#### `grantAccess(tokenId, wallet, duration) → TransactionResult`

Grant temporary read access. `duration` is in seconds.

#### `revokeAccess(tokenId, wallet) → TransactionResult`

Revoke a previously granted access.

### Versioning

#### `addVersion(tokenId, file, contentType) → TransactionResult`

Push a new version of data for an existing token.

### Data Retrieval

#### `getData(tokenId) → Buffer`

Download and decrypt the latest version data.

#### `getVersionData(tokenId, versionIndex) → Buffer`

Download a specific version's data.

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

#### `uploadFile(data, contentType, tags?) → UploadResult`

Upload data to Arweave.

**Returns**: `{ hash: string, url: string, size: number }`

#### `getFile(hash) → Buffer`

Download data from Arweave by transaction hash.

#### `getUrl(hash) → string`

Get the full gateway URL for a hash.

---

## AgentMemory

Agent memory system — store your brain as tokens.

### Constructor

```typescript
new AgentMemory(agentId: string, client?: IInkdClient)
```

If `client` is provided, memories are minted on-chain. Otherwise operates in local-only mode.

### Methods

#### `save(key, data, tags?, options?) → bigint | null`

Save a memory. Returns token ID if minted on-chain.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Unique memory key |
| `data` | `unknown` | Any serializable data |
| `tags` | `string[]?` | Tags for search |
| `options.category` | `MemoryCategory?` | Category (default: `"knowledge"`) |
| `options.importance` | `number?` | 0-100 (default: `50`) |
| `options.price` | `bigint?` | Listing price |

#### `load(tokenId) → unknown | null`

Load memory by token ID.

#### `loadByKey(key) → unknown | null`

Load memory by key (local lookup).

#### `update(tokenId, newData) → bigint | null`

Update memory. Creates new on-chain version.

#### `updateByKey(key, newData) → bigint | null`

Update memory by key.

#### `search(query) → Memory[]`

Search memories.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query.text` | `string?` | Full-text search |
| `query.tags` | `string[]?` | Filter by tags (OR) |
| `query.category` | `MemoryCategory?` | Filter by category |
| `query.minImportance` | `number?` | Minimum importance |
| `query.limit` | `number?` | Max results |

#### `export() → BrainExport`

Export entire brain with metadata.

#### `import(walletAddress) → number`

Import memories from another agent's wallet. Returns count imported.

#### `importFromExport(brainExport) → number`

Import from a previously exported brain JSON.

#### `delete(key)`

Delete a memory locally.

#### `count() → number`

Get total memory count.

#### `keys() → string[]`

Get all memory keys.

#### `summary()`

Get a summary of the agent's memory state.

---

## Encryption

### PassthroughEncryption

V1 default — no encryption. Data stored as-is on Arweave.

```typescript
const encryption = new PassthroughEncryption();
```

### LitEncryptionProvider

V2 — Lit Protocol integration (not yet implemented).

```typescript
const encryption = new LitEncryptionProvider({
  network: "cayenne",
  chain: "base",
});
// Throws in V1 — use PassthroughEncryption instead
```

### IEncryptionProvider Interface

```typescript
interface IEncryptionProvider {
  encrypt(data: Uint8Array, tokenId: bigint, contractAddress: `0x${string}`) → Promise<EncryptedData>;
  decrypt(encryptedData: EncryptedData, tokenId: bigint, contractAddress: `0x${string}`) → Promise<Uint8Array>;
}
```

---

## Types

### DataToken

```typescript
interface DataToken {
  tokenId: bigint;
  creator: `0x${string}`;
  arweaveHash: string;
  metadataURI: string;
  price: bigint;
  createdAt: bigint;
}
```

### TokenData

Extends `DataToken` with ownership and version info.

```typescript
interface TokenData extends DataToken {
  owner: `0x${string}`;
  versionCount: number;
  versions: string[];
}
```

### Memory

```typescript
interface Memory {
  tokenId: bigint | null;
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

### TransactionResult

```typescript
interface TransactionResult {
  hash: `0x${string}`;
  tokenId?: bigint;
}
```

### InkdClientConfig

```typescript
interface InkdClientConfig {
  contractAddress: `0x${string}`;
  chainId: 8453 | 84532;
  irysUrl?: string;
  arweaveGateway?: string;
}
```
