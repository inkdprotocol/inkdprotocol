/**
 * inkd project <sub-command> — project management
 *
 * Sub-commands:
 *   create   — register a new project (locks 1 $INKD)
 *   get      — fetch project details by ID
 *   list     — list projects owned by an address
 *   transfer — transfer ownership to a new address
 *   collab   — add/remove collaborators
 */

import { formatEther, parseEther, isAddress, type Address } from 'viem'
import {
  loadConfig, requirePrivateKey, ADDRESSES,
  error, success, info, warn,
  BOLD, RESET, CYAN, DIM, GREEN, YELLOW,
} from '../config.js'
import { buildClients, buildPublicClient } from '../client.js'
import { REGISTRY_ABI, TOKEN_ABI } from '../abi.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

function requireFlag(args: string[], flag: string, hint: string): string {
  const val = parseFlag(args, flag)
  if (!val) error(`Missing required flag ${BOLD}${flag}${RESET}\n  Example: ${DIM}${hint}${RESET}`)
  return val!
}

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toISOString().slice(0, 10)
}

// ─── create ──────────────────────────────────────────────────────────────────

export async function cmdProjectCreate(args: string[]): Promise<void> {
  const name         = requireFlag(args, '--name',        'inkd project create --name my-agent')
  const description  = parseFlag(args, '--description') ?? ''
  const license      = parseFlag(args, '--license')     ?? 'MIT'
  const readmeHash   = parseFlag(args, '--readme')      ?? ''
  const agentEndpoint = parseFlag(args, '--endpoint')   ?? ''
  const isPublic     = !args.includes('--private')
  const isAgent      = args.includes('--agent')

  const cfg    = loadConfig()
  const addrs  = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured. Deploy contracts first.')

  const { publicClient, walletClient, account, addrs: a } = buildClients(cfg)

  // Check/approve token allowance
  const allowance = await publicClient.readContract({
    address: a.token,
    abi: TOKEN_ABI,
    functionName: 'allowance',
    args: [account.address, a.registry],
  }) as bigint

  if (allowance < parseEther('1')) {
    info('Approving 1 $INKD for registry...')
    const approveTx = await walletClient.writeContract({
      address: a.token, abi: TOKEN_ABI, functionName: 'approve',
      args: [a.registry, parseEther('1')],
      account, chain: walletClient.chain!,
    })
    info(`Approve tx: ${DIM}${approveTx}${RESET}`)
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  info(`Creating project ${CYAN}${name}${RESET}...`)

  const tx = await walletClient.writeContract({
    address: a.registry,
    abi: REGISTRY_ABI,
    functionName: 'createProject',
    args: [name, description, license, isPublic, readmeHash, isAgent, agentEndpoint],
    account,
    chain: walletClient.chain!,
  })

  info(`Tx: ${DIM}${tx}${RESET}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })

  if (receipt.status === 'success') {
    success(`Project ${BOLD}${name}${RESET} created! (block ${receipt.blockNumber})`)
  } else {
    error('Transaction reverted. Check name uniqueness and token balance.')
  }
}

// ─── get ─────────────────────────────────────────────────────────────────────

export async function cmdProjectGet(args: string[]): Promise<void> {
  const idStr = args[0] ?? requireFlag(args, '--id', 'inkd project get 42')
  const id    = BigInt(idStr.startsWith('--') ? requireFlag(args, '--id', 'inkd project get --id 42') : idStr)

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const client = buildPublicClient(cfg)
  const project = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getProject',
    args: [id],
  }) as {
    id: bigint; name: string; description: string; license: string
    readmeHash: string; owner: Address; isPublic: boolean; isAgent: boolean
    agentEndpoint: string; createdAt: bigint; versionCount: bigint; exists: boolean
  }

  if (!project.exists) error(`Project #${id} not found.`)

  const collaborators = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getCollaborators',
    args: [id],
  }) as Address[]

  console.log()
  console.log(`  ${BOLD}Project #${project.id}${RESET}  ${project.isAgent ? CYAN + '[agent]' + RESET : ''}`)
  console.log(`  ${'─'.repeat(42)}`)
  info(`Name:          ${CYAN}${project.name}${RESET}`)
  info(`Description:   ${project.description || DIM + 'none' + RESET}`)
  info(`License:       ${project.license}`)
  info(`Owner:         ${project.owner}`)
  info(`Created:       ${formatDate(project.createdAt)}`)
  info(`Versions:      ${GREEN}${project.versionCount}${RESET}`)
  info(`Visibility:    ${project.isPublic ? GREEN + 'public' : YELLOW + 'private'}${RESET}`)
  if (project.readmeHash)    info(`README hash:   ${DIM}${project.readmeHash}${RESET}`)
  if (project.agentEndpoint) info(`Agent endpoint: ${project.agentEndpoint}`)
  if (collaborators.length)  info(`Collaborators: ${collaborators.join(', ')}`)
  console.log()
}

// ─── list ────────────────────────────────────────────────────────────────────

export async function cmdProjectList(args: string[]): Promise<void> {
  const addressArg = args[0]
  if (!addressArg || !isAddress(addressArg)) {
    error('Usage: inkd project list <address>\n  Example: inkd project list 0xDead...')
  }

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const client   = buildPublicClient(cfg)
  const projectIds = await client.readContract({
    address: addrs.registry,
    abi: REGISTRY_ABI,
    functionName: 'getOwnerProjects',
    args: [addressArg as Address],
  }) as bigint[]

  if (!projectIds.length) {
    info(`No projects found for ${addressArg}`)
    return
  }

  console.log()
  console.log(`  ${BOLD}Projects owned by ${DIM}${addressArg}${RESET}`)
  console.log(`  ${'─'.repeat(50)}`)

  const projects = await Promise.all(
    projectIds.map(id =>
      client.readContract({
        address: addrs.registry,
        abi: REGISTRY_ABI,
        functionName: 'getProject',
        args: [id],
      })
    )
  ) as Array<{ id: bigint; name: string; isAgent: boolean; isPublic: boolean; versionCount: bigint; createdAt: bigint }>

  for (const p of projects) {
    const badges = [
      p.isAgent  ? CYAN + 'agent'   + RESET : '',
      p.isPublic ? GREEN + 'public' + RESET : YELLOW + 'private' + RESET,
    ].filter(Boolean).join(' ')
    console.log(
      `  ${BOLD}#${p.id}${RESET}  ${CYAN}${p.name.padEnd(24)}${RESET}` +
      `  v${p.versionCount}  ${badges}  ${DIM}${formatDate(p.createdAt)}${RESET}`
    )
  }
  console.log()
}

// ─── transfer ────────────────────────────────────────────────────────────────

export async function cmdProjectTransfer(args: string[]): Promise<void> {
  const idStr   = requireFlag(args, '--id',    'inkd project transfer --id 42 --to 0x...')
  const toAddr  = requireFlag(args, '--to',    'inkd project transfer --id 42 --to 0x...')
  if (!isAddress(toAddr)) error('--to must be a valid Ethereum address.')

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const { publicClient, walletClient, account, addrs: a } = buildClients(cfg)

  const transferFee = await publicClient.readContract({
    address: a.registry, abi: REGISTRY_ABI, functionName: 'transferFee',
  }) as bigint

  info(`Transfer fee: ${formatEther(transferFee)} ETH`)
  info(`Transferring project #${idStr} → ${toAddr}...`)

  const tx = await walletClient.writeContract({
    address: a.registry,
    abi: REGISTRY_ABI,
    functionName: 'transferProject',
    args: [BigInt(idStr), toAddr as Address],
    value: transferFee,
    account,
    chain: walletClient.chain!,
  })

  await publicClient.waitForTransactionReceipt({ hash: tx })
  success(`Project #${idStr} transferred to ${toAddr}`)
}

// ─── collab ──────────────────────────────────────────────────────────────────

export async function cmdProjectCollab(args: string[]): Promise<void> {
  const action = args[0]
  if (action !== 'add' && action !== 'remove') {
    error('Usage: inkd project collab add|remove --id <id> --address <address>')
  }

  const idStr   = requireFlag(args, '--id',      `inkd project collab ${action} --id 42 --address 0x...`)
  const collab  = requireFlag(args, '--address', `inkd project collab ${action} --id 42 --address 0x...`)
  if (!isAddress(collab)) error('--address must be a valid Ethereum address.')

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]
  if (!addrs.registry) error('Registry address not configured.')

  const { publicClient, walletClient, account, addrs: a } = buildClients(cfg)
  const fn = action === 'add' ? 'addCollaborator' : 'removeCollaborator'

  info(`${action === 'add' ? 'Adding' : 'Removing'} collaborator ${collab}...`)

  const tx = await walletClient.writeContract({
    address: a.registry,
    abi: REGISTRY_ABI,
    functionName: fn,
    args: [BigInt(idStr), collab as Address],
    account,
    chain: walletClient.chain!,
  })

  await publicClient.waitForTransactionReceipt({ hash: tx })
  success(`Collaborator ${action === 'add' ? 'added' : 'removed'}.`)
}
