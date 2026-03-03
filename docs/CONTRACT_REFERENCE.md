# Inkd Protocol — Contract Reference

Complete reference for all Inkd Protocol smart contracts.

- **InkdToken** — ERC-20 $INKD token
- **InkdRegistry** — Project registry
- **InkdTreasury** — Fee treasury
- **InkdTimelock** — 48-hour admin timelock

> **Proxy note:** InkdRegistry and InkdTreasury are deployed as UUPS upgradeable proxies.
> InkdToken and InkdTimelock are non-upgradeable.

---

## Table of Contents

- [InkdToken](#inkdtoken)
- [InkdRegistry](#inkdregistry)
- [InkdTreasury](#inkdtreasury)
- [InkdTimelock](#inkdtimelock)
- [Events](#events)
- [Errors](#errors)
- [Constants](#constants)
- [Deployment Addresses](#deployment-addresses)

---

## InkdToken

**File:** `contracts/src/InkdToken.sol`
**Standard:** ERC-20, ERC-20Burnable, ERC-20Permit (EIP-2612)

The $INKD governance and fee token. 1 billion fixed supply minted to the deployer at construction. Burnable and permit-enabled for gasless approvals.

### State Variables

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `TOTAL_SUPPLY` | `uint256` | `1_000_000_000 ether` | Fixed supply (1B $INKD, 18 decimals) |
| `name()` | `string` | `"Inkd"` | Token name |
| `symbol()` | `string` | `"INKD"` | Token symbol |
| `decimals()` | `uint8` | `18` | Decimals (ERC-20 default) |

### Constructor

```solidity
constructor()
```

Mints `TOTAL_SUPPLY` to `msg.sender`. No initialization required (not upgradeable).

### Inherited Functions

#### `transfer(address to, uint256 amount) → bool`
Standard ERC-20 transfer.

#### `transferFrom(address from, address to, uint256 amount) → bool`
Standard ERC-20 transferFrom.

#### `approve(address spender, uint256 amount) → bool`
Standard ERC-20 approve.

#### `burn(uint256 amount)`
Burn tokens from caller's balance (ERC-20Burnable).

#### `burnFrom(address account, uint256 amount)`
Burn tokens from another account with allowance (ERC-20Burnable).

#### `permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)`
EIP-2612 gasless approval. Allows users to sign an approval off-chain and have a third party submit it.

```typescript
// Example: gasless approve using permit
const signature = await signTypedData({
  domain: { name: "Inkd", version: "1", chainId: 84532, verifyingContract: inkdTokenAddress },
  types: {
    Permit: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
      { name: "value",   type: "uint256" },
      { name: "nonce",   type: "uint256" },
      { name: "deadline",type: "uint256" },
    ],
  },
  message: { owner, spender: registryAddress, value: parseEther("1"), nonce, deadline },
});
```

---

## InkdRegistry

**File:** `contracts/src/InkdRegistry.sol`
**Upgradeable:** UUPS proxy via OpenZeppelin

The core protocol contract. Creates projects (locks 1 $INKD), pushes versions (Arweave hashes), manages collaborators, and handles project transfers.

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `inkdToken` | `IERC20` | $INKD token contract |
| `treasury` | `InkdTreasury` | Fee recipient |
| `projectCount` | `uint256` | Total projects created (auto-incrementing ID) |
| `versionFee` | `uint256` | ETH fee per version push (default: 0.001 ETH) |
| `transferFee` | `uint256` | ETH fee per project transfer (default: 0.005 ETH) |
| `nameTaken` | `mapping(string → bool)` | Tracks normalized (lowercase) project names |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `TOKEN_LOCK_AMOUNT` | `1 ether` (1 $INKD) | $INKD locked per project |
| `MAX_VERSION_FEE` | `0.01 ether` | Max allowed version fee |
| `MAX_TRANSFER_FEE` | `0.05 ether` | Max allowed transfer fee |

### Structs

#### `Project`

```solidity
struct Project {
    uint256 id;
    string  name;           // Normalized (lowercase)
    string  description;
    string  license;        // e.g. "MIT", "Apache-2.0"
    string  readmeHash;     // Arweave hash of README
    address owner;
    bool    isPublic;
    bool    isAgent;        // true if this is an AI agent project
    string  agentEndpoint;  // Public URL for agent API (if isAgent)
    uint256 createdAt;      // Unix timestamp
    uint256 versionCount;
    bool    exists;
}
```

#### `Version`

```solidity
struct Version {
    uint256 projectId;
    string  arweaveHash;   // Permanent Arweave content address
    string  versionTag;    // e.g. "v1.0.0"
    string  changelog;     // Release notes
    address pushedBy;      // Owner or collaborator
    uint256 pushedAt;      // Unix timestamp
}
```

---

### Initialization

```solidity
function initialize(address owner_, address token_, address treasury_) external initializer
```

Called once via proxy deployment. Sets owner, $INKD token address, and treasury address. Sets default fees: `versionFee = 0.001 ETH`, `transferFee = 0.005 ETH`.

---

### Admin Functions

#### `setVersionFee(uint256 newFee)`

Update the ETH fee required per version push.

| Parameter | Type | Constraint |
|-----------|------|-----------|
| `newFee` | `uint256` | ≤ `MAX_VERSION_FEE` (0.01 ETH) |

```solidity
// Only callable by contract owner
registry.setVersionFee(0.0005 ether);
```

**Reverts:** `FeeExceedsMax` if `newFee > MAX_VERSION_FEE`

#### `setTransferFee(uint256 newFee)`

Update the ETH fee required per project transfer.

| Parameter | Type | Constraint |
|-----------|------|-----------|
| `newFee` | `uint256` | ≤ `MAX_TRANSFER_FEE` (0.05 ETH) |

**Reverts:** `FeeExceedsMax` if `newFee > MAX_TRANSFER_FEE`

---

### Core Write Functions

#### `createProject(...) → (no return value, emits ProjectCreated)`

Create a new project. Locks 1 $INKD from `msg.sender`. Project name is normalized to lowercase and must be globally unique.

```solidity
function createProject(
    string calldata name,
    string calldata description,
    string calldata license,
    bool            isPublic,
    string calldata readmeHash,
    bool            isAgent,
    string calldata agentEndpoint
) external
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Project name (must be unique; normalized to lowercase) |
| `description` | `string` | Short description |
| `license` | `string` | SPDX license identifier (e.g. `"MIT"`) |
| `isPublic` | `bool` | Whether the project is publicly listed |
| `readmeHash` | `string` | Arweave hash of README file (can be empty) |
| `isAgent` | `bool` | Whether this project represents an AI agent |
| `agentEndpoint` | `string` | Public URL for agent API (only if `isAgent`) |

**Prerequisites:**
1. Caller must have ≥ 1 $INKD balance
2. Caller must have approved registry for ≥ 1 $INKD (`inkdToken.approve(registryAddress, parseEther("1"))`)

**Reverts:**
- `EmptyName` — name is empty string
- `NameTaken` — normalized name already registered

**Events:** `ProjectCreated(projectId, owner, name, license)`, optionally `AgentRegistered(projectId, endpoint)`

```typescript
// TypeScript example
await walletClient.writeContract({
  address: registryAddress,
  abi: INKD_REGISTRY_ABI,
  functionName: "createProject",
  args: ["my-agent", "My AI Agent", "MIT", true, "", true, "https://agent.example.com"],
});
```

---

#### `pushVersion(uint256 projectId, string arweaveHash, string versionTag, string changelog) payable`

Push a new version to an existing project. Requires `msg.value >= versionFee`. ETH is forwarded to the treasury.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | `uint256` | ID of the project |
| `arweaveHash` | `string` | Arweave transaction ID of the uploaded file |
| `versionTag` | `string` | Semantic version string (e.g. `"v1.2.0"`) |
| `changelog` | `string` | Human-readable release notes |

**Who can call:** Project owner OR any approved collaborator.

**Reverts:**
- `ProjectNotFound` — invalid `projectId`
- `NotOwnerOrCollaborator` — caller is neither owner nor collaborator
- `InsufficientFee` — `msg.value < versionFee`

**Events:** `VersionPushed(projectId, arweaveHash, versionTag, pushedBy)`

```typescript
await walletClient.writeContract({
  address: registryAddress,
  abi: INKD_REGISTRY_ABI,
  functionName: "pushVersion",
  args: [1n, "abc123arweave", "v0.1.0", "Initial release"],
  value: parseEther("0.001"),
});
```

---

#### `addCollaborator(uint256 projectId, address collaborator)`

Add a collaborator to a project. Only the project owner can call this.

**Reverts:**
- `NotOwner` — caller is not project owner
- `ZeroAddress` — `collaborator` is zero address
- `CannotAddOwner` — cannot add owner as collaborator
- `AlreadyCollaborator` — already a collaborator

**Events:** `CollaboratorAdded(projectId, collaborator)`

---

#### `removeCollaborator(uint256 projectId, address collaborator)`

Remove a collaborator from a project. Only the project owner can call.

**Reverts:**
- `NotOwner` — caller is not project owner
- `NotCollaborator` — address is not a collaborator

**Events:** `CollaboratorRemoved(projectId, collaborator)`

---

#### `transferProject(uint256 projectId, address newOwner) payable`

Transfer project ownership to a new address. Requires `msg.value >= transferFee`. The locked $INKD stays in the registry.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | `uint256` | ID of the project |
| `newOwner` | `address` | Recipient address |

**Notes:**
- If `newOwner` was a collaborator, they are automatically removed from the collaborator list.
- ETH fee is forwarded to treasury.

**Reverts:**
- `NotOwner` — caller is not project owner
- `ZeroAddress` — `newOwner` is zero address
- `InsufficientFee` — `msg.value < transferFee`

**Events:** `ProjectTransferred(projectId, oldOwner, newOwner)`

---

#### `setVisibility(uint256 projectId, bool isPublic)`

Toggle a project between public and private. Owner only.

**Events:** `VisibilityChanged(projectId, isPublic)`

---

#### `setReadme(uint256 projectId, string arweaveHash)`

Update the project README with a new Arweave hash. Owner only.

**Events:** `ReadmeUpdated(projectId, arweaveHash)`

---

#### `setAgentEndpoint(uint256 projectId, string endpoint)`

Update the agent's public API endpoint. Owner only.

**Events:** `AgentRegistered(projectId, endpoint)`

---

### View Functions

#### `getProject(uint256 projectId) → Project`

Returns the full `Project` struct for a given ID.

```typescript
const project = await publicClient.readContract({
  address: registryAddress,
  abi: INKD_REGISTRY_ABI,
  functionName: "getProject",
  args: [1n],
});
```

#### `getVersion(uint256 projectId, uint256 versionIndex) → Version`

Returns a specific version by project ID and index (0-based).

#### `getVersionCount(uint256 projectId) → uint256`

Returns total number of versions pushed to a project.

#### `getCollaborators(uint256 projectId) → address[]`

Returns all current collaborators of a project.

#### `getOwnerProjects(address owner) → uint256[]`

Returns all project IDs owned by a given address.

#### `getAgentProjects(uint256 offset, uint256 limit) → Project[]`

Returns paginated list of projects with `isAgent = true`.

> ⚠️ **Note (Security Review finding):** This is an O(n) view function. For large protocol state, call off-peak or use pagination with small `limit` values.

#### `isCollaborator(uint256 projectId, address user) → bool`

Returns true if `user` is a collaborator on `projectId`.

#### `nameTaken(string name) → bool`

Returns true if a normalized name is already registered.

---

## InkdTreasury

**File:** `contracts/src/InkdTreasury.sol`
**Upgradeable:** UUPS proxy via OpenZeppelin

Receives ETH fees from InkdRegistry. Owner can withdraw at any time.

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `registry` | `address` | Only address allowed to call `deposit()` |

### Initialization

```solidity
function initialize(address owner_) external initializer
```

Sets the owner. Registry must be set separately via `setRegistry()`.

### Functions

#### `setRegistry(address registry_)`

Set the registry address. Only the registry can call `deposit()`.
Must be called after registry deployment. Owner only.

```solidity
treasury.setRegistry(address(registryProxy));
```

#### `deposit() payable`

Called by InkdRegistry when a version is pushed or project is transferred. Only callable by the `registry` address.

**Reverts:** `OnlyRegistry` if called by any other address.

#### `withdraw(address to, uint256 amount)`

Withdraw ETH to a given address. Owner only.

```solidity
treasury.withdraw(multisigWallet, address(treasury).balance);
```

**Reverts:** `TransferFailed` if ETH transfer fails.

#### `receive() payable`

Fallback to accept direct ETH transfers (e.g. donations, manual transfers).

---

## InkdTimelock

**File:** `contracts/src/InkdTimelock.sol`
**Upgradeable:** No — plain contract

A 48-hour timelock that enforces a mandatory delay on sensitive admin actions (fee changes, ownership transfers, upgrades). Inspired by Compound's Timelock, simplified for Inkd's governance needs.

In production, ownership of `InkdRegistry` and `InkdTreasury` should be transferred to this contract (or a Safe multisig) so that all protocol-level changes go through the queue → wait → execute flow.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DELAY` | `48 hours` | Minimum wait between queue and execution |
| `GRACE_PERIOD` | `14 days` | Window after `eta` during which a queued tx may execute; stale after this |

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `admin` | `address` | Current admin; only address that can queue/cancel/execute |
| `pendingAdmin` | `address` | Proposed next admin (must call `acceptAdmin()` to confirm) |
| `queuedTransactions` | `mapping(bytes32 => bool)` | Tracks which tx hashes are queued |

### Constructor

```solidity
constructor(address admin_)
```

Sets the initial `admin`. No initialization proxy — deploy directly.

### Admin Handover

Admin handover is a two-step process to prevent fat-finger mistakes:

1. Current admin calls `setPendingAdmin(newAdmin)` — emits `NewPendingAdmin`
2. `newAdmin` calls `acceptAdmin()` — emits `NewAdmin` and clears `pendingAdmin`

#### `setPendingAdmin(address pendingAdmin_)`

Proposes a new admin. Does not take effect until `acceptAdmin()` is called.
**Only callable by:** `admin`

```solidity
timelock.setPendingAdmin(multisigAddress);
```

#### `acceptAdmin()`

Completes the admin handover. Sets `admin = pendingAdmin`, clears `pendingAdmin`.
**Only callable by:** `pendingAdmin`

```solidity
// Call from multisigAddress
timelock.acceptAdmin();
```

### Transaction Lifecycle

A "transaction" is any arbitrary call: `(target, value, data, eta)`. The full lifecycle is:

```
queueTransaction → [wait ≥ DELAY] → executeTransaction
                ↘ cancelTransaction (any time before execution)
```

The `txHash` is `keccak256(abi.encode(target, value, data, eta))`.

#### `queueTransaction(address target, uint256 value, bytes data, uint256 eta) → bytes32`

Queues a transaction for future execution.

- `eta` must be at least `block.timestamp + DELAY` (48 hours from now)
- Returns the `txHash`; store this to later execute or cancel

**Only callable by:** `admin`

**Reverts:** `"InkdTimelock: eta too early"` if `eta < block.timestamp + DELAY`

```solidity
uint256 eta = block.timestamp + 48 hours + 1 minutes; // safe buffer
bytes memory callData = abi.encodeWithSignature("setVersionFee(uint256)", 0.002 ether);
bytes32 txHash = timelock.queueTransaction(address(registry), 0, callData, eta);
```

#### `cancelTransaction(address target, uint256 value, bytes data, uint256 eta)`

Cancels a queued transaction (sets its hash to `false`). Safe to call even after execution (idempotent).

**Only callable by:** `admin`

```solidity
timelock.cancelTransaction(address(registry), 0, callData, eta);
```

#### `executeTransaction(address target, uint256 value, bytes data, uint256 eta) → bytes`

Executes a previously queued transaction.

- `block.timestamp >= eta` (delay has passed)
- `block.timestamp <= eta + GRACE_PERIOD` (not stale; 14-day window)
- The tx hash must still be `true` in `queuedTransactions`

**Only callable by:** `admin` (payable — forward ETH via `msg.value`)

**Reverts:**
- `"InkdTimelock: tx not queued"` — hash not in queue
- `"InkdTimelock: too early"` — delay not elapsed
- `"InkdTimelock: tx stale"` — past grace period (14 days after `eta`)
- `"InkdTimelock: execution failed"` — target call reverted

```solidity
timelock.executeTransaction{value: 0}(address(registry), 0, callData, eta);
```

#### `receive() payable`

Accepts ETH so the timelock can fund calls that forward value.

### Example: Changing a Registry Fee

```solidity
// 1. Encode the call
bytes memory callData = abi.encodeWithSignature(
    "setVersionFee(uint256)",
    0.002 ether
);

// 2. Queue (must wait 48h)
uint256 eta = block.timestamp + 2 days + 5 minutes;
bytes32 txHash = timelock.queueTransaction(
    address(registry), // target
    0,                 // value
    callData,          // data
    eta                // earliest execution time
);

// 3. Wait 48 hours, then execute
timelock.executeTransaction(address(registry), 0, callData, eta);
```

### Security Properties

| Property | Detail |
|----------|--------|
| **No self-upgrade** | Non-upgradeable; admin cannot silently change contract logic |
| **Replay protection** | Executed txs set hash → false; cannot replay |
| **Grace period** | Stale txs (>14 days past eta) automatically fail — prevents indefinitely-delayed bombs |
| **Two-step admin** | `setPendingAdmin` + `acceptAdmin` prevents accidental admin loss |
| **ETH forwarding** | `receive()` allows the timelock to hold and forward ETH for fee-paying calls |

---

## Events

### InkdRegistry Events

| Event | Parameters | When |
|-------|------------|------|
| `ProjectCreated` | `projectId, owner, name, license` | New project created |
| `VersionPushed` | `projectId, arweaveHash, versionTag, pushedBy` | New version pushed |
| `CollaboratorAdded` | `projectId, collaborator` | Collaborator added |
| `CollaboratorRemoved` | `projectId, collaborator` | Collaborator removed |
| `ProjectTransferred` | `projectId, oldOwner, newOwner` | Ownership transferred |
| `VisibilityChanged` | `projectId, isPublic` | Visibility toggled |
| `VersionFeeUpdated` | `oldFee, newFee` | Version fee changed |
| `TransferFeeUpdated` | `oldFee, newFee` | Transfer fee changed |
| `ReadmeUpdated` | `projectId, arweaveHash` | README updated |
| `AgentRegistered` | `projectId, endpoint` | Agent endpoint set |

### InkdTreasury Events

| Event | Parameters | When |
|-------|------------|------|
| `Deposited` | `from, amount` | Fee received from registry |
| `Withdrawn` | `to, amount` | Funds withdrawn by owner |
| `RegistrySet` | `registry` | Registry address updated |
| `Received` | `sender, amount` | Direct ETH received |

### InkdTimelock Events

| Event | Parameters | When |
|-------|------------|------|
| `NewPendingAdmin` | `newPendingAdmin` | `setPendingAdmin()` called |
| `NewAdmin` | `newAdmin` | `acceptAdmin()` called — handover complete |
| `QueueTransaction` | `txHash, target, value, data, eta` | Transaction queued |
| `CancelTransaction` | `txHash, target, value, data, eta` | Transaction cancelled |
| `ExecuteTransaction` | `txHash, target, value, data, eta` | Transaction executed |

---

## Errors

### InkdRegistry Errors

| Error | Description |
|-------|-------------|
| `NameTaken` | Project name already registered |
| `EmptyName` | Project name is empty string |
| `ProjectNotFound` | Invalid project ID |
| `NotOwner` | Caller is not project owner |
| `NotOwnerOrCollaborator` | Caller has no write access |
| `InsufficientFee` | `msg.value` below required fee |
| `AlreadyCollaborator` | Address is already a collaborator |
| `NotCollaborator` | Address is not a collaborator |
| `CannotAddOwner` | Cannot add project owner as collaborator |
| `ZeroAddress` | Address parameter is zero |
| `FeeExceedsMax` | Proposed fee exceeds protocol max |

### InkdTreasury Errors

| Error | Description |
|-------|-------------|
| `OnlyRegistry` | `deposit()` called by non-registry address |
| `TransferFailed` | ETH withdrawal failed |

### InkdTimelock Errors

InkdTimelock uses `require` with string messages (no custom error types):

| Revert Message | Function | Description |
|----------------|----------|-------------|
| `"InkdTimelock: caller is not admin"` | all write functions | `msg.sender != admin` |
| `"InkdTimelock: not pending admin"` | `acceptAdmin` | `msg.sender != pendingAdmin` |
| `"InkdTimelock: eta too early"` | `queueTransaction` | `eta < block.timestamp + DELAY` |
| `"InkdTimelock: tx not queued"` | `executeTransaction` | hash not in `queuedTransactions` |
| `"InkdTimelock: too early"` | `executeTransaction` | `block.timestamp < eta` |
| `"InkdTimelock: tx stale"` | `executeTransaction` | `block.timestamp > eta + GRACE_PERIOD` |
| `"InkdTimelock: execution failed"` | `executeTransaction` | target call reverted |

---

## Constants

| Constant | Contract | Value |
|----------|----------|-------|
| `TOKEN_LOCK_AMOUNT` | InkdRegistry | 1 $INKD (1e18) |
| `MAX_VERSION_FEE` | InkdRegistry | 0.01 ETH |
| `MAX_TRANSFER_FEE` | InkdRegistry | 0.05 ETH |
| `TOTAL_SUPPLY` | InkdToken | 1,000,000,000 $INKD |
| Default `versionFee` | InkdRegistry | 0.001 ETH |
| Default `transferFee` | InkdRegistry | 0.005 ETH |
| `DELAY` | InkdTimelock | 48 hours |
| `GRACE_PERIOD` | InkdTimelock | 14 days |

---

## Deployment Addresses

> Contracts deploy to Base Sepolia testnet first. Mainnet addresses will be published here after audit.

| Contract | Base Sepolia | Base Mainnet |
|----------|-------------|--------------|
| InkdToken | TBD | TBD |
| InkdRegistry Proxy | TBD | TBD |
| InkdTreasury Proxy | TBD | TBD |
| InkdTimelock | TBD | TBD |

See [POST_DEPLOY.md](../POST_DEPLOY.md) for the post-deployment verification checklist and Basescan verification steps.

---

## Security

All contracts have been manually reviewed. See [SECURITY_REVIEW.md](../SECURITY_REVIEW.md) for the full audit report.

**Summary:**
- 0 Critical
- 0 High
- 1 Medium (O(n) `getAgentProjects` — view only, no funds at risk)
- 3 Low (by design)
- CEI pattern enforced throughout
- ReentrancyGuard on all ETH-transfer functions
- UUPS with `onlyOwner` upgrade gate
- InkdTimelock: 48-hour mandatory delay on all admin actions (non-upgradeable, two-step admin handover)

---

*Last updated: March 3, 2026*
