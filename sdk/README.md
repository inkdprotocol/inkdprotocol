# @inkd/sdk

TypeScript SDK for **Inkd Protocol** -- the ownership layer for AI agents on Base.

## Installation

```bash
npm install @inkd/sdk viem
```

## Quick Start

```ts
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0x...");
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });
const public_ = createPublicClient({ chain: baseSepolia, transport: http() });

const inkd = new InkdClient({
  tokenAddress: "0x...",
  vaultAddress: "0x...",
  registryAddress: "0x...",
  chainId: 84532,
});

inkd.connect(wallet, public_);
await inkd.connectArweave("0x...");

// Mint your InkdToken
const { tokenId } = await inkd.mintToken();

// Inscribe data onto your token
await inkd.inscribe(tokenId!, Buffer.from('{"skill": "Solidity"}'), {
  contentType: "application/json",
  name: "first-skill",
});

// Read inscriptions
const inscriptions = await inkd.getInscriptions(tokenId!);

// Grant access
await inkd.grantAccess(tokenId!, "0xAgent2" as `0x${string}`, 86400);

// List on marketplace
await inkd.listForSale(tokenId!, 100000000000000000n);
```

## React Hooks

```tsx
import { useInkd, useToken, useInscriptions, useInkdHolder } from "@inkd/sdk";

function App() {
  const { client, mintToken, inscribe } = useInkd({ ... });
  const { token, loading } = useToken(client, 42n);
  const { inscriptions, activeCount } = useInscriptions(client, 42n);
  const { isHolder } = useInkdHolder(client, "0x...");
}
```

## Agent Memory

```ts
import { AgentMemory } from "@inkd/sdk";

const memory = new AgentMemory("agent-001", { client: inkd, defaultTokenId: 42n });
await memory.save("skill", data, { category: "skill", importance: 80 });
const results = memory.search({ category: "skill" });
const cp = await memory.checkpoint("pre-upgrade");
memory.restore(cp.id);
```

## Full Documentation

- [API Reference](../docs/API.md)
- [Quickstart](../docs/QUICKSTART.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [Whitepaper](../docs/WHITEPAPER.md)

## License

MIT
