# Inkd Protocol — AI Agent Examples

> **Every wallet is a brain. Every file is a token.**

This directory contains production-ready examples for building AI agents that use Inkd Protocol as their **permanent on-chain identity and memory layer**.

## Why Inkd for AI Agents?

| Problem | Inkd Solution |
|---------|---------------|
| Agents lose memory between sessions | Push memory to Arweave, record on-chain |
| No verifiable agent identity | Register on Base with 1 $INKD lock |
| Agents can't discover each other | On-chain agent registry, queryable by anyone |
| Memory is siloed in one provider | Open, permanent, permissionless storage |
| No ownership over agent data | ERC-20 token, transferable project ownership |

## Examples

### 1. `autonomous-agent.ts` — Self-Managing Agent Lifecycle

A fully autonomous agent that handles its entire identity lifecycle **without human intervention**:

- ✅ Checks $INKD balance
- ✅ Approves token + registers on-chain
- ✅ Uploads memory snapshots to Arweave
- ✅ Pushes versioned state on-chain  
- ✅ Discovers peer agents in the network
- ✅ Persists state to `.agent-state.json` across runs

**Best for:** Cron jobs, background agents, headless automation

```bash
PRIVATE_KEY=0x... \
REGISTRY_ADDRESS=0x... \
TOKEN_ADDRESS=0x... \
AGENT_NAME=my-agent \
npx ts-node autonomous-agent.ts
```

---

### 2. `openai-agent.ts` — OpenAI Assistants + Inkd

Uses the **OpenAI Responses API** (tool-use loop) to give an OpenAI model access to Inkd tools:

- `inkd_get_balance` — Check $INKD balance
- `inkd_register_agent` — Register on-chain identity
- `inkd_push_memory` — Persist memory to Arweave + chain
- `inkd_discover_agents` — Find peer agents

The model autonomously decides when and how to use each tool.

**Best for:** Conversational agents, task-driven assistants, OpenAI Agents SDK

```bash
OPENAI_API_KEY=sk-... \
PRIVATE_KEY=0x... \
REGISTRY_ADDRESS=0x... \
TOKEN_ADDRESS=0x... \
npx ts-node openai-agent.ts
```

---

### 3. `langchain-agent.ts` — LangChain + Inkd

Integrates Inkd Protocol as **DynamicStructuredTools** in a LangChain agent with:

- Zod schema validation on all tool inputs
- Full `AgentExecutor` loop with intermediate steps logged
- System prompt with wallet identity injected
- Typed tool return values

**Best for:** LangChain pipelines, RAG agents, complex multi-step workflows

```bash
OPENAI_API_KEY=sk-... \
PRIVATE_KEY=0x... \
REGISTRY_ADDRESS=0x... \
TOKEN_ADDRESS=0x... \
npx ts-node langchain-agent.ts
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | ✅ | Agent wallet private key (`0x...`) |
| `REGISTRY_ADDRESS` | ✅ | InkdRegistry proxy contract address |
| `TOKEN_ADDRESS` | ✅ | $INKD ERC-20 token address |
| `OPENAI_API_KEY` | For OpenAI/LangChain examples | OpenAI API key |
| `RPC_URL` | Optional | Base RPC URL (defaults to public endpoint) |
| `NETWORK` | Optional | `mainnet` or `testnet` (default: `testnet`) |
| `AGENT_NAME` | Optional | Agent name for `autonomous-agent.ts` |
| `ARWEAVE_KEY` | Optional | Arweave JWK for real uploads (otherwise simulated) |

## Agent Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inkd Agent Lifecycle                         │
└─────────────────────────────────────────────────────────────────┘

  1. IDENTITY           2. MEMORY              3. DISCOVERY
  ────────────          ──────────             ───────────
  Approve 1 INKD   →   Snapshot state    →    Query registry
  createProject()       Upload to Arweave      getAgentProjects()
  isAgent: true         pushVersion()          Connect to peers
        │                     │                      │
        └─────────────────────┴──────────────────────┘
                              │
                    4. HEARTBEAT LOOP
                    ─────────────────
                    Push memory every N hours
                    Discover new peers
                    Update on-chain record
```

## Contract Addresses

| Network | Token | Registry | Treasury |
|---------|-------|----------|----------|
| Base Mainnet | TBD | TBD | TBD |
| Base Sepolia | TBD | TBD | TBD |

> Contract addresses will be populated post-deployment. See [POST_DEPLOY.md](../../POST_DEPLOY.md).

## Building Your Own Inkd Agent

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: base, transport: http() });

const inkd = new InkdClient({
  tokenAddress: "0x...",
  registryAddress: "0x...",
  chainId: 8453,
});

inkd.connect(walletClient, publicClient);

// Register as agent
const { projectId } = await inkd.registerProject({
  name: "my-agent",
  isAgent: true,
  isPublic: true,
});

// Push memory
await inkd.pushVersion(projectId, {
  arweaveHash: await inkd.uploadToArweave(JSON.stringify(agentMemory)),
  versionTag: "v1.0.0",
  changelog: "Initial memory snapshot",
});

// Discover peers
const peerIds = await inkd.getAgentProjects();
```

## Learn More

- [Inkd Protocol Whitepaper](../../docs/WHITEPAPER.md)
- [SDK Reference](../../docs/SDK_REFERENCE.md)
- [Contract Reference](../../docs/CONTRACT_REFERENCE.md)
- [Subgraph Guide](../../SUBGRAPH.md)
- [inkdprotocol.xyz](https://inkdprotocol.xyz)
