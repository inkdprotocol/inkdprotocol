/**
 * inkd token — Manage $INKD token balance, allowances, and transfers
 *
 * Usage:
 *   inkd token balance [address]          Show INKD + ETH balance for address (default: own wallet)
 *   inkd token approve <amount>            Approve the registry to spend N INKD
 *   inkd token allowance [address]         Check current registry allowance for address
 *   inkd token transfer <to> <amount>      Transfer INKD to another address
 *   inkd token info                        Show total supply and token metadata
 *
 * Flags:
 *   --json                                 JSON output (for scripting)
 *
 * Environment:
 *   INKD_PRIVATE_KEY   Required for approve/transfer
 *   INKD_NETWORK       mainnet | testnet
 *   INKD_RPC_URL       Custom RPC
 */

import { formatEther, parseEther, getAddress, type Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import {
  loadConfig, requirePrivateKey, ADDRESSES,
  error, info, success, warn,
  BOLD, RESET, CYAN, DIM, GREEN, YELLOW,
} from '../config.js'
import { buildPublicClient, buildWalletClient } from '../client.js'
import { TOKEN_ABI } from '../abi.js'

// TOKEN_ABI now includes: approve, allowance, balanceOf, totalSupply,
//                         transfer, name, symbol, decimals
const FULL_TOKEN_ABI = TOKEN_ABI

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(raw: string): bigint {
  try {
    return parseEther(raw)
  } catch {
    error(`Invalid amount: ${raw}. Use a number like 1 or 0.5`)
    process.exit(1)
  }
}

function parseAddress(raw: string | undefined): Address | undefined {
  if (!raw) return undefined
  try {
    return getAddress(raw)
  } catch {
    error(`Invalid address: ${raw}`)
    process.exit(1)
  }
}

// ─── Sub-commands ────────────────────────────────────────────────────────────

/**
 * inkd token balance [address] [--json]
 * Show INKD balance + ETH balance for an address.
 * Defaults to own wallet if INKD_PRIVATE_KEY is set.
 */
export async function cmdTokenBalance(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json')
  const addressArg = args.find(a => !a.startsWith('--'))

  const cfg = loadConfig()
  const addrs = ADDRESSES[cfg.network]

  let target: Address
  if (addressArg) {
    target = parseAddress(addressArg) as Address
  } else {
    // Fall back to own wallet
    const pk = requirePrivateKey(cfg)
    const { privateKeyToAccount } = await import('viem/accounts')
    const account = privateKeyToAccount(pk)
    target = account.address
  }

  if (!addrs.token) {
    warn('Token contract address not configured.')
    process.exit(1)
  }

  const client = buildPublicClient(cfg)

  const [inkdBalance, ethBalance] = await Promise.all([
    client.readContract({
      address: addrs.token,
      abi: FULL_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [target],
    }) as Promise<bigint>,
    client.getBalance({ address: target }),
  ])

  if (jsonMode) {
    console.log(JSON.stringify({
      address: target,
      inkd: formatEther(inkdBalance),
      eth: formatEther(ethBalance),
      network: cfg.network,
    }))
    return
  }

  console.log()
  console.log(`  ${BOLD}Token Balance${RESET}`)
  console.log(`  ${'─'.repeat(40)}`)
  info(`Address:  ${CYAN}${target}${RESET}`)
  info(`INKD:     ${GREEN}${formatEther(inkdBalance)} INKD${RESET}`)
  info(`ETH:      ${GREEN}${formatEther(ethBalance)} ETH${RESET}`)
  info(`Network:  ${cfg.network}`)
  console.log()
}

/**
 * inkd token allowance [address] [--json]
 * Show how much INKD the registry is approved to spend on behalf of address.
 */
export async function cmdTokenAllowance(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json')
  const addressArg = args.find(a => !a.startsWith('--'))

  const cfg = loadConfig()
  const addrs = ADDRESSES[cfg.network]

  let owner: Address
  if (addressArg) {
    owner = parseAddress(addressArg) as Address
  } else {
    const pk = requirePrivateKey(cfg)
    const { privateKeyToAccount } = await import('viem/accounts')
    owner = privateKeyToAccount(pk).address
  }

  if (!addrs.token || !addrs.registry) {
    warn('Token or registry address not configured.')
    process.exit(1)
  }

  const client = buildPublicClient(cfg)
  const allowance = await client.readContract({
    address: addrs.token,
    abi: FULL_TOKEN_ABI,
    functionName: 'allowance',
    args: [owner, addrs.registry],
  }) as bigint

  const formatted = formatEther(allowance)
  const sufficient = allowance >= parseEther('1')

  if (jsonMode) {
    console.log(JSON.stringify({
      owner,
      spender: addrs.registry,
      allowance: formatted,
      sufficientForProject: sufficient,
      network: cfg.network,
    }))
    return
  }

  console.log()
  console.log(`  ${BOLD}Registry Allowance${RESET}`)
  console.log(`  ${'─'.repeat(40)}`)
  info(`Owner:    ${CYAN}${owner}${RESET}`)
  info(`Spender:  ${DIM}${addrs.registry}${RESET}`)
  info(`Allowance: ${sufficient ? GREEN : YELLOW}${formatted} INKD${RESET}`)

  if (!sufficient) {
    console.log()
    warn(`Allowance is below 1 INKD. Run ${DIM}inkd token approve 1${RESET} before creating a project.`)
  } else {
    console.log()
    console.log(`  ${GREEN}✓ Sufficient allowance to create projects.${RESET}`)
  }
  console.log()
}

/**
 * inkd token approve <amount> [--json]
 * Approve the registry contract to spend <amount> INKD on your behalf.
 */
export async function cmdTokenApprove(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json')
  const amountArg = args.find(a => !a.startsWith('--'))

  if (!amountArg) {
    error('Usage: inkd token approve <amount>')
    error('Example: inkd token approve 10')
    process.exit(1)
  }

  const amount = parseAmount(amountArg)
  const cfg = loadConfig()
  const addrs = ADDRESSES[cfg.network]

  if (!addrs.token || !addrs.registry) {
    warn('Token or registry address not configured.')
    process.exit(1)
  }

  const pk = requirePrivateKey(cfg)
  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(pk)

  if (!jsonMode) {
    console.log()
    console.log(`  ${BOLD}Approving INKD Spend${RESET}`)
    console.log(`  ${'─'.repeat(40)}`)
    info(`From:     ${CYAN}${account.address}${RESET}`)
    info(`Spender:  ${DIM}${addrs.registry}${RESET}`)
    info(`Amount:   ${GREEN}${formatEther(amount)} INKD${RESET}`)
    console.log()
    info('Sending approval...')
  }

  const walletClient = buildWalletClient(cfg, account)
  const publicClient = buildPublicClient(cfg)

  const hash = await walletClient.writeContract({
    address: addrs.token,
    abi: FULL_TOKEN_ABI,
    functionName: 'approve',
    args: [addrs.registry, amount],
    chain: cfg.network === 'mainnet' ? base : baseSepolia,
    account,
  })

  if (!jsonMode) info(`TX hash: ${DIM}${hash}${RESET}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (jsonMode) {
    console.log(JSON.stringify({
      success: receipt.status === 'success',
      hash,
      amount: formatEther(amount),
      spender: addrs.registry,
      from: account.address,
      blockNumber: receipt.blockNumber.toString(),
      network: cfg.network,
    }))
    return
  }

  if (receipt.status !== 'success') {
    error(`Transaction reverted: ${hash}`)
    process.exit(1)
  }

  success(`Approved ${formatEther(amount)} INKD for registry to spend.`)
  info(`Block: ${receipt.blockNumber}`)
  console.log()
}

/**
 * inkd token transfer <to> <amount> [--json]
 * Transfer <amount> INKD tokens to <to> address.
 */
export async function cmdTokenTransfer(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json')
  const nonFlags = args.filter(a => !a.startsWith('--'))

  const toArg     = nonFlags[0]
  const amountArg = nonFlags[1]

  if (!toArg || !amountArg) {
    error('Usage: inkd token transfer <to-address> <amount>')
    error('Example: inkd token transfer 0xABC...123 5')
    process.exit(1)
  }

  const to     = parseAddress(toArg) as Address
  const amount = parseAmount(amountArg)
  const cfg    = loadConfig()
  const addrs  = ADDRESSES[cfg.network]

  if (!addrs.token) {
    warn('Token contract address not configured.')
    process.exit(1)
  }

  const pk = requirePrivateKey(cfg)
  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(pk)

  // Sanity check — don't transfer to self
  if (to.toLowerCase() === account.address.toLowerCase()) {
    warn('Destination address is the same as sender.')
    process.exit(1)
  }

  if (!jsonMode) {
    console.log()
    console.log(`  ${BOLD}Transfer INKD${RESET}`)
    console.log(`  ${'─'.repeat(40)}`)
    info(`From:   ${CYAN}${account.address}${RESET}`)
    info(`To:     ${CYAN}${to}${RESET}`)
    info(`Amount: ${GREEN}${formatEther(amount)} INKD${RESET}`)
    console.log()
    info('Sending transfer...')
  }

  const walletClient  = buildWalletClient(cfg, account)
  const publicClient  = buildPublicClient(cfg)

  const hash = await walletClient.writeContract({
    address: addrs.token,
    abi: FULL_TOKEN_ABI,
    functionName: 'transfer',
    args: [to, amount],
    chain: cfg.network === 'mainnet' ? base : baseSepolia,
    account,
  })

  if (!jsonMode) info(`TX hash: ${DIM}${hash}${RESET}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (jsonMode) {
    console.log(JSON.stringify({
      success: receipt.status === 'success',
      hash,
      from: account.address,
      to,
      amount: formatEther(amount),
      blockNumber: receipt.blockNumber.toString(),
      network: cfg.network,
    }))
    return
  }

  if (receipt.status !== 'success') {
    error(`Transaction reverted: ${hash}`)
    process.exit(1)
  }

  success(`Transferred ${formatEther(amount)} INKD to ${to}`)
  info(`Block: ${receipt.blockNumber}`)
  console.log()
}

/**
 * inkd token info [--json]
 * Show $INKD token metadata: name, symbol, decimals, total supply.
 */
export async function cmdTokenInfo(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json')

  const cfg   = loadConfig()
  const addrs = ADDRESSES[cfg.network]

  if (!addrs.token) {
    warn('Token contract address not configured.')
    process.exit(1)
  }

  const client = buildPublicClient(cfg)

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'name' })         as Promise<string>,
    client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'symbol' })       as Promise<string>,
    client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'decimals' })     as Promise<number>,
    client.readContract({ address: addrs.token, abi: FULL_TOKEN_ABI, functionName: 'totalSupply' })  as Promise<bigint>,
  ])

  if (jsonMode) {
    console.log(JSON.stringify({
      address: addrs.token,
      name, symbol, decimals,
      totalSupply: formatEther(totalSupply),
      network: cfg.network,
    }))
    return
  }

  console.log()
  console.log(`  ${BOLD}$INKD Token Info${RESET}`)
  console.log(`  ${'─'.repeat(40)}`)
  info(`Contract: ${CYAN}${addrs.token}${RESET}`)
  info(`Name:     ${name}`)
  info(`Symbol:   ${GREEN}${symbol}${RESET}`)
  info(`Decimals: ${decimals}`)
  info(`Supply:   ${GREEN}${formatEther(totalSupply)} ${symbol}${RESET}`)
  info(`Network:  ${cfg.network}`)
  console.log()
}

// ─── Router ──────────────────────────────────────────────────────────────────

export async function cmdToken(args: string[]): Promise<void> {
  const sub     = args[0]
  const subArgs = args.slice(1)

  const { YELLOW: Y, RESET: R, DIM: D } = { YELLOW, RESET, DIM }

  switch (sub) {
    case 'balance':
      await cmdTokenBalance(subArgs)
      break
    case 'allowance':
      await cmdTokenAllowance(subArgs)
      break
    case 'approve':
      await cmdTokenApprove(subArgs)
      break
    case 'transfer':
      await cmdTokenTransfer(subArgs)
      break
    case 'info':
      await cmdTokenInfo(subArgs)
      break
    default:
      console.error(`\n  ${Y}Unknown token sub-command: ${sub || '(none)'}${R}`)
      console.error(`\n  ${BOLD}Usage:${R}`)
      console.error(`    inkd token balance [address]       ${D}— INKD + ETH balance${R}`)
      console.error(`    inkd token allowance [address]     ${D}— registry spend allowance${R}`)
      console.error(`    inkd token approve <amount>        ${D}— approve registry to spend N INKD${R}`)
      console.error(`    inkd token transfer <to> <amount>  ${D}— send INKD to address${R}`)
      console.error(`    inkd token info                    ${D}— token metadata + total supply${R}`)
      console.error()
      process.exit(1)
  }
}
