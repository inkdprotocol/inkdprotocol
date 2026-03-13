# @inkd/telegram-bot

Telegram bot for the [Inkd Protocol](https://inkdprotocol.com). Upload files and code to Arweave, register them on Base, pay in USDC — no API keys, no accounts.

## Features

- **New Wallet** — bot generates a wallet for you (encrypted, stored in session)
- **Connect Wallet** — link your existing wallet (read-only)
- **Upload text** — store any text content permanently on Arweave
- **Upload repo** — download a GitHub repo and store it on Arweave
- **Push versions** — push new versions to existing projects
- **Balance check** — shows USDC balance before every upload
- **Project browser** — list your projects, view versions, download files

## Commands

| Command | Description |
|---|---|
| `/start` | Connect or create a wallet |
| `/wallet` | Show wallet address & USDC balance |
| `/upload_text` | Upload text content |
| `/upload_repo` | Upload a GitHub repo |
| `/my_projects` | View your projects |
| `/cancel` | Cancel current action |
| `/help` | Show all commands |

## Pricing

| Action | Cost |
|---|---|
| Create project | $0.10 USDC |
| Push version | Arweave cost × 1.20 (min $0.10) |

## Architecture

```
User → Telegram Bot
           │
           ├── /v1/upload      → Arweave (via Irys)
           ├── /v1/projects    → InkdRegistry on Base (x402 USDC payment)
           └── /v1/projects/*/versions → same
```

Payment uses [x402](https://github.com/coinbase/x402) — EIP-3009 USDC `transferWithAuthorization`. No API key needed. Wallet = identity.

## Setup

```bash
cp .env.example .env
# fill in TELEGRAM_BOT_TOKEN, BOT_ENCRYPT_SECRET, BOT_HMAC_SECRET, INKD_REGISTRY_ADDRESS, INKD_TREASURY_ADDRESS

npm install
npm run build
node dist/index.js
```

## Environment Variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `BOT_ENCRYPT_SECRET` | AES-256-GCM key for wallet encryption (min 32 chars) |
| `BOT_HMAC_SECRET` | HMAC key for auth challenges (min 32 chars) |
| `INKD_API_URL` | API base URL (default: `https://api.inkdprotocol.com`) |
| `BASE_RPC_URL` | Base RPC (default: `https://mainnet.base.org`) |
| `SESSION_DB_PATH` | SQLite path for sessions (default: `./data/sessions.db`) |
