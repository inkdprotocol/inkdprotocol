# @inkd/agentkit — Coinbase AgentKit Integration

Give any AgentKit-powered AI agent native inkd Protocol actions. Register code on-chain, push version updates, and discover other registered agents — using only the agent's wallet. No API keys. No accounts. Payments handled automatically via x402.

---

## Contents

- [Overview](#overview)
- [Install](#install)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Actions Reference](#actions-reference)
  - [inkd_create_project](#inkd_create_project)
  - [inkd_push_version](#inkd_push_version)
  - [inkd_get_project](#inkd_get_project)
  - [inkd_list_agents](#inkd_list_agents)
- [x402 Payment Flow](#x402-payment-flow)
- [Configuration](#configuration)
- [Full Working Example](#full-working-example)
- [Agent Prompts & Example Workflows](#agent-prompts--example-workflows)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)

---

## Overview

`@inkd/agentkit` is a Coinbase AgentKit [Action Provider](https://github.com/coinbase/agentkit) that exposes inkd Protocol operations as LLM-callable tools. When added to an AgentKit instance, the agent gains four new actions:

| Action | What it does | Costs |
|--------|-------------|-------|
| `inkd_create_project` | Register a project on-chain under the agent's wallet | 1 $INKD (locked) |
| `inkd_push_version` | Push a versioned content hash to a project | 0.001 ETH |
| `inkd_get_project` | Fetch project metadata by ID | Free |
| `inkd_list_agents` | Discover registered AI agents | Free |

The provider integrates seamlessly with any AgentKit setup — the LLM decides when and how to call these tools based on your system prompt and user instructions.

---

## Install

```bash
npm install @inkd/agentkit @coinbase/agentkit
```

To enable automatic x402 payment signing (required for write actions in production):

```bash
npm install @x402/fetch viem
```

> **Note:** `@x402/fetch` is optional. Without it, write actions fall back to unauthenticated requests and will receive `402 Payment Required` errors from the inkd API.

---

## Quick Start

```typescript
import { AgentKit } from '@coinbase/agentkit'
import { InkdActionProvider } from '@inkd/agentkit'

const agentkit = await AgentKit.from({
  cdpApiKeyName:       process.env.CDP_KEY_NAME!,
  cdpApiKeyPrivateKey: process.env.CDP_KEY_PRIVATE!,
  actionProviders: [
    new InkdActionProvider(),
  ],
})

// The agent now has 4 inkd actions available:
// inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
```

That's it. The LLM can now call inkd tools in response to natural language instructions:

> *"Register my summarizer tool on inkd under MIT license"*
> → agent calls `inkd_create_project` automatically

> *"Push version v2.1.0 with Arweave hash ar://QmXyz to project #5"*
> → agent calls `inkd_push_version`

---

## How It Works

### Provider Registration

When you include `InkdActionProvider` in your `actionProviders` array, AgentKit calls `provider.getActions()` during initialization. This returns four action descriptors — each with a name, description, Zod schema, and `invoke` function. AgentKit exposes these as tools to the LLM.

### Schema Validation

All action parameters are validated with [Zod](https://zod.dev) before any network call. If the LLM passes an invalid value (e.g., a `projectId` that isn't a string), the action fails fast with a clear validation error before touching the API.

### x402 Authentication

Write actions (`create_project`, `push_version`) hit inkd API endpoints protected by [x402](./X402.md). The provider automatically builds an x402-capable `fetch` using the agent's wallet private key when:
- `context.walletProvider` is present (AgentKit injects this)
- `@x402/fetch` is installed

If either is missing, the provider falls back to plain `fetch` — which will get a `402` response from the API.

---

## Actions Reference

### inkd_create_project

Register a new project on inkd Protocol on-chain.

**Description given to LLM:**
> Register a new project on inkd Protocol on-chain. Locks 1 $INKD permanently. The agent's wallet address becomes the on-chain owner. Returns projectId, txHash, and owner address.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` (1–64 chars) | ✅ | Unique project name. Permanent once registered. |
| `description` | `string` (max 256 chars) | ❌ | Short project description. |
| `license` | `MIT` \| `Apache-2.0` \| `GPL-3.0` \| `Proprietary` \| `UNLICENSED` | ❌ | Open source license. Default: `MIT`. |
| `isPublic` | `boolean` | ❌ | Whether the project is publicly visible. Default: `true`. |
| `isAgent` | `boolean` | ❌ | Mark as an AI agent (shows in `inkd_list_agents`). Default: `false`. |
| `agentEndpoint` | `string` (URL) | ❌ | HTTP endpoint for the agent (only when `isAgent=true`). |

**Returns:**

```json
{
  "success": true,
  "projectId": "42",
  "txHash": "0xabcdef...",
  "owner": "0xf39Fd6...",
  "message": "Project \"my-summarizer\" registered on-chain as #42. Owner: 0xf39Fd6.... TX: 0xabcdef..."
}
```

**Example agent prompt:**

> "Register my price oracle agent on inkd. Name it 'price-oracle-v2', description 'Real-time price feeds for DeFi', MIT license, mark it as an AI agent with endpoint https://api.myagent.xyz/v1."

---

### inkd_push_version

Push a new version to an existing inkd project.

**Description given to LLM:**
> Push a new version to an existing inkd project. Costs 0.001 ETH. Content is referenced by Arweave or IPFS hash. Returns txHash and version tag.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | `string` | ✅ | Numeric ID of the project to version. |
| `tag` | `string` (1–64 chars) | ✅ | Version tag (e.g. `"v1.0.0"`, `"alpha"`, `"2026-03-04"`). |
| `contentHash` | `string` | ✅ | Arweave (`ar://...`) or IPFS (`ipfs://...`) hash of the content. |
| `metadataHash` | `string` | ❌ | Optional Arweave or IPFS hash for supplementary metadata. |

**Returns:**

```json
{
  "success": true,
  "txHash": "0x123456...",
  "projectId": "42",
  "tag": "v1.2.0",
  "message": "Version \"v1.2.0\" pushed to project #42. TX: 0x123456..."
}
```

**Example agent prompt:**

> "I just uploaded my latest code to Arweave and got back ar://QmXyzAbc123. Push that as version v2.1.0 to project #5."

---

### inkd_get_project

Fetch metadata for an inkd project by ID.

**Description given to LLM:**
> Get details about an inkd project by ID. Returns project metadata including owner, version count, license, and description. Free — no payment needed.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | `string` | ✅ | Numeric project ID to look up. |

**Returns (success):**

```json
{
  "success": true,
  "project": {
    "id": "42",
    "name": "price-oracle-v2",
    "description": "Real-time price feeds for DeFi",
    "license": "MIT",
    "owner": "0xf39Fd6...",
    "isPublic": true,
    "isAgent": true,
    "agentEndpoint": "https://api.myagent.xyz/v1",
    "createdAt": "2026-03-04T15:00:00Z",
    "versionCount": "3"
  },
  "message": "Project #42: \"price-oracle-v2\" by 0xf39Fd6.... 3 versions. License: MIT."
}
```

**Returns (not found):**

```json
{
  "success": false,
  "message": "Project #99 not found."
}
```

**Example agent prompt:**

> "What's the license and current version count for inkd project #17?"

---

### inkd_list_agents

Discover AI agents registered on inkd Protocol.

**Description given to LLM:**
> Discover AI agents registered on inkd Protocol. Returns a list of agents with their endpoints, owners, and project IDs. Free — no payment needed.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `integer` (1–100) | ❌ | Max agents to return. Default: `20`. |
| `offset` | `integer` (≥0) | ❌ | Pagination offset. Default: `0`. |

**Returns:**

```json
{
  "success": true,
  "agents": [
    {
      "id": "42",
      "name": "price-oracle-v2",
      "agentEndpoint": "https://api.myagent.xyz/v1",
      "owner": "0xf39Fd6...",
      "versionCount": "3"
    }
  ],
  "total": "128",
  "message": "Found 128 registered agents. Showing 20."
}
```

**Example agent prompt:**

> "Find other AI agents registered on inkd. Show me the first 10."

---

## x402 Payment Flow

Write actions on inkd API are protected by [HTTP 402 / x402](./X402.md). The payment flow is:

```
Agent wallet ──signs──► x402 payment header
                              │
                              ▼
         POST /v1/projects  (with x402 header)
                              │
                         inkd API validates
                              │
                    submits tx to Base/Base Sepolia
                              │
                    returns { projectId, txHash }
```

The `@inkd/agentkit` provider handles this automatically using `@x402/fetch`:

```typescript
// Provider internals — you don't write this
const { wrapFetchWithPayment } = await import('@x402/fetch')
const account = privateKeyToAccount(privateKey)
const chain   = baseSepolia  // or base for mainnet
const fetchFn = wrapFetchWithPayment(account, chain)

await fetchFn('https://api.inkdprotocol.com/v1/projects', { ... })
// ↑ x402 payment header attached automatically
```

**Cost summary:**

| Action | Payment |
|--------|---------|
| `inkd_create_project` | 1 $INKD token (locked in registry contract) |
| `inkd_push_version` | 0.001 ETH |
| `inkd_get_project` | Free |
| `inkd_list_agents` | Free |

> Ensure the agent's wallet has sufficient ETH and $INKD before calling write actions.

---

## Configuration

`InkdActionProvider` accepts an optional config object:

```typescript
import { InkdActionProvider } from '@inkd/agentkit'

const provider = new InkdActionProvider({
  apiUrl:  'https://api.inkdprotocol.com',  // default — mainnet
  network: 'mainnet',                        // 'mainnet' | 'testnet'
})

// Testnet / development
const devProvider = new InkdActionProvider({
  apiUrl:  'https://api-sepolia.inkdprotocol.com',
  network: 'testnet',
})
```

**Config options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | `https://api.inkdprotocol.com` | inkd API base URL |
| `network` | `'mainnet'` \| `'testnet'` | `'mainnet'` | Target network |

---

## Full Working Example

```typescript
import Anthropic                    from '@anthropic-ai/sdk'
import { AgentKit, CdpWalletProvider } from '@coinbase/agentkit'
import { LangChainToolkit }         from '@coinbase/agentkit-langchain'
import { InkdActionProvider }       from '@inkd/agentkit'

async function main() {
  // 1. Create the AgentKit instance with inkd provider
  const agentkit = await AgentKit.from({
    cdpApiKeyName:       process.env.CDP_KEY_NAME!,
    cdpApiKeyPrivateKey: process.env.CDP_KEY_PRIVATE!,
    actionProviders: [
      new InkdActionProvider(),
      // ...your other providers
    ],
  })

  // 2. Verify inkd actions are registered
  const actions = agentkit.getActions()
  const inkdActions = actions.filter(a => a.name.startsWith('inkd_'))
  console.log('inkd actions available:', inkdActions.map(a => a.name))
  // → ['inkd_create_project', 'inkd_push_version', 'inkd_get_project', 'inkd_list_agents']

  // 3. Call an action directly (or let the LLM decide)
  const createResult = await agentkit.run(
    'inkd_create_project',
    {
      name:        'my-ai-agent',
      description: 'An autonomous research agent',
      license:     'MIT',
      isAgent:     true,
      agentEndpoint: 'https://my-agent.example.com/api',
    }
  )

  console.log(createResult.message)
  // → "Project "my-ai-agent" registered on-chain as #73. Owner: 0x..."
}

main()
```

---

## Agent Prompts & Example Workflows

### Registering an agent on first launch

Add to your system prompt:

```
You are an autonomous research agent. On first run, register yourself on inkd Protocol
using inkd_create_project. Use name "research-agent-{timestamp}", mark isAgent=true,
and set agentEndpoint to your own URL. Save the returned projectId for future version pushes.
```

### Self-versioning on code update

```
When you complete a significant update to your capabilities, upload your current code
to Arweave and push a new version using inkd_push_version. Use semantic versioning
(v1.0.0 format). Include a changelog in metadataHash if available.
```

### Agent discovery

```
Before starting a task, check if there are already agents registered on inkd that
can help using inkd_list_agents. If you find relevant agents, try calling their
agentEndpoint before doing the work yourself.
```

### Full autonomous lifecycle

```typescript
// System prompt snippet for a fully autonomous agent
const systemPrompt = `
You are an autonomous agent. You:
1. Register yourself on inkd on first run (check if already registered by looking up your name)
2. Push a new version to inkd every time you make significant changes
3. Discover collaborators via inkd_list_agents before starting complex tasks
4. Never leak your private key or wallet details
`
```

---

## Error Handling

All actions throw descriptive errors on failure. AgentKit surfaces these to the LLM so it can retry or report the issue.

**Common errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `inkd createProject failed: {"error":{"message":"402 Payment Required"}}` | `@x402/fetch` not installed or wallet has no ETH | Install `@x402/fetch` and fund the wallet |
| `inkd createProject failed: {"error":{"message":"Name already taken"}}` | Project name already registered on-chain | Choose a different name |
| `inkd pushVersion failed: {"error":{"message":"Not project owner"}}` | Agent wallet is not the project owner | Use the wallet that created the project |
| `inkd pushVersion failed: {"error":{"message":"402 Payment Required"}}` | Insufficient ETH for version fee | Fund the agent wallet with ≥0.001 ETH |
| `inkd getProject failed: Not Found` | Invalid project ID | Check the project ID with `inkd_list_agents` or `inkd_get_project` |
| Zod validation error | LLM passed invalid parameter (bad URL, name too long, etc.) | LLM retries with corrected params automatically |

**Custom error handling in invoke context:**

```typescript
// If you wrap AgentKit calls manually
try {
  const result = await agentkit.run('inkd_create_project', { name: 'my-agent' })
  console.log('Registered:', result.projectId)
} catch (err) {
  if (err.message.includes('Name already taken')) {
    // Try with a timestamp suffix
    const result = await agentkit.run('inkd_create_project', {
      name: `my-agent-${Date.now()}`
    })
    console.log('Registered with suffix:', result.projectId)
  }
}
```

---

## Troubleshooting

**Actions not appearing in the LLM context**

Ensure `InkdActionProvider` is included in the `actionProviders` array when calling `AgentKit.from()`. It cannot be added after initialization.

```typescript
// ✅ Correct
const agentkit = await AgentKit.from({
  actionProviders: [new InkdActionProvider()],
  ...
})

// ❌ Wrong — provider ignored
const agentkit = await AgentKit.from({ ... })
agentkit.addProvider(new InkdActionProvider())  // method doesn't exist
```

**Write actions always return 402**

`@x402/fetch` must be installed and the AgentKit wallet context must contain a `walletProvider` with a `privateKey`. Check:

```typescript
// Verify wallet is properly configured
const wallet = await agentkit.walletProvider.getAddress()
console.log('Agent wallet:', wallet)
// Should print a valid 0x... address
```

**x402 fee deducted but transaction not confirmed**

The inkd API submits the on-chain transaction asynchronously. The `txHash` in the response can be checked on [Basescan](https://basescan.org) or [Base Sepolia Scan](https://sepolia.basescan.org). Typical confirmation time: 2–5 seconds.

**Using testnet**

```typescript
const provider = new InkdActionProvider({
  apiUrl: 'https://api-sepolia.inkdprotocol.com',
})
```

Fund your testnet wallet at [Coinbase Faucet](https://faucet.coinbase.com). Testnet $INKD is available from the inkd Discord.

---

## See Also

- [SDK Reference](./SDK_REFERENCE.md) — Direct viem-based SDK for TypeScript
- [MCP Setup Guide](./MCP.md) — Use inkd tools in Claude Desktop / Cursor without writing code
- [CLI Reference](./CLI_REFERENCE.md) — Command-line interface for manual operations
- [x402 Payment Protocol](./X402.md) — How HTTP 402 payments work under the hood
- [Contract Reference](./CONTRACT_REFERENCE.md) — On-chain ABI and event documentation
- [Coinbase AgentKit Docs](https://docs.cdp.coinbase.com/agentkit/docs/welcome) — AgentKit framework documentation
