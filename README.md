# inkd Protocol

[![CI](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml)
[![X](https://img.shields.io/badge/X-@inkdprotocol-black?logo=x)](https://x.com/inkdprotocol)
[![Base](https://img.shields.io/badge/Base-Mainnet-blue)](https://base.org)
[![x402](https://img.shields.io/badge/x402-native-orange)](https://x402.org)

**The on-chain registry for code that actually matters.**

Code lives on Arweave. Permanently. Wallet is identity. Nobody can take it.

---

## What is inkd

inkd is a permanent, on-chain project registry built on Base. Pay a small USDC fee via x402 to register a project. Every version you push is an Arweave hash stored immutably on-chain.

No accounts. No usernames. No platform.

**Wallet = identity. On-chain = forever.**

---

## Why it exists

GitHub can ban you. npm can unpublish you. Any platform can revoke your access.

inkd cannot. The registry is a smart contract on Base. There is no admin key. There is no pause function. There is no company that controls it.

When you register on inkd, you are the owner. Full stop.

---

## Built for agents

inkd is x402-native. The API speaks [x402](https://x402.org) — the payment protocol for autonomous agents built by Coinbase.

An agent with a wallet can register, pay, and own — with zero human involvement:

```
Agent calls POST /v1/projects
      ↓
API returns HTTP 402 (payment required)
      ↓
Agent auto-pays USDC via wallet (@x402/fetch)
      ↓
inkd Registry called on Base
      ↓
Project registered on-chain. Agent wallet = owner.
```

No API key. No OAuth. No human in the loop.

---

## The stack

| Layer | Protocol | What it gives agents |
|---|---|---|
| Payments | x402 | Pay for APIs autonomously |
| Storage | Arweave | Permanent, immutable code storage |
| Ownership | inkd | Own what you build, on-chain |

---

## Quick start

**For humans (CLI):**

```bash
npm install -g @inkd/cli

inkd config set privateKey 0x...
inkd create my-project
inkd push my-project v1.0.0 ar://QmYourArweaveHash
```

**For AI agents (x402):**

```typescript
import { wrapFetchWithPayment } from '@x402/fetch'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
const fetch = wrapFetchWithPayment(account, base)

const res = await fetch('https://api.inkdprotocol.com/v1/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my-agent-tool',
    license: 'MIT',
    isAgent: true,
    agentEndpoint: 'https://api.myagent.xyz',
  }),
})

const { projectId, owner, txHash } = await res.json()
// owner = agent's wallet address = permanent on-chain proof
```

GET endpoints are always free. Read, discover, and query without paying.

---

## AgentKit + MCP

**Coinbase AgentKit:**

```bash
npm install @inkd/agentkit
```

```typescript
import { InkdActionProvider } from '@inkd/agentkit'
// inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
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

| Package | Description |
|---|---|
| `@inkd/sdk` | TypeScript SDK — ProjectsClient, AgentVault |
| `@inkd/cli` | CLI tool — create, push, list |
| `@inkd/agentkit` | Coinbase AgentKit action provider |
| `@inkd/mcp` | Model Context Protocol server |

---

## Contracts

Deployed on Base Mainnet. All verified on Basescan. No admin keys. No pause function.

| Contract | Address |
|---|---|
| InkdRegistry (Proxy) | `0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d` |
| InkdTreasury (Proxy) | `0x23012C3EF1E95aBC0792c03671B9be33C239D449` |
| InkdBuyback (Proxy) | `0xcbbf310513228153D981967E96C8A097c3EEd357` |

---

## Links

- **Docs:** [inkdprotocol.com](https://inkdprotocol.com)
- **X:** [@inkdprotocol](https://x.com/inkdprotocol)
- **API:** [api.inkdprotocol.com](https://api.inkdprotocol.com)

---

*If it's not inked, it's not yours.*
