import { Bot, Context, InlineKeyboard, InputFile, session, SessionFlavor, webhookCallback } from 'grammy'
import http from 'node:http'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { createChallenge, recoverWalletFromSignature } from './services/auth'
import { 
  beginTextUpload, 
  beginRepoUpload,
  beginFileUpload,
  handleUploadMessage, 
  handleRepoCancel, 
  handleRepoConfirm, 
  handleTextConfirm, 
  handleTextCancel,
  handleFileConfirm,
  handleFileCancel,
  beginVersionPush,
  handlePushTextSelect,
  handlePushRepoSelect,
  handlePushConfirm,
  handlePushCancel,
  formatApiError,
  handleGithubUsername,
  handleGithubRepoSelected,
  type PendingVersionPush,
} from './services/uploads'
import { SqliteStorage } from './services/session'
import { generateWallet, encryptPrivateKey, decryptPrivateKey, getWalletBalance } from './services/wallet'

import { listProjectsByOwner, getProjectById, listVersions, getVersion, searchProjects, findProjectByOwnerAndName, type ApiProject, type ApiVersion } from './services/api'

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
  suggestedProjectId?: string  // For auto-version detection when project name matches
  tutorialStep?: number
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

const INTRO_URL = 'https://inkdprotocol.com/intro.mp4'

async function showHomeMenu(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .text('⬆️ Upload a File', 'home_upload').row()
    .text('💼 Wallet', 'home_wallet').text('📁 My Files', 'home_files').row()
    .text('❓ Help', 'home_help').text('🎓 Tutorial', 'start_tour')

  const caption = '🫟 *inkd*\n\nPermanent storage on Arweave. Registered on Base. Paid in USDC.\n\n' +
    '[🌐 inkdprotocol.com](https://inkdprotocol.com)\n' +
    '[𝕏 @inkdprotocol](https://twitter.com/inkdprotocol)\n' +
    '[💻 GitHub](https://github.com/inkdprotocol/inkd-protocol)'

  try {
    await ctx.replyWithAnimation(INTRO_URL, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    })
  } catch {
    await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard })
  }
}

bot.command('start', async ctx => {
  await showHomeMenu(ctx)
})

bot.callbackQuery('home_wallet', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.wallet) {
    await ctx.reply('No wallet yet.', { reply_markup: walletKeyboard })
    return
  }
  await showWalletInfo(ctx)
})

bot.callbackQuery('home_files', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.wallet) {
    await ctx.reply('Connect a wallet first.', { reply_markup: walletKeyboard })
    return
  }
  const homeBtn = new InlineKeyboard().text('🏠 Home', 'nav_home')
  try {
    const projects = await listProjectsByOwner(ctx.session.wallet, 10)
    if (!projects.length) {
      await ctx.reply('No uploads yet.\n\nSend any file or use /upload\\_text to get started.', { parse_mode: 'Markdown', reply_markup: homeBtn })
      return
    }
    // Build a keyboard where each project is a button
    const kb = new InlineKeyboard()
    for (const p of projects) {
      const icon = p.isPublic ? '🌍' : '🔒'
      const label = `${icon} ${p.name}${Number(p.versionCount) > 0 ? ` · v${p.versionCount}` : ''}`
      kb.text(label, `project:${p.id}`).row()
    }
    kb.text('🏠 Home', 'nav_home')
    await ctx.reply(`*Your files* (${projects.length})`, { parse_mode: 'Markdown', reply_markup: kb })
  } catch (err) {
    await ctx.reply(`Failed to load files: ${(err as Error).message}`, { reply_markup: homeBtn })
  }
})



bot.callbackQuery('home_search', async ctx => {
  await ctx.answerCallbackQuery()
  await ctx.reply('Send me a project name to search:', {
    reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
  })
  ctx.session.upload = { type: 'search_query' } as any
})

bot.callbackQuery('home_help', async ctx => {
  await ctx.answerCallbackQuery()
  await ctx.reply(
    '*inkd help*\n\n' +
    '*Files*\n' +
    '• Send any file, text, or /upload\\_text to upload\n' +
    '• /my\\_projects — view your uploads\n' +
    '• /history — recent activity\n\n' +
    '*Wallet*\n' +
    '• /wallet — view balance & address\n' +
    '• /export\\_key — export private key\n\n' +
    '*Other*\n' +
    '• /search <name> — find public projects\n' +
    '• /tutorial — 4-step intro\n' +
    '• /cancel — cancel current action\n\n' +
    '*Pricing*\n' +
    '• Upload: Arweave cost + 20% fee (min $0.10)\n' +
    '• Paid in USDC on Base',
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') }
  )
})

bot.callbackQuery('nav_home', async ctx => {
  await ctx.answerCallbackQuery()
  await showHomeMenu(ctx)
})

bot.callbackQuery('wallet_deposit', async ctx => {
  await ctx.answerCallbackQuery()
  const wallet = ctx.session.wallet
  if (!wallet) { await ctx.reply('No wallet.'); return }
  await ctx.reply(
    `*Add funds to your wallet*\n\n` +
    `Send USDC or ETH on Base to:\n\`${wallet}\`\n\n` +
    `You can get USDC on Base at [Coinbase](https://coinbase.com) or [Uniswap](https://app.uniswap.org).`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
    }
  )
})

bot.callbackQuery('wallet_withdraw', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.encryptedKey) {
    await ctx.reply('External wallets manage their own funds.', {
      reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
    })
    return
  }
  await ctx.reply('Send to which address?', {
    reply_markup: new InlineKeyboard().text('❌ Cancel', 'nav_home'),
  })
  ctx.session.upload = { type: 'withdraw_address' } as any
})

bot.callbackQuery('home_upload', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.encryptedKey) {
    await ctx.reply('You need a bot-managed wallet to upload.\n\nCreate one via /start → 🎓 Tutorial.', {
      reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
    })
    return
  }
  await ctx.reply('What do you want to upload?', {
    reply_markup: new InlineKeyboard()
      .text('📝 Text', 'upload_text_start').text('🐙 GitHub Repo', 'upload_repo_start').row()
      .text('🏠 Home', 'nav_home'),
  })
})

bot.callbackQuery('upload_text_start', async ctx => {
  await ctx.answerCallbackQuery()
  await beginTextUpload(ctx)
})

bot.callbackQuery('upload_repo_start', async ctx => {
  await ctx.answerCallbackQuery()
  await beginRepoUpload(ctx)
})

// User picks a repo from the GitHub username list
bot.callbackQuery(/^gh_repo:(.+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const fullName = ctx.match[1] // e.g. "inkdprotocol/inkd-protocol"
  await handleGithubRepoSelected(ctx, fullName)
})

bot.callbackQuery('start_tour', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.tutorialStep = 1
  await sendTutorialStep(ctx)
})

bot.callbackQuery('start_explore', async ctx => {
  await ctx.answerCallbackQuery()
  await ctx.reply('Connect or create a wallet to get started.', { reply_markup: walletKeyboard })
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
      const keyboard = new InlineKeyboard().text('📂 Details', `project:${project.id}`).text('🏠 Home', 'nav_home')
      await ctx.reply(summary, { reply_markup: keyboard })
    }
  } catch (err) {
    await ctx.reply(formatApiError(err), { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
  }
})

bot.command('cancel', async ctx => {
  ctx.session.upload = undefined
  ctx.session.pendingChallenge = undefined
  ctx.session.pendingVersionPush = undefined
  await ctx.reply('Cancelled.', { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
})

bot.command('export_key', async ctx => {
  if (!ctx.session.encryptedKey) {
    await ctx.reply('No bot-managed wallet. External wallets manage their own keys.\n\nCreate a bot wallet with /start → "🆕 New Wallet".')
    return
  }
  
  await ctx.reply(
    `⚠️ *SECURITY WARNING*\n\n` +
    `Your private key gives *full access* to your wallet.\n\n` +
    `• Never share it with anyone\n` +
    `• Store it offline securely\n` +
    `• Delete this message after saving\n\n` +
    `Are you sure you want to view your private key?`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('Yes, show key 🔓', 'export_key_confirm')
        .text('Cancel', 'export_key_cancel')
    }
  )
})

bot.command('history', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  
  try {
    const projects = await listProjectsByOwner(ctx.session.wallet, 10)
    if (!projects.length) {
      await ctx.reply('No upload history yet.')
      return
    }
    
    // Get latest version from each project, sort by date, show top 5
    const versionPromises = projects.slice(0, 10).map(async p => {
      const versions = await listVersions(Number(p.id), 1)
      return versions.map(v => ({ ...v, projectName: p.name, projectId: p.id }))
    })
    
    const allVersions = (await Promise.all(versionPromises)).flat()
    allVersions.sort((a, b) => Number(b.pushedAt) - Number(a.pushedAt))
    
    const recent = allVersions.slice(0, 5)
    if (!recent.length) {
      await ctx.reply('No versions uploaded yet.')
      return
    }
    
    const lines = recent.map(v => {
      const date = new Date(Number(v.pushedAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `📄 *${v.projectName}* v${v.versionIndex} — ${date}\n↳ [Arweave](https://arweave.net/${v.arweaveHash})`
    })
    
    await ctx.reply(`*Recent uploads*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' })
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.command('search', async ctx => {
  const query = ctx.match?.trim()
  if (!query) {
    await ctx.reply('Usage: /search <project name>')
    return
  }
  
  try {
    const results = await searchProjects(query)
    if (!results.length) {
      await ctx.reply(`No projects found for "${query}".`, { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
      return
    }
    
    for (const project of results.slice(0, 5)) {
      const keyboard = new InlineKeyboard().text('📂 Details', `project:${project.id}`).text('🏠 Home', 'nav_home')
      await ctx.reply(formatProjectSummary(project), { reply_markup: keyboard })
    }
  } catch (err) {
    await ctx.reply(formatApiError(err), { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
  }
})

bot.command('help', async ctx => {
  await ctx.reply(
    `📋 *Commands*\n\n` +
    `/start — Connect or create wallet\n` +
    `/wallet — Show wallet address & balance\n` +
    `/upload_text — Upload text content\n` +
    `/upload_repo — Upload a GitHub repo\n` +
    `/my_projects — View your projects\n` +
    `/history — View recent uploads\n` +
    `/search <name> — Search public projects\n` +
    `/export_key — Export your private key\n` +
    `/tutorial — Interactive guided tour\n` +
    `/links — Website, socials, buy $INKD\n` +
    `/cancel — Cancel current action\n` +
    `/help — Show this message\n\n` +
    `💡 *How it works*\n` +
    `inkd stores files on Arweave and registers them on Base.\n` +
    `You pay in USDC. No API key needed — your wallet is your identity.\n\n` +
    `*Pricing*\n` +
    `Create project: $0.10 USDC\n` +
    `Push version: Arweave cost + 20% (min $0.10)`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') }
  )
})

bot.command('tutorial', async ctx => {
  ctx.session.tutorialStep = 1
  await sendTutorialStep(ctx)
})

bot.command('links', async ctx => {
  await ctx.reply(
    '*inkd Protocol*\n\nAll links in one place.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .url('🌐 Website', 'https://inkdprotocol.com').row()
        .url('🐦 Twitter / X', 'https://x.com/inkdprotocol').row()
        .url('🪙 Buy $INKD on Clanker', 'https://clanker.world/clanker/0x103013851D4475d7D1610C7941E2a16534a1eB07').row()
        .url('📊 Chart', 'https://dexscreener.com/base/0x096D02F26091c24387D914Cb7CffAC7eD44aa7F0').row()
        .url('📄 Docs', 'https://inkdprotocol.com')
    }
  )
})

// ─── Message handlers ─────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB Telegram bot API limit

bot.on('message:document', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  if (!ctx.session.encryptedKey) {
    await ctx.reply('⚠️ You connected an external wallet. Uploads require a bot-managed wallet with USDC balance.\n\nUse /start → "🆕 New Wallet" to create one.')
    return
  }

  const doc = ctx.message.document
  const fileSize = doc.file_size ?? 0
  const fileName = doc.file_name ?? 'unknown'
  const mimeType = doc.mime_type ?? 'application/octet-stream'

  if (fileSize > MAX_FILE_BYTES) {
    await ctx.reply(`❌ File too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`)
    return
  }

  await beginFileUpload(ctx, doc.file_id, fileName, mimeType, fileSize)
})

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
      `• Fund this wallet with USDC on Base\n` +
      `• Use /wallet to check your balance\n` +
      `• Use /upload_text or /upload_repo to start`,
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

bot.callbackQuery('repo_confirm', ctx => handleRepoConfirm(ctx))
bot.callbackQuery('repo_cancel', handleRepoCancel)
bot.callbackQuery('text_confirm', ctx => handleTextConfirm(ctx))
bot.callbackQuery('text_cancel', handleTextCancel)
bot.callbackQuery('file_confirm', ctx => handleFileConfirm(ctx))
bot.callbackQuery('file_cancel', handleFileCancel)

bot.callbackQuery('export_key_confirm', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.encryptedKey) {
    await ctx.reply('No bot-managed wallet.')
    return
  }
  
  try {
    const privateKey = decryptPrivateKey(ctx.session.encryptedKey)
    await ctx.reply(
      `🔑 *Your Private Key*\n\n` +
      `\`${privateKey}\`\n\n` +
      `⚠️ Save this immediately. Delete this message after saving.\n` +
      `Never share this with anyone.`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    await ctx.reply('Failed to decrypt key. Please contact support.')
  }
})

bot.callbackQuery('export_key_cancel', async ctx => {
  await ctx.answerCallbackQuery()
  await ctx.reply('Cancelled.')
})

// Auto version detection callbacks
bot.callbackQuery(/^push_existing:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = Number(ctx.match?.[1])
  if (!projectId) {
    await ctx.reply('Invalid project id.')
    return
  }
  // Clear upload session and start version push flow
  ctx.session.upload = undefined
  ctx.session.suggestedProjectId = undefined
  if (!ctx.session.encryptedKey) {
    await ctx.reply('⚠️ You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }
  await beginVersionPush(ctx, projectId)
})

bot.callbackQuery('create_new_project', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.suggestedProjectId = undefined
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo') {
    await ctx.reply('No pending upload. Use /upload_repo to start.')
    return
  }
  await ctx.reply('Paste the GitHub repo URL or owner/repo (optionally @ref):')
})

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
    
    // Add push version and share buttons at the top
    keyboard
      .text('🆕 Push Version', `push_version:${projectId}`)
      .text('🔗 Share', `share:${projectId}`)
      .row()
    
    for (const v of versions) {
      keyboard
        .text(`⬇ v${v.versionIndex} · ${v.versionTag}`, `download:${projectId}:${v.versionIndex}`)
        .row()
    }

    keyboard.text('◀️ My Files', 'home_files').text('🏠 Home', 'nav_home')

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
      `Address: \`${wallet}\`\n\n` +
      `*Balance (Base)*\n` +
      `ETH: ${balance.eth}\n` +
      `USDC: ${balance.usdc}\n\n` +
      (isExternal 
        ? `⚠️ External wallets cannot upload. Create a bot wallet with /start → "🆕 New Wallet".`
        : ``),
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('📥 Add Funds', 'wallet_deposit').text('💸 Send', 'wallet_withdraw').row()
          .text('🏠 Home', 'nav_home'),
      }
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

// ─── Tutorial ─────────────────────────────────────────────────────────────────

async function sendTutorialStep(ctx: MyContext) {
  const step = ctx.session.tutorialStep ?? 1

  if (step === 1) {
    await ctx.reply(
      `📖 Step 1/4 — What is inkd?\n\n` +
      `inkd is a permaweb registry. Upload files to Arweave (permanent storage) and register them on Base as projects.\n\n` +
      `Pay in USDC. No accounts, no API keys — your wallet is your identity.\n\n` +
      `Think: npm, but permanent and on-chain.`,
      {
        reply_markup: new InlineKeyboard().text('Next ➡️', 'tutorial_2')
      }
    )
  } else if (step === 2) {
    if (ctx.session.wallet) {
      await ctx.reply(
        `🔑 Step 2/4 — Wallet\n\nYou're all set: \`${ctx.session.wallet}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('Next ➡️', 'tutorial_3')
        }
      )
    } else {
      await ctx.reply(
        `🔑 Step 2/4 — Set up your wallet\n\nYou need a wallet to own projects and pay for uploads.`,
        {
          reply_markup: new InlineKeyboard()
            .text('🆕 Create Wallet', 'tutorial_create_wallet')
            .text('Skip →', 'tutorial_3')
        }
      )
    }
  } else if (step === 3) {
    const walletDisplay = ctx.session.wallet ? `\`${ctx.session.wallet}\`` : 'create a wallet first'
    await ctx.reply(
      `💰 Step 3/4 — Fund your wallet\n\n` +
      `Send USDC to your wallet on Base:\n${walletDisplay}\n\n` +
      `Minimum: ~$0.20 USDC. Use /wallet to check balance.`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text("✅ I'm ready", 'tutorial_4')
      }
    )
  } else if (step === 4) {
    await ctx.reply(
      `🚀 Step 4/4 — First upload\n\n` +
      `You're ready. Choose:\n\n` +
      `• /upload_text — store any text permanently\n` +
      `• /upload_repo — archive a GitHub repo\n\n` +
      `Files live on Arweave forever. Registered on Base. Owned by your wallet.`,
      {
        reply_markup: new InlineKeyboard()
          .text('📝 Upload Text', 'tutorial_upload_text')
          .text('📦 Upload Repo', 'tutorial_upload_repo')
          .row()
          .text('Done ✅', 'tutorial_done')
      }
    )
  }
}

bot.callbackQuery('tutorial_2', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.tutorialStep = 2
  await sendTutorialStep(ctx)
})

bot.callbackQuery('tutorial_3', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.tutorialStep = 3
  await sendTutorialStep(ctx)
})

bot.callbackQuery('tutorial_4', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.tutorialStep = 4
  await sendTutorialStep(ctx)
})

bot.callbackQuery('tutorial_done', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.tutorialStep = undefined
  await ctx.reply("You're all set! Use /help to see all commands.")
})

bot.callbackQuery('tutorial_create_wallet', async ctx => {
  await ctx.answerCallbackQuery()
  
  try {
    const { address, privateKey } = generateWallet()
    const encryptedKey = encryptPrivateKey(privateKey)
    
    ctx.session.wallet = address
    ctx.session.encryptedKey = encryptedKey
    ctx.session.pendingChallenge = undefined
    
    await ctx.reply(
      `🆕 *New Wallet Created*\n\n` +
      `Address: \`${address}\`\n\n` +
      `🔐 *Private Key* (SAVE THIS, shown only once!):\n` +
      `\`${privateKey}\`\n\n` +
      `⚠️ This is your bot wallet. Fund it with ETH (for gas) and USDC (for uploads) on Base.`,
      { parse_mode: 'Markdown' }
    )
    
    ctx.session.tutorialStep = 3
    await sendTutorialStep(ctx)
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.callbackQuery('tutorial_upload_text', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.tutorialStep = undefined
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

bot.callbackQuery('tutorial_upload_repo', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.tutorialStep = undefined
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

// ─── Share ────────────────────────────────────────────────────────────────────

bot.callbackQuery(/^share:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = Number(ctx.match[1])
  
  try {
    const project = await getProjectById(projectId)
    if (!project) {
      await ctx.reply('Project not found.')
      return
    }
    
    const versions = await listVersions(projectId, 1)
    const latestHash = versions[0]?.arweaveHash ?? ''
    
    const shareText = [
      `📦 *${project.name}*`,
      ``,
      `Owner: \`${project.owner}\``,
      `Versions: ${project.versionCount}`,
      latestHash ? `Latest: [Arweave](https://arweave.net/${latestHash})` : '',
      ``,
      `Built with inkd Protocol — permanent storage on Arweave, registered on Base.`,
      `🌐 inkdprotocol.com`,
    ].filter(Boolean).join('\n')
    
    await ctx.reply(shareText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .url('🌐 inkdprotocol.com', 'https://inkdprotocol.com')
        .url('📄 Arweave', latestHash ? `https://arweave.net/${latestHash}` : 'https://arweave.net')
    })
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

// ─── Inline Mode ──────────────────────────────────────────────────────────────

bot.on('inline_query', async ctx => {
  const query = ctx.inlineQuery.query.trim()
  
  if (!query) {
    await ctx.answerInlineQuery([{
      type: 'article',
      id: 'help',
      title: 'Search inkd projects',
      description: 'Type a project name to search',
      input_message_content: {
        message_text: 'Search inkd projects at inkdprotocol.com'
      }
    }], { cache_time: 0 })
    return
  }

  try {
    const results = await searchProjects(query, 10)
    const articles = results.map(p => ({
      type: 'article' as const,
      id: String(p.id),
      title: p.name,
      description: `by ${p.owner.slice(0, 6)}...${p.owner.slice(-4)} · ${p.versionCount} version(s)`,
      input_message_content: {
        message_text: `📦 *${p.name}* (#${p.id})\nOwner: \`${p.owner}\`\nVersions: ${p.versionCount}\n\n🌐 inkdprotocol.com`,
        parse_mode: 'Markdown' as const,
      }
    }))
    
    await ctx.answerInlineQuery(articles.length ? articles : [{
      type: 'article',
      id: 'noresults',
      title: 'No results found',
      description: `Nothing found for "${query}"`,
      input_message_content: {
        message_text: `No inkd projects found for "${query}"`
      }
    }], { cache_time: 30 })
  } catch {
    await ctx.answerInlineQuery([], { cache_time: 0 })
  }
})

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
    { command: 'history',      description: 'View recent uploads' },
    { command: 'search',       description: 'Search public projects' },
    { command: 'export_key',   description: 'Export your private key (bot wallets only)' },
    { command: 'tutorial',     description: 'Interactive guided tour' },
    { command: 'links',        description: 'Website, socials, buy $INKD' },
    { command: 'cancel',       description: 'Cancel current action' },
    { command: 'help',         description: 'Show all commands' },
  ])

  const USE_WEBHOOK = process.env.BOT_WEBHOOK_URL

  if (USE_WEBHOOK) {
    // Webhook mode
    const handleUpdate = webhookCallback(bot, 'http')
    const server = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        await handleUpdate(req, res)
      } else {
        res.writeHead(200)
        res.end('inkd bot ok')
      }
    })

    const port = parseInt(process.env.BOT_PORT ?? '3001')
    server.listen(port, () => console.log(`inkd bot webhook on :${port}`))
    await bot.api.setWebhook(`${USE_WEBHOOK}/webhook`)
    console.log(`inkd bot webhook registered: ${USE_WEBHOOK}/webhook`)
  } else {
    // Polling mode (default)
    await bot.start({ drop_pending_updates: true })
    console.log('inkd bot running (polling)')
  }
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
