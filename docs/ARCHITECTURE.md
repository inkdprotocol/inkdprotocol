# Architecture

How Inkd Protocol is designed, why each component exists, and how they interact.

---

## The Big Picture

Inkd Protocol is an **ownership layer** — a permanent, trustless registry where projects and their version history live forever on-chain and on Arweave.

Three contracts on Base. One truth layer on Arweave.

```
┌─────────────────────────────────────────────────────────┐
│                     INKD PROTOCOL                        │
│                                                           │
│  ┌──────────────┐    locks      ┌───────────────────┐    │
│  │  InkdToken   │◄──────────────│   InkdRegistry    │    │
│  │  (ERC-20)    │  1 $INKD      │  (UUPS Proxy)     │    │
│  │  1B supply   │               │                   │    │
│  └──────────────┘               │  createProject()  │    │
│                                 │  pushVersion()    │────┼──► Arweave
│                                 │  addCollaborator()│    │    (permanent
│                                 │  transferProject()│    │     storage)
│                                 └─────────┬─────────┘    │
│                                           │              │
│                                     0.001 ETH            │
│                                     per version          │
│                                           │              │
│                                 ┌─────────▼─────────┐    │
│                                 │  InkdTreasury     │    │
│                                 │  (UUPS Proxy)     │    │
│                                 │                   │    │
│                                 │  deposit()        │    │
│                                 │  withdraw()       │    │
│                                 └───────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Contract Roles

### InkdToken (ERC-20)

The protocol's economic backbone. Not upgradeable — deployed once, immutable forever.

- **1 billion supply**, minted to the deployer at construction
- **Burnable** — supply decreases as tokens are burned
- **Permit-enabled (EIP-2612)** — users can sign off-chain approvals
- **Not upgradeable** — cannot be modified after deployment

Its primary role in the protocol is as a **commitment mechanism**: locking 1 $INKD into the registry proves that a project registration is intentional and creates deflationary pressure on supply.

### InkdRegistry (UUPS Proxy)

The core state machine. Stores all project and version data on-chain.

- **Upgradeable** via UUPS pattern — protocol can be improved without migrating data
- **Authoritative** — no project name duplication is ever possible on-chain
- **Access-controlled** — only owners and collaborators can mutate project state
- **Fee router** — collects ETH on writes and forwards it to InkdTreasury

### InkdTreasury (UUPS Proxy)

Simple ETH vault. Upgradeable for future fee distribution models.

- **Restricted deposit** — only `InkdRegistry` can call `deposit()`; prevents fee bypassing
- **Owner withdrawal** — ETH sent to a multisig or DAO for protocol operations
- **Direct receive** — accepts ETH sent directly (for grants, donations)

---

## Transaction Flows

### Flow 1: Create a Project

```
User Wallet
    │
    ├──[1] inkdToken.approve(registry, 1 ether)
    │         InkdToken updates allowance mapping
    │
    └──[2] registry.createProject("my-tool", ...)
              InkdRegistry:
                ├── Validate name (not empty, not taken)
                ├── inkdToken.safeTransferFrom(user → registry, 1 ether)
                │     $INKD is now LOCKED in InkdRegistry forever
                ├── Assign projectId = ++projectCount
                ├── Store Project struct in projects[id]
                ├── nameTaken[normalizedName] = true
                ├── _ownerProjects[user].push(id)
                ├── emit ProjectCreated(id, user, name, license)
                └── if isAgent: emit AgentRegistered(id, endpoint)
```

**Key property:** The 1 $INKD is locked in `InkdRegistry` permanently. It cannot be withdrawn by the project owner, protocol owner, or anyone else. It is permanently removed from circulation.

---

### Flow 2: Push a Version

```
User Wallet
    │
    ├──[1] Upload content to Arweave (off-chain, via Irys)
    │         Irys node → Arweave network
    │         Returns: arweaveHash (43-char base64 txid)
    │
    └──[2] registry.pushVersion(projectId, arweaveHash, "1.0.0", "...", {value: 0.001 ETH})
              InkdRegistry:
                ├── Validate project exists
                ├── Validate caller is owner or collaborator
                ├── Validate msg.value >= versionFee (0.001 ETH)
                ├── _versions[projectId].push(Version{...})
                ├── project.versionCount++
                ├── treasury.deposit{value: msg.value}()
                │     InkdTreasury records received ETH
                └── emit VersionPushed(projectId, arweaveHash, "1.0.0", pushedBy)
```

**Key property:** The on-chain record points to Arweave. The actual content is on Arweave. The `arweaveHash` is permanent — Arweave data cannot be deleted or modified.

---

### Flow 3: Transfer Ownership

```
Current Owner
    │
    └──[1] registry.transferProject(projectId, newOwner, {value: 0.005 ETH})
              InkdRegistry:
                ├── Validate project exists + caller is owner
                ├── Validate newOwner != address(0)
                ├── Validate msg.value >= transferFee (0.005 ETH)
                ├── projects[id].owner = newOwner
                ├── _ownerProjects[newOwner].push(projectId)
                ├── _ownerProjects[oldOwner]: remove projectId
                ├── if newOwner was collaborator: remove from collabs
                ├── treasury.deposit{value: msg.value}()
                └── emit ProjectTransferred(id, oldOwner, newOwner)
```

**Key property:** The locked $INKD does NOT transfer. It stays locked in InkdRegistry. The project can be sold for any price off-chain (or via a future marketplace contract) while the $INKD lock remains.

---

### Flow 4: Collaborator Push

```
Collaborator Wallet
    │
    ├──[0] (Owner previously called addCollaborator(projectId, collabAddr))
    │         isCollaborator[projectId][collabAddr] = true
    │
    └──[1] registry.pushVersion(projectId, hash, "patch-1", "...", {value: 0.001 ETH})
              InkdRegistry:
                ├── Validate caller is owner OR isCollaborator[projectId][msg.sender]
                └── ... (same as Flow 2)
```

---

## Why Base?

**Base** is Coinbase's L2 built on the OP Stack.

| Property | Why It Matters for Inkd |
|----------|------------------------|
| Low gas fees | Creating projects and pushing versions must be cheap enough for developers and agents to use regularly |
| EVM-compatible | Standard Solidity + OpenZeppelin contracts, tooling works out of the box |
| Institutional backing | Coinbase's infrastructure → reliability, bridge liquidity, wallet adoption |
| Growing ecosystem | Large developer community, wallet integrations, DeFi primitives |
| Fast finality | ~2 second block times → good UX for on-chain operations |

Base Mainnet: `chainId: 8453`  
Base Sepolia (testnet): `chainId: 84532`

---

## Why Arweave?

Arweave provides **permanent, immutable, decentralized storage**.

| Property | Details |
|----------|---------|
| **Permanence** | Data is guaranteed to be stored for 200+ years via endowment model |
| **Immutability** | Content-addressed by transaction ID — data cannot be modified or deleted |
| **Decentralized** | No single server; replicated across hundreds of nodes globally |
| **Accessible** | Any data readable via `https://arweave.net/{txid}` — no wallet needed |
| **Cost model** | One-time upfront payment; no recurring storage fees |

### Arweave vs Alternatives

| Storage | Permanent? | Decentralized? | Cost Model |
|---------|-----------|----------------|------------|
| **Arweave** | ✅ Yes | ✅ Yes | One-time payment |
| IPFS | ❌ No (pinning required) | ✅ Yes | Recurring |
| AWS S3 | ❌ No | ❌ No | Recurring |
| Filecoin | Partial | ✅ Yes | Recurring deals |
| On-chain (Ethereum) | ✅ Yes | ✅ Yes | Extremely expensive |

For a version registry, **permanence is non-negotiable**. A version that disappears isn't really versioned. Arweave is the only storage layer that guarantees the content at a registered hash will always be accessible.

### Irys (Upload Layer)

Inkd uses [Irys](https://irys.xyz) (formerly Bundlr) as the Arweave upload layer:

```
Developer → Irys Node → Arweave Network → Permanent Storage
```

Irys provides:
- **Instant finality** for reads (Irys gateway) while the Arweave transaction confirms
- **Ethereum payment** — pay for Arweave storage in ETH, not AR token
- **Batch uploads** — efficient multi-file uploads
- **Metadata tags** — searchable key/value tags on every upload

---

## UUPS Upgradeability

Both `InkdRegistry` and `InkdTreasury` use **UUPS (Universal Upgradeable Proxy Standard)**.

```
User ──► Proxy (permanent address)
              │
              └──► Implementation (upgradeable)
                        │
                        ├── Logic
                        └── Storage (stays in proxy)
```

**Why UUPS over Transparent Proxy?**
- Upgrade logic lives in the implementation, not the proxy → smaller proxy bytecode
- More gas efficient per call
- Implementation can revert upgrades if needed

**Who can upgrade?** Only the `owner` (set in `initialize()`). For production, this should be a multisig or timelock.

**What stays permanent?**
- The proxy contract addresses (users always interact with the same address)
- All stored data (projects, versions, mappings)
- The $INKD locked in the registry

**What can change?**
- Business logic (fee calculation, new features)
- New functions
- Bug fixes

---

## Security Model

### Trust Assumptions

| Component | Trust Level | Notes |
|-----------|-------------|-------|
| InkdToken | Trustless | Immutable, no admin keys |
| InkdRegistry proxy | Protocol owner | Upgradeable by owner multisig |
| InkdTreasury proxy | Protocol owner | Upgradeable by owner multisig |
| Arweave content | Trustless | Content-addressed, immutable |
| Project owners | Self-sovereign | Owners control their own projects |

### Key Security Properties

1. **Name collision is impossible** — `nameTaken` mapping is checked before every creation; two projects can never have the same name

2. **Locked $INKD is irrecoverable** — there is no function to withdraw locked tokens, even for the protocol owner. This is by design: the lock is permanent.

3. **Fee bypass is impossible** — `InkdTreasury.deposit()` only accepts calls from `InkdRegistry`. ETH cannot reach the treasury except through a version push or ownership transfer.

4. **Collaborators can only push** — collaborators cannot add other collaborators, transfer ownership, or change visibility. Only owners can.

5. **Caps on fees** — `MAX_VERSION_FEE` and `MAX_TRANSFER_FEE` are constants in the implementation. Even if the protocol owner upgrades the logic, they cannot raise fees beyond these caps without a new implementation deployment.

---

## Name Normalization

Project names are normalized to lowercase at registration:

```solidity
function _normalizeName(string memory name) internal pure returns (string memory) {
    bytes memory b = bytes(name);
    for (uint256 i; i < b.length; i++) {
        if (b[i] >= 0x41 && b[i] <= 0x5A) {  // A-Z
            b[i] = bytes1(uint8(b[i]) + 32);   // → a-z
        }
    }
    return string(b);
}
```

This means `"MyProject"`, `"myproject"`, and `"MYPROJECT"` all resolve to `"myproject"` and are treated as the same name. **Once registered, the normalized name is stored permanently.**

---

## Storage Layout

```
InkdRegistry storage:
  slot 0: inkdToken (address)
  slot 1: treasury (address)
  slot 2: projectCount (uint256)
  slot 3: versionFee (uint256)
  slot 4: transferFee (uint256)
  slot 5: projects mapping
  slot 6: _versions mapping
  slot 7: _collaborators mapping
  slot 8: nameTaken mapping
  slot 9: _ownerProjects mapping
  slot 10: isCollaborator mapping

InkdTreasury storage:
  slot 0: registry (address)
```

> Storage layout is preserved across upgrades via the UUPS proxy pattern. Adding new state variables must always append to the end of storage.

---

## V2 Roadmap

The following features are planned for future protocol versions:

| Feature | Description |
|---------|-------------|
| **Lit Protocol encryption** | Token-gated encrypted inscriptions — only the InkdToken NFT owner can decrypt their data |
| **On-chain marketplace** | Buy/sell project ownership directly through a registry extension |
| **Agent discovery indexer** | Off-chain subgraph + API for querying agent projects by capability |
| **Version attestations** | Third-party auditors can sign and attest to specific version hashes |
| **DAO governance** | Protocol fee parameters moved to token-holder governance |
