import type { Context, SessionFlavor } from 'grammy'
import { InlineKeyboard } from 'grammy'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MAX_TEXT_BYTES  = 512 * 1024       // 512 KB text limit
const MAX_REPO_MB     = 100              // 100 MB repo zip limit
import { parseRepoInput, fetchRepoDefaultBranch, downloadRepoZip, listUserRepos } from './github.js'
import { getUploadPriceEstimate, findProjectByOwnerAndName, type PriceEstimate } from './api.js'
import { uploadToArweave, createProject, pushVersion } from './x402.js'
import { checkUsdcBalance, decryptPrivateKey } from './wallet.js'
import { privateKeyToAccount } from 'viem/accounts'
import { encryptBuffer } from './crypto.js'

// ─── Session Types ────────────────────────────────────────────────────────────

interface PendingTextUpload {
  content: string
  size: number
  price: PriceEstimate
  isPrivate?: boolean
}

interface TextUploadSession {
  type: 'text'
  projectName?: string
  description?: string
  awaitingDescription?: boolean
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
  isPrivate?: boolean
}

interface RepoUploadSession {
  type: 'repo'
  projectName?: string
  pending?: PendingRepoUpload
  ghUser?: string
}

interface PendingFileUpload {
  fileId: string
  fileName: string
  mimeType: string
  fileSize: number
  price: PriceEstimate
  isPrivate?: boolean
}

interface FileUploadSession {
  type: 'file'
  projectName?: string
  description?: string
  awaitingDescription?: boolean
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
  if ((msg.includes('insufficient') || msg.includes('balance')) && !msg.includes('callback') && !msg.includes('query'))
    return '❌ Not enough USDC. Add funds via /wallet → 📥 Add Funds.'
  if (msg.includes('gas') || msg.includes('ETH') || msg.includes('fee'))
    return '❌ Not enough ETH for gas. Send a small amount of ETH on Base to your wallet.'
  if (msg.includes('402') || msg.includes('payment'))
    return '❌ Payment failed. Check your USDC balance with /wallet.'
  if (msg.includes('404'))
    return '❌ Not found.'
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT'))
    return '❌ Request timed out. Try again.'
  if (msg.includes('invalid') || msg.includes('Invalid'))
    return `❌ Invalid input: ${msg.split(':').pop()?.trim()}`
  console.error('[inkd-bot] Unhandled error:', err)
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
    .url('🔗 View File', `https://arweave.net/${arweaveHash}`)
    .url('⛓ On-chain', `https://basescan.org/tx/${txHash}`)
    .row()
    .url('📁 My Files', 'https://inkdprotocol.com')
}

/** Public/Private visibility buttons shown before every upload confirm. */
function buildVisibilityKeyboard(confirmPublic: string, confirmPrivate: string, cancelCb: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🌍 Public', confirmPublic)
    .text('🔒 Only me', confirmPrivate)
    .row()
    .text('✖️ Cancel', cancelCb)
}

// ─── Begin Upload Flows ───────────────────────────────────────────────────────

export async function beginTextUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'text' }
  await ctx.reply('📁 What should we call this?\n\nGive it a short name like "my-resume" or "q4-report":')
}

export async function beginRepoUpload(ctx: MyContext) {
  ctx.session.upload = { type: 'repo' }
  await ctx.reply(
    '🐙 *GitHub Repo Upload*\n\nSend a GitHub username or profile link to browse repos, or paste a repo directly:\n\n• `inkdprotocol` → lists repos\n• `github.com/inkdprotocol` → also works\n• `owner/repo` → direct upload\n• `https://github.com/owner/repo` → direct upload',
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌ Cancel', 'nav_home') }
  )
}

/**
 * Dispatch: is it a username/profile URL or a direct repo?
 */
async function handleGithubUsernameOrRepo(ctx: MyContext, input: string) {
  // GitHub profile URL → extract username
  const ghProfileMatch = input.match(/^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/?$/)
  if (ghProfileMatch) {
    await handleGithubUsername(ctx, ghProfileMatch[1])
    return
  }
  // Plain username (no slash, no http)
  const isUsername = !input.includes('/') && !input.startsWith('http') && /^@?[a-zA-Z0-9_-]+$/.test(input)
  if (isUsername) {
    await handleGithubUsername(ctx, input.replace(/^@/, ''))
    return
  }
  // Treat as direct owner/repo or full URL
  await handleGithubRepoSelected(ctx, input)
}

/**
 * Handle a selected GitHub repo (owner/repo) — download + show confirm
 */
export async function handleGithubRepoSelected(ctx: MyContext, fullName: string) {
  ctx.session.upload = { type: 'repo' }
  const upload = ctx.session.upload as RepoUploadSession

  try {
    const parsed = parseRepoInput(fullName)
    if (!parsed) {
      await ctx.reply('Invalid repo.', { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
      return
    }

    const ref = parsed.ref ?? (await fetchRepoDefaultBranch(parsed.owner, parsed.repo))
    await ctx.reply(`Downloading ${parsed.owner}/${parsed.repo}@${ref}…`)
    const { buffer, filename, size } = await downloadRepoZip({ owner: parsed.owner, repo: parsed.repo, ref })

    if (size > MAX_REPO_MB * 1024 * 1024) {
      await ctx.reply(`❌ Repo too large (${formatBytes(size)}). Maximum is ${MAX_REPO_MB} MB.`, {
        reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home'),
      })
      ctx.session.upload = undefined
      return
    }

    const price = await getUploadPriceEstimate(size)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkd-repo-'))
    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, buffer)

    upload.pending = { owner: parsed.owner, repo: parsed.repo, ref, projectName: parsed.repo, filename, filePath, size, price }

    const summary = [
      `📋 *Ready to store*`,
      ``,
      `🐙 ${parsed.owner}/${parsed.repo}@${ref}`,
      `📦 ${formatBytes(size)}`,
      `💵 ${price.totalUsd} USDC`,
      ``,
      `Choose who can see this:`,
    ].join('\n')

    const keyboard = buildVisibilityKeyboard('repo_confirm_public', 'repo_confirm_private', 'repo_cancel')
    await ctx.reply(summary, { parse_mode: 'Markdown', reply_markup: keyboard })
  } catch (err) {
    upload.pending && cleanupPending(upload.pending as PendingRepoUpload)
    ctx.session.upload = undefined
    await ctx.reply(formatApiError(err), { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
  }
}

/**
 * Handle GitHub username input → list repos as buttons
 */
export async function handleGithubUsername(ctx: MyContext, username: string) {
  try {
    const repos = await listUserRepos(username)
    if (!repos.length) {
      await ctx.reply(`No public repos found for @${username}.`, { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
      return
    }
    const kb = new InlineKeyboard()
    for (const r of repos.slice(0, 20)) {
      const label = `${r.name} ⭐${r.stars}`
      kb.text(label, `gh_repo:${r.fullName}`).row()
    }
    kb.text('❌ Cancel', 'nav_home')
    await ctx.reply(`*@${username}'s repos* (${repos.length} public)\n\nChoose one to upload:`, { parse_mode: 'Markdown', reply_markup: kb })
    ctx.session.upload = { type: 'repo', ghUser: username }
  } catch (err) {
    await ctx.reply(`${(err as Error).message}`, { reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home') })
  }
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
  await ctx.reply(`📎 *${fileName}* received · ${formatBytes(fileSize)}\n\n📁 What should we call this file?\n\nGive it a short name like \`my-resume\` or \`q4-report\`:`, { parse_mode: 'Markdown' })
}

// ─── Begin Version Push Flow ──────────────────────────────────────────────────

export async function beginVersionPush(ctx: MyContext, projectId: number) {
  ctx.session.pendingVersionPush = { projectId }
  
  // Auto-suggest next version tag
  let suggestedTag = 'v1.0.0'
  try {
    const { listVersions: lv } = await import('./api.js')
    const existing = await lv(projectId, 1)
    if (existing.length > 0) {
      const latest = existing[0].versionTag ?? 'v1.0.0'
      // Increment patch version: v1.0.3 → v1.0.4
      const match = latest.match(/^(v?)(\d+)\.(\d+)\.(\d+)(.*)$/)
      if (match) {
        const [, prefix, major, minor, patch, suffix] = match
        suggestedTag = `${prefix}${major}.${minor}.${Number(patch) + 1}${suffix}`
      } else {
        suggestedTag = latest + '-1'
      }
    }
  } catch { /* ignore, use default */ }

  await ctx.reply(
    `📝 *Version tag*\n\nSend a version tag or tap to use the suggestion:`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text(`✅ Use ${suggestedTag}`, `use_tag:${projectId}:${encodeURIComponent(suggestedTag)}`)
        .row()
        .text('✖️ Cancel', 'push_cancel'),
    }
  )
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
        `📦 *Add version ${push.versionTag}*`,
        ``,
        `📝 ${formatBytes(push.contentSize)}`,
        `💵 ${price.totalUsd} USDC`,
        ``,
        `Ready to store permanently?`,
      ].join('\n')

      const keyboard = new InlineKeyboard()
        .text('✅ Confirm', `push_confirm:${push.projectId}`)
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
    let parsed
    try {
      parsed = parseRepoInput(text)
    } catch {
      await ctx.reply('Please paste a GitHub repo like `owner/repo` or `https://github.com/owner/repo`.', { parse_mode: 'Markdown' })
      return true
    }
    try {
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
        `📦 *Add version ${push.versionTag}*`,
        ``,
        `🐙 ${parsed.owner}/${parsed.repo}@${ref}`,
        `📦 ${formatBytes(size)}`,
        `💵 ${price.totalUsd} USDC`,
        ``,
        `Ready to store permanently?`,
      ].join('\n')

      const keyboard = new InlineKeyboard()
        .text('✅ Confirm', `push_confirm:${push.projectId}`)
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
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }
  const push = ctx.session.pendingVersionPush
  if (!push) {
    await ctx.reply('No pending version push.')
    return
  }
  push.type = 'text'
  await ctx.reply('Send the text content:')
}

export async function handlePushRepoSelect(ctx: MyContext) {
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }
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
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }

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
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }
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

  // For repo uploads: skip project name step — use repo name directly
  if (upload.type === 'repo' && !upload.projectName) {
    const text = ctx.message?.text?.trim()
    if (!text) {
      await ctx.reply('Please send a GitHub username or `owner/repo`.')
      return true
    }
    // Treat input as username/URL/repo — go straight to repo flow
    await handleGithubUsernameOrRepo(ctx, text)
    return true
  }

  // Step 1: Get project name (text uploads only)
  if (!upload.projectName) {
    const text = ctx.message?.text?.trim()
    if (!text) {
      await ctx.reply('Please send a valid project name (text message).')
      return true
    }
    upload.projectName = text
    ;(upload as any).awaitingDescription = true
    await ctx.reply(
      '📝 Add a short description (optional):',
      { reply_markup: new InlineKeyboard().text('⏭ Skip', 'skip_description') }
    )
    return true
  }

  // Description step
  if ((upload as any).awaitingDescription) {
    const text = ctx.message?.text?.trim()
    if (text) (upload as any).description = text
    ;(upload as any).awaitingDescription = false

    if (upload.type === 'repo') {
      await ctx.reply('🔗 Paste the GitHub repo URL:\n\n`owner/repo` or `https://github.com/owner/repo`', { parse_mode: 'Markdown' })
    } else {
      await ctx.reply('✏️ Paste the text you want to store permanently:')
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
        `📋 *Ready to store*`,
        ``,
        `📄 ${fileUpload.fileName}`,
        `📦 ${formatBytes(fileUpload.fileSize)}`,
        `💵 ${price.totalUsd} USDC`,
        ``,
        `Choose who can see this file:`,
      ].join('\n')

      const keyboard = buildVisibilityKeyboard('file_confirm_public', 'file_confirm_private', 'file_cancel')
      await ctx.reply(summary, { parse_mode: 'Markdown', reply_markup: keyboard })
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

      const summary = [
        `📋 *Ready to store*`,
        ``,
        `✏️ Text · ${upload.projectName}`,
        `📦 ${formatBytes(size)}`,
        `💵 ${price.totalUsd} USDC`,
        ``,
        `Choose who can see this:`,
      ].join('\n')

      const keyboard = buildVisibilityKeyboard('text_confirm_public', 'text_confirm_private', 'text_cancel')
      await ctx.reply(summary, { parse_mode: 'Markdown', reply_markup: keyboard })
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

  // GitHub profile URL → extract username
  const ghProfileMatch = link.match(/^https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/?$/)
  if (ghProfileMatch) {
    await handleGithubUsername(ctx, ghProfileMatch[1])
    return true
  }
  // Plain username (no slash, no http) → list their repos
  const isUsername = !link.includes('/') && !link.startsWith('http') && /^@?[a-zA-Z0-9_-]+$/.test(link)
  if (isUsername) {
    await handleGithubUsername(ctx, link.replace(/^@/, ''))
    return true
  }

  const projectName = upload.projectName

  try {
    if (upload.pending) {
      cleanupPending(upload.pending)
      upload.pending = undefined
    }

    const parsed = (() => {
      try { return parseRepoInput(link) } catch { return null }
    })()
    if (!parsed) {
      await ctx.reply('Please paste a repo like `owner/repo` or `https://github.com/owner/repo`.', { parse_mode: 'Markdown' })
      return true
    }
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

    const summary = [
      `📋 *Ready to store*`,
      ``,
      `🐙 ${parsed.owner}/${parsed.repo}@${ref}`,
      `📦 ${formatBytes(size)}`,
      `💵 ${price.totalUsd} USDC`,
      ``,
      `Choose who can see this:`,
    ].join('\n')

    const keyboard = buildVisibilityKeyboard('repo_confirm_public', 'repo_confirm_private', 'repo_cancel')
    await ctx.reply(summary, { parse_mode: 'Markdown', reply_markup: keyboard })
  } catch (err) {
    upload.pending && cleanupPending(upload.pending)
    upload.pending = undefined
    await ctx.reply(formatApiError(err))
  }
  return true
}

// ─── Text Upload Handlers ─────────────────────────────────────────────────────

export async function handleTextConfirm(ctx: MyContext, isPrivate = false) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'text' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending text upload.', show_alert: true })
    return
  }
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }

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

  const privacyIcon = isPrivate ? '🔒' : '🌍'
  const statusMsg = await ctx.reply(
    `⏳ *Storing your file...*\n\n▪ Uploading ⏳\n▪ Creating record ○\n▪ Confirming on Base ○`,
    { parse_mode: 'Markdown' }
  )

  try {
    // Step 1: Upload content to Arweave (encrypt if private)
    let contentBuffer = Buffer.from(pending.content, 'utf8')
    let contentType = 'text/plain'
    if (isPrivate) {
      const rawKey = decryptPrivateKey(encryptedKey)
      contentBuffer = encryptBuffer(contentBuffer, rawKey)
      contentType = 'application/octet-stream'
    }
    const arweaveResult = await uploadToArweave(contentBuffer, contentType, `${projectName}.txt`)

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `⏳ *Storing your file...*\n\n✅ Uploaded\n▪ Creating record ⏳\n▪ Confirming on Base ○`,
      { parse_mode: 'Markdown' }
    )

    // Step 2: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: projectName,
      description: (upload as any).description || `Text upload (${formatBytes(pending.size)})`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `⏳ *Storing your file...*\n\n✅ Uploaded\n✅ Record created (#${projectResult.projectId})\n▪ Confirming on Base ⏳`,
      { parse_mode: 'Markdown' }
    )

    // Step 3: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: 'Initial upload',
      contentSize: pending.size,
    })

    // Success
    ctx.session.upload = undefined
    const keyboard = buildSuccessKeyboard(versionResult.txHash, arweaveResult.hash)

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `✅ *Stored forever!*\n\n` +
        `✏️ ${projectName}\n` +
        `${privacyIcon} ${isPrivate ? 'Private' : 'Public'}\n` +
        `🔗 \`${arweaveResult.hash}\`\n\n` +
        `#${projectResult.projectId} · ${projectName}`,
      { parse_mode: 'Markdown' }
    )
    await ctx.reply('🎉', { reply_markup: keyboard })
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
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }
  upload.pending = undefined
  ctx.session.upload = undefined
  await ctx.reply('Upload cancelled.')
}

// ─── File Upload Handlers ─────────────────────────────────────────────────────

export async function handleFileConfirm(ctx: MyContext, isPrivate = false) {
  const upload = ctx.session.upload
  if (!upload || upload.type !== 'file' || !upload.pending) {
    await ctx.answerCallbackQuery({ text: 'No pending file upload.', show_alert: true })
    return
  }
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }

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

  const privacyIcon = isPrivate ? '🔒' : '🌍'
  const statusMsg = await ctx.reply(
    `⏳ *Storing your file...*\n\n▪ Downloading ⏳\n▪ Uploading ○\n▪ Creating record ○\n▪ Confirming ○`,
    { parse_mode: 'Markdown' }
  )

  try {
    // Step 1: Download file from Telegram
    const file = await ctx.api.getFile(pending.fileId)
    const filePath = file.file_path
    if (!filePath) throw new Error('Could not get file path from Telegram')
    
    const token = process.env.TELEGRAM_BOT_TOKEN
    const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.status}`)
    
    let fileBuffer = Buffer.from(await fileRes.arrayBuffer())
    let mimeType = pending.mimeType
    if (isPrivate) {
      const rawKey = decryptPrivateKey(encryptedKey)
      fileBuffer = encryptBuffer(fileBuffer, rawKey)
      mimeType = 'application/octet-stream'
    }

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `⏳ *Storing your file...*\n\n✅ Downloaded (${formatBytes(fileBuffer.length)})\n▪ Uploading ⏳\n▪ Creating record ○\n▪ Confirming ○`,
      { parse_mode: 'Markdown' }
    )

    // Step 2: Upload to Arweave
    const arweaveResult = await uploadToArweave(fileBuffer, mimeType, pending.fileName)

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `⏳ *Storing your file...*\n\n✅ Downloaded\n✅ Uploaded\n▪ Creating record ⏳\n▪ Confirming ○`,
      { parse_mode: 'Markdown' }
    )

    // Step 3: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: projectName,
      description: (upload as any).description || `File upload: ${pending.fileName} (${formatBytes(pending.fileSize)})`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `⏳ *Storing your file...*\n\n✅ Downloaded\n✅ Uploaded\n✅ Record created (#${projectResult.projectId})\n▪ Confirming ⏳`,
      { parse_mode: 'Markdown' }
    )

    // Step 4: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: `File: ${pending.fileName}`,
      contentSize: pending.fileSize,
    })

    // Success
    ctx.session.upload = undefined
    const keyboard = buildSuccessKeyboard(versionResult.txHash, arweaveResult.hash)

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `✅ *Stored forever!*\n\n` +
        `📄 ${pending.fileName}\n` +
        `${privacyIcon} ${isPrivate ? 'Private' : 'Public'}\n` +
        `🔗 \`${arweaveResult.hash}\`\n\n` +
        `#${projectResult.projectId} · ${projectName}`,
      { parse_mode: 'Markdown' }
    )
    await ctx.reply('🎉', { reply_markup: keyboard })
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
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }
  ctx.session.upload = undefined
  await ctx.reply('Upload cancelled.')
}

// ─── Repo Upload Handlers ─────────────────────────────────────────────────────

export async function handleRepoConfirm(ctx: MyContext, isPrivate = false) {
  // Answer callback immediately — ignore timeout errors (Telegram 60s limit)
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }

  const upload = ctx.session.upload
  if (!upload || upload.type !== 'repo' || !upload.pending) {
    await ctx.reply('No pending upload. Use /upload_repo to start.', {
      reply_markup: new InlineKeyboard().text('🏠 Home', 'nav_home')
    })
    return
  }

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

  // Re-download if temp file was lost (e.g. after bot restart)
  if (!fs.existsSync(pending.filePath)) {
    const redownloadMsg = await ctx.reply('⏳ Re-fetching repo…')
    try {
      const { buffer, filename } = await downloadRepoZip({ owner: pending.owner, repo: pending.repo, ref: pending.ref })
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkd-repo-'))
      const newPath = path.join(tempDir, filename)
      fs.writeFileSync(newPath, buffer)
      pending.filePath = newPath
      pending.filename = filename
      await ctx.api.deleteMessage(ctx.chat!.id, redownloadMsg.message_id)
    } catch (err) {
      ctx.session.upload = undefined
      await ctx.api.editMessageText(ctx.chat!.id, redownloadMsg.message_id, formatApiError(err))
      return
    }
  }

  const privacyIcon = isPrivate ? '🔒' : '🌍'
  const statusMsg = await ctx.reply(
    `⏳ *Storing your repo...*\n\n▪ Uploading ⏳\n▪ Creating record ○\n▪ Confirming ○`,
    { parse_mode: 'Markdown' }
  )

  try {
    // Step 1: Upload ZIP to Arweave (encrypt if private)
    let zipBuffer = fs.readFileSync(pending.filePath)
    let mimeType = 'application/zip'
    if (isPrivate) {
      const rawKey = decryptPrivateKey(encryptedKey)
      zipBuffer = encryptBuffer(zipBuffer, rawKey)
      mimeType = 'application/octet-stream'
    }
    const arweaveResult = await uploadToArweave(zipBuffer, mimeType, pending.filename)

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `⏳ *Storing your repo...*\n\n✅ Uploaded\n▪ Creating record ⏳\n▪ Confirming ○`,
      { parse_mode: 'Markdown' }
    )

    // Step 2: Create project with x402 payment
    const projectResult = await createProject(encryptedKey, {
      name: pending.projectName,
      description: `GitHub: ${pending.owner}/${pending.repo}@${pending.ref}`,
      license: 'MIT',
    })

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `⏳ *Storing your repo...*\n\n✅ Uploaded\n✅ Record created (#${projectResult.projectId})\n▪ Confirming ⏳`,
      { parse_mode: 'Markdown' }
    )

    // Step 3: Push version with x402 payment
    const versionResult = await pushVersion(encryptedKey, projectResult.projectId, {
      arweaveHash: arweaveResult.hash,
      versionTag: 'v1.0.0',
      changelog: `Source: ${pending.owner}/${pending.repo}@${pending.ref}`,
      contentSize: pending.size,
    })

    // Success
    ctx.session.upload = undefined
    const keyboard = buildSuccessKeyboard(versionResult.txHash, arweaveResult.hash)

    await ctx.api.editMessageText(
      ctx.chat!.id, statusMsg.message_id,
      `✅ *Stored forever!*\n\n` +
        `🐙 ${pending.owner}/${pending.repo}@${pending.ref}\n` +
        `${privacyIcon} ${isPrivate ? 'Private' : 'Public'}\n` +
        `🔗 \`${arweaveResult.hash}\`\n\n` +
        `#${projectResult.projectId} · ${pending.projectName}`,
      { parse_mode: 'Markdown' }
    )
    await ctx.reply('🎉', { reply_markup: keyboard })
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
  try { await ctx.answerCallbackQuery() } catch { /* ignore expired callback */ }
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
