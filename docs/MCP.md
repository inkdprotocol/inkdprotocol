# @inkd/mcp — Model Context Protocol Server

Give Claude, Cursor, Windsurf, and any MCP-compatible AI assistant native inkd tools — with zero code.

The `@inkd/mcp` server exposes all core inkd Protocol operations as MCP tools. Your AI assistant can register projects, push versions, and discover agents on-chain, using your wallet for authentication. No API keys. No extra configuration.

---

## Quick Start

### 1. Install

```bash
npm install -g @inkd/mcp
```

Or run without installing:

```bash
npx @inkd/mcp
```

### 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "inkd": {
      "command": "npx",
      "args": ["@inkd/mcp"],
      "env": {
        "INKD_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY"
      }
    }
  }
}
```

Restart Claude Desktop. You should see `inkd` appear in the tools list.

### 3. Configure Cursor

In `.cursor/mcp.json` (project root) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "inkd": {
      "command": "npx",
      "args": ["@inkd/mcp"],
      "env": {
        "INKD_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INKD_PRIVATE_KEY` | No* | — | Wallet private key (`0x...`). Required for write operations. |
| `INKD_API_URL` | No | `https://api.inkdprotocol.com` | Override API endpoint (e.g. for testnet). |
| `INKD_NETWORK` | No | `mainnet` | `mainnet` (Base) or `testnet` (Base Sepolia). |

> **\* Read-only mode:** If `INKD_PRIVATE_KEY` is not set, the server starts in read-only mode. `inkd_get_project`, `inkd_get_versions`, and `inkd_list_agents` work normally. `inkd_create_project` and `inkd_push_version` will fail.

### Testnet Configuration

```json
{
  "mcpServers": {
    "inkd": {
      "command": "npx",
      "args": ["@inkd/mcp"],
      "env": {
        "INKD_PRIVATE_KEY": "0xYOUR_TESTNET_KEY",
        "INKD_API_URL": "https://api-testnet.inkdprotocol.com",
        "INKD_NETWORK": "testnet"
      }
    }
  }
}
```

---

## Available Tools

### `inkd_create_project`

Register a new project on-chain. Locks 1 $INKD permanently. The signing wallet becomes the on-chain owner.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Unique project name (1–64 chars) |
| `description` | string | No | `""` | Short description (max 256 chars) |
| `license` | string | No | `"MIT"` | `MIT`, `Apache-2.0`, `GPL-3.0`, or `Proprietary` |
| `isPublic` | boolean | No | `true` | Public visibility on the registry |
| `isAgent` | boolean | No | `false` | Mark as an AI agent for discovery |
| `agentEndpoint` | string | No | `""` | Agent API endpoint URL (if `isAgent=true`) |

**Cost:** 1 $INKD (locked, non-refundable) + gas

**Example prompt:**
> "Register my project on inkd as 'my-summarizer' under MIT license, mark it as an AI agent at https://api.example.com/summarize"

**Response:**
```
✅ Project "my-summarizer" registered!

Project ID: 42
Owner: 0x1234...abcd
TX: 0xabc...def
Basescan: https://basescan.org/tx/0xabc...def
```

---

### `inkd_push_version`

Push a new version to an existing project. Content must be uploaded to Arweave first and referenced by its hash.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | ✅ | Numeric project ID |
| `tag` | string | ✅ | Version tag (e.g. `v1.0.0`) |
| `contentHash` | string | ✅ | Arweave content hash (`ar://Qm...`) |
| `metadataHash` | string | No | Optional Arweave hash for metadata |

**Cost:** 0.001 ETH + gas

**Example prompt:**
> "Push version v1.2.0 to project #42 with Arweave hash ar://QmXyz..."

**Response:**
```
✅ Version "v1.2.0" pushed to project #42!

TX: 0xabc...def
Content: ar://QmXyz...
```

---

### `inkd_get_project`

Fetch details about any inkd project by ID. Free, no wallet required.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | ✅ | Numeric project ID |

**Example prompt:**
> "Show me details for inkd project #42"

**Response:**
```
Project #42: my-summarizer
Owner: 0x1234...abcd
Description: A fast text summarization agent
License: MIT
Versions: 3
Public: true
Agent: true
Endpoint: https://api.example.com/summarize
```

---

### `inkd_get_versions`

List all versions of a project with tags, content hashes, and timestamps. Free.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `projectId` | string | ✅ | — | Numeric project ID |
| `limit` | number | No | `20` | Max results to return |
| `offset` | number | No | `0` | Pagination offset |

**Example prompt:**
> "What versions has project #42 published?"

**Response:**
```
Versions for project #42 (total: 3):

• v1.0.0 — ar://QmAbc... (2026-01-15)
• v1.1.0 — ar://QmDef... (2026-02-01)
• v1.2.0 — ar://QmXyz... (2026-03-01)
```

---

### `inkd_list_agents`

Discover AI agents registered on inkd Protocol. Returns names, owners, and endpoints. Free.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `limit` | number | No | `20` | Max results to return |
| `offset` | number | No | `0` | Pagination offset |

**Example prompt:**
> "What AI agents are registered on inkd?"

**Response:**
```
Registered AI agents on inkd (total: 12):

• #3 code-reviewer — owner: 0xabc...
• #7 summarizer-pro — owner: 0xdef... — endpoint: https://api.example.com
• #42 my-agent — owner: 0x123... — endpoint: https://myagent.xyz/api
```

---

## How Payments Work

Write operations (`inkd_create_project`, `inkd_push_version`) use [x402](https://x402.org) — the open HTTP payment standard by Coinbase. No accounts, no API keys.

1. The MCP server sends a POST request to the inkd API
2. The API responds with HTTP 402 + payment terms
3. The server constructs a signed payment using your `INKD_PRIVATE_KEY`
4. The request retries with the payment signature
5. Transaction succeeds — your wallet address is recorded on-chain as the owner

This is fully automatic. Your AI assistant just calls the tool; the payment happens in the background.

---

## Security

**Keep your private key safe:**
- Never commit your private key to source control
- Use environment variables, not config files, for `INKD_PRIVATE_KEY`
- Consider using a dedicated agent wallet with a small balance
- For production agents, use a hardware wallet or KMS where possible

**Minimal permissions:** The MCP server only signs x402 payment messages. It does not have access to your system, files, or other wallets.

**Audit:** All on-chain actions are permanently recorded on Base. You can verify any transaction on [Basescan](https://basescan.org).

---

## Running from Source

```bash
git clone https://github.com/inkdprotocol/inkd-protocol
cd inkd-protocol/mcp
npm install
npm run build

INKD_PRIVATE_KEY=0x... node dist/server.js
```

---

## Development

```bash
# Run tests
npm test

# Run in dev mode (tsx, no build step)
INKD_PRIVATE_KEY=0x... npm run dev
```

The server prints status to stderr (safe to ignore in MCP contexts, which only reads stdout):

```
[inkd-mcp] Server running
[inkd-mcp] Wallet: 0x1234...abcd
```

In read-only mode:
```
[inkd-mcp] Server running
[inkd-mcp] Read-only mode (no INKD_PRIVATE_KEY)
```

---

## Example Workflows

### Register a New AI Agent

```
User: "Register my text summarizer as an inkd project called 'my-summarizer', MIT license, mark it as an AI agent at https://api.myapp.com/summarize"

Claude → calls inkd_create_project({
  name: "my-summarizer",
  license: "MIT",
  isAgent: true,
  agentEndpoint: "https://api.myapp.com/summarize"
})

→ ✅ Project "my-summarizer" registered! Project ID: 77, Owner: 0x...
```

### Push a Release After Deploying

```
User: "Push version v2.1.0 of project #77, the Arweave hash for the bundle is ar://QmNewHash..."

Claude → calls inkd_push_version({
  projectId: "77",
  tag: "v2.1.0",
  contentHash: "ar://QmNewHash..."
})

→ ✅ Version "v2.1.0" pushed to project #77!
```

### Discover Agents for a Task

```
User: "Find any AI agents registered on inkd that I could call"

Claude → calls inkd_list_agents({ limit: 10 })

→ Lists all registered agents with endpoints
```

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `Unknown tool` error | Server not connected | Restart Claude Desktop / Cursor |
| `write operations will fail` in logs | `@x402/fetch` not installed | Run `npm install @x402/fetch viem` in the mcp dir |
| `Error: {}` on create/push | API returned non-JSON error | Check `INKD_NETWORK` and `INKD_API_URL` |
| Project ID `not found` | Wrong ID | Use `inkd_list_agents` or check the registry |
| `process.exit(1)` immediately | Fatal startup error | Check stderr for details |

---

## Related

- [x402 Agent Payment Guide](./X402.md) — How the payment layer works
- [AgentKit Integration](../agentkit/README.md) — Coinbase AgentKit action provider
- [SDK Reference](./SDK_REFERENCE.md) — TypeScript SDK for custom integrations
- [CLI Reference](./CLI_REFERENCE.md) — Command-line interface for inkd Protocol
- [API Reference](./API.md) — Direct REST API documentation
