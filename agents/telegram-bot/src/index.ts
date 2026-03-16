import { Bot, Context, InlineKeyboard, InputFile, session, SessionFlavor, webhookCallback } from 'grammy'
import http from 'node:http'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
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
import { SqliteStorage, hideProject, unhideProject, getHiddenProjects } from './services/session'
import { generateWallet, encryptPrivateKey, decryptPrivateKey, getWalletBalance } from './services/wallet'

import { listProjectsByOwner, getProjectById, listVersions, getVersion, searchProjects, findProjectByOwnerAndName, getUploadPriceEstimate, type ApiProject, type ApiVersion } from './services/api'

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
  initial: () => ({}),
  // Disable per-update sequential locking — allows concurrent updates for same chat
  // This prevents callback_query timeouts when a long operation is in progress
  getSessionKey: (ctx) => ctx.chat?.id?.toString() ?? ctx.from?.id?.toString(),
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

  const caption = '🫟 *inkd*\n\nStore your code on-chain. For agents and humans.\n\n' +
    '[🌐 Website](https://inkdprotocol.com)\n' +
    '[𝕏 Profile](https://twitter.com/inkdprotocol)\n' +
    '[𝕏 Agent](https://x.com/inkdprotocolbot)\n' +
    '[🪙 $INKD](https://clanker.world/clanker/0x103013851D4475d7D1610C7941E2a16534a1eB07)\n' +
    '[🐱 GitHub](https://github.com/inkdprotocol/inkdprotocol)\n' +
    '[📦 npm](https://www.npmjs.com/package/@inkd/sdk)'

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
    const allProjects = await listProjectsByOwner(ctx.session.wallet, 50)
    const hidden = getHiddenProjects(sessionDbPath, String(ctx.from?.id))
    const projects = allProjects.filter(p => !hidden.has(String(p.id)))
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
    if (hidden.size > 0) {
      kb.row().text(`📦 Archived (${hidden.size})`, 'home_archived')
    }
    kb.row().text('🏠 Home', 'nav_home')
    await ctx.reply(`*Your files* (${projects.length})`, { parse_mode: 'Markdown', reply_markup: kb })
  } catch (err) {
    await ctx.reply(`Failed to load files: ${(err as Error).message}`, { reply_markup: homeBtn })
  }
})

bot.callbackQuery('home_archived', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.wallet) { await ctx.reply('Connect a wallet first.'); return }
  const userId = String(ctx.from?.id)
  const hidden = getHiddenProjects(sessionDbPath, userId)
  if (!hidden.size) {
    await ctx.reply('No archived projects.', { reply_markup: new InlineKeyboard().text('◀️ My Files', 'home_files') })
    return
  }
  // Fetch names for each hidden project
  const kb = new InlineKeyboard()
  for (const projectId of hidden) {
    let name = `#${projectId}`
    try {
      const p = await getProjectById(Number(projectId))
      if (p?.name) name = p.name
    } catch { /* keep id fallback */ }
    kb.text(`↩️ ${name}`, `unhide_project:${projectId}`).row()
  }
  kb.text('◀️ My Files', 'home_files').text('🏠 Home', 'nav_home')
  await ctx.reply(`*Archived* (${hidden.size})`, { parse_mode: 'Markdown', reply_markup: kb })
})

bot.callbackQuery(/^unhide_project:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = ctx.match[1]
  const userId = String(ctx.from?.id)
  unhideProject(sessionDbPath, userId, projectId)
  await ctx.reply(`Project #${projectId} restored.`, {
    reply_markup: new InlineKeyboard().text('◀️ My Files', 'home_files').text('📦 Archived', 'home_archived'),
  })
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

bot.callbackQuery('upload_menu', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.encryptedKey) {
    await ctx.reply('You need a bot-managed wallet to upload.\n\nCreate one via /start → 🎓 Tutorial.', {
      reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
    })
    return
  }
  await ctx.reply(
    '*Save anything on-chain, forever.*\n\nFiles, text, code — stored on Arweave, owned by your wallet.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('📝 Text / Note', 'upload_text_start').row()
        .text('🐙 GitHub Repo', 'upload_repo_start').row()
        .text('🏠 Home', 'nav_home'),
    }
  )
})

bot.callbackQuery(/^withdraw_all:(.+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const toAddress = ctx.match[1]
  if (!ctx.session.encryptedKey) { await ctx.reply('No wallet.'); return }
  try {
    const { usdcRaw } = await getWalletBalance(ctx.session.wallet!)
    if (usdcRaw === 0n) {
      await ctx.reply('No USDC to send.', { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
      return
    }
    const amount = Number(usdcRaw) / 1_000_000
    const statusMsg = await ctx.reply(`⏳ Sending ${amount.toFixed(2)} USDC…`)
    const { sendUsdc } = await import('./services/wallet.js')
    const txHash = await sendUsdc(ctx.session.encryptedKey, toAddress, amount)
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id,
      `✅ *Sent ${amount.toFixed(2)} USDC*\n\nTo: \`${toAddress}\`\n[View on Basescan](https://basescan.org/tx/${txHash})`,
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') }
    )
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.callbackQuery('wallet_refresh', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.wallet) {
    await ctx.reply('No wallet connected.')
    return
  }
  await showWalletInfo(ctx)
})

bot.callbackQuery('wallet_deposit', async ctx => {
  await ctx.answerCallbackQuery()
  const wallet = ctx.session.wallet
  if (!wallet) { await ctx.reply('No wallet.'); return }
  
  // Generate QR code for the wallet address
  const qrBuffer = await QRCode.toBuffer(`ethereum:${wallet}`, { type: 'png', width: 300 })
  
  await ctx.replyWithPhoto(new InputFile(qrBuffer, 'wallet-qr.png'), {
    caption: `*Add funds to your wallet*\n\nSend USDC or ETH on Base to:\n\`${wallet}\``,
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
  })
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
  await ctx.reply(
    '*Save anything on-chain, forever.*\n\nFiles, text, code — stored on Arweave, owned by your wallet.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('📝 Text / Note', 'upload_text_start').row()
        .text('🐙 GitHub Repo', 'upload_repo_start').row()
        .text('🏠 Home', 'nav_home'),
    }
  )
})

bot.callbackQuery('upload_text_start', async ctx => {
  await ctx.answerCallbackQuery()
  await beginTextUpload(ctx)
})

bot.callbackQuery('skip_description', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.upload) {
    await showHomeMenu(ctx)
    return
  }
  ;(ctx.session.upload as any).awaitingDescription = false
  const type = ctx.session.upload?.type
  if (type === 'text') {
    await ctx.reply('✏️ Type or paste anything — a note, code snippet, or any text. It will be stored on Arweave permanently:')
  } else if (type === 'file') {
    await ctx.reply('Send the file and it will be uploaded to Arweave permanently.')
  }
})

bot.callbackQuery('upload_repo_start', async ctx => {
  await ctx.answerCallbackQuery()
  ctx.session.upload = { type: 'repo' }
  await ctx.reply(
    '🐙 *GitHub Upload*\n\nSend a GitHub profile or repo URL to continue.',
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌ Cancel', 'nav_home') }
  )
})

// User picks a repo from the GitHub username list
bot.callbackQuery(/^gh_repo:(.+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const fullName = ctx.match[1] // e.g. "inkdprotocol/inkdprotocol"
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
  ctx.session.suggestedProjectId = undefined
  ctx.session.tutorialStep = undefined
  await ctx.reply('Cancelled.', { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
})

bot.callbackQuery('wallet_export_key', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.encryptedKey) {
    await ctx.reply('No bot-managed wallet.')
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
    await ctx.reply('Connect your wallet first with /start.', {
      reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home')
    })
    return
  }
  
  try {
    const projects = await listProjectsByOwner(ctx.session.wallet, 10)
    if (!projects.length) {
      await ctx.reply('No uploads yet.\n\nSend a file or use /upload\\_text to get started.', {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('⬆️ Upload', 'upload_menu')
          .text('🏠 Home', 'nav_home')
      })
      return
    }

    const lines = projects.slice(0, 8).map(p => {
      const shareUrl = `https://api.inkdprotocol.com/p/${p.id}`
      const vis = p.isPublic ? '🌍' : '🔒'
      return `${vis} *${p.name}* — [view](${shareUrl})`
    })

    const keyboard = new InlineKeyboard()
      .text('📁 My Files', 'home_files')
      .text('🏠 Home', 'nav_home')

    await ctx.reply(
      `*Recent uploads* (${projects.length})\n\n${lines.join('\n')}`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    )
  } catch (err) {
    await ctx.reply(formatApiError(err), {
      reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home')
    })
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

bot.command('top', async ctx => {
  try {
    const results = await searchProjects('', 8)
    if (!results.length) {
      await ctx.reply('No public projects yet.', { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
      return
    }
    const lines = results
      .filter(p => p.isPublic)
      .slice(0, 8)
      .map((p, i) => {
        const shareUrl = `https://api.inkdprotocol.com/p/${p.id}`
        return `${i + 1}. [${p.name}](${shareUrl}) · v${p.versionCount}`
      })
    const kb = new InlineKeyboard()
    results.filter(p => p.isPublic).slice(0, 5).forEach(p => {
      kb.text(`📂 ${p.name}`, `project:${p.id}`).row()
    })
    kb.text('🏠 Home', 'nav_home')
    await ctx.reply(`🔥 *Public Projects*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown', reply_markup: kb })
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.command('stats', async ctx => {
  try {
    const res = await fetch(`${process.env.INKD_API_URL ?? 'https://api.inkdprotocol.com'}/v1/status`)
    const data = await res.json() as any
    await ctx.reply(
      `📊 *inkd Protocol Stats*\n\n` +
      `Projects: ${data.protocol?.projectCount ?? 'n/a'}\n` +
      `Token supply: ${data.protocol?.totalSupply ?? 'n/a'}\n` +
      `Network: ${data.network ?? 'base'}\n` +
      `API uptime: ${Math.floor((data.server?.uptimeMs ?? 0) / 60000)} min`,
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') }
    )
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.command('estimate', async ctx => {
  const arg = ctx.match?.trim()
  if (!arg) {
    await ctx.reply(
      '💵 *Cost Estimator*\n\nUsage: `/estimate <size>`\n\nExamples:\n`/estimate 1mb`\n`/estimate 500kb`\n`/estimate 10000` (bytes)',
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') }
    )
    return
  }
  
  let bytes = 0
  const lower = arg.toLowerCase().trim()
  const numMatch = lower.match(/^([\d.]+)\s*(kb|mb|gb|b)?$/)
  if (numMatch) {
    const n = parseFloat(numMatch[1])
    const unit = numMatch[2] ?? 'b'
    if (unit === 'gb') bytes = Math.round(n * 1024 * 1024 * 1024)
    else if (unit === 'mb') bytes = Math.round(n * 1024 * 1024)
    else if (unit === 'kb') bytes = Math.round(n * 1024)
    else bytes = Math.round(n)
  } else {
    await ctx.reply('Could not parse size. Try `/estimate 500kb` or `/estimate 2mb`.', { parse_mode: 'Markdown' })
    return
  }
  
  if (bytes <= 0 || bytes > 500 * 1024 * 1024) {
    await ctx.reply('Size must be between 1 byte and 500 MB.')
    return
  }
  
  try {
    const price = await getUploadPriceEstimate(bytes)
    const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`
    await ctx.reply(
      `💵 *Cost Estimate*\n\n` +
      `Size: ${formatBytes(bytes)}\n\n` +
      `Arweave storage: $${price.arweaveCostUsd}\n` +
      `Protocol fee (20%): $${(parseFloat(price.totalUsd) - parseFloat(price.arweaveCostUsd)).toFixed(4)}\n` +
      `─────────────────\n` +
      `*Total: ${price.totalUsd} USDC*\n\n` +
      `_Minimum charge is $0.10 USDC._`,
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') }
    )
  } catch (err) {
    await ctx.reply(formatApiError(err))
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
    `/top — Trending public projects\n` +
    `/stats — Protocol stats\n` +
    `/estimate <size> — Calculate upload cost\n` +
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
        .url('𝕏 @inkdprotocol', 'https://x.com/inkdprotocol').url('🕵️ Inkd Agent', 'https://x.com/inkdprotocolbot').row()
        .url('🪙 Buy $INKD', 'https://clanker.world/clanker/0x103013851D4475d7D1610C7941E2a16534a1eB07')
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

bot.on('message:photo', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  if (!ctx.session.encryptedKey) {
    await ctx.reply('⚠️ You connected an external wallet. Uploads require a bot-managed wallet.\n\nUse /start → "🆕 New Wallet" to create one.')
    return
  }
  // Use highest-resolution photo
  const photos = ctx.message.photo
  const photo = photos[photos.length - 1]
  const fileSize = photo.file_size ?? 0
  await beginFileUpload(ctx, photo.file_id, `photo_${Date.now()}.jpg`, 'image/jpeg', fileSize)
})

bot.on('message:video', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  if (!ctx.session.encryptedKey) {
    await ctx.reply('⚠️ You connected an external wallet. Uploads require a bot-managed wallet.\n\nUse /start → "🆕 New Wallet" to create one.')
    return
  }
  const video = ctx.message.video
  const fileSize = video.file_size ?? 0
  if (fileSize > MAX_FILE_BYTES) {
    await ctx.reply(`❌ Video too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`)
    return
  }
  const fileName = video.file_name ?? `video_${Date.now()}.mp4`
  await beginFileUpload(ctx, video.file_id, fileName, video.mime_type ?? 'video/mp4', fileSize)
})

bot.on('message:text', async ctx => {
  // Handle search_query flow
  if ((ctx.session.upload as any)?.type === 'search_query') {
    const query = ctx.message.text.trim()
    ctx.session.upload = undefined
    try {
      const results = await searchProjects(query)
      if (!results.length) {
        await ctx.reply(`No results for "${query}".`, { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
        return
      }
      const kb = new InlineKeyboard()
      for (const p of results.slice(0, 5)) {
        kb.text(`📂 ${p.name}`, `project:${p.id}`).row()
      }
      kb.text('🏠 Home', 'nav_home')
      await ctx.reply(`*Results for "${query}"*`, { parse_mode: 'Markdown', reply_markup: kb })
    } catch (err) {
      await ctx.reply(formatApiError(err))
    }
    return
  }

  // Handle withdraw_address flow
  if ((ctx.session.upload as any)?.type === 'withdraw_address') {
    const toAddress = ctx.message.text.trim()
    ctx.session.upload = undefined
    if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
      await ctx.reply('Invalid Base address. Must start with 0x and be 42 characters.\n\nUse /cancel to abort.', {
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'nav_home'),
      })
      return
    }
    if (!ctx.session.encryptedKey) {
      await ctx.reply('No bot-managed wallet.')
      return
    }
    try {
      const { usdcRaw, eth } = await getWalletBalance(ctx.session.wallet!)
      const usdcFormatted = (Number(usdcRaw) / 1_000_000).toFixed(2)
      await ctx.reply(
        `*Send funds to* \`${toAddress}\`\n\n` +
        `Available:\n` +
        `• ${usdcFormatted} USDC\n` +
        `• ${parseFloat(eth).toFixed(6)} ETH\n\n` +
        `How much USDC to send?`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text(`Send all (${usdcFormatted} USDC)`, `withdraw_all:${toAddress}`)
            .row()
            .text('❌ Cancel', 'nav_home'),
        }
      )
      ctx.session.upload = { type: 'withdraw_amount', toAddress } as any
    } catch (err) {
      await ctx.reply(formatApiError(err))
    }
    return
  }

  // Handle withdraw_amount flow
  if ((ctx.session.upload as any)?.type === 'withdraw_amount') {
    const amountStr = ctx.message.text.trim()
    const toAddress = (ctx.session.upload as any).toAddress
    ctx.session.upload = undefined
    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Invalid amount. Please enter a number like `5.00`.', { parse_mode: 'Markdown' })
      return
    }
    if (!ctx.session.encryptedKey) return
    const statusMsg = await ctx.reply(`⏳ Sending ${amount} USDC to \`${toAddress}\`…`, { parse_mode: 'Markdown' })
    try {
      const { sendUsdc } = await import('./services/wallet.js')
      const txHash = await sendUsdc(ctx.session.encryptedKey, toAddress, amount)
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id,
        `✅ *Sent ${amount} USDC*\n\nTo: \`${toAddress}\`\n[View on Basescan](https://basescan.org/tx/${txHash})`,
        { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') }
      )
    } catch (err) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, formatApiError(err))
    }
    return
  }

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
    
    ctx.session.wallet = address
    ctx.session.encryptedKey = encryptedKey
    ctx.session.pendingChallenge = undefined
    
    // Step 1: Show private key warning (must save this)
    await ctx.reply(
      `🆕 *Wallet Created*\n\n` +
      `\`${address}\`\n\n` +
      `🔐 *Private Key — SAVE NOW (shown once only!)*\n` +
      `\`${privateKey}\`\n\n` +
      `⚠️ Store this offline. Anyone with this key owns your funds.`,
      { parse_mode: 'Markdown' }
    )
    
    // Step 2: Immediately show funding instructions with wallet card
    await ctx.reply(
      `💰 *Fund your wallet*\n\n` +
      `Send USDC on Base to:\n\`${address}\`\n\n` +
      `You need at least $0.10 USDC to upload.`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅ Check Balance', 'wallet_refresh')
          .text('⬆️ Start Upload', 'home_upload')
          .row()
          .text('🏠 Home', 'nav_home'),
      }
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
bot.callbackQuery('repo_confirm_public', ctx => handleRepoConfirm(ctx, false))
bot.callbackQuery('repo_confirm_private', ctx => handleRepoConfirm(ctx, true))
bot.callbackQuery('repo_cancel', handleRepoCancel)
bot.callbackQuery('text_confirm', ctx => handleTextConfirm(ctx))
bot.callbackQuery('text_confirm_public', ctx => handleTextConfirm(ctx, false))
bot.callbackQuery('text_confirm_private', ctx => handleTextConfirm(ctx, true))
bot.callbackQuery('text_cancel', handleTextCancel)
bot.callbackQuery('file_confirm', ctx => handleFileConfirm(ctx))
bot.callbackQuery('file_confirm_public', ctx => handleFileConfirm(ctx, false))
bot.callbackQuery('file_confirm_private', ctx => handleFileConfirm(ctx, true))
bot.callbackQuery('file_cancel', handleFileCancel)

bot.callbackQuery('export_key_confirm', async ctx => {
  await ctx.answerCallbackQuery()
  if (!ctx.session.encryptedKey) {
    await ctx.reply('No bot-managed wallet.')
    return
  }
  
  try {
    const privateKey = decryptPrivateKey(ctx.session.encryptedKey)
    const sent = await ctx.reply(
      `🔑 *Your Private Key*\n\n` +
      `\`${privateKey}\`\n\n` +
      `⚠️ Save this immediately. Delete this message after saving.\n` +
      `Never share this with anyone.`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🗑 Delete this message', `delete_msg:${ctx.chat!.id}`),
      }
    )
    // Store message_id in callback data via a separate handler
    // We embed the message_id in the callback after sending
    await ctx.api.editMessageReplyMarkup(ctx.chat!.id, sent.message_id, {
      reply_markup: new InlineKeyboard()
        .text('🗑 Delete this message', `delete_msg:${sent.message_id}`),
    })
  } catch (err) {
    await ctx.reply('Failed to decrypt key. Please contact support.')
  }
})

bot.callbackQuery(/^delete_msg:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, Number(ctx.match[1]))
  } catch {
    await ctx.answerCallbackQuery({ text: 'Could not delete message.' })
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

bot.callbackQuery(/^use_tag:(\d+):(.+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = Number(ctx.match[1])
  const tag = decodeURIComponent(ctx.match[2])
  ctx.session.pendingVersionPush = { projectId, versionTag: tag }
  await ctx.reply(`Tag set to *${tag}*. Send changelog (or /skip):`, { parse_mode: 'Markdown' })
})

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
    
    // Push version, share, preview
    keyboard
      .text('⬆️ Upload File', `push_version:${projectId}`)
      .text('🔗 Share', `share:${projectId}`)
      .row()
    
    if (versions.length > 0) {
      keyboard
        .text('👁 Preview', `preview:${projectId}:${versions[0].versionIndex}`)
        .row()
    }
    
    for (const v of versions) {
      keyboard
        .text(`⬇ v${v.versionIndex} · ${v.versionTag}`, `download:${projectId}:${v.versionIndex}`)
        .row()
    }

    keyboard
      .text('🗑 Hide', `hide_project:${projectId}`)
      .text('◀️ My Files', 'home_files')
      .text('🏠 Home', 'nav_home')

    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard })
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

bot.callbackQuery(/^hide_project:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = ctx.match[1]
  const userId = String(ctx.from.id)
  hideProject(sessionDbPath, userId, projectId)
  await ctx.reply(`Archived. Find it under 📦 Archived in My Files.`, {
    reply_markup: new InlineKeyboard().text('◀️ My Files', 'home_files').text('📦 Archived', 'home_archived'),
  })
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

bot.callbackQuery(/^preview:(\d+):(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = Number(ctx.match[1])
  const versionIndex = Number(ctx.match[2])

  try {
    const version = await getVersion(projectId, versionIndex)
    if (!version) { await ctx.reply('Version not found.'); return }

    const url = `https://arweave.net/${version.arweaveHash}`
    const statusMsg = await ctx.reply('⏳ Fetching preview…')

    const res = await fetch(url, { headers: { Range: 'bytes=0-1023' } })
    if (!res.ok) throw new Error(`Arweave responded with HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    const isText = contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('javascript')

    if (!isText) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id,
        `👁 *Preview* — v${versionIndex}\n\nNot a text file (\`${contentType}\`).\n[View on Arweave ↗](${url})`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    const text = await res.text()
    const preview = text.slice(0, 400).replace(/`/g, "'")
    const truncated = text.length > 400

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id,
      `👁 *Preview* — v${versionIndex} · \`${version.versionTag}\`\n\n\`\`\`\n${preview}${truncated ? '\n…' : ''}\n\`\`\`\n\n[View full ↗](${url})`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    await ctx.reply(formatApiError(err))
  }
})

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
        reply_markup: (() => {
          const kb = new InlineKeyboard()
            .text('📥 Add Funds', 'wallet_deposit').text('💸 Send', 'wallet_withdraw').row()
          if (!isExternal) kb.text('🔑 Export Key', 'wallet_export_key').row()
          kb.text('🏠 Home', 'nav_home')
          return kb
        })(),
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
  return new Date(num * 1000).toLocaleString('en-GB', { timeZone: 'UTC' })
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
  const vis = project.isPublic ? '🌍 Public' : '🔒 Private'
  const vCount = Number(project.versionCount)
  const vLabel = vCount === 0 ? 'No versions yet' : `${vCount} version${vCount !== 1 ? 's' : ''}`
  const header = `*${project.name}*\n${vis} · ${vLabel}`

  if (!versions.length) {
    return `${header}\n\n_No files yet. Tap ⬆️ Upload File to add one._`
  }
  const lines = versions.map(v => formatVersionLine(v))
  const body = lines.join('\n\n')
  const extra = versions.length < vCount ? '\n\n_… and more._' : ''
  return `${header}\n\n${body}${extra}`
}

function formatVersionLine(version: ApiVersion) {
  const date = formatTimestamp(version.pushedAt)
  const ar = version.arweaveHash
  return `📦 *${version.versionTag}* · ${date}\n\`${ar}\``
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
        reply_markup: new InlineKeyboard()
          .text('🏠 Home', 'nav_home').text('Next ➡️', 'tutorial_2')
      }
    )
  } else if (step === 2) {
    if (ctx.session.wallet) {
      await ctx.reply(
        `🔑 Step 2/4 — Wallet\n\nYou're all set: \`${ctx.session.wallet}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('🏠 Home', 'nav_home').text('Next ➡️', 'tutorial_3')
        }
      )
    } else {
      await ctx.reply(
        `🔑 Step 2/4 — Set up your wallet\n\nYou need a wallet to own projects and pay for uploads.`,
        {
          reply_markup: new InlineKeyboard()
            .text('🆕 Create Wallet', 'tutorial_create_wallet')
            .text('Skip →', 'tutorial_3')
            .row()
            .text('🏠 Home', 'nav_home')
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
        reply_markup: new InlineKeyboard()
          .text('🏠 Home', 'nav_home').text("✅ I'm ready", 'tutorial_4')
      }
    )
  } else if (step === 4) {
    await ctx.reply(
      `🚀 Step 4/4 — First upload\n\n` +
      `You're ready. Choose:\n\n` +
      `• Upload Text — store any text permanently\n` +
      `• Upload Repo — archive a GitHub repo\n\n` +
      `Files live on Arweave forever. Registered on Base. Owned by your wallet.`,
      {
        reply_markup: new InlineKeyboard()
          .text('📝 Upload Text', 'tutorial_upload_text')
          .text('📦 Upload Repo', 'tutorial_upload_repo')
          .row()
          .text('🏠 Home', 'nav_home').text('Done ✅', 'tutorial_done')
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
  await ctx.reply("You're all set! Use /start anytime to get back to the main menu.", {
    reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
  })
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
    
    const shareUrl = `https://api.inkdprotocol.com/p/${projectId}`
    
    const shareText = [
      `📦 *${project.name}*`,
      ``,
      `${project.versionCount} version${Number(project.versionCount) !== 1 ? 's' : ''} • stored forever on Arweave`,
      ``,
      shareUrl,
    ].join('\n')
    
    await ctx.reply(shareText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .url('📄 View content', shareUrl)
        .url('🔍 Basescan', `https://basescan.org/address/${project.owner}`)
        .row()
        .text('🏠 Home', 'nav_home')
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

// ─── Wallet Monitor ───────────────────────────────────────────────────────────

// Track last known USDC balance per user to detect incoming funds
const knownBalances = new Map<string, bigint>() // chatId → usdcRaw

async function pollWallets() {
  try {
    // Get all sessions with wallets from SQLite
    const sessions = sqliteStorage.getAllSessions?.() ?? []
    for (const { chatId, session: s } of sessions) {
      if (!s.wallet || !s.encryptedKey) continue
      try {
        const { usdcRaw } = await getWalletBalance(s.wallet)
        const prev = knownBalances.get(chatId)
        if (prev !== undefined && usdcRaw > prev) {
          const received = usdcRaw - prev
          const usdcFormatted = (Number(received) / 1_000_000).toFixed(2)
          await bot.api.sendMessage(
            Number(chatId),
            `💰 *${usdcFormatted} USDC received!*\n\nYour balance is now $${(Number(usdcRaw) / 1_000_000).toFixed(2)} USDC.\n\nReady to upload? Tap below.`,
            {
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard()
                .text('⬆️ Upload Now', 'home_upload')
                .text('💼 Wallet', 'home_wallet'),
            }
          )
        }
        knownBalances.set(chatId, usdcRaw)
      } catch { /* ignore per-wallet errors */ }
    }
  } catch { /* ignore poll errors */ }
}

// ─── Error Handler ────────────────────────────────────────────────────────────

bot.catch(err => {
  const msg = err.message ?? String(err)
  // Ignore expired callback query errors (Telegram 60s timeout)
  if (msg.includes('query is too old') || msg.includes('query ID is invalid')) return
  console.error('[inkd-bot] Bot error:', msg)
})

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[inkd-bot] Unhandled rejection (swallowed):', reason instanceof Error ? reason.message : reason)
})
process.on('uncaughtException', (err) => {
  console.error('[inkd-bot] Uncaught exception (swallowed):', err.message)
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
    { command: 'stats',        description: 'Protocol stats' },
    { command: 'estimate',     description: 'Calculate upload cost: /estimate 500kb' },
    { command: 'export_key',   description: 'Export your private key (bot wallets only)' },
    { command: 'tutorial',     description: 'Interactive guided tour' },

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

  // Start wallet monitor (every 60s)
  setInterval(pollWallets, 60_000)
  console.log('inkd bot wallet monitor started (60s interval)')
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
