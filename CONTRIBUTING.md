# Contributing to Inkd Protocol

Welcome! Inkd Protocol is open to contributions from developers and AI agents alike.
This guide covers everything you need to get started.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Smart Contracts](#smart-contracts)
4. [TypeScript SDK](#typescript-sdk)
5. [The Graph Subgraph](#the-graph-subgraph)
6. [Code Style](#code-style)
7. [Testing](#testing)
8. [Pull Request Process](#pull-request-process)
9. [Reporting Issues](#reporting-issues)

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/inkdprotocol/inkd-protocol.git
cd inkd-protocol

# 2. Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 3. Install contract dependencies (git submodules)
git submodule update --init --recursive

# 4. Build contracts
cd contracts
forge build

# 5. Run tests
forge test

# 6. Install SDK dependencies
cd ../sdk
npm install
npm run build
```

Everything compiles → you're ready.

---

## Project Structure

```
inkd-protocol/
├── contracts/                  # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── InkdToken.sol       # ERC-20 $INKD token
│   │   ├── InkdRegistry.sol    # Project registry (UUPS upgradeable)
│   │   └── InkdTreasury.sol    # Fee treasury (UUPS upgradeable)
│   ├── test/
│   │   ├── InkdToken.t.sol     # Unit tests for InkdToken
│   │   ├── InkdRegistry.t.sol  # Unit tests for InkdRegistry
│   │   ├── InkdTreasury.t.sol  # Unit tests for InkdTreasury
│   │   ├── InkdIntegration.t.sol # End-to-end integration tests
│   │   ├── InkdFuzz.t.sol      # Fuzz tests
│   │   └── InkdInvariant.t.sol # Invariant tests
│   └── script/
│       ├── Deploy.s.sol        # Production deploy script
│       ├── DryRun.s.sol        # Dry-run (no broadcast)
│       └── Verify.s.sol        # Contract verification
│
├── sdk/                        # TypeScript SDK (@inkd/sdk)
│   └── src/
│       ├── InkdClient.ts       # Main ERC-721/vault client
│       ├── ProjectRegistry.ts  # InkdRegistry.sol client
│       ├── ArweaveClient.ts    # Arweave/Irys upload wrapper
│       ├── encryption.ts       # Pluggable encryption interface
│       ├── hooks/              # React hooks
│       ├── types.ts            # Core TypeScript types
│       ├── errors.ts           # Custom error classes
│       ├── abi.ts              # Contract ABIs
│       └── index.ts            # Public exports
│
├── subgraph/                   # The Graph subgraph
│   ├── schema.graphql          # Entity definitions
│   ├── subgraph.yaml           # Manifest
│   └── src/
│       ├── registry.ts         # InkdRegistry event handlers
│       ├── treasury.ts         # InkdTreasury event handlers
│       └── utils.ts            # Shared helpers
│
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # System design
│   ├── CONTRACT_REFERENCE.md   # Full Solidity API reference
│   ├── SDK_REFERENCE.md        # TypeScript SDK reference
│   ├── QUICKSTART.md           # Getting started guide
│   └── WHITEPAPER.md           # Protocol whitepaper
│
├── .github/workflows/ci.yml    # GitHub Actions CI
├── CHANGELOG.md                # Version history
├── SECURITY_REVIEW.md          # Security audit report
└── POST_DEPLOY.md              # Post-deployment checklist
```

---

## Smart Contracts

### Setup

```bash
cd contracts

# Build
forge build

# Run all tests (including integration + fuzz)
forge test

# Run with verbosity
forge test -vvv

# Run a specific test file
forge test --match-path test/InkdIntegration.t.sol

# Run a specific test function
forge test --match-test test_journey_fullDeveloperWorkflow

# Run invariant tests
forge test --match-contract InkdInvariantTest

# Gas report
forge test --gas-report

# Gas snapshot (run after changes to update baseline)
forge snapshot
```

### Contract Architecture

The three contracts interact in a simple pipeline:

```
User → InkdToken (ERC-20 approval) → InkdRegistry → InkdTreasury (ETH fees)
```

- **InkdToken**: Fixed-supply ERC-20, no admin functions post-deploy.
- **InkdRegistry**: UUPS upgradeable, owns the project/version state. Locks 1 $INKD per project. Forwards ETH fees to treasury.
- **InkdTreasury**: UUPS upgradeable, passthrough ETH vault. Only the registry can call `deposit()`. Owner can `withdraw()`.

### Upgradeability

Both InkdRegistry and InkdTreasury use [OpenZeppelin UUPS](https://docs.openzeppelin.com/contracts/4.x/api/proxy#UUPSUpgradeable) proxies.

Rules:
- **Never add, remove, or reorder state variables** in an upgrade — this corrupts storage.
- New state variables must be appended at the end of the contract.
- `_disableInitializers()` in constructor prevents direct calls on implementation.
- `_authorizeUpgrade` is locked to `onlyOwner`.

### Writing Tests

All tests live in `contracts/test/`.

| File | Purpose |
|------|---------|
| `InkdToken.t.sol` | Unit tests for the ERC-20 |
| `InkdRegistry.t.sol` | Unit tests for registry functions |
| `InkdTreasury.t.sol` | Unit tests for treasury |
| `InkdIntegration.t.sol` | Full lifecycle / journey tests |
| `InkdFuzz.t.sol` | Property-based fuzz tests |
| `InkdInvariant.t.sol` | Protocol invariants (ghost accounting) |

**Test naming convention:**

```
test_<function>_<scenario>()           # happy path
test_<function>_reverts_<reason>()     # revert case
testFuzz_<property>()                  # fuzz
invariant_<property>()                 # invariant
test_journey_<userFlow>()              # integration
```

**Use named actors:**

```solidity
address public alice = makeAddr("alice");
address public bob   = makeAddr("bob");
```

---

## TypeScript SDK

### Setup

```bash
cd sdk
npm install
npm run build       # tsc compile
npm run typecheck   # type-check only (no emit)
```

### Two Clients

| Client | Contract | Use case |
|--------|----------|----------|
| `ProjectRegistry` | `InkdRegistry.sol` | Create/manage projects |
| `InkdClient` | InkdToken (ERC-721), InkdVault | NFT inscriptions (V2) |

For interacting with the V1 protocol (what's deployed), use **`ProjectRegistry`**.

### Adding New Methods

1. Add the ABI fragment to `sdk/src/ProjectRegistry.ts` (or `abi.ts`)
2. Add the TypeScript types to `types.ts`
3. Implement the method in the client class
4. Export from `index.ts` if needed
5. Document in `docs/SDK_REFERENCE.md`

---

## The Graph Subgraph

```bash
cd subgraph
npm install
graph codegen   # regenerate AssemblyScript types from schema
graph build     # compile
```

Deploy guide: `subgraph/SUBGRAPH.md`

If you add a new event to InkdRegistry.sol:

1. Update `subgraph/abis/InkdRegistry.json` with the new event ABI
2. Add the event handler to `subgraph.yaml`
3. Implement the handler in `subgraph/src/registry.ts`
4. Update `schema.graphql` if new entities are needed

---

## Code Style

### Solidity

- Pragma: `^0.8.24`
- 4-space indentation
- NatSpec for all public/external functions
- Custom errors (not `require(msg, "string")`)
- Named return variables where it improves clarity
- Section separators: `// ─── Section ─────`

```solidity
/// @notice Brief description.
/// @param projectId The project to modify.
/// @dev Emits VisibilityChanged.
function setVisibility(uint256 projectId, bool isPublic) external onlyProjectOwner(projectId) {
    projects[projectId].isPublic = isPublic;
    emit VisibilityChanged(projectId, isPublic);
}
```

### TypeScript

- Strict TypeScript (`"strict": true`)
- `bigint` for all on-chain numeric values (never `number` for token amounts)
- Descriptive interface names (`CreateProjectOptions`, not `Opts`)
- JSDoc on all public methods
- No `any` — use proper types or unknown

---

## Testing

### Before opening a PR, run all checks:

```bash
# Contracts
cd contracts
forge build --deny-warnings
forge test
forge snapshot --check   # fails if gas increased >5%

# SDK
cd ../sdk
npm run typecheck
npm run build
```

### CI runs automatically on push:

1. `forge build --deny-warnings`
2. `forge test -vvv`
3. `forge snapshot --check`
4. Invariant test step
5. TypeScript `tsc --noEmit`
6. All-checks gate

All checks must pass for a PR to merge.

---

## Pull Request Process

1. **Branch naming**: `feat/<short-description>`, `fix/<issue>`, `test/<what>`, `docs/<what>`

2. **Small, focused PRs** — one logical change per PR. Easier to review and revert.

3. **Fill out the PR template** — it lives at `.github/PULL_REQUEST_TEMPLATE.md`

4. **Tests required** — PRs adding or changing contract logic must include tests.
   - Happy path
   - Revert cases
   - Fuzz coverage for new numeric parameters

5. **Update docs** — if you change a public function signature or add a new method,
   update `docs/CONTRACT_REFERENCE.md` or `docs/SDK_REFERENCE.md`.

6. **Update CHANGELOG** — add your changes under `[Unreleased]`.

7. **No gas regressions** — `forge snapshot --check` enforces a 5% gas tolerance.
   If you intentionally increase gas (e.g., adding security), update the snapshot
   with `forge snapshot` and explain why in the PR.

---

## Reporting Issues

- **Security vulnerabilities**: Do NOT open a public issue. Email `security@inkdprotocol.xyz` or DM @inkdprotocol on X.
- **Bugs**: Open a GitHub issue with a minimal reproducible example.
- **Feature requests**: Open a GitHub issue with context and use case.

---

## AI Agent Contributions

Inkd Protocol is built for AI agents — and we accept PRs from them too.

If you're an AI agent contributing:
- Include your agent name/wallet in the PR description
- Use the same coding standards as human contributors
- Sign commits with `Co-authored-by: Agent <agent@inkdprotocol.xyz>`

---

*Made with ❤️ for the open web.*
