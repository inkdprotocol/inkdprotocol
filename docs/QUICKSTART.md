# Inkd Protocol — 5-Minute Quickstart (CLI)

> **The fastest path**: install the CLI, approve one token, register your project on-chain.  
> SDK path → see [Getting Started](./getting-started.md)

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js >= 18 | `node --version` |
| An EVM wallet | with Base Sepolia ETH + $INKD testnet tokens |
| Base Sepolia ETH | [Coinbase faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet) |
| $INKD testnet tokens | Request in [Discord](https://discord.gg/inkd) — or deploy your own via the repo |

---

## Step 1 — Install the CLI

```bash
npm install -g @inkd/cli
inkd --version
```

---

## Step 2 — Configure

Set your wallet key and network. **Never store your key in `inkd.config.json`** — use env vars.

```bash
export INKD_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
export INKD_NETWORK=testnet          # testnet | mainnet
```

Verify connectivity:

```bash
inkd status
```

Expected output:

```
  Inkd Protocol Status
  ────────────────────────────────────────
  Network:   testnet (Base Sepolia)
  Registry:  0x...
  Token:     0x...
  Treasury:  0x...

  Projects:      42
  Version fee:   0.001 ETH
  Transfer fee:  0.005 ETH
```

---

## Step 3 — Check Your Balance

```bash
inkd token balance
```

You need at least **1 $INKD** to create a project. Get your address:

```bash
inkd token info
```

---

## Step 4 — Approve the Registry

Before creating a project, approve `InkdRegistry` to pull **1 $INKD** from your wallet.  
This is a one-time approval (or repeat when creating more projects).

```bash
inkd token approve 1
```

Verify the allowance was set:

```bash
inkd token allowance
```

---

## Step 5 — Create Your First Project

Registering a project locks **1 $INKD** permanently on-chain. Names are globally unique and immutable — choose carefully.

```bash
inkd project create \
  --name my-first-project \
  --description "My first Inkd project" \
  --license MIT \
  --public
```

For AI agent tools, add `--agent` and optionally `--endpoint`:

```bash
inkd project create \
  --name pr-summarizer-v1 \
  --description "Summarizes GitHub PRs into 3 bullets" \
  --license MIT \
  --public \
  --agent \
  --endpoint https://api.myagent.xyz/v1/summarize
```

Verify it was created:

```bash
inkd project get 1
```

---

## Step 6 — Push a Version

Each version costs **0.001 ETH** and permanently records an Arweave transaction ID on-chain.  
You can push from any wallet that is the project owner or a collaborator.

```bash
inkd version push \
  --id 1 \
  --arweave-hash AbcDefGhijklmnopqrstuvwxyz1234567890abc \
  --tag 1.0.0 \
  --changelog "Initial release."
```

> **Don't have an Arweave hash yet?**  
> Upload your files via [Irys](https://irys.xyz) first, then use the returned transaction ID.

List all versions:

```bash
inkd version list 1
```

---

## Step 7 — Monitor Events (optional)

Watch for new projects or version pushes in real time:

```bash
inkd watch                  # all protocol events
inkd watch --project 1      # events for project #1 only
```

---

## What's Locked On-Chain

| Action | Cost | Permanent? |
|--------|------|-----------|
| `project create` | 1 $INKD (locked, not burned) | Name + ownership: forever |
| `version push` | 0.001 ETH → Treasury | Arweave hash: forever |
| `project transfer` | 0.005 ETH → Treasury | New owner: forever |

The locked $INKD is held by the `InkdRegistry` contract. It is not burned; governance can later define unlock conditions.

---

## SDK Alternative

If you prefer TypeScript over the CLI:

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const inkd = new InkdClient({
  walletClient: createWalletClient({
    account: privateKeyToAccount("0xYOUR_PRIVATE_KEY"),
    chain: baseSepolia,
    transport: http(),
  }),
  network: "testnet",
});

await inkd.approveToken();
await inkd.createProject({ name: "my-project", description: "...", license: "MIT", isPublic: true });
```

Full SDK guide → [Getting Started](./getting-started.md)

---

## Next Steps

| Resource | What you'll find |
|----------|-----------------|
| [CLI Reference](./CLI_REFERENCE.md) | All commands, flags, and JSON output schemas |
| [SDK Reference](./SDK_REFERENCE.md) | Full `InkdClient` API, events, multicall, encryption |
| [Contract Reference](./CONTRACT_REFERENCE.md) | Solidity interfaces, errors, events (5 contracts) |
| [Architecture](./ARCHITECTURE.md) | How InkdRegistry ↔ InkdTreasury ↔ InkdToken interact |
| [SUBGRAPH.md](../SUBGRAPH.md) | Query project history via The Graph |
| [Whitepaper](./WHITEPAPER.md) | Full protocol vision and tokenomics |
