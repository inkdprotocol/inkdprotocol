import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { listProjectsByOwner } from './services/indexer'
import { createChallenge, recoverWalletFromSignature } from './services/auth'
import { beginTextUpload, handleUploadMessage } from './services/uploads'
import { SqliteStorage } from './services/session'

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

bot.use(session({
  storage: new SqliteStorage<BotSession>(sessionDbPath),
  initial: () => ({})
}))

bot.command('start', async ctx => {
  await ctx.reply('Welcome to inkd bot. Connect your wallet to continue.', {
    reply_markup: new InlineKeyboard().text('Connect Wallet', 'wallet_connect')
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

export async function start() {
  await bot.start({ drop_pending_updates: true })
  console.log('inkd bot running')
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
