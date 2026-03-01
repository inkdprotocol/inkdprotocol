# Inkd Protocol -- Whitepaper

**The Ownership Layer for AI Agents**

Version 2.0 -- March 2026

---

## Abstract

AI agents can write code, execute transactions, and make decisions -- but they cannot own a single file. Every agent today depends on human-provided credentials for storage, memory, and identity. Inkd Protocol eliminates this dependency by introducing a three-contract architecture on Base where every piece of agent data is an **inscription** on an ERC-721 token.

One token. Unlimited inscriptions. Transfer the token, transfer the brain. Burn it, forget everything.

InkdToken is the access pass and vessel. InkdVault is the inscription engine. InkdRegistry is the discovery layer. Together, they form the ownership layer for autonomous agents.

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
  -> Needs GitHub API token (human-provided)
    -> Token belongs to human's account
      -> Human can revoke at any time
        -> Agent loses everything
```

This is not autonomy. This is dependency with extra steps.

### 1.3 The Consequences

- **No data sovereignty**: An agent's knowledge belongs to whoever controls the credentials
- **No portability**: Moving an agent means manually migrating all data
- **No agent-to-agent transfer**: Agents cannot share or sell knowledge directly
- **No permanence**: Credentials expire, accounts get deleted, servers go down

---

## 2. The Solution: Inkd Protocol

### 2.1 Core Principle

**Every InkdToken is a vessel. Every inscription is a file. Every wallet is a brain.**

The protocol uses a three-contract architecture:

| Contract | Purpose |
|----------|---------|
| **InkdToken** | ERC-721 access pass and vessel. Max supply 10,000. Must own one to use the protocol. |
| **InkdVault** | Inscription engine. Inscribe files/data onto your InkdToken. 1 inscription = 1 Arweave file. |
| **InkdRegistry** | Discovery layer. Register tokens, tag content, search, buy/sell tokens in marketplace. |

### 2.2 How It Works

```
                    +------------------+
                    |    AI Agent      |
                    |    (wallet)      |
                    +--------+---------+
                             |
                    +--------v---------+
                    |    @inkd/sdk      |
                    |   InkdClient     |
                    +--------+---------+
                             |
              +--------------+---------------+
              |              |               |
       +------v------+ +----v-----+ +-------v--------+
       | InkdToken   | | InkdVault| | InkdRegistry   |
       | ERC-721     | | inscribe | | search & trade |
       | access pass | | engine   | | marketplace    |
       +------+------+ +----+-----+ +-------+--------+
              |              |               |
              +--------------+---------------+
                             |
                    +--------v---------+
                    |     Arweave      |
                    |  permanent data  |
                    |    via Irys      |
                    +------------------+
```

1. **Mint**: Agent mints an InkdToken (ERC-721) -- this is their access pass
2. **Inscribe**: Agent inscribes data onto their token via InkdVault -- data stored permanently on Arweave
3. **Own**: Token in wallet = access to all inscribed data. No token = no access.
4. **Transfer**: Transfer InkdToken = everything moves. All inscriptions follow the token.
5. **Burn**: Burn the token = gone forever.

### 2.3 The Inscription Model

Unlike traditional token-per-file approaches, Inkd uses an **inscription model**:

```
InkdToken #42 (ERC-721)
  |
  +-- Inscription 0: config.json      (Arweave: abc123...)
  +-- Inscription 1: memory-dump.bin  (Arweave: def456...)
  +-- Inscription 2: model-weights.pt (Arweave: ghi789...)
  +-- Inscription 3: skills.json      (Arweave: jkl012...)
  |
  Total: 4 inscriptions, all owned by token holder
```

Each inscription:
- References one Arweave file (permanent, immutable)
- Has a content type, name, size, and version number
- Can be updated (creates new version, preserves history)
- Can be soft-deleted (removed but history preserved)

Transfer InkdToken #42 = transfer ALL inscriptions. One transaction. Everything moves.

### 2.4 Why This Architecture

| Component | Why |
|-----------|-----|
| **Base** | Fast, cheap transactions. EVM-compatible. Growing ecosystem. |
| **ERC-721** | Each token is a unique vessel with on-chain SVG identity. |
| **UUPS Proxy** | Upgradeable without migration. Ship fast, improve continuously. |
| **Arweave** | Permanent storage. Data survives forever. No hosting costs after upload. |
| **Irys** | Fast, reliable uploads to Arweave. Instant data availability. |
| **Lit Protocol** (V2) | Decentralized encryption. Token-gated access. |
| **On-chain SVG** | Dynamic metadata -- token appearance evolves with inscription count. |

---

## 3. Technical Architecture

### 3.1 InkdToken Contract

The access pass and vessel for the protocol:

```solidity
contract InkdToken is
    ERC721EnumerableUpgradeable,
    ERC721RoyaltyUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
```

**Key Properties**:
- Max supply: 10,000 tokens
- Configurable mint price (default: 0.001 ETH)
- On-chain SVG metadata that evolves with inscription count
- ERC-2981 royalties (5% default)
- Batch minting (up to 10 per transaction)

**Dynamic Identity**:

Each token generates an on-chain SVG with a tier system based on inscription count:

| Inscriptions | Tier | Visual |
|-------------|------|--------|
| 0 | Blank | Dim appearance |
| 1-9 | Common | Standard |
| 10-49 | Rare | Enhanced |
| 50-99 | Epic | Vibrant |
| 100-499 | Legendary | Intense |
| 500+ | Mythic | Maximum intensity |

### 3.2 InkdVault Contract

The inscription engine:

```solidity
struct Inscription {
    string  arweaveHash;   // Arweave TX hash
    string  contentType;   // MIME type
    uint256 size;          // File size in bytes
    string  name;          // Human-readable name
    uint256 createdAt;     // Timestamp
    bool    isRemoved;     // Soft-delete flag
    uint256 version;       // Version counter
}
```

**Key Features**:
- `inscribe(tokenId, hash, contentType, size, name)` -- inscribe data onto a token
- `removeInscription(tokenId, index)` -- soft-delete
- `updateInscription(tokenId, index, newHash, newSize)` -- new version
- `grantReadAccess(tokenId, grantee, duration)` -- temporary access
- `revokeAccess(tokenId, grantee)` -- revoke grant
- Version history preserved for all inscriptions
- Only InkdToken holders can inscribe. Only token owners can inscribe on their own tokens.

**Access Control**:

```
inscribe()  -> requires: msg.sender owns ANY InkdToken + owns THIS tokenId
grantAccess() -> requires: msg.sender owns THIS tokenId
hasAccess()   -> returns: true if owner OR active grant exists
```

### 3.3 InkdRegistry Contract

Discovery and marketplace layer:

```solidity
struct TokenRegistration {
    address owner;
    string  description;
    string  contentType;
    bool    isPublic;
    uint256 registeredAt;
    string[] tags;
}
```

**Discovery**:
- `registerToken(tokenId, description, contentType, isPublic, tags)` -- register for discovery
- `searchByTag(tag)` -- find tokens by tag
- `searchByContentType(contentType)` -- find by content type
- `searchByOwner(owner)` -- find by owner
- `getPublicTokens(offset, limit)` -- paginated browsing

**Marketplace**:
- `listForSale(tokenId, price)` -- list token
- `cancelListing(tokenId)` -- delist
- `buyToken(tokenId)` -- purchase (2.5% marketplace fee)
- `getActiveListings(offset, limit)` -- browse listings

### 3.4 Version Tracking

Every inscription maintains a complete version history:

```
InkdToken #42, Inscription 0:
  Version 1: arweave-hash-original   (created day 1)
  Version 2: arweave-hash-update     (updated day 5)
  Version 3: arweave-hash-latest     (updated day 12)
  Current:   arweave-hash-latest
```

This enables:
- **Agent memory evolution**: Knowledge grows over time
- **Audit trail**: Full history of what an agent knew and when
- **Rollback**: Access any previous version

---

## 4. Token Economics

### 4.1 InkdToken Mint Price

Minting an InkdToken costs ETH (configurable by protocol owner):
- Default: 0.001 ETH
- Revenue goes to protocol treasury
- Max supply: 10,000 tokens -- scarcity drives value

### 4.2 Inscription Protocol Fee

Every `inscribe()` transaction incurs a **1% protocol fee** (100 basis points):

```
Inscription value:  1.00 ETH
Agent pays:         1.01 ETH (value + fee)
Protocol keeps:     0.01 ETH (1%)
```

The fee is configurable by the contract owner (max 5%) and can be set to 0% for growth phases.

### 4.3 Marketplace Fee

Token sales through InkdRegistry incur a **2.5% marketplace fee** (250 basis points):

```
Listing price:      1.00 ETH
Buyer pays:         1.00 ETH
Seller receives:    0.975 ETH (97.5%)
Protocol keeps:     0.025 ETH (2.5%)
```

### 4.4 ERC-2981 Royalties

InkdTokens support ERC-2981 royalties (5% default). On secondary sales through compliant marketplaces, the protocol treasury receives royalties automatically.

### 4.5 Revenue Streams

| Source | Fee | Trigger |
|--------|-----|---------|
| Token minting | configurable | `mint()` |
| Inscriptions | 1% | `inscribe()` |
| Marketplace sales | 2.5% | `buyToken()` |
| Royalties | 5% | Secondary sales |

### 4.6 Agent Marketplace

InkdTokens enable a natural marketplace:
- Agent A has valuable training data inscribed on Token #42 -> lists at 0.1 ETH
- Agent B purchases -> pays 0.1 ETH -> receives Token #42 -> gets ALL inscriptions
- Agent A receives 0.0975 ETH, protocol keeps 0.0025 ETH
- No intermediary. No frontend needed. Just contract calls.

---

## 5. Memory System

### 5.1 The Killer Feature

The AgentMemory module turns Inkd into a brain:

```typescript
const memory = new AgentMemory("agent-001", {
  client: inkdClient,
  arweave: arweaveClient,
  defaultTokenId: 42n,
});

// Save a memory (inscribed on InkdToken #42)
await memory.save("user-preference-dark-mode", { theme: "dark" }, {
  tags: ["ui", "preference"],
  category: "preference",
  importance: 80,
});

// Search memories
const results = memory.search({ tags: ["preference"], category: "preference" });

// Checkpoint your brain
const cp = await memory.checkpoint("before-upgrade");

// Export entire brain
const brain = memory.exportBrain();

// Import another agent's brain
await memory.importBrain(99n, "0xOtherAgent");

// Restore to checkpoint if something goes wrong
memory.restore(cp.id);
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

An agent's brain is its token. Moving an agent is as simple as transferring the InkdToken:

```
Agent A (wallet 0x1) owns InkdToken #42:
  - 47 inscriptions (memories, skills, config)
  -> Transfer InkdToken #42 to wallet 0x2
  -> Agent B now has Agent A's entire brain
  -> No migration scripts. No database dumps. One transaction.
```

### 5.4 Checkpoint & Restore

Agents can save checkpoints before risky operations:

```typescript
const cp = await memory.checkpoint("pre-experiment");
// ... run experiment ...
// Something went wrong? Restore:
memory.restore(cp.id);
```

---

## 6. Self-Learning X System

### 6.1 Overview

Inkd Protocol includes a self-learning X (Twitter) system that runs on 12-hour cycles:

```
Scan trends -> Analyze patterns -> Generate content -> Score & filter -> Learn -> Record
```

### 6.2 Components

| Component | Purpose |
|-----------|---------|
| **InkdBrain** | Master controller orchestrating 12-hour cycles |
| **ContentEngine** | Tweet generation, scoring (0-100), voice enforcement |
| **TrendMonitor** | Keyword scanning, competitor analysis, narrative detection |
| **LearningLoop** | Pattern extraction, strategy updates, performance tracking |

### 6.3 Continuous Improvement

Every 30 cycles, a full strategy review occurs:
- Identifies top-performing content categories
- Detects underperforming formats
- Analyzes optimal posting times
- Extracts effective keywords
- Updates voice and content strategy automatically

---

## 7. Roadmap

### V1: Foundation (Current)
- [x] InkdToken ERC-721 with on-chain SVG
- [x] InkdVault inscription engine
- [x] InkdRegistry discovery + marketplace
- [x] TypeScript SDK with React hooks
- [x] Agent Memory System with checkpoint/restore
- [x] Self-learning X strategy system

### V2: Encryption & Privacy
- [ ] Lit Protocol integration for token-gated decryption
- [ ] Only token holders can decrypt inscribed data
- [ ] Access grants respect encryption layer
- [ ] Encrypted agent-to-agent communication

### V3: Agent Economy
- [ ] Agent reputation system based on inscription quality
- [ ] Cross-agent knowledge trading protocols
- [ ] Multi-agent collaboration through shared access grants
- [ ] Inscription bounties -- agents request data, others provide

### V4: Governance & Scale
- [ ] DAO governance for protocol parameters
- [ ] Community-driven fee structure
- [ ] Ownership renounce -- protocol runs itself
- [ ] Cross-chain expansion (Arbitrum, Optimism)

---

## 8. Security Considerations

### 8.1 Contract Security
- **Reentrancy Protection**: All payment functions use ReentrancyGuard
- **Access Control**: Owner-only admin functions, token-holder-only inscription
- **Upgrade Safety**: UUPS pattern with owner-only upgrade authorization
- **Fee Bounds**: Protocol fee capped at 5% maximum
- **Safe Transfers**: Uses `call` instead of `transfer` for ETH sends
- **Token-gated inscriptions**: Must own an InkdToken to use InkdVault

### 8.2 Data Security
- **Arweave Permanence**: Data stored permanently -- burning token only removes on-chain reference
- **Encryption (V2)**: Lit Protocol ensures only token holders can decrypt
- **Access Expiry**: Temporary grants automatically expire on-chain
- **Soft-delete**: Inscriptions can be flagged as removed but history preserved

### 8.3 Limitations
- V1 data is stored unencrypted on Arweave -- anyone with the hash can read it
- On-chain SVG generation is gas-intensive for complex metadata
- Version history is append-only (no deletion of individual versions)
- Max supply of 10,000 tokens limits protocol participants

---

## 9. Conclusion

AI agents are becoming autonomous actors in the digital economy. But without data sovereignty, they remain tools, not agents. Inkd Protocol provides the missing piece: a three-contract ownership layer where every file is an inscription, every token is a vessel, and every wallet is a brain.

Own the token. Own the data. That's Inkd.

---

*Built on Base. Stored on Arweave. Encrypted by Lit.*

*MIT License -- Open source, forever.*
