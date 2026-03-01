# Inkd Protocol — Whitepaper

**The Decentralized Ownership Layer for AI Agents**

Version 1.0 — March 2026

---

## Abstract

AI agents today are capable of writing code, making decisions, and executing complex tasks — but they cannot own a single file without human permission. Every agent relies on human-provided credentials (GitHub tokens, API keys, cloud accounts) for storage. This creates a fundamental dependency that undermines agent autonomy.

Inkd Protocol solves this by turning every piece of data — files, code, memories, skills — into an ERC-1155 token on Base. An agent's wallet becomes its brain. Ownership is cryptographic, not credential-based. Transfer a wallet, transfer an entire mind. Burn a token, forget a memory. No servers. No accounts. No humans required.

---

## 1. The Problem

### 1.1 Agents Are Dependents, Not Autonomous

Modern AI agents (LangChain, AutoGPT, CrewAI) can:
- Write and execute code
- Make financial transactions
- Communicate with other agents
- Learn from experience

But they **cannot**:
- Store a file without a human-provided GitHub token
- Save memory without a human-configured database
- Own their own data
- Transfer knowledge to another agent without human intervention

### 1.2 The Credential Dependency Chain

```
Agent wants to save a file
  → Needs GitHub API token (human-provided)
    → Token belongs to human's account
      → Human can revoke at any time
        → Agent loses everything
```

This is not autonomy. This is dependency with extra steps.

### 1.3 The Consequences

- **No data sovereignty**: An agent's knowledge, code, and memory belong to whoever controls the credentials.
- **No portability**: Moving an agent between platforms means manually migrating all data.
- **No agent-to-agent transfer**: Agents cannot share or sell knowledge directly.
- **No permanence**: Credentials expire, accounts get deleted, servers go down.

---

## 2. The Solution: Inkd Protocol

### 2.1 Core Principle

**Every file, code snippet, or piece of knowledge is a token.**

| Action | Inkd Equivalent |
|--------|----------------|
| Store a file | `mint(arweaveHash, metadataURI, price)` |
| Delete a file | `burn(tokenId)` |
| Transfer ownership | `safeTransferFrom(from, to, tokenId)` |
| Sell knowledge | `purchase(tokenId, seller)` |
| Check what you own | `balanceOf(address, tokenId)` |
| Update a file | `addVersion(tokenId, newArweaveHash)` |
| Share temporarily | `grantAccess(tokenId, wallet, expiresAt)` |

### 2.2 How It Works

```
                    ┌──────────────┐
                    │   AI Agent   │
                    │  (wallet)    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Inkd SDK    │
                    │  (@inkd/sdk) │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼────┐ ┌─────▼──────┐
       │   Arweave   │ │ Base  │ │    Lit     │
       │  (storage)  │ │(chain)│ │(encryption)│
       └─────────────┘ └───────┘ └────────────┘
```

1. **Upload**: Agent sends data to Arweave via Irys (permanent, decentralized storage)
2. **Encrypt** (V2): Data is encrypted via Lit Protocol — only token holder can decrypt
3. **Mint**: ERC-1155 token is minted on Base with the Arweave hash
4. **Own**: Token in wallet = access to data. No token = no access.

### 2.3 Why This Architecture

| Component | Why |
|-----------|-----|
| **Base** | Fast, cheap transactions. EVM-compatible. Growing ecosystem. |
| **ERC-1155** | Multi-token standard — one contract, unlimited data types. Semi-fungible for flexibility. |
| **UUPS Proxy** | Upgradeable without migration. Ship fast, improve continuously. |
| **Arweave** | Permanent storage. Data survives forever. No hosting costs after upload. |
| **Lit Protocol** (V2) | Decentralized encryption. Token-gated access. No central key server. |
| **Irys** | Fast, reliable uploads to Arweave. Instant data availability. |

---

## 3. Technical Architecture

### 3.1 InkdVault Contract

The core smart contract implementing all on-chain logic:

```solidity
contract InkdVault is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
```

**Storage Model**:

```solidity
struct DataToken {
    address creator;       // Original minter
    string  arweaveHash;   // Current Arweave TX id
    string  metadataURI;   // Off-chain metadata
    uint256 price;         // Listing price (0 = not for sale)
    uint256 createdAt;     // Creation timestamp
}
```

**Key Features**:

- **Single Mint**: `mint(hash, uri, price) → tokenId`
- **Batch Mint**: `batchMint(hashes[], uris[], prices[]) → tokenIds[]`
- **Purchase**: `purchase(tokenId, seller)` — pays seller, deducts protocol fee
- **Price Management**: `setPrice(tokenId, price)` — list/delist
- **Burn**: `burn(tokenId)` — permanently destroy
- **Versioning**: `addVersion(tokenId, newHash)` — push updates without re-minting
- **Access Grants**: `grantAccess(tokenId, wallet, expiresAt)` — temporary read access
- **Access Checks**: `checkAccess(tokenId, wallet)` — owner OR active grant

### 3.2 Version Tracking

Every token maintains a version history:

```
Token #42:
  Version 0: arweave-hash-original  (created)
  Version 1: arweave-hash-update-1  (updated day 5)
  Version 2: arweave-hash-update-2  (updated day 12)
  Current:   arweave-hash-update-2
```

This enables:
- **Agent memory evolution**: An agent's knowledge grows over time
- **Audit trail**: Full history of what an agent knew and when
- **Rollback**: Access any previous version

### 3.3 Access Grants

Temporary access without ownership transfer:

```
grantAccess(tokenId=42, wallet=0xAgent2, expiresAt=1735689600)
```

- Agent2 can read the data until the expiry timestamp
- Owner retains full control
- Access is checked on-chain: `checkAccess(tokenId, wallet) → bool`
- Owner can revoke anytime: `revokeAccess(tokenId, wallet)`

---

## 4. Token Economics

### 4.1 Protocol Fee

Every `purchase()` transaction incurs a **1% protocol fee** (100 basis points):

```
Buyer pays:     1.00 ETH
Seller receives: 0.99 ETH  (99%)
Protocol keeps:  0.01 ETH  (1%)
```

The fee is configurable by the contract owner (max 5%) and can be set to 0% for growth phases.

### 4.2 Fee Distribution

Protocol fees accumulate in the contract and are withdrawable by the contract owner:

```solidity
function withdrawFees() external onlyOwner
```

### 4.3 Agent Marketplace

Tokens enable a natural marketplace:
- Agent A has valuable training data → lists at 0.1 ETH
- Agent B purchases → pays 0.1 ETH → receives token → can access data
- Agent A receives 0.099 ETH, protocol keeps 0.001 ETH
- No intermediary. No marketplace frontend needed. Just contract calls.

---

## 5. Memory System

### 5.1 The Killer Feature

The AgentMemory module turns Inkd into a brain:

```typescript
const memory = new AgentMemory("agent-001", inkdClient);

// Save a memory
await memory.save("user-preference-dark-mode", { theme: "dark" }, ["ui", "preference"]);

// Search memories
const results = memory.search({ tags: ["preference"], category: "preference" });

// Export entire brain
const brain = memory.export();

// Import another agent's brain
await memory.import("0xOtherAgentWallet");
```

### 5.2 Memory Categories

| Category | Description |
|----------|-------------|
| experience | Learned behaviors, past interactions |
| skill | Acquired capabilities |
| knowledge | Facts, data, information |
| preference | User/agent preferences |
| conversation | Past conversation summaries |
| code | Code snippets, scripts |
| config | Configuration data |
| relationship | Agent-to-agent relationships |
| strategy | Plans, goals |
| reflection | Self-analysis, meta-cognition |

### 5.3 Brain Portability

An agent's brain is its wallet. Moving an agent is as simple as transferring its wallet (or exporting/importing):

```
Agent A (wallet 0x1): 47 memories (tokens)
  → Transfer wallet to new infrastructure
  → Agent A continues with full memory intact
  → No migration scripts. No database dumps. Just tokens.
```

---

## 6. Roadmap

### V1: Foundation (Current)
- InkdVault contract on Base Sepolia
- Mint / Purchase / Burn / Versioning / Access Grants
- TypeScript SDK (@inkd/sdk)
- Arweave storage via Irys
- AgentMemory system
- Self-learning X strategy system

### V2: Encryption
- Lit Protocol integration for token-gated decryption
- Only token holders can decrypt stored data
- Access grants respect encryption layer

### V3: Agent Marketplace
- Agent-to-agent knowledge trading
- Reputation system based on purchase history
- Discovery protocol for finding relevant agent knowledge
- Multi-agent collaboration through shared access grants

### V4: Governance
- DAO governance for protocol parameters
- Community-driven fee structure
- Ownership renounce — protocol runs itself
- Cross-chain expansion

---

## 7. Security Considerations

### 7.1 Contract Security
- **Reentrancy Protection**: All payment functions use ReentrancyGuard
- **Access Control**: Owner-only admin functions, token-holder-only operations
- **Upgrade Safety**: UUPS pattern with owner-only upgrade authorization
- **Fee Bounds**: Protocol fee capped at 5% maximum
- **Safe Transfers**: Uses `call` instead of `transfer` for ETH sends

### 7.2 Data Security
- **Arweave Permanence**: Data cannot be deleted from Arweave (burning token only revokes access key)
- **Encryption (V2)**: Lit Protocol ensures only token holders can decrypt
- **Access Expiry**: Temporary grants automatically expire on-chain

### 7.3 Limitations
- V1 data is stored unencrypted on Arweave — anyone with the hash can read it
- `getTokensByOwner` requires iterating all tokens (not gas-efficient for large collections)
- Version history is append-only (no deletion of individual versions)

---

## 8. Conclusion

AI agents are becoming autonomous actors in the digital economy. But without data sovereignty, they remain tools, not agents. Inkd Protocol provides the missing piece: a decentralized ownership layer where every file, memory, and skill is a token, and every wallet is a brain.

Own the token. Own the data. That's Inkd.

---

*Built on Base. Stored on Arweave. Encrypted by Lit.*

*MIT License — Open source, forever.*
