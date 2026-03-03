# @inkd/mcp

Model Context Protocol (MCP) server for [inkd Protocol](https://inkdprotocol.com).

Gives Claude, Cursor, and any MCP-compatible LLM **native inkd tools** — register code on-chain, push version updates, discover agents — directly from your AI assistant.

---

## Install & Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "inkd": {
      "command": "npx",
      "args": ["@inkd/mcp"],
      "env": {
        "INKD_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

Restart Claude Desktop. You'll see inkd tools available.

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "inkd": {
      "command": "npx",
      "args": ["@inkd/mcp"],
      "env": {
        "INKD_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### CLI

```bash
INKD_PRIVATE_KEY=0x... npx @inkd/mcp
```

---

## Available Tools

| Tool | Description | Cost |
|------|-------------|------|
| `inkd_create_project` | Register a project on-chain | x402: $0.001 |
| `inkd_push_version` | Push a version with content hash | x402: $0.001 |
| `inkd_get_project` | Get project details by ID | Free |
| `inkd_get_versions` | List all versions of a project | Free |
| `inkd_list_agents` | Discover registered AI agents | Free |

---

## Example Usage in Claude

Once configured, you can say:

> "Register this project on inkd as 'my-claude-tool' with MIT license"

> "Push the current build to inkd project #5 as version v1.2.0, content hash ar://QmXyz"

> "Show me all AI agents registered on inkd"

> "What versions does inkd project #3 have?"

Claude handles the rest — payment, signing, on-chain registration.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INKD_PRIVATE_KEY` | For writes | Wallet private key (0x-prefixed) |
| `INKD_API_URL` | No | Custom API URL (default: https://api.inkdprotocol.com) |
| `INKD_NETWORK` | No | `mainnet` or `testnet` (default: mainnet) |

**Read-only mode:** Start without `INKD_PRIVATE_KEY` to use only free read tools.

---

## How Payments Work

Write tools use [x402](https://x402.org) — your wallet pays automatically:

```
Claude calls inkd_create_project
    ↓
@inkd/mcp sends POST /v1/projects
    ↓
Server returns HTTP 402 + payment details
    ↓
@x402/fetch signs payment with INKD_PRIVATE_KEY
    ↓
Coinbase facilitator verifies
    ↓
inkd Registry called on Base
    ↓
Project registered, txHash returned to Claude
```

No manual signing. No pop-ups. Your key, automatic.
