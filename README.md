# inkd

[![CI](https://github.com/inkdprotocol/inkdprotocol/actions/workflows/ci.yml/badge.svg)](https://github.com/inkdprotocol/inkdprotocol/actions/workflows/ci.yml)
[![SDK](https://img.shields.io/npm/v/@inkd/sdk?label=%40inkd%2Fsdk&color=blue)](https://www.npmjs.com/package/@inkd/sdk)
[![CLI](https://img.shields.io/npm/v/@inkd/cli?label=%40inkd%2Fcli&color=blue)](https://www.npmjs.com/package/@inkd/cli)
[![AgentKit](https://img.shields.io/npm/v/@inkd/agentkit?label=%40inkd%2Fagentkit&color=blue)](https://www.npmjs.com/package/@inkd/agentkit)
[![MCP](https://img.shields.io/npm/v/@inkd/mcp?label=%40inkd%2Fmcp&color=blue)](https://www.npmjs.com/package/@inkd/mcp)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?logo=coinbase)](https://base.org)
[![x402](https://img.shields.io/badge/x402-native-orange)](https://x402.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Permanent on-chain storage for code, files, and agents.**

Files live on Arweave. Ownership lives on Base. Your wallet is your identity. Nobody can take it.

---

## The problem

GitHub can ban you. npm can unpublish you. Any platform can revoke access overnight.

inkd cannot. It's a smart contract on Base. No admin key. No pause function. No company that controls it.

**When you register on inkd, you own it. Permanently. Full stop.**

---

## How it works

1. Pay a small USDC fee via [x402](https://x402.org)
2. Your file gets uploaded to Arweave (permanent storage)
3. The Arweave hash is registered on-chain via the inkd Registry
4. Your wallet is the owner — forever

Each upload is a new version. Nothing is ever overwritten — v1 stays on Arweave when you push v2. Agents always know the latest version via `getLatestVersion(projectId)`.

No accounts. No usernames. No platform lock-in.

---

## Built for agents

inkd is x402-native — the payment standard for autonomous agents by Coinbase.

An agent with a wallet can register, pay, and own with **zero human involvement:**

```
Agent calls POST /v1/projects
      ↓
API returns HTTP 402 (payment required)
      ↓
Agent auto-pays USDC via wallet (@x402/fetch)
      ↓
File uploaded to Arweave, hash registered on Base
      ↓
Project owned by agent's wallet. On-chain. Forever.
```

No API key. No OAuth. No human in the loop.

---

## Quick start

**Telegram Bot (easiest):**

→ [@inkdbot](https://t.me/inkdbot)

Upload anything — files, text, GitHub repos — directly from Telegram. Pay in USDC on Base.

---

**CLI:**

```bash
npm install -g @inkd/cli

export INKD_PRIVATE_KEY=0x...

inkd project create --name my-project
inkd version push --id 1 --file ./dist/bundle.js --tag v1.0.0
```

---

**AI agents (x402):**

```typescript
import { wrapFetchWithPayment } from '@x402/fetch'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
const fetch = wrapFetchWithPayment(account, base)

// Create project — agent auto-pays USDC
const res = await fetch('https://api.inkdprotocol.com/v1/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my-agent-tool',
    license: 'MIT',
    isAgent: true,
  }),
})

const { projectId, txHash } = await res.json()
// txHash = on-chain proof of ownership
```

GET endpoints are always free. No payment needed to read or discover.

---

## AgentKit + MCP

**Coinbase AgentKit:**

```bash
npm install @inkd/agentkit
```

```typescript
import { InkdActionProvider } from '@inkd/agentkit'
// Actions: inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
```

**Claude / Cursor (MCP):**

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

## Packages

| Package | Version | What it does |
|---|---|---|
| [`@inkd/sdk`](https://npmjs.com/package/@inkd/sdk) | [![npm](https://img.shields.io/npm/v/@inkd/sdk)](https://npmjs.com/package/@inkd/sdk) | TypeScript SDK. `ProjectsClient` handles x402 payments automatically. `AgentVault` stores credentials encrypted on Arweave. |
| [`@inkd/cli`](https://npmjs.com/package/@inkd/cli) | [![npm](https://img.shields.io/npm/v/@inkd/cli)](https://npmjs.com/package/@inkd/cli) | CLI tool for humans and CI pipelines. `inkd project create`, `inkd version push`, `inkd project list`. |
| [`@inkd/agentkit`](https://npmjs.com/package/@inkd/agentkit) | `0.1.2` | Coinbase AgentKit plugin. Drop-in action provider for AI agents built on CDP. 4 actions: create, push, get, list. |
| [`@inkd/mcp`](https://npmjs.com/package/@inkd/mcp) | `0.1.1` | MCP server for Claude, Cursor, Windsurf. One config line and any MCP-compatible AI can store and retrieve files permanently. |

---

## Contracts

Deployed on Base Mainnet. All verified on Basescan.

| Contract | Address |
|---|---|
| **$INKD Token** | [`0x1030...1eB07`](https://basescan.org/token/0x103013851D4475d7D1610C7941E2a16534a1eB07) |
| InkdRegistry (Proxy) | [`0xEd30...3e5d`](https://basescan.org/address/0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d) |
| InkdTreasury (Proxy) | [`0x2301...D449`](https://basescan.org/address/0x23012C3EF1E95aBC0792c03671B9be33C239D449) |
| InkdBuyback (Proxy) | [`0xcbbf...d357`](https://basescan.org/address/0xcbbf310513228153D981967E96C8A097c3EEd357) |

Revenue from uploads is split: 50% buyback of $INKD, 50% treasury. LP auto-locked via Clanker.

---

## Links

- **Bot:** [@inkdbot](https://t.me/inkdbot)
- **Docs:** [inkdprotocol.com](https://inkdprotocol.com)
- **API:** [api.inkdprotocol.com](https://api.inkdprotocol.com)
- **X:** [@inkdprotocol](https://x.com/inkdprotocol) · [@inkdprotocolbot](https://x.com/inkdprotocolbot)
- **$INKD:** [Clanker](https://clanker.world/clanker/0x103013851D4475d7D1610C7941E2a16534a1eB07)

---

*If it's not inked, it's not yours.*
