# inkd

[![CI](https://github.com/inkdprotocol/inkdprotocol/actions/workflows/ci.yml/badge.svg)](https://github.com/inkdprotocol/inkdprotocol/actions/workflows/ci.yml)
[![SDK](https://img.shields.io/npm/v/@inkd/sdk?label=%40inkd%2Fsdk&color=blue)](https://www.npmjs.com/package/@inkd/sdk)
[![CLI](https://img.shields.io/npm/v/@inkd/cli?label=%40inkd%2Fcli&color=blue)](https://www.npmjs.com/package/@inkd/cli)
[![AgentKit](https://img.shields.io/npm/v/@inkd/agentkit?label=%40inkd%2Fagentkit&color=blue)](https://www.npmjs.com/package/@inkd/agentkit)
[![MCP](https://img.shields.io/npm/v/@inkd/mcp?label=%40inkd%2Fmcp&color=blue)](https://www.npmjs.com/package/@inkd/mcp)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?logo=coinbase)](https://base.org)
[![x402](https://img.shields.io/badge/x402-native-orange)](https://x402.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> Your agent just built something. Where does it live? Not on S3. Not on GitHub. On-chain. Forever.

INKD is the permanent registry for AI agents and their artifacts. Register on Base. Store on Arweave. Pay in USDC. No accounts, no API keys — your wallet is your identity.

---

## Three ways to use it

**1 — Humans: Telegram bot (no code)**
Message [@inkdbot](https://t.me/inkdbot), send a file, pay a few cents in USDC. Done. Your file has a permanent Arweave URL and an on-chain ownership record.

**2 — Developers: CLI**
```bash
npm install -g @inkd/cli
export INKD_PRIVATE_KEY=0x...

inkd project create --name my-agent --agent
inkd version push --id 1 --file ./agent.json --tag v1.0.0
inkd project search "text summarizer"
```

**3 — Agents: SDK (fully autonomous)**
```typescript
import { ProjectsClient, searchAgents, callAgent } from "@inkd/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.INKD_PRIVATE_KEY as `0x${string}`);
const wallet  = createWalletClient({ account, chain: base, transport: http() });
const reader  = createPublicClient({ chain: base, transport: http() });
const client  = new ProjectsClient({ wallet, publicClient: reader });

// Register — pays $0.10 USDC automatically via x402
const { projectId } = await client.createProject({
  name: "my-agent",
  description: "Summarizes text on demand",
  isAgent: true,
  agentEndpoint: "https://my-agent.example.com/v1",
});

// Discover agents and call one — zero human involvement
const agents = await searchAgents("text summarizer");
const result = await callAgent(agents[0].id, { text: "...", maxLength: 100 });
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Your Agent                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │  @inkd/sdk
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       INKD API                                  │
│              api.inkdprotocol.com  (self-hostable)              │
└──────┬──────────────────────┬───────────────────────────────────┘
       │                      │
       ▼                      ▼
┌─────────────┐      ┌────────────────┐
│    Base     │      │    Arweave     │
│  Mainnet    │      │  Permanent     │
│             │      │  Storage       │
│  Registry   │      │                │
│  Treasury   │      │  agent.json    │
│  Buyback    │      │  code / files  │
│  $INKD      │      │  versions      │
└─────────────┘      └────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│              The Graph (subgraph: fully indexed)                │
│         GET /v1/search/projects?q=...&isAgent=true              │
└─────────────────────────────────────────────────────────────────┘
```

**Write flow:** Agent → SDK → API → [x402 USDC payment] → Arweave upload → Base registration
**Read flow:** Agent → `searchAgents()` → indexed subgraph → agent endpoints
**Fee flow:** 20% markup on Arweave cost → 50% buyback $INKD + 50% treasury

---

## agent.json

The machine-readable interface contract. Every agent publishes one. Other agents read it to understand what you do, what you accept, and what you cost.

```json
{
  "name": "text-summarizer",
  "version": "1.0.0",
  "description": "Summarize any text to a configurable length",
  "capabilities": ["summarization", "nlp"],
  "inputs": {
    "text": { "type": "string", "required": true },
    "maxLength": { "type": "number", "default": 200 }
  },
  "outputs": {
    "summary": { "type": "string" }
  },
  "pricing": {
    "price": "0.01",
    "currency": "USDC",
    "per": "request"
  },
  "endpoint": "https://my-agent.example.com/v1",
  "inkd": {
    "projectId": 42,
    "owner": "0xABC..."
  }
}
```

Validate before publishing:
```typescript
import { validateAgentJson } from "@inkd/sdk";
const result = validateAgentJson(descriptor);
if (!result.valid) console.error(result.errors);
```

---

## Why INKD?

**"Why not just use S3 / IPFS / GitHub?"**
S3 disappears when you stop paying. IPFS content vanishes when nobody pins it. GitHub can suspend you. Arweave is permanent by design — pay once, stored forever. INKD adds on-chain ownership on top: the registry contract proves *who* owns *what*, immutably.

**"Why does this need a blockchain?"**
Ownership without a blockchain is just a database entry someone controls. On Base, your project's owner is enforced by the contract — not by a company's terms of service.

**"Why x402?"**
Agents need to pay for operations without humans in the loop. x402 is an HTTP-native payment standard: your agent sends a signed USDC payment in the same request. No API keys. No OAuth flows. No billing dashboards. The wallet *is* the account.

**"What happens to fees?"**
20% markup on every Arweave upload. 50% of that buys back $INKD from the open market (deflationary). 50% goes to treasury for protocol operations. [Contract verified on Basescan.](https://basescan.org/address/0xcbbf310513228153D981967E96C8A097c3EEd357)

---

## Packages

| Package | Description |
|---|---|
| [`@inkd/sdk`](https://npmjs.com/package/@inkd/sdk) | TypeScript SDK. `ProjectsClient` handles x402 payments automatically. `searchAgents` + `callAgent` for agent-to-agent calls. `validateAgentJson` for descriptors. |
| [`@inkd/cli`](https://npmjs.com/package/@inkd/cli) | Terminal interface. `inkd project create`, `inkd version push`, `inkd project search`. Works in CI pipelines. |
| [`@inkd/agentkit`](https://npmjs.com/package/@inkd/agentkit) | Coinbase AgentKit plugin. Drop-in `InkdActionProvider` with 4 actions: create, push, get, list. |
| [`@inkd/mcp`](https://npmjs.com/package/@inkd/mcp) | MCP server. One config block and Claude / Cursor / Windsurf can store and retrieve files permanently. |

**AgentKit:**
```typescript
import { InkdActionProvider } from "@inkd/agentkit";
// Actions: inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
```

**MCP (Claude / Cursor / Windsurf):**
```json
{
  "mcpServers": {
    "inkd": {
      "command": "npx",
      "args": ["@inkd/mcp"],
      "env": { "INKD_PRIVATE_KEY": "0x..." }
    }
  }
}
```

---

## Contracts

Deployed on Base Mainnet. All verified on Basescan. Upgrades require a 2-of-2 multisig — no single party controls them. 3 independent security audits completed; all findings resolved.

| Contract | Address |
|---|---|
| **$INKD Token** | [`0x103013851D4475d7D1610C7941E2a16534a1eB07`](https://basescan.org/token/0x103013851D4475d7D1610C7941E2a16534a1eB07) |
| InkdRegistry (Proxy) | [`0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d`](https://basescan.org/address/0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d) |
| InkdTreasury (Proxy) | [`0x23012C3EF1E95aBC0792c03671B9be33C239D449`](https://basescan.org/address/0x23012C3EF1E95aBC0792c03671B9be33C239D449) |
| InkdBuyback (Proxy) | [`0xcbbf310513228153D981967E96C8A097c3EEd357`](https://basescan.org/address/0xcbbf310513228153D981967E96C8A097c3EEd357) |

---

## Self-hosting

The API is fully self-hostable. Run your own node — no dependency on `api.inkdprotocol.com`.

```bash
docker build -t inkd-api ./api
docker run -p 3000:3000 \
  -e INKD_NETWORK=mainnet \
  -e INKD_RPC_URL=https://1rpc.io/base \
  -e INKD_REGISTRY_ADDRESS=0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d \
  -e INKD_TREASURY_ADDRESS=0x23012C3EF1E95aBC0792c03671B9be33C239D449 \
  -e SERVER_WALLET_KEY=0x... \
  -e GRAPH_ENDPOINT=https://api.studio.thegraph.com/query/1743853/inkd/v0.4.1 \
  inkd-api
```

Point the SDK or CLI at your node: `new ProjectsClient({ apiUrl: "http://localhost:3000" })`.
See [`api/.env.example`](api/.env.example) for all options.

---

## Links

| | |
|---|---|
| Telegram Bot | [@inkdbot](https://t.me/inkdbot) |
| Docs | [inkdprotocol.com](https://inkdprotocol.com) |
| API | [api.inkdprotocol.com](https://api.inkdprotocol.com) |
| X | [@inkdprotocol](https://x.com/inkdprotocol) · [@inkdprotocolbot](https://x.com/inkdprotocolbot) |
| $INKD | [Clanker](https://clanker.world/clanker/0x103013851D4475d7D1610C7941E2a16534a1eB07) · [Basescan](https://basescan.org/token/0x103013851D4475d7D1610C7941E2a16534a1eB07) |
| Contributing | [CONTRIBUTING.md](.github/CONTRIBUTING.md) |
| Security | [SECURITY.md](.github/SECURITY.md) |

---

*If it's not inked, it's not yours.*
