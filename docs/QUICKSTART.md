# Inkd Protocol -- Quickstart Guide

Get up and running with Inkd Protocol in 5 minutes.

---

## Prerequisites

- Node.js >= 18
- A Base Sepolia wallet with testnet ETH ([faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))
- For contract development: [Foundry](https://book.getfoundry.sh/getting-started/installation)

---

## 1. Install the SDK

```bash
npm install @inkd/sdk viem
```

## 2. Set Up Your Client

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Your agent's wallet
const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// Initialize Inkd (3 contract addresses required)
const inkd = new InkdClient({
  tokenAddress: "0xYOUR_INKD_TOKEN",
  vaultAddress: "0xYOUR_INKD_VAULT",
  registryAddress: "0xYOUR_INKD_REGISTRY",
  chainId: 84532, // Base Sepolia
});

inkd.connect(walletClient, publicClient);
```

## 3. Mint Your InkdToken

Every agent needs an InkdToken to use the protocol. It's your access pass and vessel.

```typescript
// Mint your InkdToken (pays mint price in ETH)
const { tokenId, hash } = await inkd.mintToken();
console.log(`Minted InkdToken #${tokenId}`);

// Check if you hold one
const isHolder = await inkd.hasInkdToken(account.address);
console.log(`Is InkdToken holder: ${isHolder}`);
```

## 4. Inscribe Data

Once you have an InkdToken, inscribe data onto it. Each inscription is stored permanently on Arweave.

```typescript
// Connect Arweave for file uploads
await inkd.connectArweave("YOUR_IRYS_PRIVATE_KEY");

// Inscribe a memory onto your token
const result = await inkd.inscribe(
  tokenId!,
  Buffer.from(JSON.stringify({ memory: "I learned TypeScript today" })),
  { contentType: "application/json", name: "first-memory" }
);

console.log(`Inscribed at index ${result.inscriptionIndex}`);
console.log(`Arweave hash: ${result.upload.hash}`);
```

## 5. Read Your Inscriptions

```typescript
// Get all inscriptions on your token
const inscriptions = await inkd.getInscriptions(tokenId!);
console.log(`Token #${tokenId} has ${inscriptions.length} inscriptions`);

for (const insc of inscriptions) {
  console.log(`  ${insc.name} (${insc.contentType}) - ${insc.arweaveHash}`);
}

// Get your token data
const token = await inkd.getToken(tokenId!);
console.log(`Owner: ${token.owner}`);
console.log(`Inscriptions: ${token.inscriptionCount}`);
```

## 6. Grant Temporary Access

```typescript
// Give another agent 24-hour access to read your inscriptions
await inkd.grantAccess(
  tokenId!,
  "0xOtherAgentAddress" as `0x${string}`,
  86400 // 24 hours in seconds
);

// Revoke access early
await inkd.revokeAccess(
  tokenId!,
  "0xOtherAgentAddress" as `0x${string}`
);
```

## 7. Use Agent Memory

```typescript
import { AgentMemory } from "@inkd/sdk";

const memory = new AgentMemory("my-agent-001", {
  client: inkd,
  defaultTokenId: tokenId!,
});

// Save a memory (inscribed on your InkdToken)
await memory.save(
  "learned-typescript",
  { language: "TypeScript", confidence: 0.85 },
  { tags: ["programming", "skill"], category: "skill", importance: 80 }
);

// Search memories
const skills = memory.search({ category: "skill", minImportance: 50 });

// Checkpoint your brain before risky changes
const cp = await memory.checkpoint("before-experiment");

// Export your brain
const brain = memory.exportBrain();
console.log(`Brain has ${brain.memoryCount} memories`);

// Restore if needed
memory.restore(cp.id);
```

## 8. List on Marketplace

```typescript
// List your token for sale
await inkd.listForSale(tokenId!, 100000000000000000n); // 0.1 ETH

// Get protocol stats
const stats = await inkd.getStats();
console.log(`Total tokens: ${stats.totalTokens}`);
console.log(`Total inscriptions: ${stats.totalInscriptions}`);
```

---

## React Integration

```tsx
import { useInkd, useToken, useInscriptions, useInkdHolder } from "@inkd/sdk";

function AgentDashboard() {
  const { client, connect, mintToken, inscribe } = useInkd({
    tokenAddress: "0x...",
    vaultAddress: "0x...",
    registryAddress: "0x...",
    chainId: 84532,
  });

  const { token, loading } = useToken(client, 0n);
  const { inscriptions } = useInscriptions(client, 0n);
  const { isHolder } = useInkdHolder(client, "0x...");

  return (
    <div>
      {loading ? <p>Loading...</p> : <p>Token #{token?.tokenId.toString()}</p>}
      <p>Inscriptions: {inscriptions?.length ?? 0}</p>
      <p>Is holder: {isHolder ? "Yes" : "No"}</p>
    </div>
  );
}
```

---

## Contract Development

### Build & Test

```bash
cd contracts

# Build
forge build

# Run all 63 tests
forge test -vvv

# Test coverage
forge coverage
```

### Deploy to Base Sepolia

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY="0x..."
export BASE_SEPOLIA_RPC="https://sepolia.base.org"
export BASESCAN_API_KEY="your-api-key"

# Deploy all 3 contracts with proxies
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

The deploy script outputs proxy addresses for InkdToken, InkdVault, and InkdRegistry.

---

## Next Steps

- Read the [Whitepaper](./WHITEPAPER.md) for the full vision
- Read the [Architecture](./ARCHITECTURE.md) for technical deep-dive
- Check out the [API Reference](./API.md) for all SDK methods
