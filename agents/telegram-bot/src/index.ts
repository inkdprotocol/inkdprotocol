import { Bot, Context, InlineKeyboard, InputFile, session, SessionFlavor } from 'grammy'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { createChallenge, recoverWalletFromSignature } from './services/auth'
import { 
  beginTextUpload, 
  beginRepoUpload, 
  handleUploadMessage, 
  handleRepoCancel, 
  handleRepoConfirm, 
  handleTextConfirm, 
  handleTextCancel,
  beginVersionPush,
  handlePushTextSelect,
  handlePushRepoSelect,
  handlePushConfirm,
  handlePushCancel,
  formatApiError,
  type PendingVersionPush,
} from './services/uploads'
import { SqliteStorage } from './services/session'
import { generateWallet, encryptPrivateKey, getWalletBalance } from './services/wallet'
import { listProjectsByOwner, getProjectById, listVersions, getVersion, type ApiProject, type ApiVersion } from './services/api'

dotenv.config({ path: process.env.BOT_ENV_PATH ?? '.env' })

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN missing')
}

import type { UploadSession } from './services/uploads'

export type BotSession = {
  wallet?: string
  encryptedKey?: string  // AES-256-GCM encrypted private key (only for bot-generated wallets)
  pendingChallenge?: string
  upload?: UploadSession
  pendingVersionPush?: PendingVersionPush
}

type MyContext = Context & SessionFlavor<BotSession>

const bot = new Bot<MyContext>(token)

const sessionDbPath = process.env.SESSION_DB_PATH
  ?? path.join(process.cwd(), 'data', 'sessions.db')
fs.mkdirSync(path.dirname(sessionDbPath), { recursive: true })
const sqliteStorage = new SqliteStorage<BotSession>(sessionDbPath)

bot.use(session({
  storage: sqliteStorage,
  initial: () => ({})
}))

bot.use(async (ctx, next) => {
  console.log('update', ctx.update.update_id, ctx.chat?.id, ctx.msg?.text);
  await next();
})

// ─── Keyboards ────────────────────────────────────────────────────────────────

const walletKeyboard = new InlineKeyboard()
  .text('🆕 New Wallet', 'wallet_new')
  .row()
  .text('🔑 Connect Wallet', 'wallet_connect')

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.command('start', async ctx => {
  await ctx.reply(
    `Welcome to inkd bot 🫟\n\n` +
    `Store code, data, and files permanently on Arweave.\n` +
    `Registered on Base. Paid in USDC. No accounts needed.\n\n` +
    `Connect or create a wallet to get started:`,
    { reply_markup: walletKeyboard }
  )
})

bot.command('wallet', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('No wallet connected. Use /start to create or connect one.', {
      reply_markup: walletKeyboard
    })
    return
  }
  await showWalletInfo(ctx)
})

bot.command('my_wallet', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('No wallet connected. Use /start to create or connect one.', {
      reply_markup: walletKeyboard
    })
    return
  }
  await showWalletInfo(ctx)
})

bot.command('upload_text', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  if (!ctx.session.encryptedKey) {
    await ctx.reply('⚠️ You connected an external wallet. Uploads require a bot-managed wallet with USDC balance.\n\nUse /start → "🆕 New Wallet" to create one.')
    return
  }
  await beginTextUpload(ctx)
})

bot.command('upload_repo', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  if (!ctx.session.encryptedKey) {
    await ctx.reply('⚠️ You connected an external wallet. Uploads require a bot-managed wallet with USDC balance.\n\nUse /start → "🆕 New Wallet" to create one.')
    return
  }
  await beginRepoUpload(ctx)
})

bot.command('my_projects', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  try {
    const projects = await listProjectsByOwner(ctx.session.wallet, 5)
    if (!projects.length) {
      await ctx.reply('No projects yet for this wallet.')
      return
    }
    for (const project of projects) {
      // Fetch latest version for arweave link
      let latestArweave: string | undefined
      try {
        const versions = await listVersions(Number(project.id), 1)
        if (versions.length > 0) {
          latestArweave = versions[0].arweaveHash
        }
      } catch {
        // ignore - just won't show arweave link
      }
      const summary = formatProjectSummary(project, latestArweave)
      const keyboard = new InlineKeyboard().text('📂 Details', `project:${project.id}`)
      await ctx.reply(summary, { reply_markup: keyboard })
    }
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.command('cancel', async ctx => {
  ctx.session.upload = undefined
  ctx.session.pendingChallenge = undefined
  ctx.session.pendingVersionPush = undefined
  await ctx.reply('Cancelled. Use /start to begin again.')
})

bot.command('help', async ctx => {
  await ctx.reply(
    `📋 *Commands*\n\n` +
    `/start — Connect or create wallet\n` +
    `/wallet — Show wallet address & balance\n` +
    `/upload_text — Upload text content\n` +
    `/upload_repo — Upload a GitHub repo\n` +
    `/my_projects — View your projects\n` +
    `/cancel — Cancel current action\n` +
    `/help — Show this message\n\n` +
    `💡 *How it works*\n` +
    `inkd stores files on Arweave and registers them on Base.\n` +
    `You pay in USDC. No API key needed — your wallet is your identity.\n\n` +
    `*Pricing*\n` +
    `Create project: $0.10 USDC\n` +
    `Push version: Arweave cost + 20% (min $0.10)`,
    { parse_mode: 'Markdown' }
  )
})

// ─── Message handlers ─────────────────────────────────────────────────────────

bot.on('message:text', async ctx => {
  if (await handleUploadMessage(ctx)) return
  
  const challenge = ctx.session.pendingChallenge
  if (!challenge) return
  
  const text = ctx.message.text.trim()
  if (!text.startsWith('0x') || text.length < 10) return
  
  try {
    const address = await recoverWalletFromSignature(challenge, text as `0x${string}`)
    ctx.session.wallet = address
    ctx.session.pendingChallenge = undefined
    // External wallet — no encryptedKey (read-only)
    ctx.session.encryptedKey = undefined
    await ctx.reply(
      `✅ Wallet ${address} connected (read-only).\n\n` +
      `⚠️ External wallets can view projects but cannot upload (bot needs to sign USDC transfers).\n\n` +
      `Use /my_projects to view your projects.\n` +
      `For uploads, create a bot wallet with /start → "🆕 New Wallet".`
    )
  } catch (err) {
    await ctx.reply('Signature invalid. Please try again.')
  }
})

// ─── Callback handlers ────────────────────────────────────────────────────────

bot.callbackQuery('wallet_new', async ctx => {
  await ctx.answerCallbackQuery()
  
  try {
    const { address, privateKey } = generateWallet()
    const encryptedKey = encryptPrivateKey(privateKey)
    
    // grammY auto-saves session — no explicit sqliteStorage.write needed
    ctx.session.wallet = address
    ctx.session.encryptedKey = encryptedKey
    ctx.session.pendingChallenge = undefined
    
    await ctx.reply(
      `🆕 *New Wallet Created*\n\n` +
      `Address: \`${address}\`\n\n` +
      `🔐 *Private Key* (SAVE THIS, shown only once!):\n` +
      `\`${privateKey}\`\n\n` +
      `⚠️ This is your bot wallet. Fund it with ETH (for gas) and USDC (for uploads) on Base.\n\n` +
      `💡 *Next steps:*\n` +
      `1. Fund your wallet with USDC on Base\n` +
      `2. Bridge from Ethereum: bridge.base.org\n` +
      `3. Buy directly: coinbase.com → send to Base\n\n` +
      `Minimum for uploads: ~$0.20 USDC\n\n` +
      `Use /wallet to check your balance.`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.callbackQuery('wallet_connect', async ctx => {
  const challenge = createChallenge(ctx.from.id)
  ctx.session.pendingChallenge = challenge
  await ctx.answerCallbackQuery()
  await ctx.reply(
    `Sign the following message with your Base wallet and send the signature back here:\n\n` +
    `\`${challenge}\`\n\n` +
    `⚠️ Note: Connected wallets are read-only. For uploads, use "🆕 New Wallet" instead.`,
    { parse_mode: 'Markdown' }
  )
})

bot.callbackQuery('repo_confirm', handleRepoConfirm)
bot.callbackQuery('repo_cancel', handleRepoCancel)
bot.callbackQuery('text_confirm', handleTextConfirm)
bot.callbackQuery('text_cancel', handleTextCancel)

// Version push handlers
bot.callbackQuery(/^push_version:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = Number(ctx.match?.[1])
  if (!projectId) {
    await ctx.reply('Invalid project id.')
    return
  }
  if (!ctx.session.encryptedKey) {
    await ctx.reply('⚠️ You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }
  await beginVersionPush(ctx, projectId)
})

bot.callbackQuery(/^push_text:(\d+)$/, handlePushTextSelect)
bot.callbackQuery(/^push_repo:(\d+)$/, handlePushRepoSelect)
bot.callbackQuery(/^push_confirm:(\d+)$/, handlePushConfirm)
bot.callbackQuery('push_cancel', handlePushCancel)

bot.callbackQuery(/^project:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = Number(ctx.match?.[1])
  if (!projectId) {
    await ctx.reply('Invalid project id.')
    return
  }
  try {
    const project = await getProjectById(projectId)
    if (!project) {
      await ctx.reply('Project not found.')
      return
    }
    const versions = await listVersions(projectId, 5)
    const message = formatProjectDetails(project, versions)

    const keyboard = new InlineKeyboard()
    
    // Add push version button at the top
    keyboard.text('🆕 Push Version', `push_version:${projectId}`).row()
    
    for (const v of versions) {
      keyboard
        .text(`⬇ v${v.versionIndex} · ${v.versionTag}`, `download:${projectId}:${v.versionIndex}`)
        .row()
    }

    await ctx.reply(message, { reply_markup: keyboard })
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

const MAX_DIRECT_BYTES = 48 * 1024 * 1024 // 48 MB Telegram bot API limit

function extForMime(mime: string | null): string {
  if (!mime) return ''
  const base = mime.split(';')[0].trim()
  const map: Record<string, string> = {
    'application/json': '.json',
    'application/javascript': '.js',
    'application/zip': '.zip',
    'text/plain': '.txt',
    'text/html': '.html',
    'text/css': '.css',
    'text/markdown': '.md',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'application/wasm': '.wasm',
  }
  return map[base] ?? ''
}

bot.callbackQuery(/^download:(\d+):(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()

  const projectId = Number(ctx.match[1])
  const versionIndex = Number(ctx.match[2])

  try {
    const version = await getVersion(projectId, versionIndex)
    if (!version) {
      await ctx.reply('Version not found.')
      return
    }

    const url = `https://arweave.net/${version.arweaveHash}`
    const statusMsg = await ctx.reply(`⏳ Fetching v${versionIndex} from Arweave…`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Arweave responded with HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type')
    const contentLength = response.headers.get('content-length')
    const byteSize = contentLength ? Number(contentLength) : null

    if (byteSize !== null && byteSize > MAX_DIRECT_BYTES) {
      await response.body?.cancel()
      const mb = (byteSize / 1024 / 1024).toFixed(1)
      await ctx.api.editMessageText(
        ctx.chat!.id, statusMsg.message_id,
        `📦 v${versionIndex} is ${mb} MB — too large to send via Telegram.\nDownload directly: ${url}`
      )
      return
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const ext = extForMime(contentType)
    const filename = `${version.arweaveHash}${ext}`

    await ctx.replyWithDocument(new InputFile(buffer, filename), {
      caption: `v${versionIndex} · ${version.versionTag}`
    })

    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id)
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function showWalletInfo(ctx: MyContext) {
  const wallet = ctx.session.wallet!
  const isExternal = !ctx.session.encryptedKey
  
  try {
    const balance = await getWalletBalance(wallet)
    const walletType = isExternal ? '🔑 Connected (read-only)' : '🆕 Bot-managed'
    
    await ctx.reply(
      `*Your Wallet*\n\n` +
      `Address: \`${wallet}\`\n` +
      `Type: ${walletType}\n\n` +
      `*Balance (Base)*\n` +
      `ETH: ${balance.eth}\n` +
      `USDC: ${balance.usdc}\n\n` +
      (isExternal 
        ? `⚠️ External wallets cannot upload. Create a bot wallet with /start → "🆕 New Wallet".`
        : `Use /upload_text or /upload_repo to upload.`),
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    await ctx.reply(`Wallet: \`${wallet}\`\n\nFailed to fetch balance: ${(err as Error).message}`, { parse_mode: 'Markdown' })
  }
}

function shortenAddress(addr?: string) {
  if (!addr) return 'unknown'
  return addr.length <= 10 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatTimestamp(ts?: string | number) {
  if (!ts) return 'n/a'
  const num = typeof ts === 'string' ? Number(ts) : ts
  return new Date(num * 1000).toLocaleString('de-DE', { timeZone: 'UTC' })
}

function formatProjectSummary(project: ApiProject, latestArweave?: string) {
  const lines = [
    `#${project.id} · ${project.name}`,
    `Owner: ${shortenAddress(project.owner)}`,
    `Versions: ${project.versionCount}`,
    `Updated: ${formatTimestamp(project.createdAt)}`
  ]
  if (latestArweave) {
    lines.push(`Latest: https://arweave.net/${latestArweave}`)
  }
  return lines.join('\n')
}

function formatProjectDetails(project: ApiProject, versions: ApiVersion[]) {
  const header = [
    `📂 ${project.name} (#${project.id})`,
    `Owner: ${shortenAddress(project.owner)}`,
    `Total versions: ${project.versionCount}`
  ].join('\n')
  if (!versions.length) {
    return `${header}\n\nNo versions found.`
  }
  const lines = versions.map(v => formatVersionLine(v))
  const body = lines.join('\n\n')
  const versionCount = Number(project.versionCount)
  const extra = versions.length < versionCount ? '\n… more versions exist.' : ''
  return `${header}\n\n${body}${extra}`
}

function formatVersionLine(version: ApiVersion) {
  const date = formatTimestamp(version.pushedAt)
  const ar = version.arweaveHash
  const link = `https://arweave.net/${ar}`
  return `v${version.versionIndex} · ${version.versionTag} (${date})\nArweave: ${ar}\n${link}`
}

// ─── Error Handler ────────────────────────────────────────────────────────────

bot.catch(err => {
  console.error('Bot error:', err)
})

// ─── Start ────────────────────────────────────────────────────────────────────

export async function start() {
  // Register commands with BotFather
  await bot.api.setMyCommands([
    { command: 'start',        description: 'Connect or create a wallet' },
    { command: 'wallet',       description: 'Show wallet address & USDC balance' },
    { command: 'upload_text',  description: 'Upload text content to Arweave' },
    { command: 'upload_repo',  description: 'Upload a GitHub repo to Arweave' },
    { command: 'my_projects',  description: 'View your projects' },
    { command: 'cancel',       description: 'Cancel current action' },
    { command: 'help',         description: 'Show all commands' },
  ])
  await bot.start({ drop_pending_updates: true })
  console.log('inkd bot running')
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
