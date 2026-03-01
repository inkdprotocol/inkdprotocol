# Inkd Protocol

**The decentralized ownership layer for AI agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](contracts/)
[![Base](https://img.shields.io/badge/Chain-Base-0052FF.svg)](https://base.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](sdk/)

---

```
Every file is a token. Every wallet is a brain.
Own the token = own the data.
Transfer = handover. Burn = delete.
No servers. No humans needed.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      AI AGENT                           │
│                    (any framework)                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                    @inkd/sdk                             │
│  InkdClient · ArweaveClient · AgentMemory · Encryption  │
└───────┬───────────────┬─────────────────┬───────────────┘
        │               │                 │
┌───────▼──────┐ ┌──────▼──────┐ ┌────────▼────────┐
│   Arweave    │ │    Base     │ │  Lit Protocol   │
│  (storage)   │ │  (chain)   │ │  (encryption)   │
│  permanent   │ │  ERC-1155  │ │  token-gated    │
│  via Irys    │ │  UUPS      │ │  (V2)           │
└──────────────┘ └─────────────┘ └─────────────────┘
```

## Why?

AI agents can write code, make decisions, and execute transactions — but they can't own a file without human credentials. Every agent today depends on:

- A human's GitHub token to store code
- A human's API key to access tools
- A human's permission to save memory

**Inkd gives agents their own storage.** An agent's wallet holds not just ETH — but its entire brain: code, memory, skills, identity.

## How It Works

```
Upload file → encrypt (V2) → store on Arweave → mint token on Base
                                                        │
                              token in wallet = access to file
```

| Action | Contract Call |
|--------|--------------|
| Store a file | `mint(arweaveHash, metadataURI, price)` |
| Store many files | `batchMint(hashes[], uris[], prices[])` |
| Buy knowledge | `purchase(tokenId, seller)` |
| Update a file | `addVersion(tokenId, newHash)` |
| Share temporarily | `grantAccess(tokenId, wallet, expiresAt)` |
| Delete forever | `burn(tokenId)` |

## Quick Start

```bash
npm install @inkd/sdk viem
```

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() });
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

const inkd = new InkdClient({ contractAddress: "0x...", chainId: 84532 });
inkd.connect(walletClient, publicClient);

// Mint a memory
const { tokenId } = await inkd.mintFromHash("arweave-hash", "ipfs://meta", 0n);

// Grant access to another agent for 24 hours
await inkd.grantAccess(tokenId!, "0xOtherAgent" as `0x${string}`, 86400);
```

## Agent Memory System

The killer feature — store your agent's brain as tokens:

```typescript
import { AgentMemory } from "./memory-system";

const memory = new AgentMemory("agent-001");

await memory.save("learned-solidity", { skill: "Solidity", level: "advanced" }, ["code", "skill"]);
const skills = memory.search({ category: "skill" });
const brain = memory.export(); // Full brain dump
```

## Project Structure

```
inkd-protocol/
├── contracts/           Smart contracts (Foundry)
│   ├── src/
│   │   └── InkdVault.sol    Core vault contract
│   ├── test/
│   │   └── InkdVault.t.sol  Comprehensive test suite
│   └── script/
│       └── Deploy.s.sol     Deployment script
├── sdk/                 TypeScript SDK (@inkd/sdk)
│   └── src/
│       ├── InkdClient.ts    Main client
│       ├── arweave.ts       Arweave via Irys
│       ├── encryption.ts    Lit Protocol (V2 stub)
│       ├── abi.ts           Contract ABI
│       └── types.ts         Type definitions
├── system/              Self-learning X strategy
│   ├── performance-tracker.ts
│   ├── learning-engine.ts
│   ├── content-generator.ts
│   └── trend-monitor.ts
├── memory-system/       Agent memory as tokens
│   └── AgentMemory.ts
└── docs/
    ├── WHITEPAPER.md
    ├── QUICKSTART.md
    └── API.md
```

## Contract Development

```bash
cd contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Build
forge build

# Test
forge test -vvv

# Deploy to Base Sepolia
forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify -vvvv
```

## Stack

| Component | Purpose |
|-----------|---------|
| **Base** | Fast, cheap EVM chain for on-chain ownership |
| **ERC-1155** | Multi-token standard — one contract, unlimited data types |
| **UUPS Proxy** | Upgradeable without migration |
| **Arweave** | Permanent, decentralized storage |
| **Irys** | Fast Arweave uploads with instant availability |
| **Lit Protocol** | Token-gated encryption (V2) |
| **viem** | TypeScript Ethereum client |

## Protocol Fee

1% on every purchase. Automatic. On-chain. Configurable (max 5%).

```
Buyer pays:      1.00 ETH
Seller receives: 0.99 ETH
Protocol keeps:  0.01 ETH
```

## Roadmap

- [x] V1: InkdVault contract — mint, purchase, burn, versioning, access grants
- [x] V1: TypeScript SDK
- [x] V1: Agent Memory System
- [ ] V2: Lit Protocol encryption integration
- [ ] V3: Agent-to-agent knowledge marketplace
- [ ] V4: DAO governance + ownership renounce

## Documentation

- [Whitepaper](docs/WHITEPAPER.md) — Technical deep-dive
- [Quickstart](docs/QUICKSTART.md) — 5-minute setup guide
- [API Reference](docs/API.md) — Full SDK documentation

## License

MIT
