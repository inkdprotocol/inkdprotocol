/**
 * inkd status — show network info and contract fees
 */

import { loadConfig, ADDRESSES, info, warn, BOLD, RESET, CYAN, DIM, GREEN } from '../config.js'
import { buildPublicClient } from '../client.js'
import { REGISTRY_ABI } from '../abi.js'

export async function cmdStatus(): Promise<void> {
  const cfg = loadConfig()
  const addrs = ADDRESSES[cfg.network]

  console.log()
  console.log(`  ${BOLD}Inkd Protocol Status${RESET}`)
  console.log(`  ${'─'.repeat(40)}`)
  info(`Network:   ${CYAN}${cfg.network}${RESET}`)
  info(`RPC URL:   ${cfg.rpcUrl ?? DIM + 'default (public)' + RESET}`)
  info(`Registry:  ${addrs.registry || DIM + 'not deployed yet' + RESET}`)
  info(`Token:     ${addrs.token    || DIM + 'not deployed yet' + RESET}`)
  info(`Treasury:  ${addrs.treasury || DIM + 'not deployed yet' + RESET}`)

  if (!addrs.registry) {
    warn('Contract addresses not configured — update src/config.ts after deployment.')
    console.log()
    return
  }

  try {
    const client = buildPublicClient(cfg)
    const projectCount = await client.readContract({
      address: addrs.registry, abi: REGISTRY_ABI, functionName: 'projectCount'
    })
    console.log()
    info(`Projects:      ${GREEN}${projectCount.toString()}${RESET}`)
  } catch (e) {
    warn(`Could not read on-chain state: ${(e as Error).message}`)
  }

  console.log()
}
