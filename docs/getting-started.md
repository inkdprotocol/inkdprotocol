# Getting Started with Inkd Protocol

> **Inkd Protocol** — permanent on-chain project registry on Base.  
> Lock 1 $INKD. Push versions to Arweave. Own it forever.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | >= 18 |
| A Base wallet | with ETH + $INKD |
| Foundry (contracts only) | latest |

Get Base Sepolia testnet ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

---

## 1. Install the SDK

```bash
npm install @inkd/sdk viem
# or
yarn add @inkd/sdk viem
# or
pnpm add @inkd/sdk viem
```

---

## 2. Initialize the Client

The `InkdClient` wraps all three protocol contracts. Pass your `WalletClient` and select a network:

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

const inkd = new InkdClient({
  walletClient,
  network: "testnet", // or "mainnet" for Base mainnet
});
```

> **Contract addresses** are bundled in the SDK for both `mainnet` and `testnet`. You don't configure them manually.

---

## 3. Approve Token Spend

Before creating a project, the `InkdRegistry` must be approved to pull **1 $INKD** from your wallet. This only needs to happen once (or when your allowance is depleted).

```typescript
// Approve InkdRegistry to spend 1 $INKD
const approveTx = await inkd.approveToken();
console.log("Approve tx:", approveTx);
```

Check your balance first:

```typescript
const [myAddress] = await walletClient.getAddresses();
const balance = await inkd.tokenBalance(myAddress);
console.log(`$INKD balance: ${Number(balance) / 1e18} INKD`);
```

---

## 4. Create Your First Project

One `createProject` call locks **1 $INKD** and registers your project on-chain permanently.

```typescript
const tx = await inkd.createProject({
  name: "my-first-project",      // unique, lowercased, permanent
  description: "My first Inkd project",
  license: "MIT",                 // MIT | GPL-3.0 | Apache-2.0 | Proprietary
  isPublic: true,                 // discoverable by others
  isAgent: false,                 // set true for AI agent tools
  agentEndpoint: "",              // API endpoint (agent projects only)
  readmeHash: "",                 // Arweave hash of README (optional)
});

console.log("Create tx:", tx);
// tx is the transaction hash

// Look up your projects
const [myAddress] = await walletClient.getAddresses();
const myProjects = await inkd.getOwnerProjects(myAddress);
const projectId = myProjects[myProjects.length - 1];

const project = await inkd.getProject(projectId);
console.log(`Project #${project.id}: ${project.name}`);
// Project #1: my-first-project
```

> **Names are permanent and globally unique.** Normalized to lowercase. Choose carefully.

---

## 5. Push Your First Version

Each version costs **0.001 ETH** and permanently records an Arweave transaction ID on-chain.

```typescript
const versionTx = await inkd.pushVersion(projectId, {
  arweaveHash: "AbcDefGhijklmnopqrstuvwxyz1234567890abc", // 43-char Arweave txid
  versionTag: "1.0.0",
  changelog: "Initial release. Core functionality complete.",
});

console.log("Version tx:", versionTx);
```

### Upload to Arweave First (via Irys)

```typescript
import Irys from "@irys/sdk";

const irys = new Irys({
  url: "https://node2.irys.xyz",
  token: "ethereum",
  key: "0xYOUR_PRIVATE_KEY",
});
await irys.ready();

const data = Buffer.from(JSON.stringify({
  name: "my-first-project",
  version: "1.0.0",
  files: ["index.ts", "README.md"],
}));

const receipt = await irys.upload(data, {
  tags: [
    { name: "Content-Type", value: "application/json" },
    { name: "App-Name", value: "inkd-protocol" },
    { name: "Project", value: "my-first-project" },
    { name: "Version", value: "1.0.0" },
  ],
});

// Now register the Arweave hash on-chain
await inkd.pushVersion(projectId, {
  arweaveHash: receipt.id,
  versionTag: "1.0.0",
  changelog: "Initial release",
});
```

---

## 6. Read Project & Versions

```typescript
// Get project details
const project = await inkd.getProject(projectId);
// {
//   id: 1n,
//   name: "my-first-project",
//   owner: "0xYourAddress",
//   license: "MIT",
//   isPublic: true,
//   versionCount: 1n,
//   createdAt: 1709423000n,
//   exists: true,
// }

// Get all versions
const versions = await inkd.getVersions(projectId);
for (const v of versions) {
  console.log(`${v.versionTag} → https://arweave.net/${v.arweaveHash}`);
  console.log(`  pushed by ${v.pushedBy}`);
  console.log(`  ${v.changelog}`);
}
```

---

## 7. Register an AI Agent Tool

Set `isAgent: true` to make your project discoverable in the agent registry:

```typescript
const agentTx = await inkd.createProject({
  name: "pr-summarizer-v1",
  description: "Summarizes GitHub pull requests into 3 bullet points",
  license: "MIT",
  isPublic: true,
  isAgent: true,
  agentEndpoint: "https://api.myagent.xyz/v1/summarize",
});

// Any agent can discover registered tools
const agentProjects = await inkd.getAgentProjects(0n, 100n);
console.log(`${agentProjects.length} agent tools on Inkd`);
```

---

## 8. Transfer Project Ownership

Transfer costs **0.005 ETH** (goes to treasury). Locked $INKD stays locked.

```typescript
const newOwner = "0xNewOwnerAddress" as `0x${string}`;
const transferTx = await inkd.transferProject(projectId, newOwner);
```

---

## React Integration

```tsx
import { InkdClient } from "@inkd/sdk";
import { useWalletClient } from "wagmi";
import { useState } from "react";

function CreateProject() {
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState("");

  const handleCreate = async () => {
    if (!walletClient) return;
    const inkd = new InkdClient({ walletClient, network: "testnet" });

    setStatus("Approving...");
    await inkd.approveToken();

    setStatus("Creating project...");
    const tx = await inkd.createProject({
      name: "my-dapp-project",
      description: "Built with React + Inkd",
      license: "MIT",
      isPublic: true,
    });

    setStatus(`Created! Tx: ${tx}`);
  };

  return (
    <div>
      <button onClick={handleCreate}>Create Project</button>
      <p>{status}</p>
    </div>
  );
}
```

---

## Contract Development

```bash
git clone https://github.com/inkdprotocol/inkd-protocol
cd inkd-protocol/contracts

forge install
forge build
forge test -vvv
```

### Deploy to Base Sepolia

```bash
export DEPLOYER_PRIVATE_KEY="0x..."
export BASE_SEPOLIA_RPC="https://sepolia.base.org"
export BASESCAN_API_KEY="your-api-key"

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

---

## Next Steps

- [Contract Reference](./contract-reference.md) — every function, event, and error
- [SDK Reference](./sdk-reference.md) — full `InkdClient` API with TypeScript signatures
- [Architecture](./architecture.md) — how the contracts interact, why Arweave, why Base
- [Tokenomics](./tokenomics.md) — supply, lock mechanics, deflationary model
