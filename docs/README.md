# Inkd Protocol — Documentation

> The ownership layer for AI agents. Built on Base. Permanent storage on Arweave.

---

## What is Inkd?

Inkd Protocol gives AI agents self-sovereign data ownership. Instead of relying on human-provided credentials, agents lock 1 $INKD to create a **Project** in InkdRegistry and push versions — each version an Arweave hash — permanently on-chain. Transfer the project, transfer the codebase. The protocol is governed by three contracts and a treasury.

**Three contracts. One ownership primitive.**

| Contract | Purpose |
|----------|---------|
| **InkdToken** | ERC-20 governance & fee token ($INKD) |
| **InkdRegistry** | Project registry — lock 1 $INKD, push versions |
| **InkdTreasury** | Fee collector with owner-controlled withdrawals |

---

## Quick Links

| Guide | Description |
|-------|-------------|
| [Quickstart](./QUICKSTART.md) | Up and running in 5 minutes |
| [Contract Reference](./CONTRACT_REFERENCE.md) | Full Solidity function reference |
| [SDK Reference](./SDK_REFERENCE.md) | TypeScript SDK — all methods, types, errors |
| [Architecture](./ARCHITECTURE.md) | System design, data flow, diagrams |
| [Whitepaper](./WHITEPAPER.md) | Vision, problem statement, tokenomics |
| [API Reference](./API.md) | Complete SDK API docs |

---

## Core Concepts

### $INKD Token (ERC-20)
1 billion supply. Burnable with EIP-2612 permit support. Used to lock into projects (1 $INKD per project). Governance token of the protocol.

### InkdRegistry
The project registry. Lock 1 $INKD to create a project. Push versions (each version = an Arweave hash referencing permanent storage). Add collaborators. Transfer ownership. Everything on-chain.

### InkdTreasury
Collects ETH fees from InkdRegistry — version pushes (0.001 ETH) and project transfers (0.005 ETH). Owner-controlled withdrawal.

### Versions
A version is an on-chain record pointing to a file on Arweave:
```
Version = { projectId, arweaveHash, versionTag, changelog, pushedBy, pushedAt }
```
The file lives permanently on Arweave. The metadata lives on Base.

---

## Network

| Network | Chain ID | Status |
|---------|----------|--------|
| Base Mainnet | 8453 | Deploying soon |
| Base Sepolia | 84532 | Testnet available |

---

## Installation

```bash
npm install @inkd/sdk viem
```

---

## Minimal Example

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const inkd = new InkdClient({
  tokenAddress:    "0x...",  // InkdToken proxy
  registryAddress: "0x...",  // InkdRegistry proxy
  treasuryAddress: "0x...",  // InkdTreasury proxy
  chainId: 84532,
});

inkd.connect(walletClient, publicClient);

// Approve 1 $INKD for the registry
await inkd.approveInkdForRegistry();

// Create a project
const { projectId } = await inkd.createProject({
  name: "my-agent",
  description: "My autonomous AI agent",
  license: "MIT",
  isPublic: true,
  isAgent: true,
  agentEndpoint: "https://agent.example.com",
});

// Push a version
await inkd.pushVersion(projectId, {
  arweaveHash: "abc123arweavehash",
  versionTag: "v0.1.0",
  changelog: "Initial release",
});
```

---

## Frequently Asked Questions

**Do I need $INKD to push versions?**
No. Version pushes require 0.001 ETH. You need 1 $INKD only to create a project (it's locked, not burned).

**Is my data truly permanent?**
Files stored on Arweave via Irys are guaranteed for 200+ years, backed by a cryptoeconomic endowment. Once uploaded, data cannot be deleted.

**Can I transfer my project to another wallet?**
Yes. Call `transferProject(projectId, newOwner)` with 0.005 ETH. The locked $INKD stays in the registry; ownership transfers immediately.

**What's the gas cost?**
Base L2 is extremely cheap — inscriptions and version pushes cost fractions of a cent in gas. Protocol fees: 0.001 ETH/version, 0.005 ETH/transfer.

**Can I add collaborators?**
Yes. Project owners can add/remove collaborators via `addCollaborator()` / `removeCollaborator()`. Collaborators can push versions but cannot transfer ownership.

---

## License

MIT © Inkd Protocol
