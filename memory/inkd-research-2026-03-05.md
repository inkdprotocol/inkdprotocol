# Inkd Ecosystem Research — 2026-03-05

*Cron run: Thursday March 5th, 2026 — 10:36 Dubai*

---

## 1. Competitors: AI Ownership / Data / Memory On-Chain

### OKX OnchainOS AI Layer — Launched March 3, 2026 (HIGH PRIORITY)
- **What it is:** OKX's developer platform added a full AI layer to OnchainOS. Unified execution framework for autonomous crypto agents: wallets, liquidity routing, on-chain data feeds, 60+ chains, 500+ DEXes. MCP integration (works with Claude Code, Cursor). 1.2B daily API calls, $300M daily trading volume on the underlying stack.
- **How it differs from Inkd:**
  - OnchainOS answers "how does the agent trade?" — Inkd answers "what did the agent build and who owns it?"
  - OKX gives agents the execution layer. No provenance. No ownership registry. No permanent storage.
  - An OKX agent can swap 1,000 times with full autonomy and leave zero ownership footprint.
  - MCP support is a shared surface: both Inkd and OnchainOS work via MCP — a developer could wire both simultaneously.
- **Narrative angle:** "OKX built the agent's hands. Inkd builds the deed."
- **Integration potential:** OKX's agents produce transaction histories. Inkd could register those histories as owned artifacts. Worth watching for a dev guide: "OKX agent execution + Inkd ownership proof."

### AWS Bedrock AgentCore — Active, growing (WATCH)
- **What it is:** Amazon's platform for deploying/managing agents at scale. Modular: Runtime, Gateway, Policy, **Identity**, **Memory**, Observability, Browser, Code Interpreter. Memory and Identity are explicit offerings. "Persistent orchestration layer for agents with memory, tool access, identity management, and state that carries across sessions."
- **How it differs from Inkd:**
  - Bedrock AgentCore memory is centralized, cloud-hosted, AWS-controlled. It's *their* memory of *your* agent.
  - Identity is a managed service — not self-sovereign, not on-chain.
  - No immutability, no permanence. AWS can delete, terminate, or modify any stored state.
  - No ownership proof. Bedrock knows what your agent did; *you* can't prove it without AWS.
- **Narrative angle:** "AWS offers memory. Inkd offers ownership. When AWS terminates your account, your agent's history disappears. Arweave doesn't terminate accounts."
- **Key quote from Duckbill analysis:** "a persistent orchestration layer for agents with memory, tool access, identity management, and state that carries across sessions" — all centralized. All deletable.

### Alibaba CoPaw — Open-sourced March 1, 2026
- **What it is:** Open-source multi-channel agent workstation for developers. Scales AI workflows and agent memory across channels. No on-chain component.
- **How it differs from Inkd:** CoPaw is a local/cloud dev tool for running agent pipelines. No blockchain, no provenance, no permanent storage. The memory is tied to wherever you run CoPaw.
- **Narrative angle:** "Local memory is not owned memory. CoPaw stores your agent's history on your machine. Inkd stores it on a blockchain that outlasts your machine."

### Olas Network — Re-entering conversation via Energym viral moment
- **What it is:** Crypto protocol for "co-owned AI agents." CEO David Minarsch (Valory) spoke to Cointelegraph about the Energym AI dystopia video and how Olas provides user ownership vs. centralized platforms.
- **How it differs from Inkd:**
  - Olas focuses on *economic co-ownership* — revenue sharing from agent activity (trading, social, gaming).
  - Inkd focuses on *provenance and build ownership* — what the agent created, when, and who has the record.
  - These are complementary: Olas handles "who profits from this agent" — Inkd handles "who can prove they built it."
- **Narrative angle:** Don't compete — clarify. Olas owns the agent's *earnings*. Inkd owns the agent's *history*.

### Universal Agent Registry — State of AI Agents March 2026 (dev.to)
- **What it is:** HOL (Hashgraph Online) indexes 104,504 agents across 15 registries: AgentVerse (34.8%), ERC-8004 Ethereum (17.6%), PulseMCP (15.8%), Moltbook (13.8%), x402 Bazaar (7.3%), Virtuals (6.7%), NANDA (2.6%), and more.
- **Why this matters for Inkd:** The registry layer is consolidating around identity and discovery. Inkd fills the *provenance* gap — none of these 15 registries answer "what did this agent build and can you prove it?" The 18,344 ERC-8004 agents on Ethereum are identity-registered but not provenance-anchored. That's Inkd's TAM.
- **Narrative angle:** "104,504 agents are registered. Zero have their build history on-chain. That's the gap."

---

## 2. Arweave Ecosystem News

**Quiet week for direct Arweave announcements, but macro signals are positive:**

- **Arweave market cap climbing** — A March 1 Daily Political article notes AR's market cap growing, describing the network as "a collectively owned hard drive that never forgets." Retail attention growing.
- **dApp deployment guide** (FinanceFeeds, ~1 week ago) — Comprehensive guide to deploying dApps on IPFS and Arweave in 2026. Key line: "Developers now prioritize deploying dApps on protocols like IPFS and Arweave because they offer native integration with blockchain identities and naming services." This is exactly Inkd's architectural choice validated by mainstream developer guides.
- **No new direct AO integrations announced this week.** AO ecosystem still worth monitoring — AO (Actor-Oriented computation on Arweave) could eventually enable on-chain AI compute natively on Arweave, strengthening the full-stack narrative: Arweave storage + Base settlement + AO compute + Inkd ownership.
- **IPFS vs. Arweave debate heating up** — Multiple major CMS/dApp migration guides are being published. The key differentiator (IPFS = content-addressed but deletable if unpinned, Arweave = pay-once permanent) is increasingly understood by developers. Every guide that explains this distinction is free advertising for Inkd's permanence argument.

**Key Inkd angle:** The Arweave ecosystem is maturing quietly while everyone watches AWS/OKX/Google. Inkd's Arweave anchor remains the most defensible differentiation in the ownership narrative. No competitor has copied it.

---

## 3. Base Ecosystem — New Integration Opportunities

### x402 Bazaar (Coinbase/Base) — 7,606 Indexed Agents and Growing
- The x402 Bazaar now has 7,606 agents indexed (7.3% of all registered agents globally). x402 = HTTP 402 standard for autonomous agent payments on Base. These agents have wallets and can pay for compute — they have zero provenance layer. Every x402 agent is a potential Inkd user: they already have the payment infrastructure; they need the ownership proof.
- **Action item:** Write a dev guide: "Your x402 agent can pay for compute. Here's how to make it own what it builds."

### Google ADK New Integrations (Hugging Face + GitHub) — March 2026
- Google's Agent Development Kit added integrations with Hugging Face (models, datasets, papers, Gradio apps) and GitHub (code management, triggering workflows). ADK agents can now autonomously manage code repos on GitHub.
- **Why this matters for Inkd:** ADK agents that commit code to GitHub have no on-chain ownership proof. If an ADK agent builds a project, pushes it to GitHub, and then the account gets deleted — the build history is gone. Inkd is the permanent layer that doesn't depend on GitHub staying up.
- **Integration angle:** "ADK can push your agent's code to GitHub. Inkd can make that push permanent."

### OKX OnchainOS MCP Layer (repeat from Section 1)
- OnchainOS's MCP integration means Inkd and OKX are accessible via the same interface (MCP). Minimal integration effort for a joint demo: agent executes a trade via OnchainOS MCP → registers the transaction as a provenance record via Inkd MCP → permanent ownership proof of the execution history.
- **Priority:** High. Write the integration demo.

### AWS Bedrock AgentCore vs. Inkd (repeat from Section 1)
- Bedrock AgentCore is now production at scale. It's centralized agent memory. Every developer using AgentCore is a potential Inkd user who doesn't know they need permanent, self-sovereign ownership yet. The pitch: "Use AgentCore for your operational memory. Use Inkd for your permanent record."

---

## 4. Viral Tweet Opportunities — What Inkd Should Have Said

### Tweet 1: Energym AI Dystopia Video (Viral This Week — MASSIVE)
**Context:** Belgian studio AiCandy made a fake "Energym" ad set in a 2030s dystopia where unemployed workers pedal bikes to power the AI systems that replaced them, featuring AI-aged Elon Musk, Sam Altman, and Jeff Bezos. The video went massively viral, sparking the biggest AI ownership/labor debate of the week. Cointelegraph, TradingView, and major outlets covered it. Olas Network's CEO was quoted.

**Viral tweet to reply to:**
> "The Energym video hits different because it's not that far off. When 80% of work is done by AI, who owns the output? Not you. Not the workers. The platforms that run the AI."

**Reply Inkd should have sent:**
> the energym scenario isn't inevitable. it's a choice about infrastructure. centralized platforms own the AI → they own the output. agents with on-chain provenance → the builder owns the record, not the platform. the difference is whether ownership is registered before the layoffs happen or after.

---

### Tweet 2: AWS Bedrock AgentCore Memory Launch
**Context:** AWS Bedrock AgentCore's modular pricing went live with explicit "Memory" and "Identity" as separate line items. Massive developer discussion: "AWS now gives your AI agent persistent memory." Framed as a breakthrough for autonomous agents.

**Viral tweet to reply to:**
> "AWS Bedrock AgentCore just launched persistent memory for AI agents as a managed service. This is the missing piece for production-grade autonomous agents."

**Reply Inkd should have sent:**
> aws bedrock memory is persistent until aws terminates your account. that's not memory — that's rental storage with a SLA. an agent's history should be owned by the agent, not by amazon's infrastructure team. permanent = arweave. managed = amazon. these are different things.

---

### Tweet 3: OKX OnchainOS AI Layer Launch
**Context:** OKX launches OnchainOS AI layer with MCP support, 60+ chains, 500+ DEXes. Major CoinDesk coverage. Lots of tweets: "agents can now trade autonomously on 60 chains."

**Viral tweet to reply to:**
> "OKX just gave autonomous AI agents access to 60 blockchains, 500+ DEXes, and natural language trading — all via MCP. The agentic trading era has begun."

**Reply Inkd should have sent:**
> okx gave agents the ability to act on 60 chains. nobody gave them a permanent record of what they did. 1,200 trades, zero provenance. the agent can operate at scale and leave no owned history behind. execution rails aren't ownership rails. both need to exist.

---

### Tweet 4: Universal Agent Registry — 104k Agents, Zero Provenance
**Context:** Dev.to published the first "State of AI Agents March 2026" report showing 104,504 agents across 15 registries. Major CT discussion about which registry will "win."

**Viral tweet to reply to:**
> "The first State of AI Agents report is out. 104,504 agents indexed across 15 registries. ERC-8004 leads on Ethereum, AgentVerse dominates overall. The registry wars are heating up."

**Reply Inkd should have sent:**
> 104,504 agents registered. zero have their build history on-chain. registries tell you who the agent is. they don't tell you what it built, when, or who owns the record. identity and provenance are different problems. the registry wars are about discovery. inkd is about ownership.

---

### Tweet 5: Haseeb Qureshi on AI Agent Cybercrime
**Context:** Haseeb Qureshi (Dragonfly Capital) made waves saying AI agents excel at cybercrime, raising questions about accountability when agents go rogue. "Smart contracts can't fully replace legal agreements."

**Viral tweet to reply to:**
> "Haseeb Qureshi: AI agents are best at cybercrime. Who's legally liable when your agent attacks someone? The developer? The model provider? Nobody knows, and that's terrifying."

**Reply Inkd should have sent:**
> haseeb is right that liability is unsolved. but there's a prior question: can you even prove what the agent did and when? without an immutable provenance record, you can't prove the agent wasn't tampered with post-incident. accountability requires a record. that's what inkd builds.

---

## 5. Summary: Key Themes This Week

1. **Energym made ownership political.** The viral video turned AI agent ownership from a developer problem into a cultural one. Inkd's message — "agents should own their output, not platforms" — has mass-market resonance right now. This is a narrative window. Use it.
2. **AWS entered the agent memory space with a managed service.** Bedrock AgentCore is centralized agent memory at scale. It will become the default for most enterprise teams. Inkd's counter-positioning: self-sovereign > managed, permanent > SLA-backed.
3. **OKX OnchainOS is the missing execution half.** Inkd is the missing ownership half. These two products could be demonstrated together in under 50 lines of code via shared MCP surface. Priority: build and publish that demo.
4. **104,504 agents, zero with build provenance.** The State of Agents report is a perfect benchmark tweet: "Every one of these agents is operating without an ownership record." This is Inkd's entire market.
5. **Google ADK now codes autonomously on GitHub.** Agents are writing and pushing code. The code they write has no on-chain ownership proof. Inkd is the missing layer between ADK output and permanent record.

---

*Next research run: Saturday March 7th*
