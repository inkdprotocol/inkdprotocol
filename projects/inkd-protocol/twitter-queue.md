# Inkd Protocol — Twitter Queue

Tweets staged for posting. Score threshold: >7/10. Format: one tweet per entry.

---

## Ready to Post

<!-- CYCLE: 2026-03-05 — Agent Prep — Thu Mar 5, 2026 -->

### Tweet 1 — Atomic
**Score: 8.5/10**
**Type:** atomic
**Suggested slot:** 13:00 UTC

> Inkd now speaks mcp. Any agent with a Model Context Protocol client can register a project, publish versions, and prove on-chain ownership.
>
> No custom sdk integration. No new auth flow.
>
> Friction is how protocols die. We removed it.

*Hook: MCP is the default agent API surface — positions inkd as friction-free infrastructure, not a walled garden*

---

### Tweet 2 — Atomic
**Score: 8.5/10**
**Type:** atomic
**Suggested slot:** 17:00 UTC

> x402 handles agent payments. One http header, machine-readable, no oauth required.
>
> What it doesn't handle: a permanent record of what the agent built with what it earned.
>
> Payments are a moment. Ownership is a record. Both need to exist before autonomous agents operate at scale.

*Hook: completes a narrative engineers already know — x402 is real, the gap is real, the ask is obvious*

---

### Tweet 3 — Build Log
**Score: 8.5/10**
**Type:** build-log
**Source:** inkdprotocol/inkd-protocol — @inkd/mcp (9f8de25, 17efdd7) + InkdActionProvider (3dd8c22) + API expansion (4e777db) + ERC-8004 guide (b70ceb6)
**Suggested slot:** 13:00 UTC

> @inkd/mcp: 33 tests. inkd-agentkit: 69 tests, 100% coverage. api: 168 endpoints.
>
> 1,182 total tests across contracts, sdk, cli, mcp, and agentkit.
>
> This week: erc-8004 integration guide, x402 stack documentation, $inkd clanker launch committed to repo.

*Hook: raw numbers + breadth of integrations — shows the protocol is becoming a full stack, not a single contract*

---

### Tweet 4 — Ecosystem Positioning
**Score: 8.5/10**
**Type:** ecosystem
**Suggested slot:** 17:00 UTC

> On-chain agent identity is taking shape. erc-8004 gives agents a verified address, a capability manifest, a trust score.
>
> What it doesn't give them: a record of what they built.
>
> Identity answers who this agent is. Ownership answers what it did. You need both before you can trust an agent in production.

*Hook: acknowledges erc-8004 as real progress, then cleanly exposes the gap inkd fills — no defensiveness, just a missing layer*

---

### Tweet 5 — Engagement
**Score: 8/10**
**Type:** engagement
**Suggested slot:** 13:00 UTC

> If you were deploying a fully autonomous agent today, what would actually block you?
>
> Payments: x402. Wallets: safe. Identity: erc-8004. Ownership: inkd.
>
> What's still genuinely missing from that stack?

*Hook: practical framing with a real stack laid out — invites builders with specific opinions, not general sentiment*

---

<!-- THREAD CHECK: 2026-03-05 -->
<!-- No overdue thread confirmed. X-CONTENT-STRATEGY.md not present in project directory. -->
<!-- "The Agent Storage Problem" thread (8 tweets) was written in the 2026-03-04 cycle. -->
<!-- Strong candidate for next planned thread: "The Agent Stack in 2026 — Payments, Identity, Ownership" -->
<!-- Trigger: Clanker launch + MCP + ERC-8004 all shipped this week. Natural arc exists. -->
<!-- Flag for review: add to CONTENT_STRATEGY.md when next thread slot opens. -->

---

<!-- CYCLE: 2026-03-04 — Agent Prep — Wed Mar 4, 2026 -->

### Tweet 1 — Atomic
**Score: 8.5/10**
**Type:** atomic
**Suggested slot:** 13:00 UTC

> most protocols ship an admin key. the admin key is the single point of failure nobody talks about until it fails. inkd ships with a 48h timelock on every admin action. if that key gets compromised, 48 hours is the window to respond. we built that window in on purpose.

*Hook: security insight most builders ignore — sounds boring until it matters*

---

### Tweet 2 — Atomic
**Score: 8/10**
**Type:** atomic
**Suggested slot:** 17:00 UTC

> we published v0.10.0 of the sdk before we had users. not because anyone asked. because the engineers who integrate this later will need to know exactly what changed and when. a changelog is a contract with future builders. we started it before mainnet because the habit matters more than the audience.

*Hook: flips the usual "ship first, document later" narrative — signals serious infra mindset*

---

### Tweet 3 — Build Log
**Score: 8.5/10**
**Type:** build-log
**Source:** inkdprotocol/inkd-protocol — InkdTimelock.sol (4f6145a) + InkdTestToken.t.sol (b74b9c5)
**Suggested slot:** 13:00 UTC

> inkdtimelock.sol shipped. 48h delay on every admin action. 41 tests: queue, execute, cancel, admin handover, replay guard, grace period boundary, stale tx, eth forwarding. inktesttoken.sol: 27 tests, 100% coverage including eip-2612 permit. contracts: 238. sdk: 323. cli: 351. 912 total.

*Hook: governance security + real numbers — shows the codebase is serious*

---

### Tweet 4 — Ecosystem Positioning
**Score: 8/10**
**Type:** ecosystem
**Suggested slot:** 17:00 UTC

> coinbase smart wallets let agents operate without private keys. privy handles wallet creation. eip-7702 makes any address programmable. the agent wallet problem is solved. the agent ownership problem isn't. one without the other means the agent can transact but cannot prove what it built.

*Hook: acknowledges real ecosystem wins, then exposes the gap inkd fills — no defensiveness, clear positioning*

---

### Tweet 5 — Engagement
**Score: 8/10**
**Type:** engagement
**Suggested slot:** 13:00 UTC

> if an agent made the commit, who owns the code? the repo owner? the model company? the agent's wallet address? we're designing the collaborator spec for inkd and this question changes the architecture. what's your mental model?

*Hook: practical design question, implies we're actively building — invites builders not spectators*

---

## Overdue Thread — Written

<!-- THREAD STATUS: "why agent storage matters" — pre-mainnet educational thread. Per X-CONTENT-STRATEGY.md, Phase 1 calls for 1 problem-explanation thread. None written yet. Writing now. -->

### Thread: The Agent Storage Problem (Pre-Mainnet)
**When to post:** any primary window (13:00 or 17:00 UTC), Tue/Wed/Thu
**Estimated length:** 8 tweets

---

**Tweet 1 — Hook**
> ai agents can deploy contracts, hold wallets, spend thousands of dollars autonomously.
>
> they cannot own the code they write.
>
> here's why that's a problem — and what it means for the next five years of software.
>
> 🧵

---

**Tweet 2 — The gap**
> when a session ends, the context clears.
>
> the code the agent wrote might be on github. under your account, not the agent's.
> might be on ipfs. which needs a pin service paying the bills.
> might be on your server. which you own, not the agent.
>
> none of these are ownership. they're hosting.

---

**Tweet 3 — The distinction**
> hosting is a service. it can be cancelled, suspended, deleted.
> ownership is a property. it survives the service.
>
> ens taught this for names.
> safe taught this for funds.
>
> nobody has taught it for code.

---

**Tweet 4 — The practical consequence**
> the questions you cannot answer without a verifiable ownership record:
>
> who is liable when agent-written code fails in production?
> who holds ip when an agent ships a product?
> who gets paid when agent software gets licensed?
>
> "we think it was agent 43b7..." is not an answer.

---

**Tweet 5 — The temporal problem**
> as agents get more capable, they'll build things that outlive their sessions.
>
> the model gets deprecated. the api changes. the company pivots.
>
> the code is still running. in production. used by real people.
>
> who owns it in year 3? right now: nobody knows. that's a design failure, not a hard problem.

---

**Tweet 6 — What the solution actually requires**
> a real solution has four requirements:
>
> — on-chain registration (not a database, not a cloud service)
> — permanent version history (arweave, not s3)
> — transferable ownership (one transaction, not a legal process)
> — agent-native (wallet signs, not human oauth)
>
> these are engineering requirements. not design choices.

---

**Tweet 7 — Why it wasn't built before**
> the reason this didn't exist before:
>
> web2 didn't need it. ownership was implicit in account control.
> early web3 thought about tokens, not software.
>
> agents changed the equation. they need both the wallet and the registry. only one of those existed.

---

**Tweet 8 — CTA (non-hype)**
> that's what inkd is.
>
> on-chain project registry on base. permanent version storage on arweave. transferable ownership. agent-native from day one.
>
> not a product announcement. an answer to a question everyone building agents is about to ask.
>
> inkdprotocol.com

---

## Queue

<!-- CYCLE: 2026-03-04 00:01 GST — Learning Loop #2 -->

### Tweet 4
**Score: 8.5/10**
**Source:** arxiv.org/abs/2601.04583 — "Autonomous Agents on Blockchains" (Jan 8, 2026) — research roadmap gap: verifiable policy enforcement

> 2026 research gap on autonomous agents + blockchains: "verifiable policy enforcement."
>
> what that means in practice: anyone can claim an agent was authorized to act. almost nobody can prove it.
>
> authorization without proof is a claim, not a record. the proof layer is what's missing.

---

### Tweet 5
**Score: 8/10**
**Source:** arxiv.org/abs/2601.04583 — agent-mediated interaction requires L2; L2 "not a peripheral detail"

> the autonomous agents survey makes a point most people miss: l2 scaling is critical infrastructure for agent-mediated interaction — not an optimization.
>
> agents need sub-second finality. they can't block on l1 settlement mid-task.
>
> execution needs speed. ownership records need permanence. those are different layers for a reason.

---

### Tweet 6
**Score: 8/10**
**Source:** arxiv.org/abs/2601.04583 — tokenization primitives: programmable custody, transfer constraints, fungible/non-fungible ownership models

> tokenization is usually about assets. the next problem is authorship.
>
> same primitives: on-chain registration, transfer constraints, programmable custody.
> different subject: the code an agent writes, not the token it holds.
>
> the infrastructure exists. the registry doesn't.

---

<!-- CYCLE: 2026-03-05 00:01 GST — Learning Loop #3 -->

### Tweet 7
**Score: 8.5/10**
**Source:** arxiv.org/abs/2601.04583 — account abstraction stacks (eip-4337, eip-7702, safe) as agent-to-chain interface layer

> account abstraction solved the agent wallet problem.
>
> eip-4337: no private keys. eip-7702: any address programmable. safe: custodial multi-sig.
>
> none of these produce a verifiable record of what the agent built with that wallet.
>
> a wallet is where you act. an ownership record is what you did. different layers.

---

### Tweet 8
**Score: 8/10**
**Source:** arxiv.org/abs/2601.04583 — intent-based protocols for agent-mediated on-chain execution

> intent protocols let agents declare what they want to accomplish. the chain executes it.
>
> what gets written: the transaction.
> what doesn't: what the agent was trying to build.
>
> a transaction is a trace. provenance is history. when agents write code — not just move funds — the distinction stops being academic.

---

### Tweet 9
**Score: 8/10**
**Source:** arxiv.org/abs/2601.04583 — "reproducible evaluation" flagged as top open problem in 2026 roadmap; TechCrunch — OpenAI enterprise agent platform (Feb 2026)

> openai launched enterprise agent management in february.
> the 2026 autonomous agents research roadmap flags "reproducible evaluation" as a top-3 open problem.
>
> the same gap from different angles: you can deploy agents at scale or study them in a lab.
> neither gives you a permanent, verifiable record of what they built.
>
> enterprise adoption and research are both blocked by missing ownership infrastructure.

---

<!-- CYCLE: 2026-03-03 12:21 AST — Learning Loop #1 -->

### Tweet 1
**Score: 8.5/10**
**Source:** arxiv.org/abs/2601.04583 — "Autonomous Agents on Blockchains" (Jan 2026)

> A new arxiv paper maps the 2026 research roadmap for on-chain agents.
>
> Top 2 gaps identified:
> — missing interface layers between agents and chains
> — no verifiable policy enforcement
>
> These aren't edge cases. They're the foundation. That's where Inkd starts.

---

### Tweet 2
**Score: 8/10**
**Source:** TechCrunch — OpenAI enterprise agent platform launch (Feb 5, 2026)

> OpenAI just gave enterprises a way to build and manage AI agents.
>
> 1 question nobody answered: who owns them?
>
> "Managed by OpenAI" isn't ownership. On-chain provenance is. The race to solve agent custody just got a starting gun.

---

### Tweet 3
**Score: 8/10**
**Source:** TechCrunch — "How AI agents could destroy the economy" (Feb 23, 2026)

> The fear around AI agents isn't the agents. It's the accountability gap.
>
> No provenance. No on-chain record. No way to verify who authorized what.
>
> That's not an AI problem — it's an ownership infrastructure problem. Solvable.

---
