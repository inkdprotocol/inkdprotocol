# @inkd/sdk

TypeScript SDK for **Inkd Protocol** — the decentralized ownership layer for AI agents on Base.

## Installation

```bash
npm install @inkd/sdk viem
```

## Quick Start

```ts
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// 1. Set up viem clients
const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// 2. Create Inkd client
const inkd = new InkdClient({
  contractAddress: "0xYOUR_VAULT_ADDRESS",
  chainId: 84532,
});

// 3. Connect
inkd.connect(walletClient, publicClient);
await inkd.connectArweave("YOUR_PRIVATE_KEY");

// 4. Mint a file as a token
const result = await inkd.mint(Buffer.from("agent memory data"), {
  contentType: "application/json",
  price: 0n, // not for sale
});
console.log("Token ID:", result.tokenId);
```

## Core Operations

### Mint

```ts
// Mint from file data (uploads to Arweave automatically)
const { tokenId } = await inkd.mint(fileBuffer, {
  contentType: "application/json",
  price: 0n,
});

// Mint from existing Arweave hash
const { tokenId } = await inkd.mintFromHash(
  "arweave-tx-hash",
  "ipfs://metadata",
  parseEther("0.1")
);

// Batch mint
const { tokenIds } = await inkd.batchMint(
  [file1, file2, file3],
  { contentType: "text/plain" }
);
```

### Purchase

```ts
await inkd.purchase(tokenId, sellerAddress);
```

### Burn

```ts
await inkd.burn(tokenId);
```

### Price Management

```ts
await inkd.setPrice(tokenId, parseEther("0.5")); // list for 0.5 ETH
await inkd.setPrice(tokenId, 0n);                 // delist
```

### Access Grants

```ts
// Grant 24-hour access
await inkd.grantAccess(tokenId, walletAddress, 86400);

// Check access
const hasAccess = await inkd.checkAccess(tokenId, walletAddress);

// Revoke
await inkd.revokeAccess(tokenId, walletAddress);
```

### Versioning

```ts
// Push a new version
await inkd.addVersion(tokenId, newFileBuffer, "application/json");

// Get token with full version history
const token = await inkd.getToken(tokenId);
console.log(token.versions); // ["hash-v0", "hash-v1", ...]
```

### Data Retrieval

```ts
// Get latest version data
const data = await inkd.getData(tokenId);

// Get specific version
const v0Data = await inkd.getVersionData(tokenId, 0);
```

### Queries

```ts
// Get token details
const token = await inkd.getToken(tokenId);

// Get all tokens owned by an address
const tokens = await inkd.getTokensByOwner("0x...");
```

## Encryption (V2)

V1 uses passthrough encryption (data stored unencrypted on Arweave). V2 will integrate Lit Protocol for token-gated decryption:

```ts
import { LitEncryptionProvider } from "@inkd/sdk";

// V2 (coming soon)
const litProvider = new LitEncryptionProvider({
  network: "cayenne",
  chain: "base",
});
inkd.setEncryptionProvider(litProvider);
```

## License

MIT
