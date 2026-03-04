# Changelog

All notable changes to the Inkd Protocol are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v0.10.9] — 2026-03-04

### Added
- **`InkdBuyback.sol`** — Automated $INKD buyback contract funded by USDC protocol revenue:
  - `deposit(uint256 amount)` — called by InkdTreasury after revenue split; accumulates USDC
  - `executeBuyback()` — permissionless trigger; swaps all USDC → $INKD via Uniswap V3 once threshold met
  - Auto-trigger on `receive()`: direct ETH triggers buyback check (graceful no-op if below threshold)
  - Default threshold: $50 USDC (50\_000\_000, 6 decimals); settable by owner
  - Direct USDC → $INKD Uniswap V3 swap via `exactInputSingle`; no WETH wrapping needed
  - SafeERC20 for all token transfers; owner-only emergency withdrawal of accumulated $INKD
  - `inkdToken = address(0)` until Clanker launch — `executeBuyback()` reverts cleanly if token unset
  - **18 tests** (`InkdBuyback.t.sol`): initialization, deposits, threshold logic, buyback execution,
    access control (non-owner reverts), edge cases (zero amounts, partial threshold)

### Changed
- **`InkdTreasury.sol`** — Upgraded to full X402 USDC revenue splitter with on-chain buyback notification:
  - New `settle(uint256 amount)` function — callable by `settler` (API server wallet) OR `InkdRegistry`
  - New `settler` state variable — trusted server address set by owner; enables X402 agent-pay flow
  - Payment split: $1 → `arweaveWallet`, $2 → `InkdBuyback.deposit()`, $2 → treasury (default $5 total)
  - InkdBuyback notification via `deposit()` after USDC transfer; `extcodesize` guard for graceful EOA fallback
  - `initialize()` 4th param renamed: `buybackWallet` → `buybackContract` (now calls `deposit()`)
  - **+6 tests** in `InkdTreasury.t.sol`: `settle()` happy path, settler access control, split math,
    graceful fallback when `buybackContract` is EOA
- **`@inkd/api` x402 middleware** — Upgraded from ETH micro-payments to USDC agent-native pricing:
  - Payment token: ETH → USDC (mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` /
    testnet: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
  - Payment amount: `$0.001 ETH` → **`$5.00 USDC`** per write (create project or push version)
  - `payTo`: random address → `cfg.treasuryAddress` (InkdTreasury contract receives USDC directly)
  - New `getPaymentAmount(req)` helper — extracts verified USDC amount from x402 payment header
  - After x402 verification, routes automatically call `treasury.settle(amount)` to trigger on-chain split
- **`api/src/config.ts`** — new `TREASURY_ADDRESS` env var; `x402Enabled` now requires `TREASURY_ADDRESS`
- **`api/src/abis.ts`** — added `settlementAbi` (InkdTreasury.settle ABI fragment)
- **`contracts/script/Deploy.s.sol`** — deploys InkdBuyback; wires Treasury via `setBuybackContract()`

### Tests
- **vault.ts branch coverage: 85.71% → 100%** (+4 tests); all uncovered branches now closed:
  - `sealRaw()` crafts ECIES blob with non-JSON plaintext to hit `JSON.parse` catch (L134–135)
  - Constructor `startsWith` ternary (L55) and `load()` `ArrayBuffer` ternary (L167)
  - SDK total: 344 → **348**

### Quality Gates
- Contracts: **255/255** ✅  SDK: **348/348** ✅  CLI: 352/352 ✅  AgentKit: 69/69 ✅  MCP: 33/33 ✅  API: **168/168** ✅
- **Total: 1,225 tests** (+22 since v0.10.8)

---

## [v0.10.8] — 2026-03-04

### Added
- **`AgentVault`** — ECIES wallet-key encrypted credential storage for AI agents (`sdk/src/vault.ts`):
  - `seal(credentials)` → encrypts any JSON object to a `Uint8Array` using the agent's EVM wallet public key
  - `unseal(encrypted)` → decrypts blob; throws typed `EncryptionError` on wrong key, corruption, or truncated data
  - `store(credentials, arweave)` → seal + upload to Arweave in one call; returns `ar://` hash
  - `load(arweaveHash, arweave)` → fetch from Arweave + unseal in one call
  - Encryption: ECIES (ephemeral ECDH secp256k1 + HKDF-SHA256 + AES-256-GCM); each seal is semantically secure (fresh ephemeral key + random IV)
  - **21 tests** covering constructor validation, roundtrips (simple/nested/empty/unicode), random IV non-determinism, blob length invariant, wrong-key rejection, AES-GCM tamper detection, too-short data, invalid ephemeral pubkey, Arweave store/load mocking, store/load full roundtrip, cross-vault isolation
  - vault.ts coverage: **98.88% stmts / 85.71% branch / 100% funcs / 98.88% lines** (uncovered: JSON.parse error path — only reachable with crafted non-JSON plaintext)
- **`docs/SDK_REFERENCE.md`** — AgentVault section (+~180 lines):
  - Encryption stack description and binary layout diagram
  - Method reference tables for constructor, seal, unseal, store, load
  - Full end-to-end example (store + load via InkdClient.arweave)
  - Cross-agent credential sharing pattern
  - Updated changelog table (0.1.0 → 0.10.8)
  - Updated Table of Contents with AgentVault sub-entries

### Quality Gates
- Contracts: 237/237 ✅  SDK: 344/344 ✅  CLI: 352/352 ✅  AgentKit: 69/69 ✅  MCP: 33/33 ✅  API: 168/168 ✅
- **Total: 1,203 tests** (+21 vault tests)

---

## [v0.10.7] — 2026-03-04

### Changed
- **`@inkd/api` coverage expansion** — 92 → 148 tests (+56):
  - `config.ts`: 11% → 100% (all `loadConfig()` branches, `getChain()`, `ADDRESSES` shape — 31 tests)
  - `x402.ts` middleware: 55% → 100% (mainnet/testnet selection, `HTTPFacilitatorClient`, `payTo`/`price` fields — +8 tests)
  - `rateLimit.ts` middleware: 81% → 100% stmts/funcs/lines (`'unknown'` IP fallback, `setInterval` cleanup via `vi.useFakeTimers()` — +2 tests)
  - Routes health: 503 + `contractsDeployed=false` branch tests (+15 tests)
- **USDC fee model** — `InkdTreasury` refactored from native-ETH to USDC-only fees with 50/50 auto-split buyback:
  - `InkdTreasury.initialize()` now takes 4 params: `(owner, usdc, arweaveWallet, buybackWallet)`
  - `InkdIntegration.t.sol` fully rewritten for USDC model
  - Contract test count: 238 → 237 (one test removed during refactor)

### Quality Gates
- Contracts: 237/237 ✅  SDK: 323/323 ✅  CLI: 352/352 ✅  AgentKit: 69/69 ✅  MCP: 33/33 ✅  API: 148/148 ✅
- **Total: 1,162 tests**

---

## [v0.10.6] — 2026-03-04

### Added
- **`@inkd/api` full test suite** — 0 → 92 tests across 7 test files:
  - All 5 project routes (list, get, create, versions list, version push)
  - All 3 agent routes (list, get-by-id, get-by-name)
  - Health/status routes (8 tests)
  - `authMiddleware` (9 tests: no-key passthrough, valid Bearer, invalid Bearer, x402 mode)
  - `rateLimitMiddleware` (6 tests: rate limit enforcement, per-IP isolation, headers)
  - x402 `getPayerAddress` (6 tests: happy path, invalid sig, malformed header)
  - All error classes + `sendError()` (16 tests: all error subclasses, JSON format, status codes)

### Quality Gates
- Contracts: 238/238 ✅  SDK: 323/323 ✅  CLI: 352/352 ✅  AgentKit: 69/69 ✅  MCP: 33/33 ✅  API: 92/92 ✅
- **Total: 1,107 tests**

---

## [v0.10.5] — 2026-03-04

### Added
- **`docs/AGENTKIT.md`** — 513-line comprehensive `@inkd/agentkit` integration guide:
  - Install, quick start, how x402 auth works
  - All 4 actions (`inkd_create_project`, `inkd_push_version`, `inkd_get_project`, `inkd_list_agents`) with full parameter tables and example prompts
  - x402 payment flow diagram, full working example, agent prompt patterns
  - Error handling table, troubleshooting guide
- **`CONTRIBUTING.md`** updated (+307 lines/-24):
  - Full project structure tree for all 6 packages
  - CLI/AgentKit/MCP/API setup + conventions sections
  - Per-package testing instructions, test count table
  - ToC expanded from 10 to 13 entries
- **`@inkd/agentkit` full test suite** — 0 → 69 tests, 100% coverage on `provider.ts`, `actions.ts`, `types.ts`:
  - All 4 actions tested: happy paths, error paths, Zod schema validation, `buildFetch` fallback, `walletAddress` fallback
- **`@inkd/mcp` edge-case tests** — 26 → 33 tests (+7):
  - `json().catch` fallback in `createProject`/`pushVersion` (non-JSON error body)
  - `description=''` and `undefined` → `'(none)'`
  - Empty list output in `getVersions`/`listAgents`
  - Unix timestamp → ISO date format in `getVersions`

### Quality Gates
- Contracts: 238/238 ✅  SDK: 323/323 ✅  CLI: 352/352 ✅  AgentKit: 69/69 ✅  MCP: 33/33 ✅
- **Total: 1,015 tests**

---

## [v0.10.4] — 2026-03-04

### Added
- **docs/HTTP_API.md** — 856-line complete REST API reference for `@inkd/api`:
  - All 10 endpoints documented (GET /v1/health, /v1/status, /v1/projects, /v1/projects/:id, POST /v1/projects, GET /v1/projects/:id/versions, POST /v1/projects/:id/versions, GET /v1/agents, /v1/agents/:id, /v1/agents/by-name/:name)
  - Request/response schemas with all fields, types, and constraints
  - x402 payment flow sequence diagram (wallet = identity)
  - Auth modes: x402 production vs Bearer token dev mode
  - Rate limiting, error codes table (400/401/402/404/429/500/502/503)
  - Environment variables reference
  - Vercel deployment guide
  - Code examples: curl, Python, TypeScript with `@x402/fetch`
  - Troubleshooting table (8 common issues)
  - Fills the gap between `docs/API.md` (SDK reference) and the actual `@inkd/api` HTTP server

### Quality Gates
- Contracts: 238/238 ✅  SDK: 323/323 ✅  CLI: 352/352 ✅  AgentKit: 69/69 ✅  MCP: 33/33 ✅
- **Total: 1,015 tests**

---

## [v0.10.3] — 2026-03-04

### Added
- **CLI test coverage** — two new branch-coverage describe blocks:
  - `config.test.ts`: `loadConfig()` invalid-JSON catch branch (corrupt `inkd.config.json` → `error()` → `process.exit(1)`)
  - `token.test.ts`: mainnet chain ternary (approve + transfer via `base` chain), `parseAddress` catch branch (invalid hex address)
  - CLI tests: **348 → 352** (+4)

### Changed
- **ROADMAP.md** sync to actual test counts:
  - Phase 0 CLI entry: 348 → 352
  - Phase 3 `@inkd/mcp` entry: 26 → 33 tests
  - Footer: 1,004 → 1,015 total tests

### Quality Gates
- Contracts: 238/238 ✅  SDK: 323/323 ✅  CLI: 352/352 ✅  AgentKit: 69/69 ✅  MCP: 33/33 ✅
- **Total: 1,015 tests**

---

## [v0.10.2] — 2026-03-04

### Changed
- **ROADMAP.md** — comprehensive sync to current state:
  - Phase 0 table updated with accurate test counts (323 SDK / 238 contracts / 348 CLI)
  - Added InkdTimelock.sol, InkdTestToken.sol, AUDIT_PREP.md, SUBGRAPH.md, SECURITY_REVIEW.md to Phase 0
  - Phase 2 SDK v0.2 items (event subscriptions, batch reads, LitEncryptionProvider) marked ✅
  - Phase 2 status updated from 📅 to 🔄
  - Footer updated: 312 → 909 tests

### Fixed
- **ROADMAP.md** stale footer "312 tests passing" → "909 tests passing (238 contracts / 323 SDK / 348 CLI)"
- **ROADMAP.md** Phase 0 stale counts: "153-test SDK suite" → 323, "159-test contract suite" → 238, "40+ CLI tests" → 348

---

## [v0.10.1] — 2026-03-03

### Added
- **InkdTimelock.sol** — 48-hour admin timelock for governance transitions; 41-test Foundry suite (constants, constructor, receive, setPendingAdmin, acceptAdmin, queueTransaction, cancelTransaction, executeTransaction, 3 integration flows). All edge cases: replay guard, grace period boundary, stale tx, execution failure, ETH forwarding, admin handover.
- **InkdTestToken.t.sol** — 27-test coverage for ERC-20, ERC-20Burnable, ERC-2612 Permit (domain separator, nonces, gasless approval, expired deadline, wrong signer reverts), 2 fuzz tests. InkdTestToken.sol: 100% all metrics.
- **SUBGRAPH.md** — 531-line The Graph integration guide: full GraphQL schema, AssemblyScript mapping stubs for all 10 InkdRegistry events, example queries, SDK hybrid pattern, subgraph.yaml, local dev workflow.
- **AUDIT_PREP.md** — 342-line external auditor guide: scope, trust model, 10 focus areas, 7 known design decisions, forge commands.
- **SDK v0.2** — event subscriptions (`watchProjectCreated`, `watchVersionPushed`, `watchRegistryEvents`) and batch reads via Multicall3 (`batchGetProjects`, `batchGetVersions`, `batchGetFees`, `batchGetProjectsWithVersions`). Full 100% branch coverage.
- **DOCS rewrite** — API.md and QUICKSTART.md rewritten to match current protocol (removed stale NFT/inscription/AgentMemory references; CLI-first onboarding flow).
- **SDK_REFERENCE.md** updated — full module docs for events.ts, multicall.ts, encryption.ts.
- **CONTRACT_REFERENCE.md** — InkdTimelock fully documented.
- **Deploy.s.sol** / **Verify.s.sol** / **POST_DEPLOY.md** — updated for 6-contract deployment including InkdTimelock.
- **SECURITY_REVIEW.md** — InkdTimelock analysis (LOW-3, INFO-6), access control table extended, verdict: ready for external audit.

### Improved
- SDK: 100%/100%/100%/100% stmts/branches/funcs/lines across all 11 files.
- CLI: 99%+ stmts, 97%+ branches across all command modules.
- CI: Split into `test-sdk` + `test-cli` jobs. `.gitignore` now blocks workspace files from being committed.
- **Total tests: 909** (238 contracts / 323 SDK / 348 CLI), all green.

---

## [v0.10.0] — 2026-03-02

### Added
- **`inkd token` CLI command** — Full $INKD token management from the terminal:
  - `inkd token balance [address]` — Shows INKD + ETH balance for any address (defaults to own wallet via `INKD_PRIVATE_KEY`)
  - `inkd token allowance [address]` — Checks how much INKD the registry is approved to spend; warns when below 1 INKD required for project creation
  - `inkd token approve <amount>` — Approves the registry to spend N INKD; waits for confirmation + prints block number
  - `inkd token transfer <to> <amount>` — Transfers INKD to any address with receipt confirmation
  - `inkd token info` — Displays token name, symbol, decimals, and total supply
  - All sub-commands support `--json` flag for scripting / log pipelines
- **Extended `TOKEN_ABI`** in `cli/src/abi.ts` — Added `transfer`, `name`, `symbol`, `decimals` to the shared ABI (was previously missing, limited scripting options)

---

## [v0.9.0] — 2026-03-02

### Added
- **Makefile** — root-level developer convenience targets: `make install`, `make build`,
  `make test`, `make test-fuzz`, `make test-invariant`, `make coverage`, `make snapshot`,
  `make lint`, `make typecheck`, `make fmt`, `make check`, `make ci`, `make deploy-dry`,
  `make deploy-base`, `make anvil`. Full help via `make help`.
- **GitHub Issue Templates** — structured YAML forms for bug reports and feature requests,
  with component dropdowns, environment fields, checklists, and a `config.yml` routing
  security issues and support questions to the right channels.
- **CODE_OF_CONDUCT.md** — Contributor Covenant 2.1 extended with agent-specific guidelines
  covering transparency requirements, protocol interaction rules, and enforcement ladder.

### Improved
- Developer experience: single `make ci` command replicates the full CI pipeline locally
  (fmt-check → build → test → gas snapshot → typecheck).

---
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Mainnet deployment (Base) — pending external audit
- Website launch at inkdprotocol.xyz — awaiting `VERCEL_TOKEN` secret
- SDK publish to npm (`@inkd/sdk`) — awaiting `NPM_TOKEN` secret
- CLI publish to npm (`@inkd/cli`) — awaiting `NPM_TOKEN` secret
- External smart contract audit

---

## [0.9.0] — 2026-03-02

### Added
- **`inkd watch`** — real-time on-chain event streaming for the registry
  - Filter modes: `all | projects | versions | agents`
  - Flags: `--poll <ms>` (default 3000), `--from <block>`, `--json`
  - Color-coded terminal output with block numbers and timestamps
  - `--json` flag for `jq`-compatible newline-delimited output
- **`inkd search`** — project search by name/description
  - Case-insensitive substring match across all registered projects
  - `--agents` flag to restrict to agent projects only
  - `--limit <n>` (default 20, max 100)
  - `--json` for machine-readable output
  - Parallel batched reads (20 at a time) for speed
  - Inline match highlighting in terminal output
- **`examples/`** directory with two integration scripts:
  - `register-agent.ts` — end-to-end agent registration with approval flow
  - `watch-events.ts` — standalone event monitor with JSON mode
  - `README.md` — complete usage guide with env vars and CLI equivalents
- **`.github/workflows/cli-release.yml`** — tag-triggered CLI publish workflow
  - Trigger: push `cli-v*` tag (e.g., `git tag cli-v0.1.0 && git push --tags`)
  - TypeChecks → builds → bumps version → publishes `@inkd/cli` to npm
  - Auto-creates GitHub Release with install instructions

### Improved
- CLI help text updated with `search` and `watch` command reference + examples

---

## [0.8.0] — 2026-03-02

### Added
- **`cli/`** — `@inkd/cli` npm package: full-featured `npx inkd` CLI tool
  - `inkd init [--mainnet] [--force]` — scaffold `inkd.config.json`
  - `inkd status` — show network, contract addresses, live fees from on-chain
  - `inkd project create` — register a project with token approval auto-handled
  - `inkd project get <id>` — fetch project details + collaborators
  - `inkd project list <address>` — list all projects owned by address
  - `inkd project transfer --id --to` — transfer ownership with fee
  - `inkd project collab add|remove --id --address` — collaborator management
  - `inkd version push --id --hash --tag [--changelog]` — push new version
  - `inkd version list <id>` — list all versions (newest first)
  - `inkd version show --id --index` — show specific version details
  - `inkd agent list [--offset --limit]` — paginated agent directory
  - `inkd agent lookup <name>` — find agent by name (linear scan)
  - Full ANSI colour output with `NO_COLOR` support
  - `INKD_PRIVATE_KEY` / `INKD_NETWORK` / `INKD_RPC_URL` / `INKD_DEBUG` env vars
  - `cli/README.md` with complete command reference
- **`cli` workspace** added to root `package.json`
- **CI `cli` job** — type check + build in GitHub Actions; added to `all-checks` gate

---

## [0.7.0] — 2026-03-02

### Added
- **`SECURITY.md`** — full security disclosure policy with scope, SLA table, bug bounty tiers
  (Critical 1–5 ETH, High 0.5–1 ETH, Medium 0.1–0.5 ETH), known limitations, audit history,
  and hall of fame. Email: `security@inkdprotocol.xyz`
- **`sdk/README.md`** — complete npm-ready SDK documentation with install instructions,
  Quick Start, full API reference table, error handling guide, React hooks section,
  AI agent usage examples, network addresses table, and badges (npm, CI, license, Base)
- **`sdk/eslint.config.js`** — ESLint flat config for TypeScript:
  `@typescript-eslint/no-floating-promises`, `await-thenable`, `no-misused-promises`,
  `consistent-type-imports`; lenient test overrides; `dist/` + `coverage/` ignored
- **`.github/dependabot.yml`** — automated dependency updates for GitHub Actions (weekly),
  SDK npm deps (weekly, grouped dev-deps), root npm deps; viem major pinned manually
- **`ROADMAP.md`** — public-facing 4-phase roadmap: Phase 0 (Foundation ✅), Phase 1 (Launch Q1),
  Phase 2 (Ecosystem Q2), Phase 3 (AI Agent Layer Q3), Phase 4 (Protocol Evolution TBD);
  includes explicit non-goals section

---

## [0.6.0] — 2026-03-02

### Added
- **SDK test suite** (`sdk/src/__tests__/`):
  - `errors.test.ts` — 14 tests covering all 11 custom error classes (message content, codes, names,
    inheritance chain, bigint fields)
  - `InkdClient.test.ts` — 17 tests: connection guard enforcement (`ClientNotConnected`,
    `ArweaveNotConnected`), `mintToken` flow with log parsing, `getToken` parallel reads,
    `hasInkdToken`, `getStats` tuple mapping, `estimateInscribeCost` scaling,
    `setEncryptionProvider`, custom mock clients
  - `types.test.ts` — 4 tests: `ContentType` enum values, MIME string format, count
  - `encryption.test.ts` — 7 tests: passthrough round-trip, empty/large payloads, JSON payload,
    multi-token isolation
  - **Total: 42 tests, all passing**
- **Vitest** added to SDK dev dependencies with `vitest.config.ts` (coverage thresholds configured)
- **`sdk/package.json`** improvements:
  - `test`, `test:watch`, `test:coverage` scripts
  - `prepublishOnly` hook (`typecheck → test → build`)
  - `exports` map with ESM + CJS + types entries
  - `keywords`, `author`, `repository`, `homepage`, `bugs` fields
  - `module` field for ESM consumers
- **Release workflow** (`.github/workflows/release.yml`):
  - Triggered by `v*.*.*` tags
  - Validates contracts (build + unit + invariant) + SDK (tests + typecheck + build)
  - Creates GitHub Release with changelog excerpt, pre-release detection for `-beta`/`-rc` tags
  - Publishes `@inkd/sdk` to npm with provenance attestation
  - Requires `NPM_TOKEN` secret in `npm-publish` environment
- **`sdk/.npmignore`** — excludes `src/`, `__tests__/`, `vitest.config.ts`, coverage from publish
- **CI updated** — `sdk` job now runs `npm test` between typecheck and build

---

## [0.5.0] — 2026-03-02

### Added
- **The Graph subgraph** (`subgraph/`):
  - `schema.graphql` — 7 entities: `Project`, `Version`, `Collaborator`,
    `ProjectTransfer`, `ProtocolStats`, `TreasuryEvent`, `Account`
  - `subgraph.yaml` — Manifest for Base mainnet; handles all 10 InkdRegistry
    events + 3 InkdTreasury events
  - `src/registry.ts` — AssemblyScript handlers for every InkdRegistry event:
    project creation, version pushes, collaborator management, ownership transfers,
    visibility changes, fee updates, README updates, agent registration
  - `src/treasury.ts` — AssemblyScript handlers for deposit/withdraw/receive
  - `src/utils.ts` — Shared helpers: stats singleton loader, ID builders
  - `abis/InkdRegistry.json` + `abis/InkdTreasury.json` — ABI fragments for events
  - `SUBGRAPH.md` — Full deploy guide + 8 example GraphQL queries
  - `package.json` — `@graphprotocol/graph-cli` + `graph-ts` dependencies

---

## [0.4.0] — 2026-03-02

### Added
- **Fuzz tests** (`InkdFuzz.t.sol`): 12 property-based tests covering token transfers,
  burn supply accounting, fee validation, ETH forwarding, token lock invariants, and
  project count monotonicity.
- **Invariant tests** (`InkdInvariant.t.sol`): 6 protocol-level invariants enforced
  across arbitrary action sequences via `InkdHandler`:
  - `totalSupply` never increases
  - Registry never holds ETH
  - Locked tokens == `projectCount × TOKEN_LOCK_AMOUNT`
  - `projectCount` matches ghost counter
  - `versionFee` always within `MAX_VERSION_FEE`
  - `transferFee` always within `MAX_TRANSFER_FEE`
- **CI: Gas snapshot** — `forge snapshot` runs on every push to `main`; PRs fail if
  gas increases >5% beyond the stored baseline.
- **CI: Invariant job** — Separate step explicitly runs `InkdInvariantTest` with verbose output.
- **CI: All-checks gate** — A summary job `all-checks` ensures PRs can only merge when
  both `contracts` and `sdk` jobs pass.

---

## [0.3.0] — 2026-03-02

### Added
- **Documentation suite** (`docs/`):
  - `README.md` — Full doc index + FAQ
  - `CONTRACT_REFERENCE.md` — Complete Solidity reference (InkdToken, InkdRegistry,
    InkdTreasury) with all functions, params, reverts, events, errors, constants
  - `SDK_REFERENCE.md` — TypeScript SDK with all methods, types, errors, React hooks,
    full code examples

---

## [0.2.0] — 2026-03-02

### Added
- **Deploy scripts**: `DryRun.s.sol`, `Verify.s.sol`
- **`.env.example`** — All required environment variables documented
- **`POST_DEPLOY.md`** — Step-by-step post-deployment checklist
- **`SECURITY_REVIEW.md`** — Manual audit report (0 critical, 0 high findings;
  mainnet-ready verdict)
- **TypeScript SDK** (`sdk/`):
  - `InkdClient.ts` — Main client (connect, createProject, pushVersion, transfer)
  - `ArweaveClient.ts` — Arweave upload/fetch wrapper
  - `encryption.ts` — Pluggable encryption provider interface
  - `hooks/` — React hooks (useInkd, useProject, useProjects, useVersions)
  - `abi.ts`, `types.ts`, `errors.ts`, `index.ts`

---

## [0.1.0] — 2026-03-02

### Added
- **`InkdToken.sol`** — ERC-20 ($INKD), 1B supply, burnable, EIP-2612 permit
- **`InkdRegistry.sol`** — UUPS-upgradeable project registry:
  - Lock 1 $INKD to create a named project
  - Push versioned file hashes (Arweave) with variable ETH fee
  - Collaborator management (add/remove)
  - Project transfer with transfer fee
  - Agent project registry with endpoint storage
  - Case-insensitive name deduplication
- **`InkdTreasury.sol`** — UUPS-upgradeable ETH fee collector:
  - Only accepts deposits from registry
  - Owner-controlled withdrawal
- **Unit tests** (`InkdToken.t.sol`, `InkdRegistry.t.sol`, `InkdTreasury.t.sol`):
  - 80+ test cases covering all functions, edge cases, access control, and fee mechanics
- **Foundry project setup** (`foundry.toml`, submodules: OpenZeppelin, forge-std)
- **GitHub Actions CI** — Build, test, warning check, SDK type-check + build
- **`ARCHITECTURE.md`** — System overview, contract interactions, upgrade patterns
- **`WHITEPAPER.md`** — Protocol vision and tokenomics

---

[Unreleased]: https://github.com/inkdprotocol/inkd-protocol/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/inkdprotocol/inkd-protocol/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/inkdprotocol/inkd-protocol/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/inkdprotocol/inkd-protocol/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/inkdprotocol/inkd-protocol/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/inkdprotocol/inkd-protocol/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/inkdprotocol/inkd-protocol/releases/tag/v0.1.0
