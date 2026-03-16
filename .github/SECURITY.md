# Security Policy

## Supported versions

| Component | Supported |
|---|---|
| Contracts (Base Mainnet) | ✅ Current deployment |
| `@inkd/sdk` (latest) | ✅ |
| `@inkd/cli` (latest) | ✅ |
| API (`api.inkdprotocol.com`) | ✅ |
| Older npm package versions | ❌ Please upgrade |

---

## Reporting a vulnerability

**Do not open a GitHub issue for security vulnerabilities.**

Email: **security@inkdprotocol.com**

Include:
- Description of the vulnerability
- Steps to reproduce (be specific)
- Potential impact
- Any proof-of-concept code (please don't exploit mainnet funds — test on Base Sepolia)

PGP encryption is optional but appreciated for high-severity findings. Request our public key in your initial email.

We treat all reports confidentially. We will not take legal action against good-faith security researchers acting within this policy.

---

## Scope

**In scope — please report:**
- Smart contracts (InkdRegistry, InkdTreasury, InkdBuyback, $INKD token)
- API server logic (authentication bypass, payment bypass, data exposure)
- SDK — issues that could cause users to leak private keys or send unauthorized transactions
- Subgraph — data integrity issues

**Out of scope:**
- Third-party services (Arweave, Vercel, Base chain itself)
- Telegram bot UI issues that don't affect funds or data integrity
- Theoretical attacks with no practical exploit path
- Rate limiting / DoS on the API
- Issues already known and documented in [AUDIT_REPORT.md](../AUDIT_REPORT.md)
- Social engineering

---

## Response timeline

| Milestone | Target |
|---|---|
| Acknowledgement | 24 hours |
| Initial assessment | 7 days |
| Fix ETA communicated | 14 days |
| Fix deployed (critical) | As fast as possible, no SLA |
| Fix deployed (high) | 30 days |
| Public disclosure | Coordinated with reporter |

We follow coordinated disclosure. We'll work with you on timing before anything is made public.

---

## Bug bounty

We reward responsible disclosure for critical vulnerabilities in the smart contracts.

Severity and reward amounts are assessed case-by-case based on actual risk to funds. Critical findings that enable theft or permanent loss of user funds receive the highest rewards.

Mention in your report if you're interested in a bounty — we'll discuss it as part of the triage process.

---

## Past audits

Three independent AI-assisted security audits have been completed. All findings have been addressed. See [AUDIT_REPORT.md](../AUDIT_REPORT.md) for the full report, including finding IDs and remediation status.
