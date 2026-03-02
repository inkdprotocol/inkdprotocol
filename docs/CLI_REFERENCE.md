# Inkd Protocol — CLI Reference

> `@inkd/cli` — Terminal interface for the Inkd Protocol. Manage projects, push versions, monitor agents, and control your $INKD tokens without touching the SDK.

---

## Installation

```bash
npm install -g @inkd/cli
```

Or run without installing:

```bash
npx @inkd/cli <command>
```

---

## Configuration

### Environment variables (recommended)

```bash
export INKD_PRIVATE_KEY=0x...     # Your wallet private key
export INKD_NETWORK=testnet       # mainnet | testnet (default: testnet)
export INKD_RPC_URL=https://...   # Custom RPC (optional)
```

### Config file

Run `inkd init` to scaffold `inkd.config.json` in your project directory:

```json
{
  "network": "testnet"
}
```

> ⚠️ Never store your private key in `inkd.config.json`. Use `INKD_PRIVATE_KEY`.

---

## Commands

### `inkd init`

Scaffold `inkd.config.json` in the current directory.

```bash
inkd init
```

---

### `inkd status`

Show network status, contract addresses, version fee, transfer fee, and total project count.

```bash
inkd status
```

Example output:
```
  Inkd Protocol Status
  ────────────────────────────────────────
  Network:   testnet
  Registry:  0x...
  Token:     0x...
  Treasury:  0x...

  Projects:      42
  Version fee:   0.001 ETH
  Transfer fee:  0.005 ETH
```

---

## Token Commands

Manage your $INKD ERC-20 balance, allowances, and transfers.

### `inkd token balance [address]`

Show $INKD and ETH balance for an address. Defaults to own wallet if `INKD_PRIVATE_KEY` is set.

```bash
inkd token balance
inkd token balance 0xABC...123
inkd token balance --json        # JSON output
```

**Flags:**
- `--json` — Output as JSON (for scripting)

**JSON output:**
```json
{
  "address": "0x...",
  "inkd": "100.0",
  "eth": "0.05",
  "network": "testnet"
}
```

---

### `inkd token allowance [address]`

Check how much $INKD the InkdRegistry contract is approved to spend on behalf of an address.
Shows a warning if the allowance is below 1 $INKD (required to create a project).

```bash
inkd token allowance
inkd token allowance 0xABC...123
inkd token allowance --json
```

**JSON output:**
```json
{
  "owner": "0x...",
  "spender": "0x...",
  "allowance": "10.0",
  "sufficientForProject": true,
  "network": "testnet"
}
```

---

### `inkd token approve <amount>`

Approve the InkdRegistry to spend N $INKD on your behalf.
Required before calling `inkd project create`.

```bash
inkd token approve 1        # Approve minimum (1 INKD for one project)
inkd token approve 10       # Approve for multiple projects
inkd token approve 1 --json
```

**Flags:**
- `--json` — Output approval receipt as JSON

**JSON output:**
```json
{
  "success": true,
  "hash": "0x...",
  "amount": "1.0",
  "spender": "0x...",
  "from": "0x...",
  "blockNumber": "12345678",
  "network": "testnet"
}
```

---

### `inkd token transfer <to> <amount>`

Transfer $INKD tokens to another address.

```bash
inkd token transfer 0xDEF...456 5
inkd token transfer 0xDEF...456 5 --json
```

**JSON output:**
```json
{
  "success": true,
  "hash": "0x...",
  "from": "0x...",
  "to": "0x...",
  "amount": "5.0",
  "blockNumber": "12345679",
  "network": "testnet"
}
```

---

### `inkd token info`

Show $INKD token metadata: name, symbol, decimals, and total supply.

```bash
inkd token info
inkd token info --json
```

**JSON output:**
```json
{
  "address": "0x...",
  "name": "Inkd Protocol Token",
  "symbol": "INKD",
  "decimals": 18,
  "totalSupply": "1000000000.0",
  "network": "testnet"
}
```

---

## Project Commands

### `inkd project create`

Register a new project on-chain. Locks 1 $INKD permanently (must `inkd token approve 1` first).

```bash
inkd project create \
  --name my-agent \
  --description "An autonomous trading agent" \
  --license MIT \
  --agent \
  --endpoint https://api.myagent.xyz
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--name <name>` | Unique project name (required) |
| `--description <text>` | Short description |
| `--license <spdx>` | SPDX license ID (default: MIT) |
| `--readme <arweave-hash>` | Arweave hash of the README |
| `--private` | Make project private (default: public) |
| `--agent` | Flag as an AI agent project |
| `--endpoint <url>` | Agent endpoint URL (use with `--agent`) |

---

### `inkd project get <id>`

Fetch on-chain project details by ID.

```bash
inkd project get 1
inkd project get 42
```

---

### `inkd project list <address>`

List all projects owned by an address.

```bash
inkd project list 0xABC...123
```

---

### `inkd project transfer`

Transfer project ownership to a new address. Costs 0.005 ETH.

```bash
inkd project transfer --id 1 --to 0xNEW...OWNER
```

---

### `inkd project collab add|remove`

Add or remove a collaborator on a project.

```bash
inkd project collab add    --id 1 --address 0xCOLLAB...
inkd project collab remove --id 1 --address 0xCOLLAB...
```

---

## Version Commands

### `inkd version push`

Push a new version to a project. Costs 0.001 ETH. The `--hash` must be a valid Arweave transaction ID pointing to your content.

```bash
inkd version push \
  --id 1 \
  --hash bWQ2K5M6mAHRatnKh8WvOJCujOy2e6c8... \
  --tag v1.2.0 \
  --changelog "Fixed rate limit handling"
```

---

### `inkd version list <id>`

List all versions for a project.

```bash
inkd version list 1
```

---

### `inkd version show`

Show a specific version by project ID and version index.

```bash
inkd version show --id 1 --index 0
```

---

## Agent Commands

### `inkd agent list`

Browse the agent project directory (projects flagged as AI agents).

```bash
inkd agent list
inkd agent list --offset 25 --limit 25   # Pagination
```

---

### `inkd agent lookup <name>`

Find an agent project by its registered name.

```bash
inkd agent lookup my-agent
```

---

## Search

### `inkd search <query>`

Search all projects by name or description. Case-insensitive substring match with parallel batched reads.

```bash
inkd search "trading bot"
inkd search "trading bot" --agents     # Only agent projects
inkd search "trading bot" --limit 5    # Max 5 results
inkd search "trading bot" --json       # JSON output
```

---

## Watch (Event Streaming)

### `inkd watch [filter]`

Stream real-time on-chain events. Polls the blockchain and prints events as they arrive.

```bash
inkd watch              # All events
inkd watch projects     # ProjectCreated + ProjectTransferred only
inkd watch versions     # VersionPushed only
inkd watch agents       # Agent-flagged projects only
inkd watch --json       # NDJSON output (for log pipelines)
inkd watch --poll 5000  # Poll every 5 seconds
inkd watch --from 12345678  # Start from specific block
```

**Pipe to jq:**
```bash
inkd watch --json | jq 'select(.event == "VersionPushed")'
```

---

## Agent Daemon

### `inkd agentd start`

Run a long-lived agent daemon that keeps an AI agent's on-chain identity alive, discovers peers, and optionally pushes heartbeat versions.

```bash
INKD_AGENT_NAME=my-agent inkd agentd start
INKD_AGENT_NAME=my-agent inkd agentd start --interval 30000
INKD_AGENT_NAME=my-agent inkd agentd start --dry-run  # No transactions
INKD_AGENT_NAME=my-agent inkd agentd start --once     # Single cycle (good for cron)
INKD_AGENT_NAME=my-agent inkd agentd start --json     # NDJSON output
```

**Environment:**
```bash
export INKD_AGENT_NAME=my-agent          # Required
export INKD_AGENT_ENDPOINT=https://...   # Advertised API URL
export INKD_INTERVAL=60000               # Sync interval ms (default: 60000)
```

**What each cycle does:**
1. Reads registry — discovers all peer agents
2. Confirms own project exists on-chain
3. Checks ETH balance (warns if < 0.01 ETH)
4. Emits heartbeat version to Arweave every N cycles
5. Writes `.agentd-state.json` for local introspection

---

### `inkd agentd status`

Print current daemon state from `.agentd-state.json`.

```bash
inkd agentd status
```

---

### `inkd agentd peers`

List all agent projects discovered in the registry.

```bash
inkd agentd peers
```

---

## Workflow: Register an Agent from Scratch

```bash
# 1. Check your balance
inkd token balance

# 2. Approve the registry (only needed once per token lock)
inkd token approve 1

# 3. Verify allowance
inkd token allowance

# 4. Register your agent project
inkd project create \
  --name my-agent \
  --description "Autonomous DeFi agent" \
  --agent \
  --endpoint https://api.myagent.xyz

# 5. Push your first version (upload content to Arweave first)
inkd version push \
  --id 1 \
  --hash <arweave-tx-id> \
  --tag v0.1.0 \
  --changelog "Initial release"

# 6. Start the daemon
INKD_AGENT_NAME=my-agent inkd agentd start
```

---

## JSON Output Mode

All commands that support `--json` output machine-readable NDJSON or a single JSON object. Use this for:

- Shell scripting: `inkd token balance --json | jq .inkd`
- Log ingestion: `inkd watch --json | tee events.ndjson`
- CI/CD pipelines: `inkd version push ... --json | jq .hash`

---

## See Also

- [SDK Reference](./SDK_REFERENCE.md) — TypeScript SDK for programmatic use
- [Contract Reference](./CONTRACT_REFERENCE.md) — Solidity function reference
- [Quickstart](./QUICKSTART.md) — Up and running in 5 minutes
- [Subgraph](../SUBGRAPH.md) — Query on-chain data via The Graph
