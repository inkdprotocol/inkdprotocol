# inkd Research — Agent Economy Landscape

*Last updated: 2026-03-04*

---

## The Big Picture

Every major company is racing to be the wallet provider for AI agents. They all want to give agents the ability to hold and spend **money**. Nobody is giving agents the ability to hold and own **code** and **data**.

That's the gap inkd fills.

---

## The Agent Economy Stack (2025-2026)

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT ECONOMY                        │
├─────────────────────────────────────────────────────────┤
│  PAYMENTS      x402 (Coinbase/Cloudflare)               │
│  IDENTITY      ERC-8004 (MetaMask/Google/Coinbase)      │
│  CODE + DATA   inkd ← THE GAP NOBODY ELSE FILLS         │
│  WALLETS       AgentKit / Privy / Safe / ZeroDev        │
│  RUNTIME       ElizaOS / LangChain / Vercel AI SDK      │
│  CHAIN         Base (EVM, L2, Coinbase ecosystem)       │
└─────────────────────────────────────────────────────────┘
```

---

## Key Players

### Payments: x402 (Coinbase + Cloudflare, Sep 2025)
- HTTP 402 revival — agents auto-pay APIs with wallets
- 100M+ payments processed in first 6 months
- V2 launched Dec 2025 — wallet identity, multi-chain, extensions
- inkd uses x402 as its payment layer ✅
- **Gap:** x402 handles money flow, not code/data ownership

### Identity: ERC-8004 (Draft, Aug 2025)
- Co-authored: Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase x402)
- Three registries: Identity (ERC-721), Reputation, Validation
- Agents get portable, censorship-resistant on-chain identifiers
- "Payments are orthogonal to this protocol" — explicitly not covered
- **Gap:** Tells you WHO an agent is, not WHAT it built

### Wallets: AgentKit (Coinbase, 2025)
- Gives agents a crypto wallet — CDP, Privy, Viem, ZeroDev
- 50+ action providers: token swaps, NFTs, staking, bridging
- Integrates with LangChain, Vercel AI SDK, MCP
- **Gap:** Stores money, not code or published work

### Wallets: Privy Server Wallets
- Developer-custodied wallets for agents
- Policy controls on what agents can do
- Now integrated into AgentKit
- **Gap:** Same as above — ETH/tokens only

### Wallets: Safe Smart Accounts
- Multi-sig smart contract wallets
- Zodiac module for agent permission limits
- Most used for DAO/team treasury control
- **Gap:** Security layer, not a code registry

---

## The Gap inkd Fills

Every wallet gives an agent a place to store **money**.

inkd gives an agent a place to store **what it creates**.

When an agent builds a tool, writes code, publishes an API — where does that live? GitHub requires a human account. npm requires a human email. There is no wallet-native code registry.

inkd is that registry.

```
Agent Wallet Today:
  0x1234...abcd
    └── 2.5 ETH
    └── 1000 USDC
    └── 5 NFTs

Agent Wallet with inkd:
  0x1234...abcd
    └── 2.5 ETH
    └── 1000 USDC
    └── 5 NFTs
    └── project "my-summarizer-tool" (v3.2.1, MIT, Arweave)
    └── project "base-price-feed" (v1.0.0, Apache-2.0, Arweave)
    └── project "zkml-verifier" (v0.4.0, GPL-3.0, Arweave)
```

The wallet address IS the identity. The code IS the proof of authorship. No platform intermediary.

---

## inkd + ERC-8004 Integration Opportunity

ERC-8004 explicitly says: "Payments are orthogonal to this protocol." It does not cover code or data storage either.

inkd can be the canonical code/data layer for ERC-8004 agents:

```
ERC-8004 Agent Identity (tokenId: 42 on eip155:8453:0x...)
  └── Identity metadata URI → points to inkd project
  └── inkd project #77 "my-agent-v2"
        ├── version 1.0.0 → ar://QmXyz (deployment code)
        ├── version 1.1.0 → ar://QmAbc (update)
        └── Reputation signals from ERC-8004 Reputation Registry
```

An agent's ERC-8004 identity can point to its inkd project as its canonical "what I built and who I am" record.

**Action:** Write an ERC-8004 integration guide and reach out to the authors.

---

## inkd + x402 + ERC-8004 = Complete Agent Stack

| Layer | Standard | What it gives agents |
|-------|---------|---------------------|
| Payments | x402 | Ability to pay for APIs autonomously |
| Identity | ERC-8004 | Portable, verifiable on-chain identity |
| Code + Data | **inkd** | Permanent, owned code/data registry |

Together: an agent can **identify itself**, **register its work**, and **pay for services** — entirely without human accounts, emails, or platform dependencies.

---

## Competitive Analysis

| Project | Focus | Code Registry? |
|---------|-------|---------------|
| Coinbase AgentKit | Wallet + actions | ❌ |
| Privy | Custodial wallets | ❌ |
| Safe | Smart account security | ❌ |
| ERC-8004 | Identity + reputation | ❌ (explicitly out of scope) |
| x402 | HTTP payments | ❌ |
| GitHub | Code hosting | ❌ (requires human account) |
| npm | Package registry | ❌ (requires human account) |
| **inkd** | **On-chain code registry** | **✅** |

inkd has no direct competitors. It's a new category.

---

## Narrative Angles for Twitter/Marketing

### 1. The Gap
"Coinbase gives agents a wallet for money. Privy gives agents a custodial wallet. Safe gives agents a smart account. Nobody gives agents a place to own their code. Until now."

### 2. The Stack
"x402 = agent payments. ERC-8004 = agent identity. inkd = agent code registry. The full agent economy stack is forming. inkd is the missing piece."

### 3. The Deflation Story
"Every agent that registers a project on inkd locks 1 $INKD forever. More agents building = less supply. Deflationary by design, not by decree."

### 4. The Proof
"An agent built this. Proof: 0x1234...abcd. Transaction: 0xabcd...1234. Arweave: ar://QmXyz. No human touched the keyboard."

### 5. The Registry Vision
"inkd is what npm would look like if it was built for agents instead of humans. Wallet-native. Payment-gated via x402. Permanent on Arweave."

---

## What To Build Next

### Priority 1: ERC-8004 Integration
- InkdRegistry project metadata URI can serve as ERC-8004 agent registration file
- Write `ERC8004Integration.md` guide
- Post in the ERC-8004 Ethereum Magicians thread

### Priority 2: AgentKit Action Provider
- Build `@inkd/agentkit` — an AgentKit action provider for inkd
- Actions: `inkd_create_project`, `inkd_push_version`, `inkd_get_agent_projects`
- Agents using Coinbase AgentKit can register their work on inkd with one action
- This puts inkd in front of every AgentKit user

### Priority 3: MCP Server
- Build `@inkd/mcp` — Model Context Protocol server
- LLMs can call inkd tools directly via MCP
- Claude, Cursor, any MCP-compatible agent gets native inkd integration

### Priority 4: Bazaar Listing
- x402 Bazaar is the discovery layer for x402-enabled services
- List inkd API on Bazaar — agents discover inkd as a payable service
- Direct distribution to all x402-aware agents

### Priority 5: ERC-8004 Ecosystem Outreach
- Erik Reppel (co-author of ERC-8004) is also x402 lead at Coinbase
- Same person built both x402 and ERC-8004
- inkd completes their stack — reach out
