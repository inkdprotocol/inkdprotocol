# Inkd Protocol

**Permanent on-chain project registry. Powered by Base.**

Inkd is a decentralized protocol for publishing and versioning projects permanently on-chain. Lock 1 $INKD token to create a project. Push unlimited versions to Arweave. Transfer ownership trustlessly. Built for developers and AI agents.

---

## How It Works

```
1. Lock 1 $INKD → Create a project (unique name, on-chain forever)
2. Pay 0.001 ETH → Push a version (stored permanently on Arweave)
3. Manage → Add collaborators, update README, transfer ownership
```

Every project has:
- A unique on-chain name (permanent, immutable)
- Unlimited versioned uploads (`alpha`, `beta`, `1.0.0`, etc.)
- On-chain changelog per version
- License declaration (`MIT`, `GPL-3.0`, `Apache-2.0`, `Proprietary`)
- README hash (Arweave)
- Collaborator access control
- Public / private visibility

---

## Token Economics

| Action | Cost |
|--------|------|
| Create project | Lock 1 $INKD (permanent) |
| Push version | 0.001 ETH |
| Transfer project | 0.005 ETH |
| Add collaborator | Gas only |

$INKD locked per project is never burned — it's locked forever. Every new project permanently removes supply. Fully deflationary.

**Total Supply:** 1,000,000,000 $INKD

---

## Contracts (Base)

| Contract | Address |
|----------|---------|
| InkdToken | `TBD` |
| InkdRegistry | `TBD` |
| InkdTreasury | `TBD` |

---

## Indexing (The Graph)

The protocol is fully indexed via a The Graph subgraph (`subgraph/`).

Query any project, version, collaborator, or treasury event in milliseconds — no RPC calls needed.

```graphql
# Example: all AI agent projects
{
  projects(where: { isAgent: true }) {
    name
    agentEndpoint
    versionCount
    owner
  }
}
```

See [`subgraph/SUBGRAPH.md`](./subgraph/SUBGRAPH.md) for the full deploy guide and example queries.

---

## For AI Agents

Inkd is built with AI agents as first-class citizens.

Agents can register their tools, APIs, and capabilities on-chain:

```solidity
registry.createProject(
  "my-agent-tool",
  "Summarizes GitHub PRs in 3 bullets",
  "MIT",
  "https://api.myagent.xyz/v1",  // agent endpoint
  true,   // isAgent = true
  true    // isPublic
);
```

Other agents can discover all registered agent tools:

```solidity
registry.getAgentProjects(0, 100); // paginated
```

---

## Quick Start

### Install

```bash
npm install @inkd/sdk
```

### Create a project

```typescript
import { InkdClient } from '@inkd/sdk'

const inkd = new InkdClient({ signer, chainId: 8453 }) // Base

// Approve $INKD spend first
await inkd.token.approve(REGISTRY_ADDRESS, parseEther('1'))

// Create project
const { projectId } = await inkd.createProject({
  name: 'my-project',
  description: 'A cool project',
  license: 'MIT',
  isPublic: true,
})

// Push a version
await inkd.pushVersion(projectId, {
  arweaveHash: 'abc123...',
  versionTag: '1.0.0',
  changelog: 'Initial release',
})
```

---

## Development

```bash
# Clone
git clone https://github.com/inkdprotocol/inkd-protocol
cd inkd-protocol/contracts

# Install dependencies
forge install

# Build
forge build

# Test
forge test

# Deploy to Base Sepolia testnet
forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast
```

---

## Architecture

```
InkdToken (ERC-20, 1B supply)
    └── InkdRegistry (UUPS upgradeable)
            ├── createProject()    → locks 1 $INKD
            ├── pushVersion()      → 0.001 ETH → Treasury
            ├── transferProject()  → 0.005 ETH → Treasury
            ├── addCollaborator()
            ├── setReadme()
            └── getAgentProjects()
    └── InkdTreasury (UUPS upgradeable)
            └── withdraw()         → owner/multisig
```

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built on Base. Stored on Arweave. Owned by you.*
