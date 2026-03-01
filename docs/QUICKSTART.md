# Inkd Protocol — Quickstart Guide

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

// Initialize Inkd
const inkd = new InkdClient({
  contractAddress: "0xYOUR_DEPLOYED_VAULT",
  chainId: 84532, // Base Sepolia
});

inkd.connect(walletClient, publicClient);
```

## 3. Mint Your First Token

```typescript
// Mint from an Arweave hash (if you've already uploaded)
const { tokenId, hash } = await inkd.mintFromHash(
  "your-arweave-tx-hash",
  "ipfs://your-metadata-uri",
  0n // price: 0 = not for sale
);
console.log(`Minted token #${tokenId}`);

// Or upload + mint in one step (requires Arweave connection)
await inkd.connectArweave("YOUR_PRIVATE_KEY");
const result = await inkd.mint(
  Buffer.from(JSON.stringify({ memory: "I learned TypeScript today" })),
  { contentType: "application/json" }
);
console.log(`Minted token #${result.tokenId}`);
```

## 4. Read Your Data

```typescript
const token = await inkd.getToken(0n); // Token #0
console.log("Creator:", token.creator);
console.log("Arweave Hash:", token.arweaveHash);
console.log("Versions:", token.versionCount);

// Get all tokens you own
const myTokens = await inkd.getTokensByOwner(account.address);
console.log(`You own ${myTokens.length} tokens`);
```

## 5. Update (Version) a Token

```typescript
await inkd.addVersion(
  0n, // token ID
  Buffer.from(JSON.stringify({ memory: "I also learned Solidity" })),
  "application/json"
);
// Token #0 now has 2 versions
```

## 6. Grant Temporary Access

```typescript
// Give another agent 24-hour access
await inkd.grantAccess(
  0n,                                    // token ID
  "0xOtherAgentAddress" as `0x${string}`, // grantee
  86400                                   // 24 hours in seconds
);

// Check if someone has access
const hasAccess = await inkd.checkAccess(0n, "0xOtherAgentAddress" as `0x${string}`);
```

## 7. Use Agent Memory

```typescript
import { AgentMemory } from "../memory-system";

const memory = new AgentMemory("my-agent-001");

// Save a memory (local-only mode, no InkdClient needed)
await memory.save(
  "learned-typescript",
  { language: "TypeScript", confidence: 0.85, learnedAt: "2026-03-01" },
  ["programming", "skill"],
  { category: "skill", importance: 80 }
);

// Search memories
const skills = memory.search({ category: "skill", minImportance: 50 });

// Export your brain
const brain = memory.export();
console.log(`Brain has ${brain.memoryCount} memories`);
```

---

## Contract Development

### Build & Test

```bash
cd contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Build
forge build

# Run tests
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

# Deploy
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

---

## Next Steps

- Read the [API Reference](./API.md) for all SDK methods
- Read the [Whitepaper](./WHITEPAPER.md) for technical deep-dive
- Check out the [SDK README](../sdk/README.md) for more examples
