/**
 * inkd init — scaffold inkd.config.json in the current directory
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { writeConfig, success, warn, BOLD, RESET, CYAN, DIM } from '../config.js'

export async function cmdInit(args: string[]): Promise<void> {
  const path = resolve(process.cwd(), 'inkd.config.json')
  const network = args.includes('--mainnet') ? 'mainnet' : 'testnet'

  if (existsSync(path) && !args.includes('--force')) {
    warn('inkd.config.json already exists. Use --force to overwrite.')
    return
  }

  writeConfig({ network })

  success(`Created ${BOLD}inkd.config.json${RESET} (network: ${CYAN}${network}${RESET})`)
  console.log(`  Next steps:`)
  console.log(`    ${DIM}export INKD_PRIVATE_KEY=0x...${RESET}   # never store keys in config files`)
  console.log(`    ${DIM}inkd status${RESET}                       # verify connection`)
  console.log(`    ${DIM}inkd project create${RESET}               # register your first project`)
  console.log()
}
