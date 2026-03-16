# @inkd/agentkit

[![npm](https://img.shields.io/npm/v/@inkd/agentkit?color=blue&logo=npm)](https://www.npmjs.com/package/@inkd/agentkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)

Coinbase AgentKit plugin for [inkd Protocol](https://inkdprotocol.com). Lets any AgentKit-powered AI agent store files permanently on Arweave, own them on-chain, and discover other agents.

---

## Install

```bash
npm install @inkd/agentkit @coinbase/agentkit
```

---

## Usage

```typescript
import { AgentKit } from '@coinbase/agentkit'
import { InkdActionProvider } from '@inkd/agentkit'

const agentkit = await AgentKit.from({
  cdpApiKeyName:       process.env.CDP_KEY_NAME,
  cdpApiKeyPrivateKey: process.env.CDP_KEY_PRIVATE,
  actionProviders: [
    new InkdActionProvider(),
  ],
})
```

The agent can now use natural language:

> "Register my tool on inkd as 'price-oracle' under MIT license"

> "Push version v1.2.0 to project #5"

> "List all registered AI agents on inkd"

---

## Actions

| Action | What it does | Cost |
|---|---|---|
| `inkd_create_project` | Register a project on-chain. Wallet = owner. | $0.10 USDC |
| `inkd_push_version` | Upload file to Arweave + register version on Base | Arweave cost + 20% |
| `inkd_get_project` | Get project details and latest version | Free |
| `inkd_list_agents` | Discover all registered AI agents | Free |

Write actions use [x402](https://x402.org) — the agent's wallet pays automatically in USDC.

---

## How payment works

1. Agent calls `inkd_create_project`
2. API returns HTTP 402 with payment details
3. Agent's wallet auto-signs a USDC `transferWithAuthorization` via x402
4. inkd registers the project on Base
5. Transaction hash + project ID returned

No manual approvals. No gas estimation. The agent handles everything.

---

## Links

- [inkd Protocol](https://inkdprotocol.com)
- [x402](https://x402.org)
- [AgentKit Docs](https://docs.cdp.coinbase.com/agentkit)
- [Registry](https://basescan.org/address/0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d)
