import { Bot, Context, InlineKeyboard, InputFile, session, SessionFlavor } from 'grammy'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { listProjectsByOwner } from './services/indexer'
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
  const lines = projects.map(p => `#${p.id} · ${p.name} · versions: ${p.version_count}`)
  await ctx.reply(lines.join('\n'))
})

async function sendWalletConnectPrompt(ctx: MyContext, uri: string) {
  const deepLink = `https://walletconnect.com/wc?uri=${encodeURIComponent(uri)}`
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
}

export async function start() {
  await bot.start({ drop_pending_updates: true })
  console.log('inkd bot running')
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
