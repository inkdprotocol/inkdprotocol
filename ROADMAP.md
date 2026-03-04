# Inkd Protocol Roadmap

> Every file is a token. Every wallet is a brain.

This document tracks where Inkd is going. It's a living document — updated as we learn from the community and shipping realities.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔄 | In Progress |
| 📅 | Planned |
| 💡 | Considering |

---

## Phase 0 — Foundation ✅ *Complete*

Core protocol, tooling, and infrastructure — fully shipped.

| Item | Status |
|------|--------|
| Smart contracts (InkdToken, InkdRegistry, InkdTreasury) | ✅ |
| **InkdTimelock.sol** — 48h admin timelock for governance transitions | ✅ |
| **InkdTestToken.sol** — ERC-20 + ERC-2612 permit token for testing | ✅ |
| TypeScript SDK (`@inkd/sdk`) — InkdClient, ArweaveClient, encryption | ✅ |
| **323-test SDK suite** (vitest) — unit, integration, advanced, error, encryption, ProjectRegistry, multicall, events — **100% stmts/branches/funcs/lines** | ✅ |
| **238-test contract suite** (Foundry) — unit, fuzz, invariant, UUPS upgrade, timelock, test token | ✅ |
| Fuzz tests (13) + Invariant tests (6) | ✅ |
| **348-test CLI suite** (vitest) — all commands covered, 99%+ stmts | ✅ |
| Security review (internal) — re-entrancy, access control, upgrade safety, timelock | ✅ |
| **AUDIT_PREP.md** — 342-line auditor guide (scope, trust model, focus areas, known decisions) | ✅ |
| **SECURITY_REVIEW.md** — updated with InkdTimelock analysis (LOW-3, INFO-6) | ✅ |
| The Graph subgraph definition (Base mainnet + Sepolia) | ✅ |
| **SUBGRAPH.md** — 531-line The Graph integration guide with full GraphQL schema + AssemblyScript stubs | ✅ |
| Full documentation — contract, SDK, architecture, tokenomics, whitepaper | ✅ |
| **Technical Whitepaper PDF** (`docs/whitepaper.pdf`, A4, 430KB) | ✅ |
| CI/CD pipeline (GitHub Actions) — split test-sdk + test-cli jobs | ✅ |
| Deploy scripts + post-deploy playbook | ✅ |
| **Deploy.s.sol** deploys all 6 contracts including InkdTimelock | ✅ |
| **CLI tool** (`inkd`) — create, push, list, search, watch, token, agent, agentd | ✅ |
| Twitter/X content strategy (26 posts queued) | ✅ |
| AI agent examples (autonomous, OpenAI, LangChain, multi-agent) | ✅ |
| Makefile — `make test`, `make ci`, `make deploy-dry`, 15+ targets | ✅ |
| Base Sepolia E2E integration test script | ✅ |

---

## Phase 1 — Launch 🔄 *Q1 2026*

Deploy to mainnet. Establish presence.

| Item | Status | Notes |
|------|--------|-------|
| External smart contract audit | 📅 | Pre-requisite for mainnet; AUDIT_PREP.md ready |
| Base mainnet deployment | 📅 | Needs ~$15 ETH on deployer + `BASESCAN_API_KEY` |
| Contract addresses published | 📅 | Post-deploy |
| Subgraph deployed to The Graph Studio | 📅 | After contracts live |
| `@inkd/sdk` published to npm | 📅 | Needs `NPM_TOKEN` |
| `@inkd/cli` published to npm | 📅 | Needs `NPM_TOKEN` |
| Website live at `inkdprotocol.xyz` | 🔄 | Running at `inkd-protocol.vercel.app` — needs custom domain DNS |
| Discord community launched | 📅 | Setup guide ready in `docs/DISCORD_SETUP.md` |
| Twitter launch campaign | 📅 | 26 posts ready in `docs/twitter-queue.md` |
| Base Sepolia E2E test (live network) | 📅 | Script ready; needs `DEPLOYER_PRIVATE_KEY` + `BASE_SEPOLIA_RPC` |
| First AI agent registered on-chain | 📅 | Post-deploy |

---

## Phase 2 — Ecosystem 🔄 *Q2 2026*

Grow usage. Build community. Improve UX.

| Item | Status | Notes |
|------|--------|-------|
| **SDK v0.2** — event subscriptions, watch mode | ✅ | viem `watchEvent` wrappers — `watchProjectCreated`, `watchVersionPushed`, `watchRegistryEvents` |
| **SDK v0.2** — batch reads (multi-project fetch) | ✅ | Multicall3 — `batchGetProjects`, `batchGetVersions`, `batchGetFees`, `batchGetProjectsWithVersions` |
| **LitEncryptionProvider** — Lit Protocol stub (v2 slot) | ✅ | Interface ready; full Lit integration pending |
| **Arweave bundler integration** — push content + register in one call | 📅 | |
| **Project explorer** (web UI) — browse all registered projects | 📅 | On website |
| **Analytics dashboard** — protocol stats, volume, top projects | 📅 | Powered by subgraph |
| **Collaborator UX** — invite flow, permission display | 📅 | |
| **SDK Golang port** | 💡 | Community contributed? |
| **SDK Python port** | 💡 | For AI/ML ecosystem |

---

## Phase 3 — AI Agent Layer 🔄 *Q2-Q3 2026*

Make inkd the standard code registry for AI agents. x402 + ERC-8004 + inkd = full stack.

| Item | Status | Notes |
|------|--------|-------|
| **x402 Payment Layer** — `@inkd/api` protected by x402, wallet = identity | ✅ | `api/src/middleware/x402.ts` — $0.001/request |
| **`@inkd/agentkit`** — Coinbase AgentKit action provider | ✅ | 69 tests; inkd_create_project, inkd_push_version, inkd_list_agents, inkd_get_project |
| **`@inkd/mcp`** — Model Context Protocol server | ✅ | 26 tests; Claude Desktop + Cursor native integration |
| **ERC-8004 Integration Guide** — inkd as canonical code layer for ERC-8004 agents | ✅ | `docs/ERC8004.md` |
| **Clanker Launch Script** — $INKD token on Base via Clanker V4 | ✅ | `scripts/clanker-launch.ts` |
| **x402 Bazaar listing** — get inkd discovered by all x402-aware agents | 📅 | Submit to x402.org/ecosystem |
| **ERC-8004 forum outreach** — reach out to Erik Reppel (x402 + ERC-8004 Coinbase lead) | 📅 | ethereum-magicians.org |
| **Agent capability registry** — structured on-chain schema for agent tools | 📅 | JSON Schema → Arweave |
| **Agent discovery API** — REST endpoint wrapping subgraph queries | 📅 | |
| **Agent verification** — stake $INKD to signal trust | 💡 | Slashable stake |
| **Agent composition** — declare dependencies between agents | 💡 | DAG on-chain |
| **Agent marketplace** — browse, hire, and pay agents with $INKD | 💡 | Long-term vision |

---

## Phase 4 — Protocol Evolution 💡 *TBD*

Governed by the community (if token governance is enabled).

| Item | Notes |
|------|-------|
| **Fee governance** — $INKD holders vote on fee parameters | Requires DAO tooling |
| **Multi-chain expansion** — Optimism, Arbitrum, Polygon | Bridge $INKD |
| **L3 / app-chain** — dedicated Inkd chain for zero-cost version pushes | Long-term |
| **Private projects** — encrypted content, access-controlled versions | Lit Protocol / EAS |
| **Token-gated downloads** — pay-per-download or subscription | |

---

## What We're NOT Building

To keep Inkd focused:

- ❌ **Code hosting** — we're not GitHub. We store hashes, not code.
- ❌ **Build systems** — not CI/CD. We register artifacts, not pipelines.
- ❌ **Package execution** — not a runtime. We register, you run.
- ❌ **Social features** — no likes, follows, or comments. Keep it minimal.

---

## Feedback

Got ideas? Open an issue: [github.com/inkdprotocol/inkd-protocol/issues](https://github.com/inkdprotocol/inkd-protocol/issues)

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

*Last updated: 2026-03-04 04:40 | 1004 tests passing (238 contracts / 323 SDK / 348 CLI / 69 agentkit / 26 mcp) — x402 layer live, AgentKit + MCP providers shipped, ERC-8004 integration guide published*
