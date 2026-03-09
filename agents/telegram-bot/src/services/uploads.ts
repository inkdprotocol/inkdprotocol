import type { Context, SessionFlavor } from 'grammy'
import { uploadText } from './arweave'
import { createProject } from './registry'

interface UploadSession {
  type: 'text'
  projectName?: string
}

interface BotSession {
  wallet?: string
  upload?: UploadSession
}

type MyContext = Context & SessionFlavor<BotSession>

export async function beginTextUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'text' }
  await ctx.reply('Send me the project name for this upload:')
}

export async function handleUploadMessage(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload) return false
  if (!ctx.session.wallet) {
    await ctx.reply('Connect your wallet first with /start.')
    ctx.session.upload = undefined
    return true
  }
  if (!upload.projectName) {
    const text = ctx.message?.text?.trim()
    if (!text) {
      await ctx.reply('Please send a valid project name (text message).')
      return true
    }
    upload.projectName = text
    await ctx.reply('Great. Now paste the content you want to store (text).')
    return true
  }
  const content = ctx.message?.text
  if (!content) {
    await ctx.reply('Please send text content for the upload.')
    return true
  }
  try {
    const wallet = ctx.session.wallet!
    const receipt = await uploadText(content, {
      'Project-Name': upload.projectName,
      'Wallet': wallet,
    })
    const tx = await createProject(wallet, upload.projectName, receipt.hash)
    ctx.session.upload = undefined
    await ctx.reply(
      `Stored ${content.length} characters on Arweave:\n${receipt.hash}\n${receipt.url}\nTx: ${receipt.txId}\n\nOn-chain: ${tx.transactionHash}`
    )
  } catch (err) {
    await ctx.reply(`Upload failed: ${(err as Error).message}`)
  }
  return true
}
