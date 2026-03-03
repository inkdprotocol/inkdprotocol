# @inkd/agentkit

Coinbase AgentKit action provider for [inkd Protocol](https://inkdprotocol.com).

Gives any AgentKit-powered AI agent the ability to **register code on-chain**, push version updates, and discover other registered agents — using only its wallet. No API keys. No accounts.

---

## Install

```bash
npm install @inkd/agentkit @coinbase/agentkit
```

## Usage

```typescript
import { AgentKit } from '@coinbase/agentkit'
import { InkdActionProvider } from '@inkd/agentkit'

const agentkit = await AgentKit.from({
  cdpApiKeyName:       process.env.CDP_KEY_NAME,
  cdpApiKeyPrivateKey: process.env.CDP_KEY_PRIVATE,
  actionProviders: [
    new InkdActionProvider(),
    // ...your other providers
  ],
})
```

That's it. The agent can now call inkd actions:

> "Register my tool on inkd as 'price-oracle' under MIT license"

> "Push version v1.2.0 with Arweave hash ar://QmXyz... to project #5"

> "List all registered AI agents on inkd"

---

## Actions

| Action | Description | Cost |
|--------|-------------|------|
| `inkd_create_project` | Register a project on-chain, wallet = owner | x402: $0.001 |
| `inkd_push_version` | Push a new version with content hash | x402: $0.001 |
| `inkd_get_project` | Get project details by ID | Free |
| `inkd_list_agents` | Discover registered AI agents | Free |

Write actions use x402 — the agent's wallet pays automatically. Read actions are always free.

---

## What Happens On-Chain

When an agent calls `inkd_create_project`:

1. Request hits `POST https://api.inkdprotocol.com/v1/projects`
2. Server returns HTTP 402 with payment details ($0.001)
3. Agent's wallet auto-pays via x402
4. Coinbase facilitator verifies payment
5. inkd Registry called on Base: `createProject(name, description, ...)`
6. **1 $INKD locked permanently** in the Registry (removed from supply)
7. Agent's wallet address = on-chain owner of the project
8. Project ID returned — immutable proof of authorship

---

## Customize API Endpoint

```typescript
// Use testnet (Base Sepolia)
new InkdActionProvider({ apiUrl: 'https://api-sepolia.inkdprotocol.com' })

// Use local development server
new InkdActionProvider({ apiUrl: 'http://localhost:3000' })
```

---

## Links

- [inkd Protocol](https://inkdprotocol.com)
- [x402 Docs](https://x402.org)
- [AgentKit Docs](https://docs.cdp.coinbase.com/agentkit)
- [On-chain Registry](https://basescan.org/address/0x1b24f377c5264d07e7443cb714d27fa484be0f02)
