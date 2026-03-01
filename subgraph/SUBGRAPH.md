# Inkd Protocol — Subgraph

The Graph indexer for the Inkd Protocol on Base.

---

## Files

```
subgraph/
├── schema.graphql       # GraphQL entity definitions
├── subgraph.yaml        # Manifest (data sources + event handlers)
├── package.json         # @graphprotocol/graph-cli dependency
├── abis/
│   ├── InkdRegistry.json
│   └── InkdTreasury.json
└── src/
    ├── registry.ts      # InkdRegistry event handlers (AssemblyScript)
    ├── treasury.ts      # InkdTreasury event handlers (AssemblyScript)
    └── utils.ts         # Shared helpers (stats singleton, ID builders)
```

---

## Deploy (after mainnet)

### 1. Install

```bash
cd subgraph
npm install
```

### 2. Update addresses

Edit `subgraph.yaml` — replace the two placeholder addresses and `startBlock`:

```yaml
source:
  address: "0xYOUR_REGISTRY_PROXY_ADDRESS"
  startBlock: 28000000   # block of deployment tx
```

### 3. Codegen

```bash
npm run codegen
# Generates subgraph/generated/* types from schema + ABIs
```

### 4. Build

```bash
npm run build
```

### 5. Authenticate with The Graph Studio

```bash
npm run auth
# Enter your deploy key from https://thegraph.com/studio/
```

### 6. Deploy

```bash
npm run deploy:studio
```

For testnet (Base Sepolia):

```bash
npm run deploy:sepolia
```

---

## Entities

| Entity | Description |
|--------|-------------|
| `Project` | Registered project (id = uint256 projectId) |
| `Version` | Versioned Arweave upload |
| `Collaborator` | Per-project collaborator (active flag) |
| `ProjectTransfer` | Historical ownership transfers |
| `ProtocolStats` | Global singleton — totals, current fees |
| `TreasuryEvent` | All ETH flows (deposit/withdraw/receive) |
| `Account` | Any address that has interacted with the protocol |

---

## Example Queries

### All projects

```graphql
{
  projects(first: 20, orderBy: createdAt, orderDirection: desc) {
    id
    name
    license
    owner
    isPublic
    isAgent
    versionCount
    createdAt
  }
}
```

### Latest versions across all projects

```graphql
{
  versions(first: 10, orderBy: pushedAt, orderDirection: desc) {
    id
    project { name owner }
    versionTag
    arweaveHash
    pushedBy
    pushedAt
  }
}
```

### All AI agent projects

```graphql
{
  projects(where: { isAgent: true }) {
    name
    agentEndpoint
    owner
    versionCount
  }
}
```

### Projects owned by a specific wallet

```graphql
{
  projects(where: { owner: "0xYOUR_ADDRESS" }) {
    name
    versionCount
    isPublic
    createdAt
  }
}
```

### Protocol stats

```graphql
{
  protocolStats(id: "global") {
    totalProjects
    totalVersions
    totalAgentProjects
    totalVersionFees
    totalTransferFees
    versionFee
    transferFee
    lastUpdated
  }
}
```

### Active collaborators on a project

```graphql
{
  collaborators(where: { project: "1", active: true }) {
    address
    addedAt
  }
}
```

### Treasury deposits

```graphql
{
  treasuryEvents(where: { eventType: "deposit" }, orderBy: timestamp, orderDirection: desc, first: 20) {
    amount
    account
    timestamp
    transactionHash
  }
}
```

### Transfer history for a project

```graphql
{
  projectTransfers(where: { project: "42" }, orderBy: timestamp) {
    from
    to
    timestamp
    transactionHash
  }
}
```

---

## Notes

- The `description` and `changelog` fields are NOT emitted in events — they are stored
  on Arweave. Use the contract ABI or SDK to fetch them if needed. The subgraph stores
  what is available on-chain for zero-latency queries.
- `ProtocolStats.totalVersionFees` and `totalTransferFees` are estimates based on
  the fee at the time of each event. Actual ETH amounts are tracked via `TreasuryEvent`.
- After upgrading the UUPS proxy, re-deploy the subgraph to pick up any new events
  added to the implementation.
