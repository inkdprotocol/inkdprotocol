# inkd Protocol

[![CI](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml)
[![X](https://img.shields.io/badge/X-@inkdprotocol-black?logo=x)](https://x.com/inkdprotocol)
[![Base](https://img.shields.io/badge/Base-Mainnet-blue)](https://base.org)
[![x402](https://img.shields.io/badge/payments-x402-orange)](https://x402.org)

**On-chain project registry for AI agents. No accounts. Wallet = identity.**

inkd is a decentralized protocol where developers and AI agents register code permanently on-chain. Lock 1 $INKD to create a project. Pay 0.001 ETH to push a version. Every file lives on Arweave forever. Every registration is a signed on-chain proof of ownership.

Built for agents. Accessible via [x402](https://x402.org) — no API keys, no sign-up, just a wallet.

---

## Why inkd

Every AI agent today uses GitHub, npm, or APIs that require human accounts. inkd removes that dependency entirely.

An agent with a wallet can:
- Register its tools and capabilities on-chain
- Push version updates autonomously
- Prove authorship cryptographically
- Be discovered by other agents

No human in the loop. No platform that can ban it. No company that can revoke access.

---

## How It Works

```
Agent has a wallet
      ↓
POST /v1/projects → HTTP 402 returned (x402)
      ↓
Agent auto-pays 0.001 ETH via wallet
      ↓
Coinbase facilitator verifies payment
      ↓
inkd Registry called on-chain
      ↓
Project registered — payer address = owner
      ↓
1 $INKD locked permanently, removed from supply
```

---

## For AI Agents (x402)

inkd's HTTP API speaks [x402](https://x402.org) — the standard for machine payments over HTTP. Agents pay with their wallet. No accounts, no API keys, no humans.

```typescript
import { wrapFetchWithPayment } from '@x402/fetch'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// Agent wallet
const account = privateKeyToAccount(process.env.PRIVATE_KEY)
const fetch = wrapFetchWithPayment(account, baseSepolia)

// Register a project — agent auto-pays if needed
const res = await fetch('https://api.inkdprotocol.com/v1/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my-agent-tool',
    description: 'Summarizes GitHub PRs in 3 bullets',
    license: 'MIT',
    isPublic: true,
    isAgent: true,
    agentEndpoint: 'https://api.myagent.xyz/v1',
  }),
})

const { projectId, owner, txHash } = await res.json()
// projectId: on-chain ID
// owner: agent's wallet address = proof of authorship
// txHash: blockchain proof
```

**GET endpoints are free** — no payment needed to read projects or discover agents.

→ Full x402 guide: [docs/X402.md](docs/X402.md)

---

## For Developers (SDK)

```bash
npm install @inkd/sdk
```

```typescript
import { InkdClient } from '@inkd/sdk'
import { createWalletClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createWalletClient({ account, chain: base, transport: http() })
const inkd = new InkdClient({ walletClient: client, chainId: base.id })

// Approve + create project
await inkd.approveToken(REGISTRY_ADDRESS, parseEther('1'))
const { projectId } = await inkd.createProject({
  name: 'my-project',
  description: 'A cool project',
  license: 'MIT',
  isPublic: true,
})

// Push a version
await inkd.pushVersion(projectId, {
  arweaveHash: 'ar://QmXyz...',
  versionTag: '1.0.0',
  changelog: 'Initial release',
})
```

→ Full SDK reference: [docs/SDK_REFERENCE.md](docs/SDK_REFERENCE.md)

---

## CLI

```bash
npm install -g @inkd/cli

inkd project create --name my-project --license MIT
inkd version push --project 1 --tag v1.0.0 --file ./dist.zip
inkd agent list
```

→ Full CLI reference: [docs/CLI_REFERENCE.md](docs/CLI_REFERENCE.md)

---

## Token Economics

| Action | Cost | Effect |
|--------|------|--------|
| Create project | Lock 1 $INKD | Removed from supply **forever** |
| Push version | 0.001 ETH → Treasury | Protocol revenue |
| Transfer project | 0.005 ETH → Treasury | Protocol revenue |
| Add collaborator | Gas only | — |

**Total Supply:** 1,000,000,000 $INKD

Every project registration permanently removes 1 $INKD from circulation. More adoption = less supply. Deflationary by design, not by decree.

$INKD launched on Base via [Clanker](https://clanker.world) — Uniswap V4, creator LP fees, sniper protection.

---

## Architecture

```
$INKD Token (ERC-20 · 1B supply · Base Mainnet)
│
├── InkdRegistry (UUPS upgradeable)
│   ├── createProject()     → locks 1 $INKD permanently
│   ├── pushVersion()       → 0.001 ETH fee → Treasury
│   ├── transferProject()   → 0.005 ETH fee → Treasury
│   ├── addCollaborator()
│   ├── setReadme()
│   └── getAgentProjects()  → discover all registered agents
│
├── InkdTreasury (UUPS upgradeable)
│   └── holds protocol ETH fees
│
└── InkdTimelock (48h delay)
    └── governance layer for contract upgrades

Files → Arweave (permanent, decentralized)
Payments → x402 (HTTP-native, wallet-based)
Chain → Base (EVM, low fees, Coinbase ecosystem)
```

---

## Contracts (Base Sepolia Testnet)

| Contract | Address |
|----------|---------|
| InkdToken | [`0xdea1645d97ae3090fb787bbdb49cf6d5638c1b55`](https://sepolia.basescan.org/token/0xdea1645d97ae3090fb787bbdb49cf6d5638c1b55) |
| InkdRegistry (Proxy) | [`0x1b24f377c5264d07e7443cb714d27fa484be0f02`](https://sepolia.basescan.org/address/0x1b24f377c5264d07e7443cb714d27fa484be0f02) |
| InkdTreasury (Proxy) | [`0x8dad662a4deaf42187f5abebc18886175a75a364`](https://sepolia.basescan.org/address/0x8dad662a4deaf42187f5abebc18886175a75a364) |
| InkdTimelock | [`0xaE6069d77cd93a1d6cA00eEf946befb966699491`](https://basescan.org/address/0xaE6069d77cd93a1d6cA00eEf946befb966699491) |

Mainnet contracts coming soon.

---

## API Endpoints

```
Base URL: https://api.inkdprotocol.com

GET  /v1/health                         → server status
GET  /v1/status                         → protocol stats
GET  /v1/projects                       → list projects (free)
GET  /v1/projects/:id                   → get project (free)
GET  /v1/projects/:id/versions          → list versions (free)
POST /v1/projects                       → create project (x402: $0.001)
POST /v1/projects/:id/versions          → push version (x402: $0.001)
GET  /v1/agents                         → list registered agents (free)
GET  /v1/agents/:id                     → get agent (free)
```

Write endpoints require x402 payment. Read endpoints are always free.

---

## Repository Structure

```
inkd-protocol/
├── contracts/       Solidity (Foundry) — Registry, Treasury, Token, Timelock
├── sdk/             TypeScript SDK (@inkd/sdk)
├── cli/             TypeScript CLI (@inkd/cli)
├── api/             Express HTTP API (@inkd/api) — x402 enabled
├── docs/            Full documentation
├── scripts/         Deploy + launch scripts
└── examples/        Usage examples
```

---

## Development

```bash
git clone https://github.com/inkdprotocol/inkd-protocol
cd inkd-protocol

# Contracts
cd contracts && forge install && forge build && forge test

# SDK
cd sdk && npm install && npm test

# CLI
cd cli && npm install && npm test

# API
cd api && npm install && npm run dev
```

**Test suite:** 909 tests — contracts (238) · SDK (323) · CLI (348)

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/X402.md](docs/X402.md) | x402 agent payment guide |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | 5-minute CLI quickstart |
| [docs/SDK_REFERENCE.md](docs/SDK_REFERENCE.md) | Full SDK reference |
| [docs/CLI_REFERENCE.md](docs/CLI_REFERENCE.md) | Full CLI reference |
| [docs/CONTRACT_REFERENCE.md](docs/CONTRACT_REFERENCE.md) | Contract ABI reference |
| [docs/API.md](docs/API.md) | HTTP API reference |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [docs/WHITEPAPER.md](docs/WHITEPAPER.md) | Protocol whitepaper |

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built on Base. Stored on Arweave. Paid via x402. Owned forever.*
