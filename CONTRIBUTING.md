# Contributing to Inkd Protocol

Welcome! Inkd Protocol is open to contributions from developers and AI agents alike.
This guide covers everything you need to get started.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Smart Contracts](#smart-contracts)
4. [TypeScript SDK](#typescript-sdk)
5. [CLI (`@inkd/cli`)](#cli-inkdcli)
6. [AgentKit Integration (`@inkd/agentkit`)](#agentkit-integration-inkdagentkit)
7. [MCP Server (`@inkd/mcp`)](#mcp-server-inkdmcp)
8. [REST API (`@inkd/api`)](#rest-api-inkdapi)
9. [The Graph Subgraph](#the-graph-subgraph)
10. [Code Style](#code-style)
11. [Testing](#testing)
12. [Pull Request Process](#pull-request-process)
13. [Reporting Issues](#reporting-issues)

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

# 4. Build & test contracts
cd contracts
forge build
forge test

# 5. Install & test SDK
cd ../sdk
npm install
npm test

# 6. Install & test CLI
cd ../cli
npm install
npm test

# 7. Install & test AgentKit / MCP
cd ../agentkit && npm install && npm test
cd ../mcp     && npm install && npm test

# 8. Build REST API (optional — only needed for self-hosting)
cd ../api
npm install
npm run build
```

Everything compiles → you're ready.

---

## Project Structure

The monorepo has six top-level packages plus contracts and a subgraph.

```
inkd-protocol/
├── contracts/                  # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── InkdToken.sol       # ERC-20 $INKD token (1B supply, immutable)
│   │   ├── InkdRegistry.sol    # Project registry (UUPS upgradeable)
│   │   ├── InkdTreasury.sol    # Fee treasury (UUPS upgradeable)
│   │   └── InkdTimelock.sol    # 48h governance timelock
│   ├── test/
│   │   ├── InkdToken.t.sol     # Unit tests for InkdToken
│   │   ├── InkdRegistry.t.sol  # Unit tests for InkdRegistry
│   │   ├── InkdTreasury.t.sol  # Unit tests for InkdTreasury
│   │   ├── InkdIntegration.t.sol # End-to-end lifecycle tests
│   │   ├── InkdFuzz.t.sol      # Property-based fuzz tests
│   │   └── InkdInvariant.t.sol # Invariant tests (ghost accounting)
│   └── script/
│       ├── Deploy.s.sol        # Production deploy script
│       ├── DryRun.s.sol        # Dry-run (no broadcast)
│       └── Verify.s.sol        # Contract verification
│
├── sdk/                        # TypeScript SDK (@inkd/sdk)
│   └── src/
│       ├── InkdClient.ts       # Main viem-based client
│       ├── ProjectRegistry.ts  # InkdRegistry.sol client
│       ├── arweave.ts          # Arweave/Irys upload wrapper
│       ├── encryption.ts       # Pluggable encryption interface
│       ├── events.ts           # watchEvent wrappers (watchProjectCreated, etc.)
│       ├── multicall.ts        # Multicall3 batch reads (batchGetProjects, etc.)
│       ├── hooks/              # React hooks (useInkd, useToken, etc.)
│       ├── types.ts            # Core TypeScript types
│       ├── errors.ts           # Custom error classes
│       ├── abi.ts              # Contract ABIs
│       └── index.ts            # Public exports
│
├── cli/                        # Command-line interface (@inkd/cli → `inkd` binary)
│   └── src/
│       ├── commands/
│       │   ├── project.ts      # inkd project create|get|list|transfer
│       │   ├── version.ts      # inkd version push|list
│       │   ├── token.ts        # inkd token balance|approve|allowance|transfer|info
│       │   ├── agent.ts        # inkd agent list|get
│       │   ├── agentd.ts       # inkd agentd (daemon: auto-push on file change)
│       │   ├── search.ts       # inkd search <query>
│       │   ├── status.ts       # inkd status (network + wallet info)
│       │   ├── init.ts         # inkd init (create inkd.config.json)
│       │   └── watch.ts        # inkd watch (live event stream)
│       ├── config.ts           # Config loader, env vars, ADDRESSES map
│       ├── client.ts           # viem client builders
│       ├── abi.ts              # Contract ABIs (CLI copy)
│       └── index.ts            # CLI entry point (command router)
│
├── agentkit/                   # Coinbase AgentKit integration (@inkd/agentkit)
│   └── src/
│       ├── provider.ts         # InkdActionProvider (registers with AgentKit)
│       ├── actions.ts          # 4 actions: create_project, push_version,
│       │                       #            get_project, list_agents
│       ├── types.ts            # Zod schemas for action inputs
│       └── index.ts            # Public exports
│
├── mcp/                        # Model Context Protocol server (@inkd/mcp)
│   └── src/
│       ├── server.ts           # MCP server entry point (stdio transport)
│       ├── handlers.ts         # 5 tool handlers: create_project, push_version,
│       │                       #   get_project, get_versions, list_agents
│       └── abis.ts             # Contract ABIs (MCP copy)
│
├── api/                        # HTTP REST API server (@inkd/api)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── projects.ts     # GET/POST /v1/projects, GET /v1/projects/:id
│   │   │   ├── agents.ts       # GET /v1/agents, GET /v1/agents/:address
│   │   │   └── health.ts       # GET /v1/health, GET /v1/status
│   │   ├── middleware/         # Auth (API key), error handling, x402 payment
│   │   ├── clients.ts          # viem client builders
│   │   ├── config.ts           # Env var loader
│   │   ├── errors.ts           # HTTP error types
│   │   └── index.ts            # Express app entry point
│   ├── openapi.yaml            # OpenAPI 3.1 spec
│   └── Dockerfile              # Container image for self-hosting
│
├── subgraph/                   # The Graph subgraph
│   ├── schema.graphql          # Entity definitions
│   ├── subgraph.yaml           # Manifest
│   └── src/
│       ├── registry.ts         # InkdRegistry event handlers
│       ├── treasury.ts         # InkdTreasury event handlers
│       └── utils.ts            # Shared helpers
│
├── docs/                       # Long-form documentation
│   ├── ARCHITECTURE.md         # System design
│   ├── QUICKSTART.md           # Getting started
│   ├── CLI_REFERENCE.md        # Full `inkd` command reference
│   ├── SDK_REFERENCE.md        # TypeScript SDK reference
│   ├── CONTRACT_REFERENCE.md   # Solidity API reference
│   ├── AGENTKIT.md             # @inkd/agentkit integration guide
│   ├── MCP.md                  # @inkd/mcp setup guide
│   ├── API.md                  # REST API reference
│   ├── X402.md                 # x402 payment protocol guide
│   ├── ARCHITECTURE.md         # System design
│   ├── AUDIT_PREP.md           # Audit preparation notes
│   └── WHITEPAPER.md           # Protocol whitepaper
│
├── .github/workflows/ci.yml    # GitHub Actions CI
├── CHANGELOG.md                # Version history
├── SECURITY.md                 # Security policy + disclosure instructions
├── SECURITY_REVIEW.md          # Internal security review notes
└── POST_DEPLOY.md              # Post-deployment checklist
```

**Test counts (v0.10.3):**

| Package | Tests | Coverage |
|---------|------:|---------|
| `contracts/` | 238 | — |
| `sdk/` | 323 | 100% all files |
| `cli/` | 352 | 99.5% stmts |
| `agentkit/` | 69 | 100% all files |
| `mcp/` | 33 | — |
| **Total** | **1,015** | |

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

## CLI (`@inkd/cli`)

The `inkd` binary. Users install it via `npm install -g @inkd/cli`.

### Setup

```bash
cd cli
npm install
npm run build       # tsc compile → dist/
npm test            # vitest test suite (352 tests)
npm run typecheck   # type-check only
```

### Adding a New Command

1. Create `src/commands/<name>.ts` and export a `cmd<Name>(args: string[]): Promise<void>`
2. Add the case to the router in `src/index.ts`
3. Add a `src/__tests__/<name>.test.ts` with unit tests
4. Document in `docs/CLI_REFERENCE.md`

### Command Conventions

- All commands accept `--json` for machine-readable output
- Use `error()` (from `config.ts`) + `process.exit(1)` for fatal errors
- Use `info()` / `success()` / `warn()` (from `config.ts`) for output
- Private keys come from `INKD_PRIVATE_KEY` env var — never accept via flag
- All on-chain amounts are `bigint`; use `parseEther` / `formatEther` from viem

---

## AgentKit Integration (`@inkd/agentkit`)

Coinbase AgentKit action provider — lets any AgentKit-powered agent use Inkd.
See `docs/AGENTKIT.md` for the full integration guide.

### Setup

```bash
cd agentkit
npm install
npm run build       # tsc + tsup dual CJS/ESM build
npm test            # vitest test suite (69 tests)
```

### The 4 Actions

| Action | What it does |
|--------|-------------|
| `inkd_create_project` | Register a new project on-chain |
| `inkd_push_version` | Push a version (locks 0.001 ETH fee) |
| `inkd_get_project` | Read project metadata |
| `inkd_list_agents` | List all registered agents |

### Adding a New Action

1. Add the Zod schema to `src/types.ts`
2. Add the handler function to `src/actions.ts`
3. Register it in `src/provider.ts` (`this.actions` array)
4. Export from `src/index.ts`
5. Add tests to `src/__tests__/provider.test.ts`
6. Document in `docs/AGENTKIT.md`

---

## MCP Server (`@inkd/mcp`)

Model Context Protocol server — connects Claude Desktop, Cursor, and other MCP-compatible
hosts to the Inkd Protocol. Uses stdio transport.
See `docs/MCP.md` for setup and usage.

### Setup

```bash
cd mcp
npm install
npm run build       # tsc → dist/
npm test            # vitest test suite (33 tests)
```

The compiled binary is `dist/server.js`. Users add it to their MCP host config:

```json
{
  "mcpServers": {
    "inkd": {
      "command": "node",
      "args": ["/path/to/inkd-protocol/mcp/dist/server.js"],
      "env": { "INKD_PRIVATE_KEY": "0x..." }
    }
  }
}
```

### The 5 Tools

| Tool | What it does |
|------|-------------|
| `create_project` | Register a project on-chain |
| `push_version` | Push a new version |
| `get_project` | Read project details |
| `get_versions` | List all versions for a project |
| `list_agents` | Discover registered agents |

### Adding a New Tool

1. Add the handler to `src/handlers.ts`
2. Register it with `server.tool(...)` in `src/server.ts`
3. Add tests to `src/__tests__/handlers.test.ts`
4. Document in `docs/MCP.md`

---

## REST API (`@inkd/api`)

Self-hostable HTTP API for teams that prefer REST over direct viem calls.
See `docs/API.md` for the endpoint reference. The OpenAPI spec lives at `api/openapi.yaml`.

### Setup

```bash
cd api
npm install
npm run build       # tsc → dist/
npm run dev         # tsx watch (hot-reload for local dev)
```

Required env vars:

```bash
INKD_PRIVATE_KEY=0x...        # Wallet key for write operations
INKD_NETWORK=testnet           # mainnet | testnet
INKD_API_KEY=secret            # API key for bearer auth (optional)
```

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/health` | public | Liveness check |
| `GET`  | `/v1/status` | public | Network + wallet info |
| `GET`  | `/v1/projects` | bearer | List all projects |
| `POST` | `/v1/projects` | bearer | Create a project |
| `GET`  | `/v1/projects/:id` | bearer | Get a project |
| `GET`  | `/v1/agents` | bearer | List all agents |
| `GET`  | `/v1/agents/:address` | bearer | Get an agent's projects |

### Self-hosting with Docker

```bash
docker build -t inkd-api .
docker run -p 3000:3000 \
  -e INKD_PRIVATE_KEY=0x... \
  -e INKD_NETWORK=mainnet \
  inkd-api
```

### Adding a New Route

1. Create or edit a file in `src/routes/`
2. Mount it in `src/index.ts`
3. Add the endpoint to `api/openapi.yaml`
4. Document in `docs/API.md`

---

## The Graph Subgraph

```bash
cd subgraph
npm install
graph codegen   # regenerate AssemblyScript types from schema
graph build     # compile
```

Deploy guide: `SUBGRAPH.md`

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
npm test

# CLI
cd ../cli
npm run typecheck
npm test

# AgentKit
cd ../agentkit
npm run typecheck
npm test

# MCP
cd ../mcp
npm run typecheck
npm test
```

Quick all-packages shortcut from the repo root:

```bash
make test   # if Makefile is present, otherwise run the above manually
```

### Running with coverage

```bash
cd sdk && npm test -- --coverage
cd cli && npm test -- --coverage
cd agentkit && npm test -- --coverage
```

### CI runs automatically on push:

1. `forge build --deny-warnings`
2. `forge test -vvv`
3. `forge snapshot --check`
4. Invariant test step
5. `tsc --noEmit` for `sdk`, `cli`, `agentkit`, `mcp`, `api`
6. `npm test` for `sdk`, `cli`, `agentkit`, `mcp`
7. All-checks gate

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
