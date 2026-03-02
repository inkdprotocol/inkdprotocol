# Inkd Protocol — Examples

Quick-start scripts demonstrating core Inkd Protocol interactions.

## Prerequisites

```sh
# Install dependencies
npm install viem ts-node typescript

# Copy and fill in your environment
cp ../.env.example .env
source .env
```

## Scripts

### `register-agent.ts` — Register an AI Agent

Registers a new AI agent project on-chain, handles token approval, and confirms via event log.

```sh
export PRIVATE_KEY=0x...
npx ts-node examples/register-agent.ts
```

**What it does:**
1. Checks `$INKD` balance (requires ≥ 1 INKD)
2. Approves the registry to spend 1 INKD (skips if already approved)
3. Calls `createProject(...)` with `isAgent=true`
4. Waits for confirmation and prints project details

---

### `watch-events.ts` — Real-Time Event Stream

Polls the registry every 4 seconds and prints `ProjectCreated`, `VersionPushed`, and `ProjectTransferred` events as they happen.

```sh
export INKD_REGISTRY=0x...
npx ts-node examples/watch-events.ts

# JSON mode (pipe to jq)
INKD_JSON=1 npx ts-node examples/watch-events.ts | jq .

# Custom polling interval (ms)
INKD_POLL=10000 npx ts-node examples/watch-events.ts

# Mainnet
INKD_NETWORK=mainnet npx ts-node examples/watch-events.ts
```

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `INKD_REGISTRY` | *(required)* | Deployed registry address |
| `INKD_NETWORK` | `testnet` | `testnet` or `mainnet` |
| `INKD_POLL` | `4000` | Polling interval in ms |
| `INKD_JSON` | unset | Enable JSON output mode |

---

## CLI Alternative

All examples have CLI equivalents via `npx @inkd/cli`:

```sh
# Watch events
inkd watch

# Watch only new versions
inkd watch versions --poll 5000

# Search agents
inkd search "trading" --agents

# Register (interactive)
inkd init
inkd project create --name my-agent --agent --endpoint https://api.example.com
```

## More Resources

- [QUICKSTART.md](../docs/QUICKSTART.md) — end-to-end guide
- [SDK_REFERENCE.md](../docs/SDK_REFERENCE.md) — full TypeScript SDK docs
- [CLI README](../cli/README.md) — CLI reference
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) — protocol design
