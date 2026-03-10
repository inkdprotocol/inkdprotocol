import type { Context, SessionFlavor } from 'grammy'
import { InlineKeyboard } from 'grammy'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { uploadText, uploadBinary } from './arweave'
import { createProject } from './registry'
import { parseRepoInput, fetchRepoDefaultBranch, downloadRepoZip } from './github'
import { fetchUploadPrice, type UploadPriceQuote } from './pricing'

interface TextUploadSession {
  type: 'text'
  projectName?: string
}

interface PendingRepoUpload {
  owner: string
  repo: string
  ref: string
  projectName: string
  filename: string
  filePath: string
  size: number
  price: UploadPriceQuote
}

interface RepoUploadSession {
  type: 'repo'
  projectName?: string
  pending?: PendingRepoUpload
}

export type UploadSession = TextUploadSession | RepoUploadSession

interface BotSession {
  wallet?: string
  upload?: UploadSession
}

type MyContext = Context & SessionFlavor<BotSession>

export async function beginTextUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'text' }
  await ctx.reply('Send me the project name for this upload:')
}

export async function beginRepoUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'repo' }
  await ctx.reply('Send me the project name for this repo upload:')
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
    if (upload.type === 'repo') {
      await ctx.reply('Paste the GitHub repo URL or owner/repo (optionally @ref):')
    } else {
      await ctx.reply('Great. Now paste the content you want to store (text).')
    }
    return true
  }

  if (upload.type === 'text') {
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

  const link = ctx.message?.text?.trim()
  if (!link) {
    await ctx.reply('Please send the GitHub repo link or owner/repo.')
    return true
  }

  const wallet = ctx.session.wallet!
  const projectName = upload.projectName

  try {
    if (upload.pending) {
      cleanupPending(upload.pending)
      upload.pending = undefined
    }

    const parsed = parseRepoInput(link)
    const ref = parsed.ref ?? (await fetchRepoDefaultBranch(parsed.owner, parsed.repo))

    await ctx.reply(`Downloading ${parsed.owner}/${parsed.repo}@${ref}…`)
    const { buffer, filename, size } = await downloadRepoZip({ owner: parsed.owner, repo: parsed.repo, ref })

    const price = await fetchUploadPrice(size)

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkd-repo-'))
    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, buffer)

    upload.pending = {
      owner: parsed.owner,
      repo: parsed.repo,
      ref,
      projectName,
      filename,
      filePath,
      size,
      price,
    }

    const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`
    const breakdownLine = `Includes ${formatUsdc(price.arweaveCost)} USDC storage + ${formatUsdc(price.markup)} USDC protocol fee.`
    const summary = [
      `📦 ${parsed.owner}/${parsed.repo}@${ref}`,
      `Project: ${projectName}`,
      `Size: ${formatBytes(size)}`,
      estimateLine,
      breakdownLine,
      '',
      'Upload with these details?'
    ].join('\n')

    const keyboard = new InlineKeyboard()
      .text('✅ Upload', 'repo_confirm')
      .text('✖️ Cancel', 'repo_cancel')

    await ctx.reply(summary, { reply_markup: keyboard })
  } catch (err) {
    upload.pending && cleanupPending(upload.pending)
    upload.pending = undefined
    await ctx.reply(`Repo preparation failed: ${(err as Error).message}`)
  }
  return true
}

export async function handleRepoConfirm(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending repo upload.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const pending = upload.pending
  const wallet = ctx.session.wallet
  if (!wallet) {
    cleanupPending(pending)
    upload.pending = undefined
    await ctx.reply('Connect your wallet first with /start.')
    return
  }

  const statusMsg = await ctx.reply('⏳ Uploading to Arweave…')
  try {
    const buffer = fs.readFileSync(pending.filePath)
    const receipt = await uploadBinary(buffer, {
      contentType: 'application/zip',
      filename: pending.filename,
      tags: {
        'Project-Name': pending.projectName,
        'Wallet': wallet,
        'Repo': `${pending.owner}/${pending.repo}`,
        'Ref': pending.ref,
      }
    })
    const tx = await createProject(wallet, pending.projectName, receipt.hash)
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `Stored ${formatBytes(pending.size)} (${pending.filename}) on Arweave:\n${receipt.hash}\n${receipt.url}\nTx: ${receipt.txId}\n\nOn-chain: ${tx.transactionHash}`
    )
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `Repo upload failed: ${(err as Error).message}`
    )
  } finally {
    cleanupPending(pending)
    upload.pending = undefined
    ctx.session.upload = undefined
  }
}

export async function handleRepoCancel(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'Nothing to cancel.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()
  cleanupPending(upload.pending)
  upload.pending = undefined
  await ctx.reply('Upload cancelled.')
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function toNumber(value: number | string) {
  return typeof value === 'string' ? Number(value) : value
}

function formatUsdc(value: number | string) {
  const num = toNumber(value)
  return (num / 1_000_000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') || '0'
}

function cleanupPending(pending?: PendingRepoUpload) {
  if (!pending) return
  try {
    fs.rmSync(path.dirname(pending.filePath), { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}
