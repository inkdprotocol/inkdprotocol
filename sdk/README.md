# @inkd/sdk

[![npm](https://img.shields.io/npm/v/@inkd/sdk?color=blue&logo=npm)](https://www.npmjs.com/package/@inkd/sdk)
[![CI](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/inkdprotocol/inkd-protocol/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)
[![Built on Base](https://img.shields.io/badge/Built%20on-Base-0052ff?logo=ethereum)](https://base.org)

TypeScript SDK for the **Inkd Protocol** — permanent on-chain project registry on Base. Lock 1 `$INKD` to register. Pay 0.001 ETH to push a version. Own your work forever.

---

## Installation

```bash
npm install @inkd/sdk viem
# or
pnpm add @inkd/sdk viem
# or
yarn add @inkd/sdk viem
```

> **Peer dependency:** [`viem`](https://viem.sh) ≥ 2.0.0 must be installed in your project.

---

## Quick Start

```typescript
import { InkdClient } from '@inkd/sdk'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const account = privateKeyToAccount('0x...')
const wallet = createWalletClient({ account, chain: base, transport: http() })

const inkd = new InkdClient({ walletClient: wallet, network: 'mainnet' })

// 1. Approve $INKD spend (one-time per project)
await inkd.approveToken()

// 2. Register your project on-chain
const hash = await inkd.createProject({
  name: 'my-awesome-tool',
  description: 'An AI tool for doing amazing things',
  license: 'MIT',
  isPublic: true,
  isAgent: true,
  agentEndpoint: 'https://api.myawesometool.xyz',
})

console.log('Project registered! tx:', hash)
```

---

## API Reference

### `new InkdClient(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `walletClient` | `WalletClient` | required | viem wallet client |
| `network` | `'mainnet' \| 'testnet'` | `'testnet'` | Target network |
| `rpcUrl` | `string` | viem default | Custom RPC URL |

---

### Token Methods

#### `approveToken(amount?)`
Approve the registry contract to spend `$INKD` tokens. Call before `createProject()`.

```typescript
await inkd.approveToken()              // approve 1 INKD (default)
await inkd.approveToken(parseEther('5')) // approve 5 INKD
```

#### `tokenBalance(address?)`
Get `$INKD` balance for an address (defaults to connected wallet).

```typescript
const balance = await inkd.tokenBalance()
// → 1000000000000000000n (1 INKD in wei)
```

---

### Project Methods

#### `createProject(opts)`
Register a new project. Requires 1 `$INKD` locked permanently.

```typescript
const hash = await inkd.createProject({
  name: 'my-project',            // unique, immutable, lowercase
  description: 'What it does',
  license: 'MIT',                // MIT | GPL-3.0 | Apache-2.0 | Proprietary
  readmeHash: 'ar://abc123',     // Arweave hash of README
  isPublic: true,
  isAgent: false,
  agentEndpoint: '',
})
```

#### `pushVersion(projectId, opts)`
Push a new version. Costs 0.001 ETH.

```typescript
const hash = await inkd.pushVersion(1n, {
  arweaveHash: 'ar://QmXyz...',
  versionTag: '1.2.0',
  changelog: 'Fixed critical bug in payment processor',
})
```

#### `getProject(projectId)`
Fetch project metadata from the registry.

```typescript
const project = await inkd.getProject(1n)
// → { id, name, description, license, owner, isAgent, versionCount, ... }
```

#### `getVersions(projectId)`
List all versions of a project.

```typescript
const versions = await inkd.getVersions(1n)
// → [{ arweaveHash, versionTag, changelog, pushedBy, pushedAt }, ...]
```

#### `transferProject(projectId, newOwner)`
Transfer project ownership. Costs 0.005 ETH.

```typescript
await inkd.transferProject(1n, '0xNewOwner...')
```

#### `getAgentProjects(offset?, limit?)`
List all AI agent projects registered on-chain.

```typescript
const ids = await inkd.getAgentProjects(0n, 50n)
// → [1n, 4n, 7n, ...]
```

---

### Fee Methods

#### `getVersionFee()`
Current fee to push a version (in wei).

```typescript
const fee = await inkd.getVersionFee()
// → 1000000000000000n (0.001 ETH)
```

---

## React Hooks

The SDK ships optional React hooks (requires `react` ≥ 18):

```typescript
import { useInkdProject, useInkdVersions, useInkdStats } from '@inkd/sdk/hooks'

function ProjectCard({ id }: { id: bigint }) {
  const { project, loading, error } = useInkdProject(client, id)

  if (loading) return <Spinner />
  if (error) return <Error message={error.message} />

  return (
    <div>
      <h2>{project.name}</h2>
      <p>{project.description}</p>
      <span>{project.versionCount.toString()} versions</span>
    </div>
  )
}
```

Available hooks:
- `useInkdProject(client, projectId)` — fetch project metadata
- `useInkdVersions(client, projectId)` — fetch all versions
- `useInkdStats(client)` — protocol-wide stats

---

## Error Handling

All SDK errors extend `InkdError`:

```typescript
import { InkdError, ProjectNotFound, InsufficientAllowance, InsufficientBalance } from '@inkd/sdk'

try {
  await inkd.createProject({ name: 'exists', ... })
} catch (err) {
  if (err instanceof ProjectNotFound) {
    console.log('Project does not exist')
  } else if (err instanceof InsufficientAllowance) {
    console.log('Need to approve $INKD first')
    await inkd.approveToken()
  } else if (err instanceof InkdError) {
    console.log('Protocol error:', err.message, err.code)
  } else {
    throw err // re-throw unexpected errors
  }
}
```

| Error Class | Code | When thrown |
|-------------|------|-------------|
| `InkdError` | — | Base class |
| `ProjectNotFound` | `PROJECT_NOT_FOUND` | Project ID doesn't exist |
| `ProjectNameTaken` | `PROJECT_NAME_TAKEN` | Name already registered |
| `Unauthorized` | `UNAUTHORIZED` | Not owner/collaborator |
| `InsufficientBalance` | `INSUFFICIENT_BALANCE` | Not enough $INKD |
| `InsufficientAllowance` | `INSUFFICIENT_ALLOWANCE` | Token not approved |
| `InvalidArweaveHash` | `INVALID_ARWEAVE_HASH` | Bad hash format |
| `VersionAlreadyExists` | `VERSION_ALREADY_EXISTS` | Tag already pushed |
| `ClientNotConnected` | `CLIENT_NOT_CONNECTED` | No wallet connected |
| `ArweaveNotConnected` | `ARWEAVE_NOT_CONNECTED` | Arweave client missing |
| `EncryptionError` | `ENCRYPTION_ERROR` | Encryption/decryption failed |

---

## AI Agent Usage

Register your AI agent's capabilities on-chain:

```typescript
const hash = await inkd.createProject({
  name: 'my-agent-v1',
  description: 'Autonomous coding agent — builds and deploys software',
  license: 'Proprietary',
  isAgent: true,
  agentEndpoint: 'https://api.myagent.xyz/v1',
  isPublic: true,
})
```

Query all registered agents:

```typescript
const agentIds = await inkd.getAgentProjects(0n, 100n)
const agents = await Promise.all(agentIds.map(id => inkd.getProject(id)))
```

---

## Network Addresses

| Contract | Mainnet (Base) | Testnet (Base Sepolia) |
|----------|---------------|------------------------|
| `InkdToken` | TBD | TBD |
| `InkdRegistry` | TBD | TBD |
| `InkdTreasury` | TBD | TBD |

> Addresses will be populated after mainnet deployment.

---

## Contributing

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) in the monorepo root.

**Dev setup:**
```bash
cd sdk
npm install
npm test           # run 42 unit tests
npm run typecheck  # TypeScript check
npm run build      # compile to dist/
```

---

## License

MIT — see [LICENSE](../LICENSE)

---

*Made by [Inkd Protocol](https://inkdprotocol.xyz)*
