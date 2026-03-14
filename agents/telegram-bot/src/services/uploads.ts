import type { Context, SessionFlavor } from 'grammy'
import { InlineKeyboard } from 'grammy'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MAX_TEXT_BYTES  = 512 * 1024       // 512 KB text limit
const MAX_REPO_MB     = 100              // 100 MB repo zip limit
import { parseRepoInput, fetchRepoDefaultBranch, downloadRepoZip } from './github.js'
import { getUploadPriceEstimate, findProjectByOwnerAndName, type PriceEstimate } from './api.js'
import { uploadToArweave, createProject, pushVersion } from './x402.js'
import { checkUsdcBalance, decryptPrivateKey } from './wallet.js'
import { privateKeyToAccount } from 'viem/accounts'

// ─── Session Types ────────────────────────────────────────────────────────────

interface PendingTextUpload {
  content: string
  size: number
  price: PriceEstimate
}

interface TextUploadSession {
  type: 'text'
  projectName?: string
  pending?: PendingTextUpload
}

interface PendingRepoUpload {
  owner: string
  repo: string
  ref: string
  projectName: string
  filename: string
  filePath: string
  size: number
  price: PriceEstimate
}

interface RepoUploadSession {
  type: 'repo'
  projectName?: string
  pending?: PendingRepoUpload
}

interface PendingFileUpload {
  fileId: string
  fileName: string
  mimeType: string
  fileSize: number
  price: PriceEstimate
}

interface FileUploadSession {
  type: 'file'
  projectName?: string
  fileId?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  pending?: PendingFileUpload
}

export type UploadSession = TextUploadSession | RepoUploadSession | FileUploadSession

// Version push session for existing projects
export interface PendingVersionPush {
  projectId: number
  versionTag?: string
  changelog?: string
  type?: 'text' | 'repo'
  content?: string // for text
  contentSize?: number
  pending?: { // for repo
    owner: string
    repo: string
    ref: string
    filename: string
    filePath: string
    size: number
  }
}

interface BotSession {
  wallet?: string
  encryptedKey?: string
  upload?: UploadSession
  pendingVersionPush?: PendingVersionPush
  suggestedProjectId?: string
}

type MyContext = Context & SessionFlavor<BotSession>

// ─── Error Formatting ─────────────────────────────────────────────────────────

export function formatApiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('insufficient') || msg.includes('balance'))
    return '❌ Insufficient USDC balance. Use /wallet to check.'
  if (msg.includes('402') || msg.includes('payment'))
    return '❌ Payment failed. Check your USDC balance with /wallet.'
  if (msg.includes('404'))
    return '❌ Not found.'
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT'))
    return '❌ Request timed out. Try again.'
  if (msg.includes('invalid') || msg.includes('Invalid'))
    return `❌ Invalid input: ${msg.split(':').pop()?.trim()}`
  return `❌ Something went wrong. Try again or use /cancel.`
}

// ─── Balance Check Helper ─────────────────────────────────────────────────────

export async function ensureSufficientBalance(
  ctx: MyContext,
  requiredUsdc: bigint
): Promise<boolean> {
  if (!ctx.session.wallet || !ctx.session.encryptedKey) return false
  
  const check = await checkUsdcBalance(ctx.session.wallet, requiredUsdc)
  if (check.ok) return true
  
  const formatUsdc = (val: bigint) => (Number(val) / 1_000_000).toFixed(2)
  
  await ctx.reply(
    `❌ *Insufficient USDC balance*\n\n` +
    `Required: $${formatUsdc(check.required)} USDC\n` +
    `Your balance: $${formatUsdc(check.balance)} USDC\n` +
    `Shortfall: $${formatUsdc(check.shortfall)} USDC\n\n` +
    `Your wallet: \`${ctx.session.wallet}\`\n\n` +
    `Get USDC on Base:\n` +
    `• Bridge: bridge.base.org\n` +
    `• Buy directly: coinbase.com`,
    { parse_mode: 'Markdown' }
  )
  return false
}

// ─── Success Buttons Helper ───────────────────────────────────────────────────

export function buildSuccessKeyboard(txHash: string, arweaveHash: string): InlineKeyboard {
  return new InlineKeyboard()
    .url('🔍 Basescan', `https://basescan.org/tx/${txHash}`)
    .url('📄 Arweave', `https://arweave.net/${arweaveHash}`)
    .row()
    .url('🌐 inkdprotocol.com', 'https://inkdprotocol.com')
}

// ─── Begin Upload Flows ───────────────────────────────────────────────────────

export async function beginTextUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'text' }
  await ctx.reply('Send me the project name for this upload:')
}

export async function beginRepoUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'repo' }
  await ctx.reply('Send me the project name for this repo upload:')
}

export async function beginFileUpload(
  ctx: MyContext,
  fileId: string,
  fileName: string,
  mimeType: string,
  fileSize: number
) {
  ctx.session.upload = {
    type: 'file',
    fileId,
    fileName,
    mimeType,
    fileSize,
  }
  await ctx.reply(`📎 File received: *${fileName}* (${formatBytes(fileSize)})\n\nSend me the project name for this upload:`, { parse_mode: 'Markdown' })
}

// ─── Begin Version Push Flow ──────────────────────────────────────────────────

export async function beginVersionPush(ctx: MyContext, projectId: number) {
  ctx.session.pendingVersionPush = { projectId }
  await ctx.reply('📝 Send version tag (e.g. v1.0.1):')
}

// ─── Handle Version Push Messages ─────────────────────────────────────────────

export async function handleVersionPushMessage(ctx: MyContext): Promise<boolean> {
  const push = ctx.session.pendingVersionPush
  if (!push) return false

  const text = ctx.message?.text?.trim()
  if (!text) return true

  // Handle /skip for changelog
  if (text === '/skip' && push.versionTag && !push.changelog && !push.type) {
    push.changelog = ''
    const keyboard = new InlineKeyboard()
      .text('📝 Text Content', `push_text:${push.projectId}`)
      .text('📦 GitHub Repo', `push_repo:${push.projectId}`)
    await ctx.reply('What do you want to upload?', { reply_markup: keyboard })
    return true
  }

  // Step 1: Get version tag
  if (!push.versionTag) {
    push.versionTag = text
    await ctx.reply('Send changelog (or /skip):')
    return true
  }

  // Step 2: Get changelog
  if (push.changelog === undefined) {
    push.changelog = text
    const keyboard = new InlineKeyboard()
      .text('📝 Text Content', `push_text:${push.projectId}`)
      .text('📦 GitHub Repo', `push_repo:${push.projectId}`)
    await ctx.reply('What do you want to upload?', { reply_markup: keyboard })
    return true
  }

  // Step 3: Handle text content
  if (push.type === 'text' && !push.content) {
    push.content = text
    push.contentSize = Buffer.from(text, 'utf8').length
    
    try {
      const price = await getUploadPriceEstimate(push.contentSize)
      const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`
      
      const summary = [
        `📝 Push Version`,
        `Version: ${push.versionTag}`,
        `Changelog: ${push.changelog || '(none)'}`,
        `Size: ${formatBytes(push.contentSize)}`,
        estimateLine,
        '',
        'Continue?',
      ].join('\n')

      const keyboard = new InlineKeyboard()
        .text('✅ Push', `push_confirm:${push.projectId}`)
        .text('✖️ Cancel', 'push_cancel')

      await ctx.reply(summary, { reply_markup: keyboard })
    } catch (err) {
      await ctx.reply(formatApiError(err))
      ctx.session.pendingVersionPush = undefined
    }
    return true
  }

  // Step 4: Handle repo URL
  if (push.type === 'repo' && !push.pending) {
    try {
      const parsed = parseRepoInput(text)
      const ref = parsed.ref ?? (await fetchRepoDefaultBranch(parsed.owner, parsed.repo))

      await ctx.reply(`Downloading ${parsed.owner}/${parsed.repo}@${ref}…`)
      const { buffer, filename, size } = await downloadRepoZip({ owner: parsed.owner, repo: parsed.repo, ref })

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkd-push-'))
      const filePath = path.join(tempDir, filename)
      fs.writeFileSync(filePath, buffer)

      push.pending = { owner: parsed.owner, repo: parsed.repo, ref, filename, filePath, size }
      push.contentSize = size

      const price = await getUploadPriceEstimate(size)
      const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`

      const summary = [
        `📦 Push Version`,
        `Source: ${parsed.owner}/${parsed.repo}@${ref}`,
        `Version: ${push.versionTag}`,
        `Changelog: ${push.changelog || '(none)'}`,
        `Size: ${formatBytes(size)}`,
        estimateLine,
        '',
        'Continue?',
      ].join('\n')

      const keyboard = new InlineKeyboard()
        .text('✅ Push', `push_confirm:${push.projectId}`)
        .text('✖️ Cancel', 'push_cancel')

      await ctx.reply(summary, { reply_markup: keyboard })
    } catch (err) {
      await ctx.reply(formatApiError(err))
      ctx.session.pendingVersionPush = undefined
    }
    return true
  }

  return true
}

// ─── Version Push Callback Handlers ───────────────────────────────────────────

export async function handlePushTextSelect(ctx: MyContext) {
  await ctx.answerCallbackQuery()
  const push = ctx.session.pendingVersionPush
  if (!push) {
    await ctx.reply('No pending version push.')
    return
  }
  push.type = 'text'
  await ctx.reply('Send the text content:')
}

export async function handlePushRepoSelect(ctx: MyContext) {
  await ctx.answerCallbackQuery()
  const push = ctx.session.pendingVersionPush
  if (!push) {
    await ctx.reply('No pending version push.')
    return
  }
  push.type = 'repo'
  await ctx.reply('Paste the GitHub repo URL or owner/repo (optionally @ref):')
}

export async function handlePushConfirm(ctx: MyContext) {
  const push = ctx.session.pendingVersionPush
  if (!push || (!push.content && !push.pending)) {
    await ctx.answerCallbackQuery({ text: 'No pending version push.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const encryptedKey = ctx.session.encryptedKey
  if (!encryptedKey) {
    ctx.session.pendingVersionPush = undefined
    await ctx.reply('You need a bot-managed wallet. Use /start → "🆕 New Wallet".')
    return
  }

  // Get wallet address for balance check
  const privateKey = decryptPrivateKey(encryptedKey)
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  
  // Check balance before proceeding
  const contentSize = push.contentSize ?? 0
  const price = await getUploadPriceEstimate(contentSize)
  const requiredUsdc = BigInt(price.total)
  
  if (!(await ensureSufficientBalance(ctx, requiredUsdc))) {
    return // Don't clear session - user might fund wallet and retry
  }

  const statusMsg = await ctx.reply('⏳ Step 1/2: Uploading to Arweave…')

  try {
    let arweaveResult: { hash: string; txId: string }

    if (push.type === 'text' && push.content) {
      const contentBuffer = Buffer.from(push.content, 'utf8')
      arweaveResult = await uploadToArweave(contentBuffer, 'text/plain', 'content.txt')
    } else if (push.type === 'repo' && push.pending) {
      const zipBuffer = fs.readFileSync(push.pending.filePath)
      arweaveResult = await uploadToArweave(zipBuffer, 'application/zip', push.pending.filename)
    } else {
      throw new Error('Invalid push state')
    }

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/2: Uploaded to Arweave\n   Hash: ${arweaveResult.hash}\n\n⏳ Step 2/2: Pushing version…`
    )

    const versionResult = await pushVersion(encryptedKey, push.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: push.versionTag ?? 'v1.0.0',
      changelog: push.changelog ?? '',
      contentSize: push.contentSize ?? 0,
    })

    // Success - show with buttons
    const keyboard = buildSuccessKeyboard(versionResult.txHash, arweaveResult.hash)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Version Pushed!\n\n` +
        `📂 Project: #${push.projectId}\n` +
        `📦 Version: ${versionResult.versionTag}\n\n` +
        `Use /my_projects to view your projects.`
    )
    await ctx.reply('🎉 Success!', { reply_markup: keyboard })

    // Cleanup
    if (push.pending) {
      cleanupPending(push.pending)
    }
    ctx.session.pendingVersionPush = undefined
  } catch (err) {
    if (push.pending) cleanupPending(push.pending)
    ctx.session.pendingVersionPush = undefined
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      formatApiError(err)
    )
  }
}

export async function handlePushCancel(ctx: MyContext) {
  await ctx.answerCallbackQuery()
  const push = ctx.session.pendingVersionPush
  if (push?.pending) {
    cleanupPending(push.pending)
  }
  ctx.session.pendingVersionPush = undefined
  await ctx.reply('Version push cancelled.')
}

// ─── Handle Upload Messages ───────────────────────────────────────────────────

export async function handleUploadMessage(ctx: MyContext) {
  // Check version push first
  if (await handleVersionPushMessage(ctx)) return true

  const upload = ctx.session.upload
  if (!upload) return false

  if (!ctx.session.wallet || !ctx.session.encryptedKey) {
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    ctx.session.upload = undefined
    return true
  }

  // Step 1: Get project name
  if (!upload.projectName) {
    const text = ctx.message?.text?.trim()
    if (!text) {
      await ctx.reply('Please send a valid project name (text message).')
      return true
    }
    upload.projectName = text
    
    // Auto version detection: check if project with same name exists
    if (upload.type === 'repo' && ctx.session.wallet) {
      try {
        const existing = await findProjectByOwnerAndName(ctx.session.wallet, text)
        if (existing) {
          ctx.session.suggestedProjectId = existing.id
          await ctx.reply(
            `📦 You already have a project named "${text}" (#${existing.id}).\n\nWhat do you want to do?`,
            {
              reply_markup: new InlineKeyboard()
                .text(`🔄 Push new version to #${existing.id}`, `push_existing:${existing.id}`)
                .row()
                .text('🆕 Create new project', 'create_new_project')
            }
          )
          return true
        }
      } catch {
        // Ignore errors - continue with normal flow
      }
    }
    
    if (upload.type === 'repo') {
      await ctx.reply('Paste the GitHub repo URL or owner/repo (optionally @ref):')
    } else {
      await ctx.reply('Great. Now paste the content you want to store (text).')
    }
    return true
  }

  // File upload flow: collect project name and show confirmation
  if (upload.type === 'file') {
    const text = ctx.message?.text?.trim()
    if (!text) {
      await ctx.reply('Please send a valid project name (text message).')
      return true
    }
    
    // We have project name, now show confirmation
    upload.projectName = text
    
    const fileUpload = upload as FileUploadSession
    if (!fileUpload.fileId || !fileUpload.fileName || !fileUpload.fileSize) {
      await ctx.reply('File data missing. Please try again with /cancel.')
      return true
    }

    try {
      const price = await getUploadPriceEstimate(fileUpload.fileSize)

      // Store pending upload
      fileUpload.pending = {
        fileId: fileUpload.fileId,
        fileName: fileUpload.fileName,
        mimeType: fileUpload.mimeType ?? 'application/octet-stream',
        fileSize: fileUpload.fileSize,
        price,
      }

      const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`
      const breakdownLine = `Includes ${formatUsdc(price.arweaveCost)} USDC storage + ${formatUsdc(price.markup)} USDC protocol fee.`
      const summary = [
        `📎 File Upload`,
        `Project: ${upload.projectName}`,
        `File: ${fileUpload.fileName}`,
        `Size: ${formatBytes(fileUpload.fileSize)}`,
        `Type: ${fileUpload.mimeType ?? 'unknown'}`,
        `Version: v1.0.0`,
        estimateLine,
        breakdownLine,
        '',
        'This will:',
        '1. Download file from Telegram',
        '2. Upload to Arweave',
        '3. Create project on Inkd Registry',
        '4. Push version with content',
        '',
        'Continue?',
      ].join('\n')

      const keyboard = new InlineKeyboard()
        .text('✅ Upload', 'file_confirm')
        .text('✖️ Cancel', 'file_cancel')

      await ctx.reply(summary, { reply_markup: keyboard })
    } catch (err) {
      await ctx.reply(formatApiError(err))
      ctx.session.upload = undefined
    }
    return true
  }

  // Text upload flow: collect content and show confirmation
  if (upload.type === 'text') {
    const content = ctx.message?.text
    if (!content) {
      await ctx.reply('Please send text content for the upload.')
      return true
    }

    const contentBytes = Buffer.from(content, 'utf8')
    const size = contentBytes.length

    if (size > MAX_TEXT_BYTES) {
      await ctx.reply(`❌ Text too large (${formatBytes(size)}). Maximum is ${formatBytes(MAX_TEXT_BYTES)}.\n\nFor large files, use /upload_repo instead.`)
      return true
    }

    try {
      const price = await getUploadPriceEstimate(size)

      // Store pending upload
      upload.pending = {
        content,
        size,
        price,
      }

      const estimateLine = `Estimated cost: ${formatUsdc(price.total)} USDC (${price.totalUsd})`
      const breakdownLine = `Includes ${formatUsdc(price.arweaveCost)} USDC storage + ${formatUsdc(price.markup)} USDC protocol fee.`
      const summary = [
        `📝 Text Upload`,
        `Project: ${upload.projectName}`,
        `Size: ${formatBytes(size)}`,
        `Version: v1.0.0`,
        estimateLine,
        breakdownLine,
        '',
        'This will:',
        '1. Upload content to Arweave',
        '2. Create project on Inkd Registry',
        '3. Push version with content',
        '',
        'Continue?',
      ].join('\n')

      const keyboard = new InlineKeyboard()
        .text('✅ Upload', 'text_confirm')
        .text('✖️ Cancel', 'text_cancel')

      await ctx.reply(summary, { reply_markup: keyboard })
    } catch (err) {
      await ctx.reply(formatApiError(err))
      ctx.session.upload = undefined
    }
    return true
  }

  // Repo upload flow: collect GitHub link
  const link = ctx.message?.text?.trim()
  if (!link) {
    await ctx.reply('Please send the GitHub repo link or owner/repo.')
    return true
  }

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

    if (size > MAX_REPO_MB * 1024 * 1024) {
      await ctx.reply(`❌ Repo too large (${formatBytes(size)}). Maximum is ${MAX_REPO_MB} MB.`)
      ctx.session.upload = undefined
      return true
    }

    const price = await getUploadPriceEstimate(size)

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
      `Version: v1.0.0`,
      estimateLine,
      breakdownLine,
      '',
      'Upload with these details?',
    ].join('\n')

    const keyboard = new InlineKeyboard()
      .text('✅ Upload', 'repo_confirm')
      .text('✖️ Cancel', 'repo_cancel')

    await ctx.reply(summary, { reply_markup: keyboard })
  } catch (err) {
    upload.pending && cleanupPending(upload.pending)
    upload.pending = undefined
    await ctx.reply(formatApiError(err))
  }
  return true
}

// ─── Text Upload Handlers ─────────────────────────────────────────────────────

export async function handleTextConfirm(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'text' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending text upload.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const pending = upload.pending
  const projectName = upload.projectName!
  const encryptedKey = ctx.session.encryptedKey

  if (!encryptedKey) {
    upload.pending = undefined
    ctx.session.upload = undefined
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }

  // Check balance before proceeding
  const requiredUsdc = BigInt(pending.price.total)
  if (!(await ensureSufficientBalance(ctx, requiredUsdc))) {
    return // Don't clear session - user might fund wallet and retry
  }

  const statusMsg = await ctx.reply('⏳ Step 1/3: Uploading to Arweave…')

  try {
    // Step 1: Upload content to Arweave
    const contentBuffer = Buffer.from(pending.content, 'utf8')
    const arweaveResult = await uploadToArweave(contentBuffer, 'text/plain', `${projectName}.txt`)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `⏳ Step 2/3: Creating project…`
    )

    // Step 2: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: projectName,
      description: `Text upload (${formatBytes(pending.size)})`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `✅ Step 2/3: Project created\n` +
        `   ID: #${projectResult.projectId}\n\n` +
        `⏳ Step 3/3: Pushing version…`
    )

    // Step 3: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: 'Initial upload',
      contentSize: pending.size,
    })

    // Success - show with buttons
    ctx.session.upload = undefined
    const keyboard = buildSuccessKeyboard(versionResult.txHash, arweaveResult.hash)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Upload Complete!\n\n` +
        `📂 Project: ${projectName} (#${projectResult.projectId})\n` +
        `📦 Version: ${versionResult.versionTag}\n\n` +
        `Use /my_projects to view your projects.`
    )
    await ctx.reply('🎉 Success!', { reply_markup: keyboard })
  } catch (err) {
    ctx.session.upload = undefined
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      formatApiError(err)
    )
  }
}

export async function handleTextCancel(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'text') {
    await ctx.answerCallbackQuery({ text: 'Nothing to cancel.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()
  upload.pending = undefined
  ctx.session.upload = undefined
  await ctx.reply('Upload cancelled.')
}

// ─── File Upload Handlers ─────────────────────────────────────────────────────

export async function handleFileConfirm(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'file' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending file upload.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const pending = upload.pending
  const projectName = upload.projectName!
  const encryptedKey = ctx.session.encryptedKey

  if (!encryptedKey) {
    ctx.session.upload = undefined
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }

  // Check balance before proceeding
  const requiredUsdc = BigInt(pending.price.total)
  if (!(await ensureSufficientBalance(ctx, requiredUsdc))) {
    return // Don't clear session - user might fund wallet and retry
  }

  const statusMsg = await ctx.reply('⏳ Step 1/4: Downloading file from Telegram…')

  try {
    // Step 1: Download file from Telegram
    const file = await ctx.api.getFile(pending.fileId)
    const filePath = file.file_path
    if (!filePath) throw new Error('Could not get file path from Telegram')
    
    const token = process.env.TELEGRAM_BOT_TOKEN
    const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.status}`)
    
    const fileBuffer = Buffer.from(await fileRes.arrayBuffer())

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/4: Downloaded from Telegram\n   Size: ${formatBytes(fileBuffer.length)}\n\n⏳ Step 2/4: Uploading to Arweave…`
    )

    // Step 2: Upload to Arweave
    const arweaveResult = await uploadToArweave(fileBuffer, pending.mimeType, pending.fileName)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/4: Downloaded from Telegram\n` +
        `   Size: ${formatBytes(fileBuffer.length)}\n\n` +
        `✅ Step 2/4: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `⏳ Step 3/4: Creating project…`
    )

    // Step 3: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: projectName,
      description: `File upload: ${pending.fileName} (${formatBytes(pending.fileSize)})`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/4: Downloaded from Telegram\n` +
        `   Size: ${formatBytes(fileBuffer.length)}\n\n` +
        `✅ Step 2/4: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `✅ Step 3/4: Project created\n` +
        `   ID: #${projectResult.projectId}\n\n` +
        `⏳ Step 4/4: Pushing version…`
    )

    // Step 4: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: `File: ${pending.fileName}`,
      contentSize: pending.fileSize,
    })

    // Success - show with buttons
    ctx.session.upload = undefined
    const keyboard = buildSuccessKeyboard(versionResult.txHash, arweaveResult.hash)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Upload Complete!\n\n` +
        `📂 Project: ${projectName} (#${projectResult.projectId})\n` +
        `📎 File: ${pending.fileName}\n` +
        `📦 Version: ${versionResult.versionTag}\n\n` +
        `Use /my_projects to view your projects.`
    )
    await ctx.reply('🎉 Success!', { reply_markup: keyboard })
  } catch (err) {
    ctx.session.upload = undefined
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      formatApiError(err)
    )
  }
}

export async function handleFileCancel(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'file') {
    await ctx.answerCallbackQuery({ text: 'Nothing to cancel.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()
  ctx.session.upload = undefined
  await ctx.reply('Upload cancelled.')
}

// ─── Repo Upload Handlers ─────────────────────────────────────────────────────

export async function handleRepoConfirm(ctx: MyContext) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending repo upload.', show_alert: true })
    return
  }
  await ctx.answerCallbackQuery()

  const pending = upload.pending
  const encryptedKey = ctx.session.encryptedKey

  if (!encryptedKey) {
    cleanupPending(pending)
    upload.pending = undefined
    ctx.session.upload = undefined
    await ctx.reply('You need a bot-managed wallet for uploads. Use /start → "🆕 New Wallet".')
    return
  }

  // Check balance before proceeding
  const requiredUsdc = BigInt(pending.price.total)
  if (!(await ensureSufficientBalance(ctx, requiredUsdc))) {
    return // Don't clear session - user might fund wallet and retry
  }

  const statusMsg = await ctx.reply('⏳ Step 1/3: Uploading to Arweave…')

  try {
    // Step 1: Upload ZIP to Arweave
    const zipBuffer = fs.readFileSync(pending.filePath)
    const arweaveResult = await uploadToArweave(zipBuffer, 'application/zip', pending.filename)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `⏳ Step 2/3: Creating project…`
    )

    // Step 2: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: pending.projectName,
      description: `GitHub: ${pending.owner}/${pending.repo}@${pending.ref}`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Step 1/3: Uploaded to Arweave\n` +
        `   Hash: ${arweaveResult.hash}\n\n` +
        `✅ Step 2/3: Project created\n` +
        `   ID: #${projectResult.projectId}\n\n` +
        `⏳ Step 3/3: Pushing version…`
    )

    // Step 3: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: `Source: ${pending.owner}/${pending.repo}@${pending.ref}`,
      contentSize: pending.size,
    })

    // Success - show with buttons
    ctx.session.upload = undefined
    const keyboard = buildSuccessKeyboard(versionResult.txHash, arweaveResult.hash)

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `✅ Upload Complete!\n\n` +
        `📂 Project: ${pending.projectName} (#${projectResult.projectId})\n` +
        `📦 Version: ${versionResult.versionTag}\n` +
        `📁 Source: ${pending.owner}/${pending.repo}@${pending.ref}\n\n` +
        `Use /my_projects to view your projects.`
    )
    await ctx.reply('🎉 Success!', { reply_markup: keyboard })
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      formatApiError(err)
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
  ctx.session.upload = undefined
  await ctx.reply('Upload cancelled.')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function cleanupPending(pending?: { filePath?: string }) {
  if (!pending?.filePath) return
  try {
    fs.rmSync(path.dirname(pending.filePath), { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}
