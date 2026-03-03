# Inkd Protocol — Audit Preparation Guide

> This document is for the external smart contract auditors.
> It covers scope, setup, design decisions, known risks, and key areas of focus.

---

## Table of Contents

1. [Overview](#overview)
2. [Scope](#scope)
3. [Out of Scope](#out-of-scope)
4. [Repository Setup](#repository-setup)
5. [Contract Architecture](#contract-architecture)
6. [Test Suite](#test-suite)
7. [Known Design Decisions](#known-design-decisions)
8. [Known Informational Findings (Internal Review)](#known-informational-findings-internal-review)
9. [Key Focus Areas](#key-focus-areas)
10. [Trust Model](#trust-model)
11. [Upgrade Safety](#upgrade-safety)
12. [Contact](#contact)

---

## Overview

**Protocol:** Inkd Protocol — on-chain ownership registry for AI agents and their artifacts.
**Chain:** Base (L2 on Ethereum, OP Stack)
**Solidity version:** 0.8.24
**Framework:** Foundry
**OpenZeppelin version:** 5.x (via git submodule)
**Test count:** 238 (unit · fuzz · invariant · upgrade · integration · timelock)
**Internal review:** `SECURITY_REVIEW.md` — no critical/high findings

### What Inkd Does

Inkd lets AI agents (and humans) register projects on-chain by locking 1 $INKD token. Each project can have versions pushed — each version referencing an Arweave content hash. The protocol collects small ETH fees for version pushes and project transfers.

---

## Scope

The following contracts are **in scope** for the audit:

| Contract | Path | Lines | Upgradeable |
|----------|------|-------|-------------|
| `InkdToken.sol` | `contracts/src/InkdToken.sol` | ~50 | ❌ |
| `InkdRegistry.sol` | `contracts/src/InkdRegistry.sol` | ~220 | ✅ UUPS |
| `InkdTreasury.sol` | `contracts/src/InkdTreasury.sol` | ~60 | ✅ UUPS |
| `InkdTimelock.sol` | `contracts/src/InkdTimelock.sol` | ~95 | ❌ |

**Also review (deployment context):**

- `contracts/script/Deploy.s.sol` — mainnet deploy script
- `contracts/script/DeployTest.s.sol` — test deploy script
- `contracts/script/DryRun.s.sol` — pre-deploy dry-run validation

**Not in scope (test helper only):**

- `InkdTestToken.sol` — ERC-20 with public `mint()`, used only in tests

---

## Out of Scope

The following are explicitly **out of scope**:

- TypeScript SDK (`sdk/`) — off-chain client code only, no on-chain risk
- CLI tool (`cli/`) — off-chain only
- The Graph subgraph (`subgraph/`) — indexer only, no on-chain risk
- Front-end / website — not part of this repo
- Arweave storage — external system; Inkd only stores content hashes
- `InkdTestToken.sol` — never deployed to mainnet

---

## Repository Setup

```bash
# Clone
git clone https://github.com/inkdprotocol/inkd-protocol.git
cd inkd-protocol

# Install Foundry (if needed)
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Install OpenZeppelin submodule
git submodule update --init --recursive

# Build
cd contracts
forge build

# Run full test suite
forge test --summary

# Run with verbosity
forge test -vvv

# Coverage (requires lcov)
forge coverage --report lcov
# or for terminal summary:
forge coverage
```

**Expected test results:** 238 tests, 0 failures, 0 skipped.

**Coverage summary (as of last run):**
All production contracts: 100% statement coverage (excluding `_disableInitializers()` constructor bodies — a known Foundry `--ir-minimum` instrumentation artifact, not a real gap).

---

## Contract Architecture

```
InkdToken (non-upgradeable ERC-20)
    │
    │  1 $INKD locked per project
    ▼
InkdRegistry (UUPS proxy) ─────► InkdTreasury (UUPS proxy)
    │   stores: projects,              │   stores: ETH fees
    │   versions, collaborators        │
    │                                  │
    │  ownership transferred to:       │
    └──────────► InkdTimelock ◄────────┘
                 (48h delay on
                  all admin calls)
```

### Contract Roles

| Contract | Role |
|----------|------|
| `InkdToken` | ERC-20 $INKD. Fixed 1B supply. Burnable. EIP-2612 permit. No admin. |
| `InkdRegistry` | Core registry. Projects, versions, collaborators, transfers. UUPS owner = deployer (→ timelock post-deploy). |
| `InkdTreasury` | ETH fee collector. Accepts deposits from registry only. Withdrawal by owner (→ timelock post-deploy). |
| `InkdTimelock` | 48h governance delay. Admin queues transactions targeting Registry/Treasury. Two-step admin handover. |

---

## Test Suite

| File | Tests | Coverage |
|------|-------|---------|
| `InkdToken.t.sol` | 19 | Token: 100% |
| `InkdRegistry.t.sol` | 87 | Registry: 100% |
| `InkdTreasury.t.sol` | 19 | Treasury: 100% |
| `InkdTimelock.t.sol` | 41 | Timelock: 100% |
| `InkdTestToken.t.sol` | 27 | TestToken: 100% |
| `InkdFuzz.t.sol` | 13 | Fuzz: pushVersion, transfer, createProject fee edge cases |
| `InkdInvariant.t.sol` | 7 | Invariants: token lock accounting, treasury balance |
| `InkdIntegration.t.sol` | ~10 | Full lifecycle flows |
| `InkdUpgrade.t.sol` | 16 | UUPS upgrade paths, storage layout |
| **Total** | **238** | |

Run individual suites:
```bash
forge test --match-contract InkdRegistryTest -vvv
forge test --match-contract InkdTimelockTest -vvv
forge test --match-contract InkdInvariant -vvv
```

---

## Known Design Decisions

These are intentional choices that may look like issues but are by design:

### 1. `receive()` in InkdTreasury accepts ETH from any sender

Direct ETH transfers to the treasury (not via `registry.deposit()`) are not attributed in event logs but are safe — they add to the treasury balance and can be withdrawn by the owner. The `Received` event is emitted. This is intentional: we don't want to revert valid ETH donations.

### 2. `cancelTransaction()` in InkdTimelock does not check if tx is queued

Setting an already-false mapping entry to false is a no-op. The emitted `CancelTransaction` event may be spurious for non-queued hashes, but no state is corrupted. Admin-only, so this is an acceptable trade-off for simplicity.

### 3. `setRegistry()` on InkdTreasury is mutable

The owner (post-deploy: timelock) can change the registry address. This is needed for upgrade scenarios (e.g., deploying InkdRegistry V2 and pointing the existing treasury at it). The 48h timelock delay means any registry change is publicly observable before execution.

### 4. Overpayment is not refunded in `pushVersion()` / `transferProject()`

Excess ETH goes to the treasury. The SDK always sends exact fee amounts. This is documented in `SECURITY_REVIEW.md` as INFO-4. We consider it acceptable for V1; a refund mechanism can be added in V2.

### 5. `_disableInitializers()` in UUPS constructors

Both `InkdRegistry` and `InkdTreasury` call `_disableInitializers()` in their constructors to prevent the implementation contract from being initialized. Foundry's `--ir-minimum` coverage mode does not instrument this call, showing 0 hits. This is a known Foundry artifact — the guard is exercised by the tests. See [Foundry issue #3357](https://github.com/foundry-rs/foundry/issues/3357).

### 6. Token lock is not slashable

1 $INKD locked per project can only be returned via `transferProject()` (ownership transfer) or a contract upgrade. We do not slash the lock. This is intentional — it's a commitment device, not a stake.

### 7. No name-collision check across owners

Two different wallets cannot register the same project name — `_normalizeName()` + `nameToProjectId` mapping enforces global uniqueness. Names are cosmetic; ownership is tracked by `projectId` (uint256 counter).

---

## Known Informational Findings (Internal Review)

From `SECURITY_REVIEW.md` (pre-audit internal pass):

| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| LOW-1 | 🔵 Low | Treasury `receive()` accepts ETH from any sender | By design, documented |
| LOW-2 | 🔵 Low | `setRegistry()` mutable by owner | By design; timelock post-deploy mitigates |
| LOW-3 | 🔵 Low | Timelock initial admin is a single EOA | Transfer to Safe multisig post-deploy (POST_DEPLOY.md) |
| INFO-1 | ⚪ Info | Token is non-upgradeable | By design |
| INFO-2 | ⚪ Info | `_normalizeName` is ASCII-only | Cosmetic names, no security impact |
| INFO-3 | ⚪ Info | No name length limit | Gas cost borne by caller |
| INFO-4 | ⚪ Info | Overpayment not refunded | SDK sends exact amounts; V2 improvement |
| INFO-5 | ⚪ Info | `lockAmount` naming inconsistency | Fixed in DryRun.s.sol |
| INFO-6 | ⚪ Info | `cancelTransaction` no pre-check on queued state | No-op on false; admin-only |

---

## Key Focus Areas

For the external audit, we'd most like scrutiny on:

### High Priority

1. **Re-entrancy in InkdRegistry**
   - `createProject()`: `safeTransferFrom` → INKD token → could the INKD token (if ever compromised/upgraded) re-enter registry state?
   - `pushVersion()` / `transferProject()`: external call to `InkdTreasury.deposit()` — treasury is Ownable + upgradeable; is state always safe before this call?
   - We believe CEI is followed throughout. Please verify.

2. **UUPS Upgrade Safety**
   - Can `upgradeToAndCall()` be called by a non-owner? (`_authorizeUpgrade` is `onlyOwner` in both contracts)
   - Storage layout: are there any hidden gaps or shadowing between implementation and proxy state? (Run `forge inspect InkdRegistry storage-layout`)
   - Can the implementation contract itself be initialized (bypassing `_disableInitializers()`)?

3. **InkdTimelock execution correctness**
   - Is the `txHash = keccak256(abi.encode(target, value, data, eta))` scheme collision-resistant in practice?
   - Can a queued transaction be replayed after execution? (`queuedTransactions[txHash] = false` before execution — verify this is sufficient)
   - Can ETH be stuck in the timelock? (It accepts ETH via `receive()` and forwards via `executeTransaction{value: value}`)

4. **Access control completeness**
   - Is every state-mutating function correctly gated?
   - Are there any privilege escalation paths (e.g., a collaborator becoming an owner)?

### Medium Priority

5. **Integer arithmetic** — Solidity 0.8.24 built-in overflow protection; spot-check fee comparisons and project ID counter
6. **Event completeness** — Do emitted events correctly reflect all state changes? (Important for off-chain indexer integrity)
7. **EIP-2612 permit implementation** in InkdToken — nonce management, replay protection, domain separator correctness

### Lower Priority

8. **Gas limits** — Any unbounded loops or storage patterns that could hit gas limits at scale?
9. **Name normalization edge cases** — Unicode, empty strings, very long strings
10. **Fuzz corpus quality** — Are the fuzz tests covering realistic edge cases?

---

## Trust Model

**Who is the deployer / initial owner?**

The deployer EOA controls `InkdRegistry` and `InkdTreasury` ownership immediately post-deploy. The deployment plan:

1. Deploy all contracts
2. Deploy `InkdTimelock` with deployer as admin
3. Transfer `InkdRegistry.owner` → `InkdTimelock`
4. Transfer `InkdTreasury.owner` → `InkdTimelock`
5. Transfer `InkdTimelock.admin` → Gnosis Safe multisig (2-of-3 or 3-of-5)

After step 5: **no single key can execute admin actions without a 48h public delay**.

**What can the owner (timelock) do?**
- Upgrade InkdRegistry or InkdTreasury implementation
- Change version fee or transfer fee in InkdRegistry
- Withdraw ETH from InkdTreasury
- Change registry address in InkdTreasury

**What can the owner NOT do?**
- Change the InkdToken contract (non-upgradeable, no owner)
- Modify existing project ownership, version history, or collaborator lists — these are user data and the registry has no admin override for user records
- Drain user-locked $INKD tokens directly (they're locked in the contract; only retrievable via protocol-defined paths)

---

## Upgrade Safety

```bash
# Inspect storage layout
cd contracts
forge inspect InkdRegistry storage-layout
forge inspect InkdTreasury storage-layout
```

Current storage layout has no reserved gaps (we rely on UUPS proxy storage being independent of implementation). For any V2 upgrade, we will:
- Run OpenZeppelin's upgrade safety checker
- Add storage gap variables (`uint256[50] private __gap`) in a future refactor
- Only upgrade via the timelock (48h delay, publicly visible)

**No upgrade is planned before or during the audit window.**

---

## Contact

| Role | Contact |
|------|---------|
| Protocol lead | Contact via GitHub issues or Discord (see DISCORD_SETUP.md) |
| Security disclosure | `security@inkdprotocol.xyz` (see SECURITY.md) |
| Discord | See `docs/DISCORD_SETUP.md` once server is live |

For audit-related questions, open a **private** GitHub security advisory or contact via the security email above.

---

## Useful Commands

```bash
# Full test suite
forge test --summary

# Specific contract
forge test --match-contract InkdRegistryTest -vvv

# All fuzz tests
forge test --match-contract InkdFuzz -vvvv

# Invariant tests
forge test --match-contract InkdInvariant -vvvv

# Coverage
forge coverage

# Storage layout
forge inspect InkdRegistry storage-layout
forge inspect InkdTreasury storage-layout

# ABI
forge inspect InkdRegistry abi
```

---

*Last updated: 2026-03-03 | 238 contract tests · 323 SDK tests · 351 CLI tests = 912 total*
*Internal review: SECURITY_REVIEW.md — no critical/high findings*
