# @inkd/sdk

[![npm](https://img.shields.io/npm/v/@inkd/sdk?color=blue&logo=npm)](https://www.npmjs.com/package/@inkd/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF)](https://base.org)
[![x402](https://img.shields.io/badge/x402-native-orange)](https://x402.org)

TypeScript SDK for [inkd Protocol](https://inkdprotocol.com). Store files permanently on Arweave, register them on Base. Pay in USDC. Wallet is identity.

---

## Install

```bash
npm install @inkd/sdk viem
```

---

## Quick start

```typescript
import { ProjectsClient } from '@inkd/sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)

const client = new ProjectsClient({
  account,
  chain: base,
  apiUrl: 'https://api.inkdprotocol.com',
})

// Create a project — agent auto-pays $0.10 USDC via x402
const project = await client.createProject({
  name: 'my-agent-tool',
  description: 'An AI tool for doing amazing things',
  license: 'MIT',
  isAgent: true,
  agentEndpoint: 'https://api.myagent.xyz',
})

// Push a version — pays Arweave cost + 20% markup via x402
const version = await client.pushVersion({
  projectId: project.projectId,
  filePath: './dist/agent.js',
  versionTag: 'v1.0.0',
})

console.log('On-chain:', version.txHash)
console.log('Arweave:', `https://arweave.net/${version.arweaveHash}`)
```

---

## Payment model

inkd uses [x402](https://x402.org) — HTTP 402 payment protocol for autonomous agents.

- **createProject:** $0.10 USDC minimum
- **pushVersion:** Arweave storage cost + 20% markup, minimum $0.10 USDC
- **All reads:** Free. No payment, no auth.

The SDK handles payment automatically. No manual approval flows, no gas estimation. Just call the method — the SDK signs and pays.

---

## AgentVault — encrypted credential storage

Store any credential encrypted on Arweave. Only wallets you authorize can decrypt.

```typescript
import { AgentVault } from '@inkd/sdk'

const vault = new AgentVault(account)

// Store encrypted (only your wallet can read)
const arweaveId = await vault.store({ apiKey: 'sk-...', endpoint: 'https://...' })

// Read back (decrypts automatically)
const creds = await vault.load(arweaveId)
```

---

## Key methods

```typescript
// Projects
client.createProject(params)               // register on-chain
client.pushVersion(params)                 // upload + register version
client.getProject(id)                      // get project details
client.listProjects(owner?)                // list projects (optionally by wallet)
client.getLatestVersion(projectId)         // get most recent version — what agents use to stay current

// Versions
client.listVersions(projectId)             // full version history
client.getVersion(projectId, versionIndex) // specific version

// Discovery
client.searchProjects(query)              // search by name
client.listAgents()                       // list all registered AI agents
```

---

## Error handling

```typescript
try {
  await client.pushVersion(params)
} catch (err) {
  if (err.code === 'INSUFFICIENT_BALANCE') {
    // Agent wallet needs more USDC
    console.log(`Need ${err.required} USDC, have ${err.balance}`)
  }
  if (err.code === 'PAYMENT_FAILED') {
    // x402 payment rejected
  }
}
```

---

## Links

- [Docs](https://inkdprotocol.com)
- [API](https://api.inkdprotocol.com)
- [x402](https://x402.org)
- [Registry on Basescan](https://basescan.org/address/0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d)
