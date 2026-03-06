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

### Protocol Contracts — Base Mainnet (deployed 2026-03-05) ✅

| Contract | Proxy | Impl |
|---|---|---|
| InkdBuyback | `0xcbbf310513228153D981967E96C8A097c3EEd357` | `0x3b13120e670aEBF325a1752E0aa8Ed5048e22E69` |
| InkdTreasury | `0x23012C3EF1E95aBC0792c03671B9be33C239D449` | `0xAd7175c3c720eda55a1089bbD31eEB85E3BBa442` |
| InkdRegistry | `0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d` | `0xCCC613c5c890722C04B28592879E60f4a7de829b` |

Ownership: Buyback→BUYBACK_SAFE ✅ Treasury→TREASURY_SAFE ✅ Registry→DEV_SAFE ✅
Deployer: `0xD363864d25446F0db53fb0B7c4e453abeE161928`
Inkd Signer (Server/Settler): `0x210bDf52ad7afE3Ea7C67323eDcCD699598983C0`
Gas: ~0.000037 ETH total

---

### INKD Protocol (`inkdprotocol.com`)

A token/registry protocol on Base (EVM). Key artifacts:

- **Website:** `inkdprotocol.com` — all sections live, `/legal` (ToS + Privacy Policy) deployed 2026-03-03
- **Token:** `$TEST` on Base Sepolia (1B supply), deployer holds 100%
- **Contracts:** Registry Proxy + Impl, Treasury Proxy + Impl — all verified on Basescan ✅
- **Timelock:** `InkdTimelock` deployed + verified at `0xaE6069d77cd93a1d6cA00eEf946befb966699491` (48h delay)
- **Uniswap Pool:** `0x096D02F26091c24387D914Cb7CffAC7eD44aa7F0` (live, has liquidity)
- **npm:** `@inkd/sdk@0.9.0` + `@inkd/cli@0.1.0` published
- **GitHub:** `inkdprotocol/inkd-protocol` — main branch, public, clean

**Test suite (as of 2026-03-05):**
- Contracts: 251/251 ✅
- SDK: 348/348 ✅
- CLI: 352/352 ✅
- AgentKit: 69/69 ✅
- MCP: 33/33 ✅
- API: 204/204 ✅
- **Total: 1,257 tests**

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

**Launch Reihenfolge (confirmed 2026-03-04):**
1. 🟡 **3x Safe Multisig** erstellen (app.safe.global, Base Mainnet, 2-of-2 each):
   - ✅ **INKD DEV 1** → `0x52d288c6697044561F99e433F01cd3d5ed4638A1` (Ethereum + Base)
   - ✅ **Inkd Buyback 1** → `0x58822722FA012Df30c37b709Fd2f70e0F83d9536` (Ethereum + Base)
   - ✅ **INKD Treasury** → `0x6f8D6adc77C732972541A89a88ecB76Dfc641d1D` (Ethereum + Base)
2. ✅ **$TEST via Clanker** deployed → `0xa6f64A0D23e9d6eC918929af53df1C7b0D819B07` (Base Mainnet)
3. ❌ **$INKD via Clanker** → erst wenn $TEST sauber läuft
4. ✅ **Protocol Contracts** auf Mainnet deployt — commit `75b0916`
- ⚠️ **Security Audit** — recommended before full public launch ($INKD)

**x402 Full Stack (deployed 2026-03-06):**
- ✅ `POST /v1/upload` — Arweave upload via Irys (server wallet), free endpoint
- ✅ `GET /v1/upload/price?bytes=N` — Kostenabschätzung (1 KB ≈ $0.0018)
- ✅ `SDK ProjectsClient` — agents zahlen USDC direkt, wallet = identity, kein API-Key nötig
- ✅ `CLI project create` — x402 flow ($5 USDC)
- ✅ `CLI version push` — `--file` auto-upload zu Arweave + $2 USDC on-chain
- **Irys Server Wallet:** `0x210bDf52...` — ~0.0015 ETH, für Prod aufladen
- **Vercel Deploy:** IMMER von workspace root (`/`) deployen, nicht von `/api/`

**Post-Deploy TODOs (as of 2026-03-06):**
- ❌ `setInkdToken($TEST CA)` via Buyback Safe aufrufen
- ✅ API .env updaten: REGISTRY_ADDRESS + TREASURY_ADDRESS
- ❌ $INKD via Clanker (erst wenn $TEST sauber läuft)
- ❌ Security Audit vor Public Launch
- ❌ E2E Test mit echtem Agent-Wallet auf Mainnet laufen lassen
- ❌ Irys Server Wallet aufladen (ETH auf `0x210bDf52...`) für Prod-Uploads
- ❌ Docs (Mintlify) updaten: /v1/upload + ProjectsClient

**E2E Test PASSED (2026-03-06):**
- ✅ createProject ($5 USDC) → TX 0x25642785bb06de399e102e3e943c6e93572fb8b65d3c9cceee45a3e430e413b9
- ✅ pushVersion ($2 USDC)   → TX 0x7a63bd374bd439a73f9090ac8431cbb338bc4693574e7663f6f7aff595eadf18
- Project ID: 6 (first real mainnet E2E run)

**x402 Architecture (final — 2026-03-06):**
- LocalFacilitatorClient — kein CDP, kein JWT-Auth-Problem
- Route handler führt USDC.transferWithAuthorization() selbst aus (vor Treasury.settle())
- Explizite Nonce-Verwaltung (nonce tracking durch TX-Chain um stale-nonce zu vermeiden)
- USDC EIP-712 domain name = "USD Coin" (nicht "USDC")
- Vercel auto-deploy von GitHub (kein manueller Upload nötig — Internet-Problem umgangen)

**Architecture (final — confirmed 2026-03-05):**
- Agent pays: Arweave storage cost + 20% markup (DYNAMIC, not fixed fee)
  - 100% Arweave cost → arweaveWallet (forwarded for actual storage)
  - 20% markup → split 50/50: 50% → InkdBuyback, 50% → Treasury
- InkdBuyback accumulates USDC, auto-swaps to $INKD at $50 threshold via Uniswap V3
- $INKD recipient = owner() of InkdBuyback = Buyback Safe multisig
- inkdToken = address(0) until Clanker launch → setInkdToken(CA) after deploy
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

## Cron/Agent Rules (PERMANENT)

- **Niemals unnötige Crons/Agents laufen lassen.** Wenn ein Job nix nützt → sofort deaktivieren.
- **Delivery mode für Background-Jobs = "none"** — Hazar bekommt nur Nachrichten wenn sie wichtig sind.
- **AGI Holdings Agent** und andere autonome Prozesse außer dem Gateway → killen wenn sie Spam produzieren.
- **Aktive Crons (nur diese 4):** weekly-deep-review, memory-consolidation, morning-briefing, inkd-tweet-queue
- Vor dem Erstellen eines neuen Crons fragen: "Braucht Hazar das wirklich?"

---

## Build Rules (PERMANENT — nie wieder vergessen)

- **Jede Build-Session MUSS enden mit `git add -A && git commit && git push`** — kein "done" ohne Push
- **Vor jeder Session:** `git status` checken — uncommitted work = vorherige Session hat versagt
- **Autonomous build agents:** immer `git push` am Ende des Prompts einbauen + verify mit `git log --oneline -3`
- **Keine Arbeit existiert bis sie auf `origin/main` ist.** Lokal = nicht existent.

---

## Lessons Learned

- **Don't say "done" prematurely.** On 2026-03-03, I told Hazar we were "fertig" when multisig, LP lock, and security audit were still open. That was a failure. Always give a complete status, including what's still blocking.
- **Hazar expects full honesty on blockers**, not optimistic summaries.
- **ALWAYS read MEMORY.md from disk at session start** — the injected system prompt version can be stale/outdated. Use `read` tool to load actual file, not the cached inject.
- **LP Lock / Timelock are NOT tasks** — $INKD launches via Clanker. LP is auto-locked by Clanker. Never mention manual LP lock again. Hazar has had to correct this 10+ times.
- **forge scripts env vars (2026-03-05):** Never use `nano` to manage .env files I control — it overwrites silently. For forge: use `export` in .env OR pass inline (`KEY=val forge script ...`). Just give Hazar the inline command directly.

---

## Infrastructure Notes

- Basescan API Key: saved/configured
- WalletConnect Project ID: real one set (not placeholder)
- Contract deployment scripts: in repo under `scripts/`

---

_Last updated: 2026-03-06 17:06 (x402 full stack deployed)_
