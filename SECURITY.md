# Security Policy

## Overview

Inkd Protocol is a smart contract system managing token locks and on-chain registries on Base mainnet. We take security seriously. If you discover a vulnerability, **please report it responsibly** — do not post it publicly until we've had time to address it.

---

## Supported Versions

| Version | Status |
|---------|--------|
| `main` (pre-launch) | ✅ Active development |
| Deployed mainnet contracts | ✅ Supported post-launch |

---

## Reporting a Vulnerability

**Email:** `security@inkdprotocol.xyz`

**PGP:** Available on request.

**Response SLA:**
| Severity | Initial Response | Resolution Target |
|----------|-----------------|-------------------|
| Critical | < 24 hours | < 72 hours |
| High | < 48 hours | < 7 days |
| Medium | < 72 hours | < 30 days |
| Low | < 7 days | Best effort |

Please include:
- Contract name + function affected
- Steps to reproduce
- Impact description (what assets could be drained / how)
- Suggested fix (optional but appreciated)

---

## Scope

### In Scope

| Asset | Priority |
|-------|----------|
| `InkdToken.sol` | Critical |
| `InkdRegistry.sol` | Critical |
| `InkdTreasury.sol` | Critical |
| `@inkd/sdk` (on-chain interactions only) | High |
| Subgraph data integrity | Medium |

### Out of Scope

- Website UI bugs (not financial impact)
- Third-party dependencies (report upstream)
- Issues requiring compromised private keys
- Theoretical issues without demonstrated impact
- Gas optimization suggestions (use GitHub Issues)

---

## Bug Bounty

> **Status: Pre-launch — bounty program launches with mainnet deployment.**

Planned rewards (paid in ETH):

| Severity | Reward |
|----------|--------|
| Critical (fund drain, ownership hijack) | 1–5 ETH |
| High (DoS, fee bypass) | 0.5–1 ETH |
| Medium (data integrity) | 0.1–0.5 ETH |
| Low (informational) | Swag + recognition |

---

## Known Limitations

These are known design constraints, **not vulnerabilities**:

1. **Arweave hash is not verified on-chain** — `pushVersion()` accepts any string as `arweaveHash`. Consumers must verify content exists on Arweave themselves.
2. **Owner can change fees** — `InkdTreasury` allows the owner to update `versionFee` and `transferFee`. This is intentional; projects should approve per-transaction.
3. **No emergency pause** — Contracts are intentionally non-upgradeable. There is no `pause()` function. In the event of a critical bug, the only recourse is a new deployment.
4. **Project names are first-come-first-served** — No trademark protection.

---

## Audit History

| Date | Auditor | Scope | Report |
|------|---------|-------|--------|
| 2026-03-02 | Internal (agent) | All contracts | [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) |
| TBD | External firm | All contracts | Planned pre-launch |

---

## Disclosure Policy

We follow [Responsible Disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure):

1. Reporter submits via email
2. We confirm receipt within the SLA
3. We investigate and develop a fix
4. Fix deployed + verified
5. CVE assigned if applicable
6. Reporter credited in release notes (optional, reporter's choice)
7. Public disclosure after fix is live (90-day max embargo)

---

## Hall of Fame

*No vulnerabilities reported yet. Be the first — help make Inkd secure.*

---

*Security policy version: 1.0 — effective 2026-03-02*
