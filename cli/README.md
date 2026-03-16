# @inkd/cli

> Command-line interface for the [Inkd Protocol](https://inkdprotocol.com) — permanent on-chain file ownership on Base.

[![npm](https://img.shields.io/npm/v/@inkd/cli)](https://www.npmjs.com/package/@inkd/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Built on Base](https://img.shields.io/badge/Built%20on-Base-0052FF)](https://base.org)

## Installation

```bash
# Global install
npm install -g @inkd/cli

# Or use without installing
npx @inkd/cli help
```

## Quick Start

```bash
# 1. Scaffold config
inkd init

# 2. Set your wallet private key
export INKD_PRIVATE_KEY=0xabc123...

# 3. Check network status
inkd status

# 4. Create your first project (costs $0.10 USDC via x402)
inkd project create --name my-agent --agent --endpoint https://api.example.com

# 5. Push a version
inkd version push --id 1 --hash <arweave-hash> --tag v0.1.0 --changelog "initial release"
```

## Configuration

The CLI reads from `inkd.config.json` in the current directory. Scaffold it with:

```bash
inkd init           # testnet (default)
inkd init --mainnet # mainnet
```

**inkd.config.json**
```json
{
  "network": "testnet",
  "rpcUrl": "https://your-rpc-endpoint"
}
```

> ⚠️ **Never store your private key in the config file.** Use the environment variable instead.

### Environment Variables

| Variable           | Description                                   |
|--------------------|-----------------------------------------------|
| `INKD_PRIVATE_KEY` | Wallet private key (hex, `0x` optional)       |
| `INKD_NETWORK`     | `mainnet` or `testnet` (overrides config)     |
| `INKD_RPC_URL`     | Custom RPC endpoint                           |
| `INKD_DEBUG`       | Set to any value to show full error stacks    |

## Commands

### `inkd init`

Scaffold `inkd.config.json` in the current directory.

```bash
inkd init           # testnet
inkd init --mainnet # mainnet
inkd init --force   # overwrite existing
```

---

### `inkd status`

Show network info, contract addresses, and current protocol fees.

```bash
inkd status
```

---

### `inkd project create`

Register a new project. Locks 1 $INKD in the registry contract.

```bash
inkd project create \
  --name my-agent \
  --description "An AI agent that does things" \
  --license MIT \
  --agent \
  --endpoint https://api.example.com
```

**Flags:**

| Flag            | Required | Description                                     |
|-----------------|----------|-------------------------------------------------|
| `--name`        | ✅        | Project name (unique, lowercased)               |
| `--description` |           | Short description                               |
| `--license`     |           | SPDX license ID (default: MIT)                 |
| `--readme`      |           | Arweave hash of README document                |
| `--private`     |           | Make project private (default: public)         |
| `--agent`       |           | Flag as AI agent project                       |
| `--endpoint`    |           | Agent endpoint URL (used with `--agent`)       |

---

### `inkd project get <id>`

Fetch and display project details.

```bash
inkd project get 1
inkd project get --id 42
```

---

### `inkd project list <address>`

List all projects owned by an address.

```bash
inkd project list 0xDead...
```

---

### `inkd project transfer`

Transfer ownership of a project. Requires `transferFee` ETH.

```bash
inkd project transfer --id 1 --to 0xNewOwner...
```

---

### `inkd project collab add|remove`

Add or remove a collaborator on a project.

```bash
inkd project collab add    --id 1 --address 0xCollaborator...
inkd project collab remove --id 1 --address 0xCollaborator...
```

---

### `inkd version push`

Push a new version to a project. Requires `versionFee` ETH.

```bash
inkd version push \
  --id 1 \
  --hash <arweave-tx-id> \
  --tag v0.2.0 \
  --changelog "Bug fixes and performance improvements"
```

---

### `inkd version list <id>`

List all versions for a project (newest first).

```bash
inkd version list 1
```

---

### `inkd version show`

Show details for a specific version by index.

```bash
inkd version show --id 1 --index 0
```

---

### `inkd agent list`

Browse registered AI agent projects.

```bash
inkd agent list
inkd agent list --offset 25 --limit 50
```

---

### `inkd agent lookup <name>`

Find an agent project by name.

```bash
inkd agent lookup my-agent
```

---

## Development

```bash
git clone https://github.com/inkdprotocol/inkdprotocol.git
cd inkd-protocol/cli
npm install
npm run build
node dist/index.js help
```

## License

MIT — see [LICENSE](../../LICENSE)
