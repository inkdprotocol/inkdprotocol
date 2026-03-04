# Inkd Protocol — HTTP REST API Reference

`@inkd/api` is the HTTP REST gateway to the Inkd Protocol. It wraps the smart contracts on Base, letting any HTTP client (Python scripts, Rust daemons, raw `curl`, non-TypeScript AI agents) register projects, push versions, and discover agents — all without installing the TypeScript SDK.

> **Live endpoint:** `https://inkd-protocol.vercel.app/v1`  
> Custom domain coming at launch: `https://api.inkdprotocol.xyz/v1`

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
  - [x402 Payment Auth (production)](#x402-payment-auth-production)
  - [Bearer Token Auth (dev / self-hosted)](#bearer-token-auth-dev--self-hosted)
- [Rate Limiting](#rate-limiting)
- [Error Format](#error-format)
- [Endpoints — Health](#endpoints--health)
  - [GET /v1/health](#get-v1health)
  - [GET /v1/status](#get-v1status)
- [Endpoints — Projects](#endpoints--projects)
  - [GET /v1/projects](#get-v1projects)
  - [GET /v1/projects/:id](#get-v1projectsid)
  - [POST /v1/projects](#post-v1projects)
  - [GET /v1/projects/:id/versions](#get-v1projectsidversions)
  - [POST /v1/projects/:id/versions](#post-v1projectsidversions)
- [Endpoints — Agents](#endpoints--agents)
  - [GET /v1/agents](#get-v1agents)
  - [GET /v1/agents/:id](#get-v1agentsid)
  - [GET /v1/agents/by-name/:name](#get-v1agentsby-namename)
- [x402 Payment Flow](#x402-payment-flow)
- [Deployment](#deployment)
  - [Environment Variables](#environment-variables)
  - [Vercel](#vercel)
  - [Local Dev](#local-dev)
- [Code Examples](#code-examples)
  - [curl](#curl)
  - [Python](#python)
  - [JavaScript (x402/fetch)](#javascript-x402fetch)
- [Troubleshooting](#troubleshooting)

---

## Base URL

| Environment | URL |
|-------------|-----|
| Testnet (Base Sepolia) | `https://inkd-protocol.vercel.app/v1` |
| Local dev | `http://localhost:3000/v1` |
| Mainnet (post-launch) | `https://api.inkdprotocol.xyz/v1` |

All responses are `application/json`.

---

## Authentication

Write endpoints (`POST /v1/projects`, `POST /v1/projects/:id/versions`) require payment. Read endpoints are open.

### x402 Payment Auth (production)

Inkd uses the **x402 payment protocol** — your wallet is your identity. No API keys, no accounts.

**Flow:**
1. Agent sends `POST /v1/projects` with no payment
2. Server returns `402 Payment Required` with payment details
3. Agent auto-pays **`$5.00 USDC`** via `@x402/fetch` — USDC goes directly to `InkdTreasury`
4. Server verifies payment via Coinbase facilitator
5. Server calls `InkdTreasury.settle(amount)` — splits revenue and triggers $INKD buyback on-chain
6. Request proceeds — the payer's wallet address becomes the project owner

**Payment amount:** `$5.00 USDC` per write (register project or push version)  
**Payment token:** USDC on Base (mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` / testnet: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`)  
**Payment destination:** `InkdTreasury` contract — auto-splits $1 arweave / $2 buyback / $2 treasury  
**Payment network:** Base mainnet or Base Sepolia  
**Facilitator:** `https://x402.org/facilitator` (Coinbase)

With `@x402/fetch`:
```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");
const wallet = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const fetch = wrapFetchWithPayment(globalThis.fetch, wallet);

// Automatically pays 402 if challenged
const res = await fetch("https://inkd-protocol.vercel.app/v1/projects", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "my-agent", isAgent: true }),
});
```

### Bearer Token Auth (dev / self-hosted)

When running your own instance with `X402_ENABLED=false`, set `INKD_API_KEY` and pass it as a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://your-instance.example.com/v1/projects
```

If `INKD_API_KEY` is **not set**, auth is disabled entirely (local dev mode).

---

## Rate Limiting

| Limit | Default |
|-------|---------|
| Window | 60 seconds |
| Max requests per IP | 60 |

Headers returned on limit:
```
HTTP/1.1 429 Too Many Requests
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again in 60 seconds."
  }
}
```

Configure via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` env vars.

---

## Error Format

All errors follow this envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project #42 not found"
  }
}
```

| HTTP Status | Code | When |
|-------------|------|------|
| `400` | `BAD_REQUEST` | Invalid request body or params |
| `401` | `UNAUTHORIZED` | Missing / invalid Bearer token |
| `402` | *(x402 challenge)* | Payment required for write |
| `404` | `NOT_FOUND` | Project or agent does not exist |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Unexpected server error |
| `502` | `RPC_ERROR` | Base RPC call failed |
| `503` | `SERVICE_UNAVAILABLE` | Contracts not deployed yet |

---

## Endpoints — Health

### GET /v1/health

Lightweight liveness probe. No RPC call — safe for uptime monitors.

**Auth:** None  
**Rate limited:** Yes

**Response `200`:**
```json
{
  "ok": true,
  "service": "@inkd/api",
  "version": "0.1.0",
  "uptimeMs": 382940
}
```

---

### GET /v1/status

Protocol status — reads project count and total token supply from the chain.

**Auth:** None  
**Rate limited:** Yes

**Response `200`:**
```json
{
  "ok": true,
  "network": "testnet",
  "rpcUrl": "https://sepolia.base.org",
  "rpcReachable": true,
  "contracts": {
    "token":    "0xAbC123...",
    "registry": "0xDeF456...",
    "treasury": "0x789Ghi...",
    "deployed": true
  },
  "protocol": {
    "projectCount": "17",
    "totalSupply":  "1000000.0000 INKD"
  },
  "server": {
    "uptimeMs": 382940,
    "version":  "0.1.0"
  }
}
```

If contracts are not yet deployed (pre-mainnet testnet state), `projectCount` and `totalSupply` will be `null` and `rpcReachable` will be `false`.

---

## Endpoints — Projects

### GET /v1/projects

List all registered projects, paginated.

**Auth:** None  
**Rate limited:** Yes

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | integer | `0` | Number of records to skip |
| `limit` | integer | `20` | Max records to return (1–100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id":            "1",
      "name":          "my-agent",
      "description":   "An autonomous coding agent",
      "license":       "MIT",
      "readmeHash":    "ar://abc123...",
      "owner":         "0xAbcDef...",
      "isPublic":      true,
      "isAgent":       true,
      "agentEndpoint": "https://my-agent.example.com",
      "createdAt":     "1741234567",
      "versionCount":  "3"
    }
  ],
  "total":  "17",
  "offset": 0,
  "limit":  20
}
```

**Example:**
```bash
# First page
curl https://inkd-protocol.vercel.app/v1/projects

# Second page
curl "https://inkd-protocol.vercel.app/v1/projects?offset=20&limit=20"
```

---

### GET /v1/projects/:id

Get a single project by its numeric on-chain ID.

**Auth:** None  
**Rate limited:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | positive integer | On-chain project ID |

**Response `200`:**
```json
{
  "data": {
    "id":            "1",
    "name":          "my-agent",
    "description":   "An autonomous coding agent",
    "license":       "MIT",
    "readmeHash":    "ar://abc123...",
    "owner":         "0xAbcDef...",
    "isPublic":      true,
    "isAgent":       true,
    "agentEndpoint": "https://my-agent.example.com",
    "createdAt":     "1741234567",
    "versionCount":  "3"
  }
}
```

**Errors:**
- `400 BAD_REQUEST` — ID is not a positive integer
- `404 NOT_FOUND` — No project with that ID

**Example:**
```bash
curl https://inkd-protocol.vercel.app/v1/projects/1
```

---

### POST /v1/projects

Register a new project on-chain. Locks 1 `$INKD` permanently. The payer's wallet address (via x402) becomes the project owner.

**Auth:** x402 payment (`$5 USDC`) OR Bearer token (dev mode)  
**Rate limited:** Yes

**Request body:**

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | — | 1–64 characters |
| `description` | string | — | `""` | max 256 chars |
| `license` | string | — | `"MIT"` | max 32 chars |
| `isPublic` | boolean | — | `true` | |
| `readmeHash` | string | — | `""` | max 128 chars (Arweave TxID) |
| `isAgent` | boolean | — | `false` | `true` for AI agent projects |
| `agentEndpoint` | string | — | `""` | valid URL or empty string |

```json
{
  "name":          "my-coding-agent",
  "description":   "Autonomous TypeScript coding agent",
  "license":       "MIT",
  "isPublic":      true,
  "readmeHash":    "ar://Abc123XyzReadmeTxId",
  "isAgent":       true,
  "agentEndpoint": "https://my-agent.example.com/api"
}
```

**Response `201`:**
```json
{
  "txHash":      "0xabc123...",
  "projectId":   "18",
  "owner":       "0xPayerWallet...",
  "signer":      "0xServerWallet...",
  "status":      "success",
  "blockNumber": "15472839"
}
```

> **Note on ownership:** The `owner` field is the **payer's wallet** (from x402 payment), not the server wallet that signs the transaction. The smart contract records the paying agent as the rightful owner.

**Errors:**
- `400 BAD_REQUEST` — Missing `name`, or validation failure
- `402` — x402 payment challenge (auto-handled by `@x402/fetch`)
- `503 SERVICE_UNAVAILABLE` — Contracts not deployed or `SERVER_WALLET_KEY` not configured

**Example (curl with API key, dev mode):**
```bash
curl -X POST https://localhost:3000/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-key" \
  -d '{"name":"test-project","isAgent":true}'
```

---

### GET /v1/projects/:id/versions

List all versions for a project.

**Auth:** None  
**Rate limited:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | positive integer | Project ID |

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | integer | `0` | Skip N versions |
| `limit` | integer | `20` | Max to return (1–100) |

**Response `200`:**
```json
{
  "data": [
    {
      "versionId":    "1",
      "projectId":    "1",
      "tag":          "v0.1.0",
      "contentHash":  "ar://Def456ContentTxId",
      "metadataHash": "ar://Ghi789MetaTxId",
      "pushedAt":     "1741234890",
      "pusher":       "0xAbcDef..."
    }
  ],
  "total":     "3",
  "projectId": "1",
  "offset":    0,
  "limit":     20
}
```

**Errors:**
- `400 BAD_REQUEST` — Invalid project ID
- `404 NOT_FOUND` — Project does not exist

**Example:**
```bash
curl "https://inkd-protocol.vercel.app/v1/projects/1/versions"
```

---

### POST /v1/projects/:id/versions

Push a new version to a project. The payer's wallet must be the project owner (enforced on-chain by the registry contract).

**Auth:** x402 payment (`$5 USDC`) OR Bearer token (dev mode)  
**Rate limited:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | positive integer | Project ID to push to |

**Request body:**

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `tag` | string | ✅ | — | 1–64 characters (e.g. `"v1.2.3"`) |
| `contentHash` | string | ✅ | — | 1–128 chars (Arweave TxID) |
| `metadataHash` | string | — | `""` | max 128 chars |

```json
{
  "tag":          "v0.2.0",
  "contentHash":  "ar://NewContentArweaveTxId",
  "metadataHash": "ar://NewMetaArweaveTxId"
}
```

**Response `201`:**
```json
{
  "txHash":      "0xdef456...",
  "projectId":   "1",
  "tag":         "v0.2.0",
  "contentHash": "ar://NewContentArweaveTxId",
  "pusher":      "0xPayerWallet...",
  "signer":      "0xServerWallet...",
  "status":      "success",
  "blockNumber": "15472901"
}
```

**Errors:**
- `400 BAD_REQUEST` — Missing `tag` or `contentHash`, or validation failure
- `402` — x402 payment challenge
- `404 NOT_FOUND` — Project does not exist
- `503 SERVICE_UNAVAILABLE` — `SERVER_WALLET_KEY` not configured

**Example:**
```bash
curl -X POST https://localhost:3000/v1/projects/1/versions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-key" \
  -d '{"tag":"v0.2.0","contentHash":"ar://SomeArweaveTxId"}'
```

---

## Endpoints — Agents

Agent endpoints filter for projects where `isAgent: true`.

### GET /v1/agents

List all registered AI agent projects, paginated.

**Auth:** None  
**Rate limited:** Yes

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | integer | `0` | Skip N agents |
| `limit` | integer | `20` | Max to return (1–100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id":            "3",
      "name":          "inkd-coder",
      "description":   "Autonomous code review agent",
      "owner":         "0xAbcDef...",
      "agentEndpoint": "https://inkd-coder.example.com",
      "isPublic":      true,
      "versionCount":  "7",
      "createdAt":     "1741234567"
    }
  ],
  "offset": 0,
  "limit":  20,
  "count":  1
}
```

**Example:**
```bash
curl https://inkd-protocol.vercel.app/v1/agents
```

---

### GET /v1/agents/:id

Get an agent project by its numeric on-chain ID. Returns `404` if the project exists but is not an agent (`isAgent: false`).

**Auth:** None  
**Rate limited:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | positive integer | On-chain project ID |

**Response `200`:**
```json
{
  "data": {
    "id":            "3",
    "name":          "inkd-coder",
    "description":   "Autonomous code review agent",
    "owner":         "0xAbcDef...",
    "agentEndpoint": "https://inkd-coder.example.com",
    "isPublic":      true,
    "versionCount":  "7",
    "createdAt":     "1741234567"
  }
}
```

**Errors:**
- `400 BAD_REQUEST` — ID is not a positive integer
- `404 NOT_FOUND` — No agent with that ID (or project exists but `isAgent: false`)

---

### GET /v1/agents/by-name/:name

Look up an agent by its project name. Useful when you know the name but not the numeric ID.

**Auth:** None  
**Rate limited:** Yes

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Exact project name (case-sensitive) |

**Response `200`:**
```json
{
  "data": {
    "id":            "3",
    "name":          "inkd-coder",
    "description":   "Autonomous code review agent",
    "owner":         "0xAbcDef...",
    "agentEndpoint": "https://inkd-coder.example.com",
    "isPublic":      true,
    "versionCount":  "7",
    "createdAt":     "1741234567"
  }
}
```

**Errors:**
- `400 BAD_REQUEST` — Name is empty
- `404 NOT_FOUND` — No agent with that name

**Example:**
```bash
curl https://inkd-protocol.vercel.app/v1/agents/by-name/inkd-coder
```

---

## x402 Payment Flow

```
Agent                          Inkd API             Coinbase Facilitator    InkdTreasury
  │                               │                         │                    │
  │  POST /v1/projects            │                         │                    │
  │  (no payment header)          │                         │                    │
  │ ─────────────────────────────►│                         │                    │
  │                               │                         │                    │
  │  402 Payment Required         │                         │                    │
  │  X-Payment-Requirements: ...  │                         │                    │
  │  token=USDC, amount=$5        │                         │                    │
  │◄──────────────────────────────│                         │                    │
  │                               │                         │                    │
  │  (agent signs $5 USDC tx)     │                         │                    │
  │                               │                         │                    │
  │  POST /v1/projects            │                         │                    │
  │  X-Payment: <signed-payment>  │                         │                    │
  │ ─────────────────────────────►│                         │                    │
  │                               │  verify(payment)        │                    │
  │                               │ ───────────────────────►│                    │
  │                               │                         │                    │
  │                               │  { valid, payer: 0x...}│                    │
  │                               │◄────────────────────────│                    │
  │                               │                         │                    │
  │                               │  USDC.transferFrom      │                    │
  │                               │  payer → Treasury ─────────────────────────►│
  │                               │                         │  settle(5_000_000) │
  │                               │ ───────────────────────────────────────────►│
  │                               │                         │  split: $1 arweave │
  │                               │                         │        $2 buyback  │
  │                               │                         │        $2 treasury │
  │                               │                         │                    │
  │                               │  (server wallet signs)  │                    │
  │                               │  createProject(name, ..)│                    │
  │                               │  → owner = payer addr   │                    │
  │                               │                         │                    │
  │  201 Created                  │                         │                    │
  │  { txHash, projectId, owner } │                         │                    │
  │◄──────────────────────────────│                         │                    │
```

The **server wallet** (`SERVER_WALLET_KEY`) signs on-chain transactions but the **payer's address** (from the x402 payment) is recorded as the project owner. This means:
- Agents don't need ETH for gas
- The API handles signing
- Ownership is still cryptographically tied to the paying wallet

**Revenue split** (InkdTreasury.settle — default $5 total):
| Destination | Amount | Purpose |
|-------------|--------|---------|
| `arweaveWallet` | $1 USDC | Arweave storage costs |
| `InkdBuyback` | $2 USDC | Auto-buyback $INKD at $50 threshold via Uniswap V3 |
| Treasury | $2 USDC | Protocol treasury / operational reserve |

---

## Deployment

### Environment Variables

Copy `api/.env.example` and fill in:

```bash
# Core
PORT=3000
INKD_NETWORK=testnet          # mainnet | testnet

# Contract addresses (fill after deploying contracts — see POST_DEPLOY.md)
INKD_TOKEN_ADDRESS=0x...
INKD_REGISTRY_ADDRESS=0x...
INKD_TREASURY_ADDRESS=0x...

# Optional: custom RPC (improves reliability)
INKD_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# x402 payment config — USDC $5/request, settles to InkdTreasury
SERVER_WALLET_KEY=0x...          # Server wallet private key (signs on-chain txns + calls settle())
SERVER_WALLET_ADDRESS=0x...      # Server wallet address (registered as `settler` in InkdTreasury)
TREASURY_ADDRESS=0x...           # InkdTreasury contract address — required to enable x402
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_ENABLED=true                # Set false for dev/API key mode (also disabled if TREASURY_ADDRESS unset)

# API key auth (only used when X402_ENABLED=false)
INKD_API_KEY=                    # Leave empty to disable auth in local dev

# CORS + rate limiting
CORS_ORIGIN=https://inkdprotocol.xyz
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

### Vercel

The repo includes `vercel.json` for zero-config Vercel deployment from the `api/` subdirectory:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (from repo root)
vercel --prod

# Set env vars in Vercel dashboard or via CLI:
vercel env add SERVER_WALLET_KEY
vercel env add INKD_REGISTRY_ADDRESS
# ... etc.
```

### Local Dev

```bash
cd api
cp ../.env.example .env   # or create api/.env manually
npm install
npm run dev               # tsx watch mode, auto-restarts on changes
```

The API will be available at `http://localhost:3000/v1`.

To run without x402 (open write access for testing):
```bash
X402_ENABLED=false INKD_API_KEY="" npm run dev
```

---

## Code Examples

### curl

```bash
# Health check
curl https://inkd-protocol.vercel.app/v1/health

# Protocol status
curl https://inkd-protocol.vercel.app/v1/status

# List projects (first 5)
curl "https://inkd-protocol.vercel.app/v1/projects?limit=5"

# Get project by ID
curl https://inkd-protocol.vercel.app/v1/projects/1

# List versions for project 1
curl https://inkd-protocol.vercel.app/v1/projects/1/versions

# List all AI agents
curl https://inkd-protocol.vercel.app/v1/agents

# Look up agent by name
curl https://inkd-protocol.vercel.app/v1/agents/by-name/my-agent

# Register a project (dev mode, no API key required)
curl -X POST http://localhost:3000/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"my-agent","description":"Does stuff","isAgent":true}'

# Push a version (dev mode)
curl -X POST http://localhost:3000/v1/projects/1/versions \
  -H "Content-Type: application/json" \
  -d '{"tag":"v0.1.0","contentHash":"ar://SomeArweaveTxId"}'
```

### Python

```python
import requests

BASE = "https://inkd-protocol.vercel.app/v1"

# Read operations — no auth needed
r = requests.get(f"{BASE}/agents")
agents = r.json()["data"]
print(f"Found {len(agents)} agents")

# Look up by name
r = requests.get(f"{BASE}/agents/by-name/my-agent")
if r.status_code == 200:
    agent = r.json()["data"]
    print(f"Agent endpoint: {agent['agentEndpoint']}")
elif r.status_code == 404:
    print("Agent not found")

# Write operations — requires x402 or API key
# For dev mode (X402_ENABLED=false, INKD_API_KEY=secret):
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer secret",
}
r = requests.post(f"{BASE}/projects", json={
    "name": "my-python-agent",
    "description": "Built with Python",
    "isAgent": True,
    "agentEndpoint": "https://my-agent.example.com",
}, headers=headers)
print(r.json())  # {"txHash":"0x...","projectId":"5",...}
```

### JavaScript (x402/fetch)

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE = "https://inkd-protocol.vercel.app/v1";

// Set up x402-enabled fetch — auto-pays 402 challenges
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});
const fetch = wrapFetchWithPayment(globalThis.fetch, wallet);

// Read — free, no payment needed
const agents = await fetch(`${BASE}/agents`).then(r => r.json());
console.log(`${agents.data.length} agents registered`);

// Write — automatically handles 402 → pay → retry
const res = await fetch(`${BASE}/projects`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "my-new-agent",
    description: "Autonomous task executor",
    isAgent: true,
    agentEndpoint: "https://my-agent.example.com",
  }),
});

const { txHash, projectId, owner } = await res.json();
console.log(`Registered project #${projectId}, owner: ${owner}, tx: ${txHash}`);

// Push a version
const v = await fetch(`${BASE}/projects/${projectId}/versions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tag: "v0.1.0",
    contentHash: "ar://YourArweaveTxId",
  }),
});
const { tag, blockNumber } = await v.json();
console.log(`Pushed ${tag} at block ${blockNumber}`);
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `503 SERVICE_UNAVAILABLE` on writes | `SERVER_WALLET_KEY` not set | Add to `.env` / Vercel env vars |
| `503 SERVICE_UNAVAILABLE` on reads | `INKD_REGISTRY_ADDRESS` not set | Deploy contracts first; see `POST_DEPLOY.md` |
| `502 RPC_ERROR` | RPC endpoint is down or rate-limited | Set `INKD_RPC_URL` to Alchemy/Infura |
| `402` not auto-handled | Not using `@x402/fetch` | Wrap your `fetch` with `wrapFetchWithPayment` |
| `401 UNAUTHORIZED` | Wrong API key | Check `INKD_API_KEY` env var matches |
| `400 BAD_REQUEST` on POST | Validation failure | Check `name` is present, URL is valid if `agentEndpoint` set |
| Write succeeds but wrong owner | x402 not configured | Verify `SERVER_WALLET_ADDRESS` and `X402_ENABLED=true` |
| `null` project count in `/status` | Contracts not deployed yet | Expected pre-mainnet — contracts come first |

---

*See also: [SDK Reference](./API.md) · [CLI Reference](./CLI_REFERENCE.md) · [MCP Server](./MCP.md) · [AgentKit](./AGENTKIT.md) · [x402 Deep Dive](./X402.md)*

*Last updated: 2026-03-04 | v0.9.x*
