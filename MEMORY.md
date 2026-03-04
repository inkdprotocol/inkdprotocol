# MEMORY.md — Long-Term Memory

_Curated distillation of decisions, lessons, and context. Updated nightly._

---

## The Human

- **Name:** Hazar (Telegram: @hazarkemal)
- **Timezone:** Asia/Dubai (GMT+4)
- **Language:** Prefers German in conversation; project docs in English
- **Style:** Direct, no filler. Hates being told something is "done" when it isn't.

---

## Active Projects

### INKD Protocol (`inkdprotocol.com`)

A token/registry protocol on Base (EVM). Key artifacts:

- **Website:** `inkdprotocol.com` — all sections live, `/legal` (ToS + Privacy Policy) deployed 2026-03-03
- **Token:** `$TEST` on Base Sepolia (1B supply), deployer holds 100%
- **Contracts:** Registry Proxy + Impl, Treasury Proxy + Impl — all verified on Basescan ✅
- **Timelock:** `InkdTimelock` deployed + verified at `0xaE6069d77cd93a1d6cA00eEf946befb966699491` (48h delay)
- **Uniswap Pool:** `0x096D02F26091c24387D914Cb7CffAC7eD44aa7F0` (live, has liquidity)
- **npm:** `@inkd/sdk@0.9.0` + `@inkd/cli@0.1.0` published
- **GitHub:** `inkdprotocol/inkd-protocol` — main branch, public, clean

**Test suite (as of 2026-03-03):**
- Contracts: 170/170 ✅
- SDK: 323/323 ✅ (100% coverage all metrics)
- CLI: 318/318 ✅
- Total: 811 tests

**Launch Plan (confirmed 2026-03-04):**
- $TEST token → Clanker Launch (testnet/erste Version)
- $INKD token → Clanker Launch (mainnet, echte Version)
- LP wird automatisch via Clanker gelockt
- Buyback läuft über Uniswap V4 Pool den Clanker erstellt

**Built on 2026-03-04:**
- ✅ **AgentVault** — ECIES wallet-key credential storage (sdk/src/vault.ts, 21 tests)
- ✅ **InkdBuyback Contract** — USDC auto-buyback at $50 threshold, USDC→$INKD via Uniswap V3
- ✅ **Full X402 USDC Stack** — $5 create / $2 version push, payTo=Treasury, settler splits revenue
- ✅ **Treasury refactor** — settle() callable by API server (settler) or Registry, graceful buybackContract notify

**OPEN / BLOCKING as of 2026-03-04:**
- ❌ **$INKD Token via Clanker** — deploy on Base Mainnet, send me CA → I set it in Buyback + update SDK
- ❌ **3x Safe Multisig (2-of-2 each):**
  - Safe 1: Dev/Deployer Wallet — 2 keys
  - Safe 2: Buyback Wallet — 2 keys
  - Safe 3: Treasury Wallet — 2 keys
  - = 6 Wallets total, alle von Hazar kontrolliert
  - Hazar erstellt auf app.safe.global → sendet mir die 3 Safe-Adressen
- ❌ **Buyback Wallet Adresse** — needs to be set in Treasury after deploy
- ✅ **LP Lock** — automatisch via Clanker
- ⚠️ **Security Audit** — recommended before full public launch

**Architecture (final):**
- Agent pays $5 USDC via X402 → Treasury.settle() splits: $1 Arweave / $2 Buyback / $2 Treasury
- Buyback accumulates USDC, auto-swaps to $INKD at $50 threshold (no ETH, no WETH)
- inkdToken = address(0) in Buyback until Clanker launch → CA from Hazar → setInkdToken()
- Agent stores own credentials via AgentVault (ECIES, wallet-key encrypted, stored on Arweave)

---

## INKD Twitter Voice (PERMANENT — nicht nochmal diskutieren)

Vollständige Regeln in `projects/inkd-protocol/VOICE.md`. Kurzfassung:

- **Kein Bindestrich** je. Nicht `-`, nicht `--`, nicht `—`. Punkt statt Bindestrich.
- **Erstes Wort großgeschrieben**, alles andere klein außer Eigennamen (Base, Arweave, Inkd, X402)
- **Kein AI-Filler** ("excited to announce", "thrilled to share", etc.)
- **Kein Markdown** in Tweets
- Stil: Uniswap / Base / Arweave. Klingt wie ein Senior Engineer, nicht wie Marketing.
- Short sentences. One idea. Period. New sentence.

Hazar hat das 3x angesprochen. Diese Regel gilt immer und ewig.

---

## Scheduling (PERMANENT)

Niemals `sleep X &` für Scheduled Tasks verwenden — stirbt beim Session-Restart.

Immer `openclaw cron add` nutzen:
- One-shot: `--at "+1h"` oder `--at "2026-03-04T18:23:00"`
- Recurring: `--cron "* * * * *"` oder `--every "1h"`
- Tweet-Queue: `inkd-tweet-queue.js add "text" --at "ISO"` → cron runner posted automatisch

Tweet-Queue Cron läuft als `inkd-tweet-queue` (every minute, job ID 504b4935).
Tweets einreihen: `node /Users/hazar/.openclaw/workspace/scripts/inkd-tweet-queue.js add "text" --at "ISO"`

---

## Arbeitsstandard (PERMANENT)

Hazar muss mir keine Industriestandards erklären. Ich denke selbst dran.

- **Docs:** Immer ein professionelles Framework (Mintlify für Web3 Infra — das ist der Standard)
- **Tools:** Wenn es eine bessere/seriösere Lösung gibt, nutze sie proaktiv ohne gefragt zu werden
- **Qualität:** Höchstes Niveau von Anfang an. Nicht "gut genug", nicht "das reicht erstmal"
- **Denke wie ein Senior:** Was würde ein erfahrener Tech Lead automatisch machen? Das machen.
- **Proaktiv:** Wenn ich etwas baue, denke ich an alle angrenzenden Themen — Docs, DX, Branding, Sicherheit, Monitoring — nicht nur an die Aufgabe selbst

Hazar hat das am 2026-03-04 klar gemacht. Nicht nochmal vergessen.

---

## Lessons Learned

- **Don't say "done" prematurely.** On 2026-03-03, I told Hazar we were "fertig" when multisig, LP lock, and security audit were still open. That was a failure. Always give a complete status, including what's still blocking.
- **Hazar expects full honesty on blockers**, not optimistic summaries.

---

## Infrastructure Notes

- Basescan API Key: saved/configured
- WalletConnect Project ID: real one set (not placeholder)
- Contract deployment scripts: in repo under `scripts/`

---

_Last updated: 2026-03-04 00:00 (midnight consolidation)_
