# Changelog

All notable changes to the Inkd Protocol are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Mainnet deployment (Base)
- Website launch at inkdprotocol.xyz
- SDK publish to npm (`@inkd/sdk`) — awaiting `NPM_TOKEN` secret
- Vercel deployment for frontend — awaiting `VERCEL_TOKEN` secret

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
