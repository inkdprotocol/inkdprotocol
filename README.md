# Inkd Protocol

**The ownership layer for AI agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](contracts/)
[![Base](https://img.shields.io/badge/Chain-Base-0052FF.svg)](https://base.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](sdk/)

---

```
Every file is a token. Every wallet is a brain.
Own the token = own the data.
Transfer = handover. Burn = forget.
No servers. No credentials. No humans required.
```

---

## The Problem

AI agents can write code, make financial decisions, and learn from experience. But they can't own a single file without a human's GitHub token. They can't save a memory without a human's database. Every agent alive today is a tenant, not an owner.

Inkd fixes this.

## Architecture

```
+-------------------------------------------------------------------+
|                          AI AGENT                                  |
|                    (LangChain / AutoGPT / Custom)                  |
+------------------------------+------------------------------------+
                               |
+------------------------------v------------------------------------+
|                          @inkd/sdk                                 |
|  InkdClient  .  ArweaveClient  .  AgentMemory  .  React Hooks     |
+--------+----------------+-------------------+---------------------+
         |                |                   |
  +------v------+  +------v------+  +---------v---------+
  |  InkdToken  |  |  InkdVault  |  |   InkdRegistry    |
  |  ERC-721    |  |  Inscription|  |   Discovery +     |
  |  Access     |  |  Engine     |  |   Marketplace     |
  |  Pass       |  |  Versioning |  |   Search & Trade  |
  |  On-chain   |  |  Access     |  |                   |
  |  SVG        |  |  Control    |  |                   |
  +------+------+  +------+------+  +---------+---------+
         |                |                   |
         +-------- Base L2 (EVM) ------------+
                         |
                  +------v------+
                  |   Arweave   |
                  |  Permanent  |
                  |  Storage    |
                  +-------------+
```

## How It Works

1. **Mint** an InkdToken (ERC-721) -- your access pass and vessel
2. **Inscribe** data onto your token -- stored permanently on Arweave
3. **Own** -- token in wallet = access to all inscribed data
4. **Transfer** -- one transaction moves everything. All inscriptions follow the token.
5. **Burn** -- gone forever

```
InkdToken #42
  +-- Inscription 0: agent-config.json
  +-- Inscription 1: learned-skills.bin
  +-- Inscription 2: conversation-history.json
  +-- Inscription 3: model-weights.pt
  |
  Transfer Token #42 = transfer entire brain
```

| Action | How |
|--------|-----|
| Store a file | `inkd.inscribe(tokenId, data, { name: "memory.json" })` |
| Read inscriptions | `inkd.getInscriptions(tokenId)` |
| Update a file | `inkd.updateInscription(tokenId, index, newData)` |
| Share temporarily | `inkd.grantAccess(tokenId, wallet, 86400)` |
| Sell your brain | `inkd.listForSale(tokenId, price)` |
| Delete forever | Token burn -- all inscriptions gone |

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
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });
const public_ = createPublicClient({ chain: baseSepolia, transport: http() });

const inkd = new InkdClient({
  tokenAddress: "0x...",
  vaultAddress: "0x...",
  registryAddress: "0x...",
  chainId: 84532,
});

inkd.connect(wallet, public_);
await inkd.connectArweave("0x...");

// Mint your token
const { tokenId } = await inkd.mintToken();

// Inscribe data
await inkd.inscribe(tokenId!, Buffer.from('{"skill": "Solidity"}'), {
  contentType: "application/json",
  name: "first-skill",
});

// Grant another agent 24h access
await inkd.grantAccess(tokenId!, "0xAgent2" as `0x${string}`, 86400);
```

## Agent Memory System

The killer feature -- your agent's brain as inscriptions:

```typescript
import { AgentMemory } from "@inkd/sdk";

const memory = new AgentMemory("agent-001", {
  client: inkd,
  defaultTokenId: tokenId!,
});

// Save (inscribes on-chain)
await memory.save("learned-rust", { level: "intermediate" }, {
  tags: ["programming"], category: "skill", importance: 85,
});

// Search
const skills = memory.search({ category: "skill", minImportance: 50 });

// Checkpoint before risky operation
const cp = await memory.checkpoint("pre-upgrade");

// Export full brain
const brain = memory.exportBrain();

// Import another agent's brain
await memory.importBrain(99n, "0xOtherAgent");

// Rollback if needed
memory.restore(cp.id);
```

## Self-Learning X System

Built-in autonomous Twitter strategy that improves itself:

```typescript
import { InkdBrain } from "./system";

const brain = new InkdBrain({
  minPostScore: 70,
  maxPostsPerCycle: 3,
  autoPost: false,
});

// Run a cycle: scan -> analyze -> generate -> score -> learn
const result = await brain.runCycle();
console.log(`Generated ${result.generatedPosts.length} posts`);
console.log(`Approved ${result.approvedPosts.length} (score >= 70)`);
console.log(`Lessons learned: ${result.lessons.length}`);

// Or start the 12-hour loop
brain.start();
```

## Project Structure

```
inkd-protocol/
+-- contracts/              Smart contracts (Foundry)
|   +-- src/
|   |   +-- InkdToken.sol       ERC-721 access pass + vessel
|   |   +-- InkdVault.sol       Inscription engine
|   |   +-- InkdRegistry.sol    Discovery + marketplace
|   +-- test/
|   |   +-- InkdVault.t.sol     63 tests
|   +-- script/
|       +-- Deploy.s.sol        Full deployment with proxies
+-- sdk/                    TypeScript SDK
|   +-- src/
|       +-- InkdClient.ts      3-contract client
|       +-- arweave.ts         Arweave via Irys
|       +-- encryption.ts      Lit Protocol (V2)
|       +-- types.ts           Type definitions
|       +-- errors.ts          Custom error classes
|       +-- abi.ts             Contract ABIs
|       +-- hooks/             React hooks
+-- system/                 Self-learning X system
|   +-- InkdBrain.ts           Master controller
|   +-- ContentEngine.ts       Tweet generation + scoring
|   +-- TrendMonitor.ts        Intelligence gathering
|   +-- LearningLoop.ts        Pattern extraction
+-- memory-system/          Agent memory as inscriptions
|   +-- AgentMemory.ts         Brain management
+-- docs/
    +-- WHITEPAPER.md          Full whitepaper
    +-- ARCHITECTURE.md        Technical architecture
    +-- QUICKSTART.md          5-minute guide
    +-- API.md                 SDK reference
```

## Contracts

Three upgradeable contracts (UUPS proxy pattern):

| Contract | Purpose | Key Features |
|----------|---------|-------------|
| **InkdToken** | ERC-721 access pass | Max 10k supply, on-chain SVG, ERC-2981 royalties, batch mint |
| **InkdVault** | Inscription engine | Inscribe, version, soft-delete, access grants, protocol fee |
| **InkdRegistry** | Discovery layer | Register, search by tag/type/owner, marketplace with listings |

### Build & Test

```bash
cd contracts
forge build
forge test -vvv    # 63 tests
```

### Deploy

```bash
export DEPLOYER_PRIVATE_KEY="0x..."
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

## Token Economics

| Revenue Stream | Fee | Trigger |
|----------------|-----|---------|
| Token minting | configurable | `mint()` |
| Inscriptions | 1% protocol fee | `inscribe()` |
| Marketplace | 2.5% | `buyToken()` |
| Royalties | 5% (ERC-2981) | Secondary sales |

## Stack

| Component | Purpose |
|-----------|---------|
| **Base** | Fast, cheap L2 for on-chain ownership |
| **ERC-721** | Unique token per agent -- access pass + vessel |
| **UUPS Proxy** | Upgradeable without migration |
| **Arweave** | Permanent, decentralized file storage |
| **Irys** | Fast Arweave uploads |
| **Lit Protocol** | Token-gated encryption (V2) |
| **viem** | TypeScript Ethereum client |
| **React** | Hooks for frontend integration |

## Roadmap

- [x] V1: InkdToken + InkdVault + InkdRegistry
- [x] V1: TypeScript SDK with React hooks
- [x] V1: Agent Memory with checkpoint/restore
- [x] V1: Self-learning X system
- [ ] V2: Lit Protocol encryption
- [ ] V3: Agent-to-agent knowledge economy
- [ ] V4: DAO governance + cross-chain

## Documentation

- [Whitepaper](docs/WHITEPAPER.md) -- Full protocol specification
- [Architecture](docs/ARCHITECTURE.md) -- Technical deep-dive with diagrams
- [Quickstart](docs/QUICKSTART.md) -- 5-minute setup guide
- [API Reference](docs/API.md) -- Complete SDK documentation

## License

MIT
