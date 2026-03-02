# Changelog

All notable changes to the Inkd Protocol are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
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
