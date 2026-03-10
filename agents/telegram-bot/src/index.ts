import { Bot, Context, InlineKeyboard, InputFile, session, SessionFlavor } from 'grammy'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { getProjectById, getVersion, listProjectsByOwner, listVersions } from './services/indexer'
import type { IndexedProject, IndexedVersion } from './services/indexer'
import { createChallenge, recoverWalletFromSignature } from './services/auth'
import { beginTextUpload, handleUploadMessage } from './services/uploads'
import { SqliteStorage } from './services/session'
import { createWalletConnectSession, extractAddress } from './services/walletconnect'

dotenv.config({ path: process.env.BOT_ENV_PATH ?? '.env' })

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN missing')
}

type UploadSession = {
  type: 'text'
  projectName?: string
}

type BotSession = {
  wallet?: string
  pendingChallenge?: string
  upload?: UploadSession
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

const walletKeyboard = new InlineKeyboard()
  .text('🔗 WalletConnect', 'wallet_connect')
  .row()
  .text('✍️ Manual signature', 'wallet_manual')

bot.command('start', async ctx => {
  await ctx.reply('Welcome to inkd bot. Connect your wallet to continue.', {
    reply_markup: walletKeyboard
  })
})

bot.command('upload_text', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  await beginTextUpload(ctx)
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
    await ctx.reply(`Wallet ${address} linked. Use /my_projects to view your projects.`)
  } catch (err) {
    await ctx.reply('Signature invalid. Please try again.')
  }
})

bot.callbackQuery('wallet_connect', async ctx => {
  if (!ctx.chat) {
    await ctx.answerCallbackQuery({ text: 'Chats only' })
    return
  }
  await ctx.answerCallbackQuery()
  await ctx.reply('Generating WalletConnect link …')
  try {
    const { uri, approval } = await createWalletConnectSession()
    if (!uri) {
      await ctx.reply('WalletConnect did not return a pairing URI. Please try again in a moment.')
      return
    }
    await sendWalletConnectPrompt(ctx, uri)
    const chatId = ctx.chat.id.toString()
    approval()
      .then(async session => {
        const address = extractAddress(session)
        const current = (await sqliteStorage.read(chatId)) ?? {}
        current.wallet = address
        current.pendingChallenge = undefined
        await sqliteStorage.write(chatId, current)
        await ctx.api.sendMessage(
          ctx.chat!.id,
          `Wallet ${address} linked via WalletConnect ✅ Use /upload_text or /my_projects.`
        )
      })
      .catch(async err => {
        await ctx.api.sendMessage(ctx.chat!.id, `WalletConnect session failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      })
  } catch (err) {
    await ctx.reply(`WalletConnect setup failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
})

bot.callbackQuery('wallet_manual', async ctx => {
  const challenge = createChallenge(ctx.from.id)
  ctx.session.pendingChallenge = challenge
  await ctx.answerCallbackQuery()
  await ctx.reply(
    `Sign the following message with your Base wallet and send the signature back here:\n\n${challenge}`
  )
})

bot.command('my_projects', async ctx => {
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    return
  }
  const projects = listProjectsByOwner(ctx.session.wallet, 5)
  if (!projects.length) {
    await ctx.reply('No projects yet for this wallet.')
    return
  }
  for (const project of projects) {
    const summary = formatProjectSummary(project)
    const keyboard = new InlineKeyboard().text('📂 Details', `project:${project.id}`)
    await ctx.reply(summary, { reply_markup: keyboard })
  }
})

bot.callbackQuery(/^project:(\d+)$/, async ctx => {
  await ctx.answerCallbackQuery()
  const projectId = Number(ctx.match?.[1])
  if (!projectId) {
    await ctx.reply('Invalid project id.')
    return
  }
  const project = getProjectById(projectId)
  if (!project) {
    await ctx.reply('Project not found.')
    return
  }
  const versions = listVersions(projectId, 5)
  const message = formatProjectDetails(project, versions)

  // Build one download button per version (up to 5), each on its own row
  const keyboard = new InlineKeyboard()
  for (const v of versions) {
    keyboard
      .text(`⬇ v${v.version_index} · ${v.version_tag}`, `download:${projectId}:${v.version_index}`)
      .row()
  }

  await ctx.reply(message, { reply_markup: keyboard })
})

const MAX_DIRECT_BYTES = 48 * 1024 * 1024 // 48 MB Telegram bot API limit

/** Map common MIME types to file extensions for better filenames. */
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

  const version = getVersion(projectId, versionIndex)
  if (!version) {
    await ctx.reply('Version not found.')
    return
  }

  const url = `https://arweave.net/${version.arweave_hash}`

  // Notify user that we're fetching
  const statusMsg = await ctx.reply(`⏳ Fetching v${versionIndex} from Arweave…`)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Arweave responded with HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type')
    const contentLength = response.headers.get('content-length')
    const byteSize = contentLength ? Number(contentLength) : null

    // If size is known and exceeds limit, send a direct link instead
    if (byteSize !== null && byteSize > MAX_DIRECT_BYTES) {
      await response.body?.cancel()
      const mb = (byteSize / 1024 / 1024).toFixed(1)
      await ctx.api.editMessageText(
        ctx.chat!.id, statusMsg.message_id,
        `📦 v${versionIndex} is ${mb} MB — too large to send via Telegram.\nDownload directly: ${url}`
      )
      return
    }

    // Buffer the response body
    const buffer = Buffer.from(await response.arrayBuffer())

    // Build a descriptive filename: <hash><ext>
    const ext = extForMime(contentType)
    const filename = `${version.arweave_hash}${ext}`

    await ctx.replyWithDocument(new InputFile(buffer, filename), {
      caption: `v${versionIndex} · ${version.version_tag}`
    })

    // Remove the "fetching" status message after successful send
    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `❌ Failed to fetch v${versionIndex}: ${msg}`
    )
  }
})

function shortenAddress(addr?: string) {
  if (!addr) return 'unknown'
  return addr.length <= 10 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatTimestamp(ts?: number) {
  if (!ts) return 'n/a'
  return new Date(ts * 1000).toLocaleString('de-DE', { timeZone: 'UTC' })
}

function formatProjectSummary(project: IndexedProject) {
  return [
    `#${project.id} · ${project.name}`,
    `Owner: ${shortenAddress(project.owner)}`,
    `Versions: ${project.version_count}`,
    `Updated: ${formatTimestamp(project.updated_at)}`
  ].join('\n')
}

function formatProjectDetails(project: IndexedProject, versions: IndexedVersion[]) {
  const header = [
    `📂 ${project.name} (#${project.id})`,
    `Owner: ${shortenAddress(project.owner)}`,
    `Total versions: ${project.version_count}`
  ].join('\n')
  if (!versions.length) {
    return `${header}\n\nKeine Versionen gefunden.`
  }
  const lines = versions.map(v => formatVersionLine(v))
  const body = lines.join('\n\n')
  const extra = versions.length < project.version_count ? '\n… weitere Versionen existieren.' : ''
  return `${header}\n\n${body}${extra}`
}

function formatVersionLine(version: IndexedVersion) {
  const date = formatTimestamp(version.pushed_at)
  const ar = version.arweave_hash
  const link = `https://arweave.net/${ar}`
  return `v${version.version_index} · ${version.version_tag} (${date})\nArweave: ${ar}\n${link}`
}

async function sendWalletConnectPrompt(ctx: MyContext, uri: string) {
  const deepLink = `https://reown.app/wc?uri=${encodeURIComponent(uri)}`
  const qrBuffer = await QRCode.toBuffer(uri, { width: 512 })
  await ctx.reply('Scan or open the link below to approve the session:')
  await ctx.replyWithPhoto(new InputFile(qrBuffer), {
    caption: 'Scan this QR code from any WalletConnect-compatible wallet.',
  })
  await ctx.reply(
    'On mobile, tap the button below to open your wallet directly.',
    {
      reply_markup: new InlineKeyboard().url('Open Wallet', deepLink)
    }
  )
  await ctx.reply(`WalletConnect URI (Desktop Copy/Paste):\n${uri}`)
}

export async function start() {
  await bot.start({ drop_pending_updates: true })
  console.log('inkd bot running')
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
