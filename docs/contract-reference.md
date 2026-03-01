# Contract Reference

Complete reference for all Inkd Protocol smart contracts.

All contracts are deployed as **UUPS upgradeable proxies** on Base. The implementation logic is upgradeable by the protocol owner; proxy addresses are permanent.

---

## Table of Contents

- [InkdToken](#inkdtoken)
- [InkdRegistry](#inkdregistry)
- [InkdTreasury](#inkdtreasury)
- [Events](#events)
- [Custom Errors](#custom-errors)
- [Constants](#constants)
- [Deployment Addresses](#deployment-addresses)

---

## InkdToken

**File:** `contracts/src/InkdToken.sol`  
**Inherits:** `ERC20`, `ERC20Burnable`, `ERC20Permit` (OpenZeppelin)  
**NOT upgradeable** — immutable at deploy time.

The $INKD ERC-20 token. Fixed 1 billion supply minted to the deployer at construction. Burnable and permit-enabled (EIP-2612) for gasless approvals.

### State Variables

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `TOTAL_SUPPLY` | `uint256 constant` | `1_000_000_000 ether` | 1B tokens, 18 decimals |
| `name()` | `string` | `"Inkd"` | Token name |
| `symbol()` | `string` | `"INKD"` | Token ticker |
| `decimals()` | `uint8` | `18` | Standard ERC-20 decimals |

### Constructor

```solidity
constructor()
```

Mints the full `TOTAL_SUPPLY` to `msg.sender`. Sets EIP-2612 domain name to `"Inkd"`.

### Functions

#### `transfer(address to, uint256 amount) → bool`

Standard ERC-20 transfer. Emits `Transfer`.

#### `transferFrom(address from, address to, uint256 amount) → bool`

Standard ERC-20 transferFrom. Requires prior `approve`. Emits `Transfer`.

#### `approve(address spender, uint256 amount) → bool`

Approve a spender. Emits `Approval`.

#### `burn(uint256 amount)`

Destroy `amount` tokens from the caller's balance. Permanently reduces total supply. Emits `Transfer` to zero address.

#### `burnFrom(address account, uint256 amount)`

Burn tokens from `account`. Requires allowance. Emits `Transfer` to zero address.

#### `permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)`

EIP-2612 gasless approval. Lets users sign an approval off-chain; anyone can submit it on-chain. Used by the SDK to approve the registry without a separate approval transaction.

```solidity
// On-chain equivalent of approve() but signature-based
token.permit(owner, registry, 1 ether, deadline, v, r, s);
```

#### `balanceOf(address account) → uint256`

Returns $INKD balance of `account`.

#### `allowance(address owner, address spender) → uint256`

Returns remaining allowance `spender` has from `owner`.

#### `totalSupply() → uint256`

Returns current total supply (decreases as tokens are burned).

---

## InkdRegistry

**File:** `contracts/src/InkdRegistry.sol`  
**Inherits:** `Initializable`, `OwnableUpgradeable`, `UUPSUpgradeable` (OpenZeppelin)  
**Proxy pattern:** UUPS

The core protocol contract. Manages project creation, versioning, collaborators, and ownership transfers. All fee ETH flows to `InkdTreasury`.

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `inkdToken` | `IERC20` | The $INKD ERC-20 token contract |
| `treasury` | `InkdTreasury` | Treasury that receives ETH fees |
| `projectCount` | `uint256` | Total projects ever created (monotonically increasing ID) |
| `versionFee` | `uint256` | ETH fee to push a version (default: `0.001 ether`) |
| `transferFee` | `uint256` | ETH fee to transfer a project (default: `0.005 ether`) |
| `nameTaken[name]` | `mapping(string => bool)` | Whether a normalized name is already registered |
| `projects[id]` | `mapping(uint256 => Project)` | Project data by ID |
| `isCollaborator[id][addr]` | `mapping(uint256 => mapping(address => bool))` | Access control |

### Structs

#### `Project`

```solidity
struct Project {
    uint256 id;           // Unique project ID (1-indexed)
    string  name;         // Normalized (lowercase) project name
    string  description;  // Project description
    string  license;      // SPDX license identifier
    string  readmeHash;   // Arweave tx ID of README/docs
    address owner;        // Current owner address
    bool    isPublic;     // Whether the project is publicly visible
    bool    isAgent;      // Whether this is an AI agent tool
    string  agentEndpoint;// HTTP endpoint for agent discovery
    uint256 createdAt;    // Block timestamp of creation
    uint256 versionCount; // Total versions pushed
    bool    exists;       // Existence flag (false for invalid IDs)
}
```

#### `Version`

```solidity
struct Version {
    uint256 projectId;   // Parent project ID
    string  arweaveHash; // Arweave transaction ID of the upload
    string  versionTag;  // Semver tag or label (e.g., "1.0.0", "alpha")
    string  changelog;   // Human-readable changes for this version
    address pushedBy;    // Who pushed this version (owner or collaborator)
    uint256 pushedAt;    // Block timestamp
}
```

### Initializer

```solidity
function initialize(address owner_, address token_, address treasury_) external initializer
```

Called once by the proxy factory on deployment.

| Parameter | Description |
|-----------|-------------|
| `owner_` | Protocol admin address (multisig recommended) |
| `token_` | `InkdToken` contract address |
| `treasury_` | `InkdTreasury` contract address |

Sets default fees: `versionFee = 0.001 ether`, `transferFee = 0.005 ether`.

### Admin Functions

#### `setVersionFee(uint256 newFee)`

```solidity
function setVersionFee(uint256 newFee) external onlyOwner
```

Update the ETH fee for pushing a version.

| Constraint | Value |
|------------|-------|
| Caller | `owner` only |
| Max | `MAX_VERSION_FEE = 0.01 ether` |
| Reverts | `FeeExceedsMax` if `newFee > 0.01 ether` |

Emits: `VersionFeeUpdated(oldFee, newFee)`

#### `setTransferFee(uint256 newFee)`

```solidity
function setTransferFee(uint256 newFee) external onlyOwner
```

Update the ETH fee for transferring project ownership.

| Constraint | Value |
|------------|-------|
| Caller | `owner` only |
| Max | `MAX_TRANSFER_FEE = 0.05 ether` |
| Reverts | `FeeExceedsMax` if `newFee > 0.05 ether` |

Emits: `TransferFeeUpdated(oldFee, newFee)`

### Core Write Functions

#### `createProject(...)`

```solidity
function createProject(
    string calldata name,
    string calldata description,
    string calldata license,
    bool isPublic,
    string calldata readmeHash,
    bool isAgent,
    string calldata agentEndpoint
) external
```

Create a new project. Locks exactly **1 $INKD** from the caller into this contract permanently.

**Prerequisites:** Caller must have approved the registry for at least `1 ether` (1 $INKD).

| Parameter | Description |
|-----------|-------------|
| `name` | Project name. Normalized to lowercase. Must be unique. Max length uncapped (gas-limited). |
| `description` | Free-text description. |
| `license` | SPDX identifier: `MIT`, `GPL-3.0`, `Apache-2.0`, `Proprietary`, etc. |
| `isPublic` | `true` = publicly discoverable. `false` = private (owner/collaborators only). |
| `readmeHash` | Arweave transaction ID of the project's README. Can be empty string. |
| `isAgent` | `true` = appears in `getAgentProjects()` discovery. |
| `agentEndpoint` | HTTP URL for agent API endpoint. Only meaningful if `isAgent = true`. |

**Reverts:**
- `EmptyName()` — if `name` is an empty string
- `NameTaken()` — if the normalized name is already registered
- ERC-20 `SafeTransferFrom` reverts if insufficient balance or allowance

**Emits:**
- `ProjectCreated(projectId, owner, name, license)`
- `AgentRegistered(projectId, endpoint)` if `isAgent = true`

**Example:**
```solidity
// Approve first:
inkdToken.approve(address(registry), 1 ether);

// Create:
registry.createProject(
    "my-tool",
    "A useful developer tool",
    "MIT",
    true,    // isPublic
    "",      // readmeHash (set later with setReadme)
    false,   // not an agent tool
    ""
);
```

---

#### `pushVersion(...)`

```solidity
function pushVersion(
    uint256 projectId,
    string calldata arweaveHash,
    string calldata versionTag,
    string calldata changelog
) external payable
```

Push a new version to a project. Sends `msg.value` (must be >= `versionFee`) to the treasury.

| Parameter | Description |
|-----------|-------------|
| `projectId` | Target project ID |
| `arweaveHash` | Arweave transaction ID of the uploaded content |
| `versionTag` | Version label: `"1.0.0"`, `"alpha"`, `"beta-2"`, etc. |
| `changelog` | Human-readable description of what changed |

**Value required:** `msg.value >= versionFee` (currently `0.001 ETH`)

**Access:** Owner or any registered collaborator.

**Reverts:**
- `ProjectNotFound()` — invalid `projectId`
- `NotOwnerOrCollaborator()` — caller is neither owner nor collaborator
- `InsufficientFee()` — `msg.value < versionFee`

**Emits:** `VersionPushed(projectId, arweaveHash, versionTag, pushedBy)`

**Example:**
```solidity
registry.pushVersion{value: 0.001 ether}(
    1,
    "Qm...",       // Arweave hash
    "2.0.0",
    "Breaking: renamed createFoo to makeFoo"
);
```

---

#### `addCollaborator(uint256 projectId, address collaborator)`

```solidity
function addCollaborator(uint256 projectId, address collaborator) external
```

Grant an address permission to push versions. Owner only.

**Reverts:**
- `ProjectNotFound()` — invalid project
- `NotOwner()` — caller is not the project owner
- `ZeroAddress()` — if `collaborator == address(0)`
- `CannotAddOwner()` — can't add the owner as collaborator
- `AlreadyCollaborator()` — address is already a collaborator

**Emits:** `CollaboratorAdded(projectId, collaborator)`

---

#### `removeCollaborator(uint256 projectId, address collaborator)`

```solidity
function removeCollaborator(uint256 projectId, address collaborator) external
```

Revoke collaborator access. Owner only.

**Reverts:**
- `ProjectNotFound()`, `NotOwner()` — same as `addCollaborator`
- `NotCollaborator()` — address is not currently a collaborator

**Emits:** `CollaboratorRemoved(projectId, collaborator)`

---

#### `transferProject(uint256 projectId, address newOwner)`

```solidity
function transferProject(uint256 projectId, address newOwner) external payable
```

Transfer project ownership. Costs `transferFee` ETH. The locked $INKD remains locked in the contract (does not transfer with the project).

**Value required:** `msg.value >= transferFee` (currently `0.005 ETH`)

**Side effects:**
- If `newOwner` was a collaborator, they are automatically removed from the collaborator list
- Updates `_ownerProjects` mapping for both old and new owner

**Reverts:**
- `NotOwner()`, `ProjectNotFound()` — access control
- `ZeroAddress()` — if `newOwner == address(0)`
- `InsufficientFee()` — insufficient ETH

**Emits:** `ProjectTransferred(projectId, oldOwner, newOwner)`

---

#### `setVisibility(uint256 projectId, bool isPublic)`

```solidity
function setVisibility(uint256 projectId, bool isPublic) external
```

Toggle project public/private visibility. Owner only.

**Emits:** `VisibilityChanged(projectId, isPublic)`

---

#### `setReadme(uint256 projectId, string calldata arweaveHash)`

```solidity
function setReadme(uint256 projectId, string calldata arweaveHash) external
```

Update the project's README/documentation Arweave hash. Owner only. Can be called at any time to update docs without pushing a code version.

**Emits:** `ReadmeUpdated(projectId, arweaveHash)`

---

#### `setAgentEndpoint(uint256 projectId, string calldata endpoint)`

```solidity
function setAgentEndpoint(uint256 projectId, string calldata endpoint) external
```

Update the agent API endpoint. Owner only.

**Emits:** `AgentRegistered(projectId, endpoint)`

---

### View Functions

#### `getProject(uint256 projectId) → Project`

```solidity
function getProject(uint256 projectId) external view returns (Project memory)
```

Returns the full `Project` struct. Returns a zeroed struct if `projectId` is invalid (`exists = false`).

---

#### `getVersion(uint256 projectId, uint256 versionIndex) → Version`

```solidity
function getVersion(uint256 projectId, uint256 versionIndex) external view returns (Version memory)
```

Returns a single version by index. Reverts with array out-of-bounds if `versionIndex >= versionCount`.

---

#### `getVersionCount(uint256 projectId) → uint256`

```solidity
function getVersionCount(uint256 projectId) external view returns (uint256)
```

Returns the number of versions pushed for a project.

---

#### `getCollaborators(uint256 projectId) → address[]`

```solidity
function getCollaborators(uint256 projectId) external view returns (address[] memory)
```

Returns all current collaborators for a project.

---

#### `getOwnerProjects(address owner_) → uint256[]`

```solidity
function getOwnerProjects(address owner_) external view returns (uint256[] memory)
```

Returns all project IDs owned by `owner_`.

---

#### `getAgentProjects(uint256 offset, uint256 limit) → Project[]`

```solidity
function getAgentProjects(uint256 offset, uint256 limit) external view returns (Project[] memory)
```

Returns a paginated list of agent projects (`isAgent = true`). Use for agent discovery.

| Parameter | Description |
|-----------|-------------|
| `offset` | Number of agent projects to skip |
| `limit` | Max results to return |

Returns empty array if `offset >= total agent count`.

**Example:**
```solidity
// Get first 50 agent tools
Project[] memory agents = registry.getAgentProjects(0, 50);

// Next page
agents = registry.getAgentProjects(50, 50);
```

---

#### `isCollaborator(uint256 projectId, address addr) → bool`

```solidity
mapping(uint256 => mapping(address => bool)) public isCollaborator;
```

Returns `true` if `addr` is a collaborator on `projectId`.

---

#### `nameTaken(string name) → bool`

```solidity
mapping(string => bool) public nameTaken;
```

Returns `true` if the (normalized) name is already registered.

---

## InkdTreasury

**File:** `contracts/src/InkdTreasury.sol`  
**Inherits:** `Initializable`, `OwnableUpgradeable`, `UUPSUpgradeable` (OpenZeppelin)  
**Proxy pattern:** UUPS

Receives all ETH fees from `InkdRegistry`. Only the `InkdRegistry` can call `deposit()`. Owner can withdraw to any address.

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `registry` | `address` | Only address allowed to call `deposit()` |

### Initializer

```solidity
function initialize(address owner_) external initializer
```

Called once on deployment. Sets the owner.

### Functions

#### `setRegistry(address registry_)`

```solidity
function setRegistry(address registry_) external onlyOwner
```

Configure which address is allowed to call `deposit()`. Must be set after deployment, pointing to the `InkdRegistry` proxy.

**Emits:** `RegistrySet(registry_)`

---

#### `deposit()`

```solidity
function deposit() external payable
```

Called by `InkdRegistry` whenever a version push or ownership transfer fee is collected. Accepts ETH; reverts if called by anyone other than `registry`.

**Reverts:** `OnlyRegistry()` if `msg.sender != registry`

**Emits:** `Deposited(msg.sender, msg.value)`

---

#### `withdraw(address to, uint256 amount)`

```solidity
function withdraw(address to, uint256 amount) external onlyOwner
```

Send ETH from the treasury to `to`. Owner only.

**Reverts:** `TransferFailed()` if the ETH transfer fails (e.g., `to` reverts)

**Emits:** `Withdrawn(to, amount)`

**Example:**
```solidity
// Withdraw 0.5 ETH to multisig
treasury.withdraw(multisig, 0.5 ether);
```

---

#### `receive() external payable`

Fallback to accept direct ETH transfers. Emits `Received(sender, amount)`. Does not enforce `registry`-only for direct sends.

---

## Events

### InkdRegistry Events

```solidity
event ProjectCreated(
    uint256 indexed projectId,
    address indexed owner,
    string name,
    string license
);

event VersionPushed(
    uint256 indexed projectId,
    string arweaveHash,
    string versionTag,
    address pushedBy
);

event CollaboratorAdded(uint256 indexed projectId, address collaborator);
event CollaboratorRemoved(uint256 indexed projectId, address collaborator);

event ProjectTransferred(
    uint256 indexed projectId,
    address indexed oldOwner,
    address indexed newOwner
);

event VisibilityChanged(uint256 indexed projectId, bool isPublic);
event VersionFeeUpdated(uint256 oldFee, uint256 newFee);
event TransferFeeUpdated(uint256 oldFee, uint256 newFee);
event ReadmeUpdated(uint256 indexed projectId, string arweaveHash);
event AgentRegistered(uint256 indexed projectId, string endpoint);
```

### InkdTreasury Events

```solidity
event Deposited(address indexed from, uint256 amount);
event Withdrawn(address indexed to, uint256 amount);
event RegistrySet(address indexed registry);
event Received(address indexed sender, uint256 amount);
```

---

## Custom Errors

All errors are defined in `InkdRegistry.sol`. Using custom errors saves ~24% gas vs `require` strings.

| Error | Thrown When |
|-------|-------------|
| `NameTaken()` | Project name already registered |
| `EmptyName()` | Name is an empty string |
| `ProjectNotFound()` | `projectId` doesn't exist |
| `NotOwner()` | Caller is not the project owner |
| `NotOwnerOrCollaborator()` | Caller can't push versions |
| `InsufficientFee()` | `msg.value < required fee` |
| `AlreadyCollaborator()` | Address already has collaborator access |
| `NotCollaborator()` | Address doesn't have collaborator access |
| `CannotAddOwner()` | Owner can't be added as their own collaborator |
| `ZeroAddress()` | `address(0)` passed where not allowed |
| `FeeExceedsMax()` | New fee exceeds the protocol max |

Treasury errors:

| Error | Thrown When |
|-------|-------------|
| `OnlyRegistry()` | `deposit()` called by non-registry address |
| `TransferFailed()` | ETH withdrawal failed |

---

## Constants

```solidity
// InkdToken
uint256 constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1,000,000,000 $INKD

// InkdRegistry
uint256 constant TOKEN_LOCK_AMOUNT = 1 ether;     // 1 $INKD per project
uint256 constant MAX_VERSION_FEE   = 0.01 ether;  // 10 milli-ETH max
uint256 constant MAX_TRANSFER_FEE  = 0.05 ether;  // 50 milli-ETH max

// Default fees (set in initialize())
uint256 versionFee  = 0.001 ether; // 1 milli-ETH per version
uint256 transferFee = 0.005 ether; // 5 milli-ETH per transfer
```

---

## Deployment Addresses

| Contract | Base Mainnet | Base Sepolia |
|----------|-------------|--------------|
| InkdToken | TBD | TBD |
| InkdRegistry | TBD | TBD |
| InkdTreasury | TBD | TBD |

> Addresses will be published here upon mainnet deployment.
