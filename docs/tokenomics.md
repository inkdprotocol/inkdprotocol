# Tokenomics

$INKD token economics, supply mechanics, and the deflationary lock model.

---

## Overview

| Parameter | Value |
|-----------|-------|
| **Token name** | Inkd |
| **Symbol** | $INKD |
| **Standard** | ERC-20 (ERC-20Burnable, EIP-2612 Permit) |
| **Total Supply** | 1,000,000,000 (1 billion) |
| **Decimals** | 18 |
| **Chain** | Base (chainId: 8453) |
| **Mint function** | None — entire supply minted at deployment |
| **Burn function** | Yes — any holder can burn |
| **Upgradeable** | No — immutable contract |

---

## Supply Distribution

The full 1 billion $INKD supply is minted to the deployer at contract construction:

```solidity
constructor() ERC20("Inkd", "INKD") ERC20Permit("Inkd") {
    _mint(msg.sender, TOTAL_SUPPLY); // 1_000_000_000 ether
}
```

There is no mint function. No additional $INKD can ever be created. The supply can only decrease through burns or protocol locks.

Distribution from the deployer address is determined by the team and governed by the protocol's launch plan. On-chain, there is no vesting schedule enforced by the token contract itself — the contract is a standard ERC-20 with burn and permit extensions.

---

## The Lock Mechanism

**Every project on Inkd permanently removes 1 $INKD from circulation.**

When `createProject()` is called:

```solidity
// Lock 1 $INKD in this contract
inkdToken.safeTransferFrom(msg.sender, address(this), TOKEN_LOCK_AMOUNT);
```

- 1 $INKD moves from the user's wallet into `InkdRegistry`
- There is **no function to withdraw locked tokens** — not for the project owner, not for the protocol owner
- The tokens are locked at `address(InkdRegistry)` permanently
- If the project is transferred, the locked $INKD does NOT move — it stays locked

### Lock Math

```
Circulating Supply = Total Supply - Locked Supply - Burned Supply
Locked Supply      = projectCount × 1 $INKD
```

At 1,000,000 projects:  
`Locked = 1,000,000 $INKD`  
`% of Supply Locked = 0.1%`

At 100,000,000 projects:  
`Locked = 100,000,000 $INKD`  
`% of Supply Locked = 10%`

The more the protocol is used, the more supply is permanently removed. Usage drives scarcity.

---

## Fee Structure

The protocol charges ETH fees for version pushes and ownership transfers. These fees do NOT burn $INKD — they are collected in the treasury as ETH.

| Action | Cost | Currency | Destination |
|--------|------|----------|-------------|
| Create project | 1 $INKD (locked forever) | $INKD | InkdRegistry (locked) |
| Push version | 0.001 ETH | ETH | InkdTreasury |
| Transfer project | 0.005 ETH | ETH | InkdTreasury |
| Add collaborator | Gas only | ETH | Miners/validators |
| Update README | Gas only | ETH | Miners/validators |

### Fee Caps (Protocol Constants)

```solidity
uint256 public constant MAX_VERSION_FEE  = 0.01 ether;  // 10× current fee
uint256 public constant MAX_TRANSFER_FEE = 0.05 ether;  // 10× current fee
```

The protocol owner can adjust fees within these bounds. They cannot exceed the caps without deploying a new implementation.

---

## Treasury

All ETH fees flow to `InkdTreasury`.

```
Version push (0.001 ETH)    ──►
                                 InkdTreasury ──► Owner withdrawal
Project transfer (0.005 ETH) ──►
```

The treasury is controlled by the protocol owner (ideally a multisig or DAO). ETH in the treasury is used for:

- Protocol development
- Audits and security
- Ecosystem grants
- Infrastructure costs
- Future: DAO-governed distribution to $INKD stakers

---

## Deflationary Model

$INKD is **deflationary by design** through two mechanisms:

### 1. Protocol Locks (Permanent)
Every new project locks 1 $INKD forever. This is the primary deflationary driver.

```
Year 1: 10,000 projects   → 10,000 $INKD locked
Year 2: 100,000 projects  → 100,000 $INKD locked
Year 3: 1,000,000 projects → 1,000,000 $INKD locked
```

Locked $INKD accumulates monotonically. It never decreases.

### 2. Burns (Discretionary)
Any $INKD holder can call `burn(amount)` or `burnFrom(account, amount)` to permanently destroy tokens. Burns reduce total supply immediately.

```solidity
// Anyone can burn their own tokens
inkdToken.burn(parseEther("100")); // destroys 100 $INKD

// With allowance
inkdToken.burnFrom(address, parseEther("50"));
```

Future protocol mechanisms (governance votes, milestone burns, etc.) may introduce structured burn events.

---

## EIP-2612 Permit

$INKD supports **gasless approvals** via EIP-2612. Instead of paying gas for an `approve()` transaction, users can sign an off-chain message and let anyone submit it on-chain.

This enables a single-transaction flow for project creation:

```typescript
// Without permit: 2 transactions (approve + createProject)
await inkdToken.approve(registry, parseEther("1"));
await registry.createProject(...);

// With permit: 1 transaction (permit embedded in createProject)
const signature = await signPermit({
  owner: userAddress,
  spender: registryAddress,
  value: parseEther("1"),
  deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  nonce: await inkdToken.nonces(userAddress),
});

// Registry can verify + execute in one call (if registry supports it)
await registry.createProjectWithPermit(..., signature);
```

> Note: `createProjectWithPermit` is a planned V2 feature. V1 requires a separate `approve()` call.

---

## Token Utility

$INKD serves three roles:

### 1. Commitment Token
Locking 1 $INKD is the cost of creating a project. The lock:
- Prevents spam registrations (real economic cost)
- Creates permanent demand for $INKD proportional to protocol usage
- Aligns developer incentives with the protocol's long-term success

### 2. Governance Token (Planned)
$INKD holders will be able to vote on:
- Fee parameter changes (within protocol constants)
- Treasury fund allocation
- Protocol upgrades
- New feature proposals

### 3. Access Token
Future features may gate access based on $INKD holdings:
- Premium discovery placement for agent tools
- Advanced collaboration features
- Early access to new protocol features

---

## Economic Flywheel

```
More developers use Inkd
         │
         ▼
More projects created → More $INKD locked → Less supply
         │
         ▼
More version fees → More ETH in treasury → More development
         │
         ▼
Better protocol → More developers use Inkd
         │
         └──► (repeat)
```

The key insight: **protocol usage is directly correlated with token scarcity**. There is no artificial mechanism — the deflationary pressure is entirely driven by real usage.

---

## Supply Projections

Rough projections based on adoption scenarios:

| Scenario | Projects | $INKD Locked | % Supply Locked |
|----------|----------|--------------|-----------------|
| Conservative | 100,000 | 100,000 | 0.01% |
| Moderate | 5,000,000 | 5,000,000 | 0.50% |
| Optimistic | 50,000,000 | 50,000,000 | 5.00% |
| Max (1B projects) | 1,000,000,000 | 1,000,000,000 | 100% |

In the maximum case, if every $INKD is locked in a project, no further projects can be created (unless locked tokens are somehow recaptured, which they cannot be under current protocol design). This creates a natural ceiling on the number of projects: 1 billion.

---

## Comparison to Other Models

| Protocol | Token Role | Deflationary Mechanism |
|----------|------------|----------------------|
| **Inkd** | Commit + Govern | Lock per project (permanent) |
| ENS | Name registration | Expiring registrations |
| Uniswap (UNI) | Governance | None (fixed supply, no burn) |
| Maker (MKR) | Governance | Buyback + burn from protocol revenue |
| Aave (AAVE) | Safety + Govern | Ecosystem reserve, no mandatory burn |

Inkd's model is unique in that the deflationary pressure is **automatic and permanent per unit of usage** — not discretionary or governance-dependent. Every project is a ratchet click toward scarcity.

---

## Smart Contract Source

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract InkdToken is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    constructor() ERC20("Inkd", "INKD") ERC20Permit("Inkd") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
```

The token contract is minimal by design. No admin keys. No mint function post-deployment. Immutable.
