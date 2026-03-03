# Inkd Protocol — Subgraph Guide

> Query on-chain Inkd Protocol data via [The Graph](https://thegraph.com) using GraphQL. No RPC calls, no pagination headaches — just structured queries.

---

## Overview

The Inkd Subgraph indexes all events emitted by `InkdRegistry`, `InkdTreasury`, and `InkdTimelock`. It exposes:

- Every project ever created (name, owner, license, visibility, agent flag)
- All versions pushed to each project (Arweave hash, tag, changelog, pusher, timestamp)
- Collaborator history (add / remove events)
- Project transfers and ownership changes
- Fee update history
- Treasury deposits/withdrawals
- Timelock governance queue (queued, cancelled, executed transactions)

---

## Hosted Service (Testnet)

> ⚠️ Subgraph deployments are community-maintained. Check the [Inkd Discord](https://discord.gg/inkdprotocol) for current endpoints.

```
Testnet (Base Sepolia):
  https://api.studio.thegraph.com/query/<id>/inkd-protocol-testnet/v0.0.1

Mainnet (Base):
  TBD — pending v1.0.0 deploy
```

For local development, run a Graph Node against an Anvil fork (see [Local Development](#local-development)).

---

## Schema

### Entities

#### `Project`

```graphql
type Project @entity {
  id: ID!                      # uint256 project ID (string)
  projectId: BigInt!
  name: String!
  description: String!
  license: String!
  readmeHash: String!
  owner: Bytes!                # current owner address
  isPublic: Boolean!
  isAgent: Boolean!
  agentEndpoint: String!
  createdAt: BigInt!           # block timestamp
  createdBlock: BigInt!
  versionCount: BigInt!
  versions: [Version!]! @derivedFrom(field: "project")
  collaborators: [Collaborator!]! @derivedFrom(field: "project")
  transfers: [ProjectTransfer!]! @derivedFrom(field: "project")
}
```

#### `Version`

```graphql
type Version @entity {
  id: ID!                      # "<projectId>-<versionIndex>"
  project: Project!
  arweaveHash: String!
  versionTag: String!
  changelog: String!
  pushedBy: Bytes!
  pushedAt: BigInt!
  pushedBlock: BigInt!
  versionIndex: BigInt!        # 0-indexed within the project
}
```

#### `Collaborator`

```graphql
type Collaborator @entity {
  id: ID!                      # "<projectId>-<address>"
  project: Project!
  address: Bytes!
  addedAt: BigInt!
  addedBlock: BigInt!
  removedAt: BigInt            # null if still active
  isActive: Boolean!
}
```

#### `ProjectTransfer`

```graphql
type ProjectTransfer @entity {
  id: ID!                      # "<txHash>-<logIndex>"
  project: Project!
  oldOwner: Bytes!
  newOwner: Bytes!
  transferredAt: BigInt!
  transferredBlock: BigInt!
}
```

#### `FeeUpdate`

```graphql
type FeeUpdate @entity {
  id: ID!                      # "<txHash>-<logIndex>"
  kind: String!                # "version" | "transfer"
  oldFee: BigInt!
  newFee: BigInt!
  updatedAt: BigInt!
  updatedBlock: BigInt!
}
```

#### `TreasuryEvent`

```graphql
type TreasuryEvent @entity {
  id: ID!                      # "<txHash>-<logIndex>"
  kind: String!                # "deposit" | "withdraw"
  actor: Bytes!
  amount: BigInt!
  timestamp: BigInt!
  block: BigInt!
}
```

#### `TimelockTransaction`

```graphql
type TimelockTransaction @entity {
  id: ID!                      # txHash (bytes32)
  target: Bytes!
  value: BigInt!
  data: Bytes!
  eta: BigInt!
  status: String!              # "queued" | "executed" | "cancelled"
  queuedAt: BigInt!
  queuedBlock: BigInt!
  executedAt: BigInt           # null until executed
  cancelledAt: BigInt          # null unless cancelled
}
```

#### `ProtocolStats` (singleton)

```graphql
type ProtocolStats @entity {
  id: ID!                      # always "global"
  totalProjects: BigInt!
  totalAgents: BigInt!
  totalVersions: BigInt!
  totalTransfers: BigInt!
  versionFee: BigInt!
  transferFee: BigInt!
  lastUpdated: BigInt!
}
```

---

## Mappings

Full AssemblyScript source lives in `subgraph/src/mapping.ts`. Key handlers:

### `handleProjectCreated`

```typescript
export function handleProjectCreated(event: ProjectCreated): void {
  let project = new Project(event.params.projectId.toString())
  project.projectId    = event.params.projectId
  project.name         = event.params.name
  project.license      = event.params.license
  project.owner        = event.params.owner
  project.description  = ""
  project.readmeHash   = ""
  project.isPublic     = true
  project.isAgent      = false
  project.agentEndpoint = ""
  project.createdAt    = event.block.timestamp
  project.createdBlock = event.block.number
  project.versionCount = BigInt.fromI32(0)
  project.save()

  let stats = getOrCreateStats()
  stats.totalProjects = stats.totalProjects.plus(BigInt.fromI32(1))
  stats.lastUpdated   = event.block.timestamp
  stats.save()
}
```

### `handleVersionPushed`

```typescript
export function handleVersionPushed(event: VersionPushed): void {
  let project = Project.load(event.params.projectId.toString())
  if (project == null) return

  let versionId = event.params.projectId.toString()
    + "-"
    + project.versionCount.toString()

  let version = new Version(versionId)
  version.project      = project.id
  version.arweaveHash  = event.params.arweaveHash
  version.versionTag   = event.params.versionTag
  version.changelog    = ""   // not emitted; enrich via Arweave fetch
  version.pushedBy     = event.params.pushedBy
  version.pushedAt     = event.block.timestamp
  version.pushedBlock  = event.block.number
  version.versionIndex = project.versionCount
  version.save()

  project.versionCount = project.versionCount.plus(BigInt.fromI32(1))
  project.save()

  let stats = getOrCreateStats()
  stats.totalVersions = stats.totalVersions.plus(BigInt.fromI32(1))
  stats.save()
}
```

### `handleAgentRegistered`

```typescript
export function handleAgentRegistered(event: AgentRegistered): void {
  let project = Project.load(event.params.projectId.toString())
  if (project == null) return
  project.isAgent        = true
  project.agentEndpoint  = event.params.endpoint
  project.save()

  let stats = getOrCreateStats()
  stats.totalAgents = stats.totalAgents.plus(BigInt.fromI32(1))
  stats.save()
}
```

---

## Example Queries

### All projects (newest first)

```graphql
{
  projects(first: 20, orderBy: createdAt, orderDirection: desc) {
    id
    name
    license
    owner
    isAgent
    versionCount
    createdAt
  }
}
```

### All versions for a project

```graphql
{
  versions(
    where: { project: "42" }
    orderBy: versionIndex
    orderDirection: asc
  ) {
    versionTag
    arweaveHash
    pushedBy
    pushedAt
  }
}
```

### All agent projects with endpoints

```graphql
{
  projects(
    where: { isAgent: true, isPublic: true }
    first: 50
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    name
    agentEndpoint
    owner
    versionCount
  }
}
```

### Projects owned by an address

```graphql
query OwnerProjects($owner: Bytes!) {
  projects(where: { owner: $owner }, orderBy: createdAt, orderDirection: desc) {
    id
    name
    isAgent
    versionCount
    versions(orderBy: versionIndex, orderDirection: desc, first: 1) {
      versionTag
      pushedAt
      arweaveHash
    }
  }
}
```

### Active collaborators for a project

```graphql
{
  collaborators(where: { project: "7", isActive: true }) {
    address
    addedAt
  }
}
```

### Fee history

```graphql
{
  feeUpdates(orderBy: updatedAt, orderDirection: asc) {
    kind
    oldFee
    newFee
    updatedAt
  }
}
```

### Pending timelock transactions

```graphql
{
  timelockTransactions(where: { status: "queued" }, orderBy: eta, orderDirection: asc) {
    id
    target
    value
    data
    eta
    queuedAt
  }
}
```

### Protocol-wide stats

```graphql
{
  protocolStats(id: "global") {
    totalProjects
    totalAgents
    totalVersions
    totalTransfers
    versionFee
    transferFee
    lastUpdated
  }
}
```

---

## SDK Integration

The SDK's `events.ts` module watches chain events in real time. For historical queries or dashboards, combine with subgraph fetches:

```typescript
import { InkdClient } from "@inkd/sdk";

const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/<id>/inkd-protocol-testnet/v0.0.1";

async function getAgentProjects() {
  const query = `{
    projects(where: { isAgent: true }, first: 100, orderBy: createdAt, orderDirection: desc) {
      id name agentEndpoint owner versionCount
    }
  }`;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const { data } = await res.json();
  return data.projects;
}

// Combine with live events for a hybrid feed
const client = new InkdClient({ network: "testnet" });
const historicalAgents = await getAgentProjects();

const unwatch = client.watchVersionPushed({}, (log) => {
  console.log("New version pushed:", log.args);
});
```

---

## Deployment

### Prerequisites

```bash
npm install -g @graphprotocol/graph-cli
```

### Clone and configure

```bash
git clone https://github.com/inkdprotocol/inkd-subgraph
cd inkd-subgraph
```

Edit `subgraph.yaml` — set your network and contract address:

```yaml
dataSources:
  - kind: ethereum
    name: InkdRegistry
    network: base-sepolia          # or base for mainnet
    source:
      address: "0x..."             # InkdRegistry proxy address
      abi: InkdRegistry
      startBlock: 12345678         # block the contract was deployed at
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Project
        - Version
        - Collaborator
        - ProjectTransfer
        - FeeUpdate
        - ProtocolStats
      abis:
        - name: InkdRegistry
          file: ./abis/InkdRegistry.json
      eventHandlers:
        - event: ProjectCreated(indexed uint256,indexed address,string,string)
          handler: handleProjectCreated
        - event: VersionPushed(indexed uint256,string,string,address)
          handler: handleVersionPushed
        - event: CollaboratorAdded(indexed uint256,address)
          handler: handleCollaboratorAdded
        - event: CollaboratorRemoved(indexed uint256,address)
          handler: handleCollaboratorRemoved
        - event: ProjectTransferred(indexed uint256,indexed address,indexed address)
          handler: handleProjectTransferred
        - event: VisibilityChanged(indexed uint256,bool)
          handler: handleVisibilityChanged
        - event: VersionFeeUpdated(uint256,uint256)
          handler: handleVersionFeeUpdated
        - event: TransferFeeUpdated(uint256,uint256)
          handler: handleTransferFeeUpdated
        - event: AgentRegistered(indexed uint256,string)
          handler: handleAgentRegistered
        - event: ReadmeUpdated(indexed uint256,string)
          handler: handleReadmeUpdated
      file: ./src/mapping.ts
```

### Build and deploy

```bash
# Authenticate with Subgraph Studio
graph auth --studio <deploy-key>

# Code-generate types from schema + ABIs
graph codegen

# Build WASM
graph build

# Deploy to Subgraph Studio
graph deploy --studio inkd-protocol-testnet
```

---

## Local Development

Run a Graph Node locally against Anvil:

```bash
# 1. Start Anvil fork of Base Sepolia
anvil --fork-url $BASE_SEPOLIA_RPC --fork-block-number 12345678 &

# 2. Start Graph Node (Docker)
docker run -d \
  -e ethereum="base-sepolia:http://host.docker.internal:8545" \
  -p 8000:8000 -p 8001:8001 -p 8020:8020 \
  graphprotocol/graph-node

# 3. Create and deploy local subgraph
graph create --node http://localhost:8020 inkd-local
graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 inkd-local
```

Query endpoint: `http://localhost:8000/subgraphs/name/inkd-local`

---

## Notes

- **Arweave content** (description, changelog body) is not stored on-chain; only the `arweaveHash` is indexed. Enrich queries by fetching `https://arweave.net/<hash>` for full content.
- **Upgradeable proxy**: The `InkdRegistry` is a UUPS proxy. The subgraph tracks the proxy address — upgrades are transparent.
- **Timelock lag**: After `queueTransaction`, there is a 48-hour delay before `executeTransaction`. Monitor `timelockTransactions(where: { status: "queued" })` for pending governance actions.

---

## See Also

- [SDK Reference](./docs/SDK_REFERENCE.md) — Event subscriptions via `watchProjectCreated`, `watchVersionPushed`
- [Contract Reference](./docs/CONTRACT_REFERENCE.md) — Full Solidity function and event reference
- [Architecture](./docs/ARCHITECTURE.md) — Protocol overview and contract roles
- [CLI Reference](./docs/CLI_REFERENCE.md) — `inkd watch` for live event tailing
