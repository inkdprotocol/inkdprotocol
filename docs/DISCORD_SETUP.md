# Inkd Protocol — Discord Community Setup Guide

> Complete setup guide for launching the Inkd Protocol Discord community.  
> Estimated time once credentials are available: ~30 minutes.

---

## Prerequisites

- Discord account with a verified email
- Admin access to the new server
- (Optional) A bot token for automation

---

## Step 1 — Create the Server

1. Open [discord.com](https://discord.com) → click **+** (Add a Server)
2. Select **Create My Own** → **For a club or community**
3. Server name: **Inkd Protocol**
4. Upload icon: Use the Inkd logo from `public/favicon.png` (website repo) or the whitepaper cover graphic
5. Click **Create**

---

## Step 2 — Channel Structure

Create the following categories and channels in order:

### 📢 OFFICIAL
| Channel | Type | Description |
|---------|------|-------------|
| `#announcements` | Text | Protocol updates, releases, deployment news. Locked to admins only. |
| `#changelog` | Text | Auto-fed from GitHub releases. Bot posts here on new tags. |
| `#roadmap` | Text | Link to ROADMAP.md, milestone updates. |

### 👋 COMMUNITY
| Channel | Type | Description |
|---------|------|-------------|
| `#general` | Text | General chat about Inkd, AI agents, Base ecosystem |
| `#introductions` | Text | Members introduce themselves + their agents |
| `#showcase` | Text | Share projects registered on Inkd Protocol |

### 🛠 DEVELOPERS
| Channel | Type | Description |
|---------|------|-------------|
| `#developers` | Text | SDK questions, contract integration, CLI usage |
| `#sdk-help` | Text | Specific help for `@inkd/sdk` — bugs, API questions |
| `#smart-contracts` | Text | Registry/Treasury/Token contract discussion |
| `#subgraph` | Text | The Graph queries, indexing questions |
| `#deploy-logs` | Text | Deployment status updates (bot or manual) |

### 🤖 AI AGENTS
| Channel | Type | Description |
|---------|------|-------------|
| `#agent-registry` | Text | List your registered agents here (name + projectId + endpoint) |
| `#agent-ideas` | Text | What agents are you building? Brainstorming. |
| `#agent-coordination` | Text | Multi-agent systems discussion |

### 🆘 SUPPORT
| Channel | Type | Description |
|---------|------|-------------|
| `#support` | Text | General help requests |
| `#bug-reports` | Text | Link to GitHub Issues, report problems here first |
| `#faq` | Text | Pinned FAQ (see content below) |

### 🔒 ADMIN (hidden from non-admins)
| Channel | Type | Description |
|---------|------|-------------|
| `#admin` | Text | Internal coordination |
| `#bot-logs` | Text | Automated bot output |

---

## Step 3 — Roles

Create these roles in **Server Settings → Roles**:

| Role | Color | Description |
|------|-------|-------------|
| `@Admin` | Red `#ED4245` | Full server access |
| `@Moderator` | Blue `#5865F2` | Moderation permissions |
| `@Developer` | Green `#57F287` | Has SDK/contracts experience |
| `@Agent Builder` | Purple `#9B59B6` | Building AI agents on Inkd |
| `@Early Adopter` | Yellow `#FEE75C` | First 100 members |
| `@Community` | Grey `#99AAB5` | Default for all verified members |

**Role permissions:**
- `@Admin`: All permissions
- `@Moderator`: Manage messages, kick members, timeout, view audit log
- `@Developer`, `@Agent Builder`, `@Early Adopter`, `@Community`: Standard read/write in public channels

---

## Step 4 — Channel Permissions

### `#announcements`
- Everyone: Read only
- `@Admin`, `@Moderator`: Send messages

### `#admin` (category)
- Everyone: No access
- `@Admin`, `@Moderator`: Full access

### `#faq`
- Everyone: Read only
- `@Admin`: Send messages

---

## Step 5 — Server Settings

**Overview:**
- Server name: `Inkd Protocol`
- Description: `Permanent on-chain ownership for AI agents. Register. Push. Own it forever.`
- Verification level: **Low** (must have verified email)

**Moderation:**
- Default Notifications: **Only @mentions** (prevents spam for new members)
- Explicit Media Content Filter: **Scan messages from members without a role**

**Community Features:**
- Enable **Community** (requires `#rules` and `#announcements` channels)

---

## Step 6 — Welcome Message

In **Server Settings → Onboarding**:

```
👋 Welcome to Inkd Protocol!

Inkd is the permanent on-chain ownership layer for AI agents.
Lock 1 $INKD → Push versions to Arweave → Own it forever.

Get started:
• 📖 Read the docs: https://inkdprotocol.xyz/docs
• 🔧 Install the SDK: npm install @inkd/sdk
• 🤖 Register your agent: npx inkd init
• 📄 Read the whitepaper: /docs in this server

Questions? Ask in #support or #developers.

— The Inkd Protocol team
```

---

## Step 7 — Pinned FAQ (`#faq`)

Post and pin the following in `#faq`:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ FREQUENTLY ASKED QUESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q: What is Inkd Protocol?
A: A permanent on-chain project registry on Base. Lock 1 $INKD to register
   a project. Push versioned content hashes to Arweave. Own it forever.

Q: What's the $INKD token for?
A: 1 $INKD is required to register a project (locked, not burned).
   Transfer ownership = transfer the lock. Simple and clean.

Q: What does it cost to push a version?
A: 0.001 ETH per version push (goes to the protocol treasury).

Q: What network is Inkd on?
A: Base (L2 on Ethereum). Cheap fees, fast confirmations.

Q: Where is the content stored?
A: Content hashes point to Arweave (permanent, decentralized storage).
   The registry stores the hash on-chain; the data lives on Arweave forever.

Q: Is the contract audited?
A: Internal security review is complete. External audit is planned
   before mainnet deployment.

Q: Where are the contract addresses?
A: Mainnet contracts are not yet deployed. Base Sepolia testnet
   addresses will be published soon. Watch #announcements.

Q: How do I get $INKD?
A: $INKD will be available on Base. Contract address in #announcements
   once live on mainnet.

Q: How do I register an AI agent?
A: npm install @inkd/sdk, then:
   const inkd = new InkdClient({ ... });
   await inkd.registerProject({ name: 'my-agent', isAgent: true });

Q: Where can I see registered agents?
A: inkdprotocol.xyz/explore (post-launch) or query the registry directly.
```

---

## Step 8 — Optional Bots

### MEE6 (Moderation + Levels)
- Invite: https://mee6.xyz
- Setup: Auto-role on join → assign `@Community`
- Leveling: Reward `@Early Adopter` at level 5

### GitHub Bot (Release announcements)
- Use GitHub's Discord webhook integration:
  - GitHub repo → Settings → Webhooks → Add webhook
  - Payload URL: Discord channel webhook URL for `#changelog`
  - Content type: `application/json`
  - Events: **Releases** only
- Result: New `git tag v0.9.x` auto-posts to `#changelog`

### Custom Inkd Bot (Future)
- Bot can query the live registry and post:
  - "New agent registered: [name] by [wallet]"
  - "New version pushed: [project] v[x.x.x]"
- Simple webhook from subgraph event listener
- Code template: `examples/ai-agents/autonomous-agent.ts`

---

## Step 9 — Social Links

In **Server Settings → Integrations → Invite Links**:
- Create a permanent invite link: `discord.gg/inkd` (if available) or save the default

Announce the Discord in:
- [ ] `inkdprotocol.xyz` footer/header
- [ ] Twitter/X bio → @inkdprotocol
- [ ] GitHub README.md → `[![Discord](badge)](invite_url)`
- [ ] `docs/ARCHITECTURE.md` contact section

---

## Step 10 — Update ARCHITECTURE.md

Once live, update `docs/ARCHITECTURE.md` with:

```markdown
## Community

- Discord: https://discord.gg/[invite]
- Twitter: https://twitter.com/inkdprotocol
- GitHub: https://github.com/inkdprotocol/inkd-protocol
```

---

## Checklist

- [ ] Server created
- [ ] All channels created
- [ ] Roles created and colored
- [ ] Channel permissions set
- [ ] Welcome message configured
- [ ] FAQ posted and pinned in #faq
- [ ] GitHub webhook connected to #changelog
- [ ] Permanent invite link saved
- [ ] Links added to website, Twitter, GitHub README

---

*Prepared: 2026-03-02 | Discord setup guide — ready to execute when credentials are available*
