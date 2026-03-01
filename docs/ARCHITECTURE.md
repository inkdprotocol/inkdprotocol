# Inkd Protocol -- Technical Architecture

Full technical architecture for the Inkd Protocol ownership layer.

---

## System Overview

```
+-------------------------------------------------------------------+
|                          AI AGENT                                  |
|                    (LangChain / AutoGPT / Custom)                  |
+----------------------------------+--------------------------------+
                                   |
+----------------------------------v--------------------------------+
|                           @inkd/sdk                                |
|                                                                    |
|  InkdClient        ArweaveClient       AgentMemory                 |
|  (3-contract)      (Irys uploads)      (brain storage)             |
|                                                                    |
|  React Hooks:                                                      |
|  useInkd  useToken  useInscriptions  useInkdHolder                 |
+------+------------------+-------------------+---------------------+
       |                  |                   |
+------v------+    +------v------+     +------v------+
| InkdToken   |    | InkdVault   |     | InkdRegistry|
| ERC-721     |    | Inscription |     | Discovery + |
| Access Pass |    | Engine      |     | Marketplace |
| On-chain SVG|    | Versioning  |     | Search/Tags |
| Max: 10,000 |    | Access Ctrl |     | Buy/Sell    |
+------+------+    +------+------+     +------+------+
       |                  |                   |
       +------------------+-------------------+
                          |
                   +------v------+
                   |    Base     |
                   | (L2 Chain)  |
                   +------+------+
                          |
                   +------v------+
                   |   Arweave   |
                   |  Permanent  |
                   |   Storage   |
                   +-------------+
```

---

## Contract Architecture

### Three-Contract Model

Inkd uses a separation-of-concerns approach with three upgradeable contracts:

```
+-------------------+     setVault()      +-------------------+
|    InkdToken      | <-----------------  |    InkdVault      |
|                   |                     |                   |
|  - mint()         |  setInscription     |  - inscribe()     |
|  - batchMint()    |  Count() --------> |  - removeInscr()  |
|  - tokenURI()     |                     |  - updateInscr()  |
|  - isInkdHolder() |                     |  - grantAccess()  |
|  - ownerOf()      |                     |  - hasAccess()    |
+-------------------+                     +-------------------+
        ^                                          ^
        |            +-------------------+         |
        |            |   InkdRegistry    |         |
        +----------- |                   | --------+
                     |  - register()     |
                     |  - searchByTag()  |
                     |  - listForSale()  |
                     |  - buyToken()     |
                     +-------------------+
```

### Why Three Contracts?

| Concern | Contract | Rationale |
|---------|----------|-----------|
| Identity & Access | InkdToken | ERC-721 standards, enumeration, royalties |
| Data Storage | InkdVault | Inscription logic, versioning, access grants |
| Discovery & Trade | InkdRegistry | Search, tags, marketplace -- separable |

Each contract is independently upgradeable via UUPS proxy pattern.

### Proxy Architecture

```
+------------------+     delegatecall     +------------------+
|   ERC1967 Proxy  | ------------------> | Implementation   |
|  (stable address)|                     | (upgradeable)    |
|                  |                     |                  |
|  InkdToken Proxy |                     | InkdToken v1     |
|  InkdVault Proxy |                     | InkdVault v1     |
|  InkdRegistry    |                     | InkdRegistry v1  |
|      Proxy       |                     |                  |
+------------------+                     +------------------+
```

All storage is in the proxy. Implementation can be swapped without data migration.

---

## Data Flow

### Inscription Flow

```
1. Agent calls inscribe(tokenId, hash, contentType, size, name)

   +-------+     inscribe()    +----------+
   | Agent | ----------------> | InkdVault|
   +-------+                   +----+-----+
                                    |
                               Check: isInkdHolder?
                               Check: ownerOf(tokenId)?
                               Check: protocol fee paid?
                                    |
                               +----v-----+
                               | Store    |
                               | on-chain |
                               | mapping  |
                               +----+-----+
                                    |
                               Update InkdToken
                               inscriptionCount
                                    |
                               Emit Inscribed()
```

### Upload + Inscribe Flow (via SDK)

```
1. Agent prepares data
2. SDK uploads to Arweave via Irys -> gets arweaveHash
3. SDK calls InkdVault.inscribe(tokenId, arweaveHash, ...)
4. Data is now: permanent on Arweave + referenced on Base

   +-------+    upload()   +------+    arweaveHash    +-------+
   | Agent | ------------> | Irys | ----------------> | Arweave|
   +-------+               +------+                   +-------+
       |
       |   inscribe(tokenId, hash)
       +-------------------------> +----------+
                                   | InkdVault|
                                   +----------+
```

### Access Grant Flow

```
Owner grants Agent B 24-hour access to Token #42:

   +--------+  grantReadAccess()  +----------+
   | Owner  | ------------------> | InkdVault|
   +--------+                     +----+-----+
                                       |
                                  Store grant:
                                  { grantee, expiresAt }
                                       |
   +--------+   hasAccess(42, B)  +----v-----+
   | Reader | ------------------> | InkdVault|  -> true (if not expired)
   +--------+                     +----------+
```

### Marketplace Flow

```
Seller lists Token #42 for 1 ETH:

   +--------+  listForSale()   +-----------+
   | Seller | ---------------> | Registry  |
   +--------+                  +-----+-----+
                                     |
                                Approve Registry
                                to transfer token
                                     |
   +--------+  buyToken()      +-----v-----+
   | Buyer  | ---------------> | Registry  |
   +--------+  (sends 1 ETH)  +-----+-----+
                                     |
                               Transfer token
                               Seller gets 0.975 ETH
                               Protocol gets 0.025 ETH
```

---

## Storage Architecture

### On-Chain (Base)

Stored directly in smart contract storage:

| Data | Contract | Gas Cost |
|------|----------|----------|
| Token ownership | InkdToken | Standard ERC-721 |
| Inscription metadata | InkdVault | ~50k gas per inscribe |
| Version history | InkdVault | ~30k gas per update |
| Access grants | InkdVault | ~30k gas per grant |
| Token registrations | InkdRegistry | ~60k gas per register |
| Marketplace listings | InkdRegistry | ~40k gas per listing |

### Off-Chain (Arweave)

Stored permanently on Arweave via Irys:

| Data | Format | Access |
|------|--------|--------|
| Agent memories | JSON | Via arweaveHash from inscription |
| Code files | text/* | Via arweaveHash from inscription |
| Model weights | binary | Via arweaveHash from inscription |
| Config files | JSON | Via arweaveHash from inscription |
| Any file type | any MIME | Via arweaveHash from inscription |

### Local (Agent Memory System)

Cached locally for fast access:

```
data/
  memory-index.json    # Memory key -> inscription mapping
  checkpoints.json     # Saved brain states
```

---

## SDK Architecture

### Client Class Hierarchy

```
InkdClient
  |
  +-- connect(walletClient, publicClient)
  |     Connects to Base via viem
  |
  +-- connectArweave(privateKey)
  |     Initializes ArweaveClient with Irys
  |
  +-- Token Operations
  |     mintToken() -> InkdToken.mint()
  |     getToken()  -> InkdToken read
  |     getTokensByOwner() -> InkdToken.getTokensByOwner()
  |     hasInkdToken() -> InkdToken.isInkdHolder()
  |
  +-- Inscription Operations
  |     inscribe()  -> Irys upload + InkdVault.inscribe()
  |     getInscriptions() -> InkdVault.getInscriptions()
  |     removeInscription() -> InkdVault.removeInscription()
  |     updateInscription() -> InkdVault.updateInscription()
  |
  +-- Access Operations
  |     grantAccess() -> InkdVault.grantReadAccess()
  |     revokeAccess() -> InkdVault.revokeAccess()
  |
  +-- Marketplace Operations
        listForSale() -> InkdRegistry.listForSale()
        buyToken()    -> InkdRegistry.buyToken()
```

### React Hooks

```
useInkd()           -- Full client with all operations
useToken(tokenId)   -- Single token data with loading/error
useInscriptions(id) -- Inscriptions for a token
useInkdHolder(addr) -- Check if address holds InkdToken
```

### Error Handling

```
InkdError (base)
  +-- NotInkdHolder       -- No InkdToken in wallet
  +-- InsufficientFunds   -- Not enough ETH
  +-- TokenNotFound       -- Token doesn't exist
  +-- InscriptionNotFound -- Inscription doesn't exist
  +-- NotTokenOwner       -- Not the token owner
  +-- ClientNotConnected  -- No viem client
  +-- ArweaveNotConnected -- No Arweave client
  +-- TransactionFailed   -- On-chain TX failed
  +-- MaxSupplyReached    -- 10,000 tokens minted
  +-- EncryptionError     -- Encryption/decryption failed
  +-- UploadError         -- Arweave upload failed
```

---

## Memory System Architecture

### Brain-as-Inscription Model

```
AgentMemory
  |
  +-- memories: Map<key, Memory>
  |     Each Memory maps to an inscription on an InkdToken
  |
  +-- save(key, data, metadata)
  |     1. Create Memory object
  |     2. JSON.stringify payload
  |     3. InkdClient.inscribe(tokenId, payload)
  |     4. Store inscriptionIndex in local index
  |
  +-- load(tokenId, index)
  |     1. Check local cache
  |     2. If miss: fetch inscription metadata from chain
  |     3. Download from Arweave via arweaveHash
  |     4. Parse and return
  |
  +-- checkpoint(label)
  |     1. Snapshot all current memories
  |     2. Optionally inscribe checkpoint manifest on-chain
  |     3. Save locally for fast restore
  |
  +-- restore(checkpointId)
  |     1. Load checkpoint data
  |     2. Clear current memories
  |     3. Restore from snapshot
  |
  +-- exportBrain() / importBrain()
        Full brain transfer between agents
```

### Memory Lifecycle

```
save("learned-rust", {...})
  |
  v
Memory { key: "learned-rust", tokenId: 42n, inscriptionIndex: 7 }
  |
  +-- Local: memory-index.json
  +-- Chain: InkdVault inscription #7 on Token #42
  +-- Arweave: permanent JSON blob
  |
  v
update("learned-rust", {...})  -- creates version 2
  |
  v
checkpoint("pre-upgrade")     -- snapshots all memories
  |
  v
restore("checkpoint-xxx")     -- rolls back if needed
```

---

## X System Architecture

### 12-Hour Cycle

```
+--------+     +---------+     +----------+     +-------+     +-------+     +--------+
|  SCAN  | --> | ANALYZE | --> | GENERATE | --> | SCORE | --> | LEARN | --> | RECORD |
+--------+     +---------+     +----------+     +-------+     +-------+     +--------+
    |               |               |               |             |             |
 TrendMonitor   Patterns     ContentEngine      Score 0-100   Lessons     LearningLoop
 Keywords       from past    Templates +         Filter by    Strategy    saveCycle()
 Competitors    cycles       Voice profile       minScore     updates
 Narratives                                      (default 70)
```

### Component Interaction

```
InkdBrain (orchestrator)
  |
  +-- TrendMonitor
  |     scanKeywords()
  |     getTopAccountPosts()
  |     detectEmergingNarrative()
  |     competitorAnalysis()
  |
  +-- ContentEngine
  |     generateBuildUpdate()
  |     generateThread()
  |     generateEcosystemResponse()
  |     scoreTweet()  -- 0-100 scoring
  |     improveUntilScore()
  |     enforceVoice()
  |
  +-- LearningLoop
        saveCycle()
        extractPatterns()
        updateVoice()
        fullStrategyReview()  -- every 30 cycles
```

---

## Deployment Architecture

### Contract Deployment

```
Deploy.s.sol
  |
  +-- Deploy InkdToken implementation
  +-- Deploy InkdToken proxy (ERC1967)
  +-- Initialize InkdToken(name, symbol, mintPrice, royalty)
  |
  +-- Deploy InkdVault implementation
  +-- Deploy InkdVault proxy (ERC1967)
  +-- Initialize InkdVault(inkdTokenAddress, protocolFee)
  |
  +-- Deploy InkdRegistry implementation
  +-- Deploy InkdRegistry proxy (ERC1967)
  +-- Initialize InkdRegistry(inkdTokenAddress, inkdVaultAddress, marketplaceFee)
  |
  +-- Link: InkdToken.setVault(vaultProxyAddress)
  |
  +-- Verify all initialization values
```

### Network Configuration

| Network | Chain ID | RPC |
|---------|----------|-----|
| Base Mainnet | 8453 | https://mainnet.base.org |
| Base Sepolia | 84532 | https://sepolia.base.org |

---

## Security Model

### Access Control Matrix

| Action | Who Can Do It | Contract |
|--------|--------------|----------|
| Mint token | Anyone (pays mint price) | InkdToken |
| Set mint price | Owner only | InkdToken |
| Set vault | Owner only | InkdToken |
| Inscribe | InkdToken holder + token owner | InkdVault |
| Remove inscription | Token owner only | InkdVault |
| Update inscription | Token owner only | InkdVault |
| Grant access | Token owner only | InkdVault |
| Revoke access | Token owner only | InkdVault |
| Set protocol fee | Owner only (max 5%) | InkdVault |
| Register token | Token owner only | InkdRegistry |
| List for sale | Token owner only | InkdRegistry |
| Buy token | Anyone (pays listing price) | InkdRegistry |
| Set marketplace fee | Owner only (max 10%) | InkdRegistry |
| Upgrade contracts | Owner only | All (UUPS) |

### Reentrancy Protection

All external calls that transfer ETH are protected by ReentrancyGuard:
- `InkdToken.mint()` / `withdrawRevenue()`
- `InkdVault.inscribe()` / `withdrawFees()`
- `InkdRegistry.buyToken()` / `withdrawFees()`
