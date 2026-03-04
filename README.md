# inkd Protocol

[![CI](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml)
[![X](https://img.shields.io/badge/X-@inkdprotocol-black?logo=x)](https://x.com/inkdprotocol)
[![Base](https://img.shields.io/badge/Base-Mainnet-blue)](https://base.org)
[![x402](https://img.shields.io/badge/x402-native-orange)](https://x402.org)

**The on-chain registry for code that actually matters.**

Lock 1 $INKD. Your project is registered forever. Your wallet is the owner. Nobody can take it.

---

## What is inkd

inkd is a permanent, on-chain project registry built on Base. You lock 1 $INKD token to register a project. The token stays locked forever — permanently associated with that project. Every version you push is an Arweave hash stored immutably on-chain.

No accounts. No usernames. No platform.

**Wallet = identity. Lock = ownership. On-chain = forever.**

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
Agent auto-pays via wallet (@x402/fetch)
      ↓
inkd Registry called on Base
      ↓
Project registered on-chain
1 $INKD locked permanently
Agent wallet = owner
```

No API key. No OAuth. No human in the loop.

This is the first registry where an AI agent can own what it builds.

---

## The stack

inkd fits into the emerging agent infrastructure:

| Layer | Protocol | What it gives agents |
|-------|----------|---------------------|
| Payments | [x402](https://x402.org) | Pay for APIs autonomously |
| Identity | [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Verifiable on-chain identity |
| **Ownership** | **inkd** | **Own what you build, permanently** |

x402 was built by Coinbase. ERC-8004 was co-authored by MetaMask, Ethereum Foundation, Google, and Coinbase. inkd is the piece nobody else built.

---

## $INKD Token

$INKD launched on Base via [Clanker](https://clanker.world) — LP permanently locked, no admin control.

**The lock mechanic:**
- Register a project → 1 $INKD locked forever in the registry
- That token never unlocks. It's permanently associated with that project.
- Every new project removes 1 $INKD from circulation
- Protocol grows → supply decreases

This isn't a burn. It's a commitment. One project, one token, forever.

---

## Quick start

**For humans (CLI):**

```bash
npm install -g @inkd/cli

# Configure your wallet
inkd config set privateKey 0x...

# Register a project — locks 1 $INKD
inkd create my-project

# Push a version
inkd push my-project v1.0.0 ar://QmYourArweaveHash
```

**For AI agents (x402):**

```typescript
import { wrapFetchWithPayment } from '@x402/fetch'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
const fetch = wrapFetchWithPayment(account, base)

// Register — agent auto-pays if server returns 402
const res = await fetch('https://api.inkdprotocol.com/v1/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name:    'my-agent-tool',
    license: 'MIT',
    isAgent: true,
    agentEndpoint: 'https://api.myagent.xyz',
  }),
})

const { projectId, owner, txHash } = await res.json()
// owner = agent's wallet address = permanent on-chain proof
```

**GET endpoints are always free.** Read, discover, and query without paying.

---

## AgentKit + MCP

inkd ships native integrations for the two dominant agent frameworks:

**Coinbase AgentKit:**
```bash
npm install @inkd/agentkit
```
```typescript
import { InkdActionProvider } from '@inkd/agentkit'
// inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
// available as native actions in any AgentKit agent
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
|---------|-------------|
| `@inkd/sdk` | TypeScript SDK — InkdClient, ArweaveClient, events, batch reads |
| `@inkd/cli` | CLI tool — create, push, list, transfer |
| `@inkd/agentkit` | Coinbase AgentKit action provider |
| `@inkd/mcp` | Model Context Protocol server (Claude, Cursor) |

---

## Contracts

Deployed on Base Mainnet. All verified on Basescan. No admin keys. No pause function.

| Contract | Address |
|----------|---------|
| InkdRegistry (Proxy) | TBD post-launch |
| InkdTreasury (Proxy) | TBD post-launch |
| InkdTimelock (48h) | TBD post-launch |

---

## Test suite

1,011 tests. All green.

| Package | Tests |
|---------|-------|
| Contracts (Foundry) | 238 |
| SDK (vitest) | 323 |
| CLI (vitest) | 348 |
| AgentKit | 69 |
| MCP | 33 |

---

## Docs

- [x402 Agent Guide](docs/X402.md) — full guide for agent integrations
- [ERC-8004 Integration](docs/ERC8004.md) — inkd as the ownership layer for ERC-8004 agents
- [SDK Reference](docs/SDK_REFERENCE.md)
- [Subgraph](SUBGRAPH.md)
- [Security Review](SECURITY_REVIEW.md)
- [Audit Prep](AUDIT_PREP.md)

---

## Links

- Website: [inkdprotocol.com](https://inkdprotocol.com)
- X: [@inkdprotocol](https://x.com/inkdprotocol)
- GitHub: [inkdprotocol/inkd-protocol](https://github.com/inkdprotocol/inkd-protocol)

---

*If it's not inked, it's not yours.*
