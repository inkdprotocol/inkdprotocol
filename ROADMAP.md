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

Core protocol, tooling, and infrastructure.

| Item | Status |
|------|--------|
| Smart contracts (InkdToken, InkdRegistry, InkdTreasury) | ✅ |
| TypeScript SDK (`@inkd/sdk`) | ✅ |
| 42-test unit suite (vitest) | ✅ |
| Fuzz + invariant tests (Foundry) | ✅ |
| Security review (internal) | ✅ |
| The Graph subgraph (Base mainnet) | ✅ |
| Full documentation (contract, SDK, architecture, tokenomics) | ✅ |
| CI/CD pipeline (GitHub Actions) | ✅ |
| Deploy scripts + post-deploy playbook | ✅ |
| Twitter/X content strategy (23 posts queued) | ✅ |

---

## Phase 1 — Launch 📅 *Q1 2026*

Deploy to mainnet. Establish presence.

| Item | Status | Notes |
|------|--------|-------|
| External smart contract audit | 📅 | Pre-requisite for mainnet |
| Base mainnet deployment | 📅 | Pending audit |
| Contract addresses published | 📅 | Post-deploy |
| Subgraph deployed to The Graph | 📅 | After contracts live |
| `@inkd/sdk` published to npm | 📅 | Awaiting `NPM_TOKEN` |
| Website live at `inkdprotocol.xyz` | 📅 | Awaiting `VERCEL_TOKEN` |
| Twitter launch campaign | 📅 | 23 posts ready |
| First AI agent registered on-chain | 📅 | |

---

## Phase 2 — Ecosystem 📅 *Q2 2026*

Grow usage. Build community. Improve UX.

| Item | Status | Notes |
|------|--------|-------|
| **SDK v0.2** — event subscriptions, watch mode | 📅 | viem `watchEvent` wrappers |
| **SDK v0.2** — batch reads (multi-project fetch) | 📅 | Multicall3 integration |
| **CLI tool** (`npx inkd`) — create/push from terminal | 📅 | For devs and agents |
| **Arweave bundler integration** — push content + register in one call | 📅 | |
| **Project explorer** (web UI) — browse all registered projects | 📅 | On website |
| **Analytics dashboard** — protocol stats, volume, top projects | 📅 | Powered by subgraph |
| **Collaborator UX** — invite flow, permission display | 📅 | |
| **SDK Golang port** | 💡 | Community contributed? |
| **SDK Python port** | 💡 | For AI/ML ecosystem |

---

## Phase 3 — AI Agent Layer 📅 *Q3 2026*

Make Inkd the standard identity layer for AI agents.

| Item | Status | Notes |
|------|--------|-------|
| **Agent capability registry** — structured on-chain schema for agent tools | 📅 | JSON Schema → Arweave |
| **Agent discovery API** — REST endpoint wrapping subgraph queries | 📅 | `api.inkdprotocol.xyz` |
| **Agent verification** — stake $INKD to signal trust | 💡 | Slashable stake |
| **Agent composition** — declare dependencies between agents | 💡 | DAG on-chain |
| **OpenAI/Anthropic plugin manifest** — agents auto-discoverable by frontier LLMs | 💡 | |
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

*Last updated: 2026-03-02 | Phase 0 complete, Phase 1 in motion*
