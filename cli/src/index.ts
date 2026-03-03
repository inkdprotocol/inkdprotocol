#!/usr/bin/env node
/**
 * @inkd/cli — Inkd Protocol command-line interface
 *
 * Usage: inkd <command> [sub-command] [flags]
 *
 * Commands:
 *   init                        Scaffold inkd.config.json
 *   status                      Show network status and fees
 *   project create              Register a new project (locks 1 $INKD)
 *   project get    <id>         Fetch project details
 *   project list   <address>    List projects owned by an address
 *   project transfer            Transfer project ownership
 *   project collab add|remove   Manage collaborators
 *   version push                Push a new version to a project
 *   version list   <id>         List all versions for a project
 *   version show                Show a specific version
 *   agent list                  Browse agent directory
 *   agent lookup   <name>       Find an agent project by name
 *   help                        Show this help message
 */

import { BOLD, RESET, CYAN, DIM, GREEN, YELLOW } from './config.js'
import { cmdInit }                                    from './commands/init.js'
import { cmdStatus }                                  from './commands/status.js'
import {
  cmdProjectCreate,
  cmdProjectGet,
  cmdProjectList,
  cmdProjectTransfer,
  cmdProjectCollab,
} from './commands/project.js'
import {
  cmdVersionPush,
  cmdVersionList,
  cmdVersionShow,
} from './commands/version.js'
import {
  cmdAgentList,
  cmdAgentLookup,
} from './commands/agent.js'
import { cmdWatch }   from './commands/watch.js'
import { cmdSearch }  from './commands/search.js'
import { cmdAgentd }  from './commands/agentd.js'
import { cmdToken }   from './commands/token.js'

// ─── Help ─────────────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
  ${BOLD}inkd${RESET} — Inkd Protocol CLI  ${DIM}v0.1.0${RESET}

  ${DIM}Ownership layer for AI agents. Every file is a token.${RESET}

  ${BOLD}USAGE${RESET}
    inkd <command> [sub-command] [flags]

  ${BOLD}COMMANDS${RESET}
    ${CYAN}init${RESET}                          Scaffold ${DIM}inkd.config.json${RESET} in current dir
    ${CYAN}status${RESET}                        Show network, contract addresses, and fees
    ${CYAN}help${RESET}                          Show this help message

  ${BOLD}PROJECT${RESET}
    ${CYAN}project create${RESET}                Register a new project (locks 1 $INKD)
      ${DIM}--name      <name>${RESET}           Project name (required, unique, lowercased)
      ${DIM}--description <desc>${RESET}         Short description
      ${DIM}--license   <spdx>${RESET}           SPDX license identifier (default: MIT)
      ${DIM}--readme    <arweave-hash>${RESET}   Arweave hash of the README
      ${DIM}--private${RESET}                    Make project private (default: public)
      ${DIM}--agent${RESET}                      Flag as AI agent project
      ${DIM}--endpoint  <url>${RESET}            Agent endpoint URL (if --agent)

    ${CYAN}project get${RESET} <id>              Fetch project details
    ${CYAN}project list${RESET} <address>        List projects owned by address
    ${CYAN}project transfer${RESET}              Transfer project ownership
      ${DIM}--id  <id>${RESET}                   Project ID (required)
      ${DIM}--to  <address>${RESET}              New owner address (required)

    ${CYAN}project collab${RESET} add|remove     Manage collaborators
      ${DIM}--id      <id>${RESET}               Project ID (required)
      ${DIM}--address <address>${RESET}          Collaborator address (required)

  ${BOLD}VERSION${RESET}
    ${CYAN}version push${RESET}                  Push a new version (requires versionFee ETH)
      ${DIM}--id         <id>${RESET}            Project ID (required)
      ${DIM}--hash        <arweave-hash>${RESET} Arweave content hash (required)
      ${DIM}--tag         <semver>${RESET}       Version tag e.g. v1.2.3 (required)
      ${DIM}--changelog   <text>${RESET}         Changelog notes

    ${CYAN}version list${RESET} <id>             List all versions for a project
    ${CYAN}version show${RESET}                  Show a specific version
      ${DIM}--id    <id>${RESET}                 Project ID (required)
      ${DIM}--index <n>${RESET}                  Version index, 0-based (required)

  ${BOLD}AGENT${RESET}
    ${CYAN}agent list${RESET}                    Browse the agent project directory
      ${DIM}--offset <n>${RESET}                 Pagination offset (default: 0)
      ${DIM}--limit  <n>${RESET}                 Page size (default: 25)

    ${CYAN}agent lookup${RESET} <name>           Find agent project by name

  ${BOLD}TOKEN${RESET}
    ${CYAN}token balance${RESET} [address]        Show $INKD + ETH balance (default: own wallet)
    ${CYAN}token allowance${RESET} [address]      Check registry spend allowance
    ${CYAN}token approve${RESET} <amount>         Approve registry to spend N $INKD
    ${CYAN}token transfer${RESET} <to> <amount>   Send $INKD to another address
    ${CYAN}token info${RESET}                     Show total supply + token metadata
      ${DIM}--json${RESET}                       JSON output for all token commands

  ${BOLD}SEARCH${RESET}
    ${CYAN}search${RESET} <query>                Search projects by name or description
      ${DIM}--agents${RESET}                     Only search agent projects
      ${DIM}--limit  <n>${RESET}                 Max results (default: 20)
      ${DIM}--json${RESET}                       JSON output (for scripting)

  ${BOLD}DAEMON${RESET}
    ${CYAN}agentd start${RESET}                  Run autonomous agent daemon (long-running)
      ${DIM}--interval <ms>${RESET}              Sync interval in ms (default: 60000)
      ${DIM}--dry-run${RESET}                    Simulate only — no on-chain transactions
      ${DIM}--quiet${RESET}                      Only print errors
      ${DIM}--json${RESET}                       Newline-delimited JSON output (for log pipelines)
      ${DIM}--once${RESET}                       Single cycle then exit (great for cron)

    ${CYAN}agentd status${RESET}                 Print current daemon state
    ${CYAN}agentd peers${RESET}                  List all discovered peer agents

    ${DIM}Env vars:${RESET}
      ${GREEN}INKD_AGENT_NAME${RESET}             Your agent's project name (required)
      ${GREEN}INKD_AGENT_ENDPOINT${RESET}         API endpoint to advertise to peers
      ${GREEN}INKD_INTERVAL${RESET}               Default interval override in ms

  ${BOLD}WATCH${RESET}
    ${CYAN}watch${RESET} [filter]                Stream real-time on-chain events
      ${DIM}filter: all | projects | versions | agents${RESET}  (default: all)
      ${DIM}--poll <ms>${RESET}                  Polling interval (default: 3000)
      ${DIM}--from <block>${RESET}               Start from block (default: latest-1000)
      ${DIM}--json${RESET}                       Newline-delimited JSON output

  ${BOLD}ENVIRONMENT${RESET}
    ${GREEN}INKD_PRIVATE_KEY${RESET}              Wallet private key (hex, with or without 0x)
    ${GREEN}INKD_NETWORK${RESET}                  ${DIM}mainnet${RESET} | ${DIM}testnet${RESET} (overrides config file)
    ${GREEN}INKD_RPC_URL${RESET}                  Custom RPC endpoint

  ${BOLD}EXAMPLES${RESET}
    ${DIM}inkd init${RESET}
    ${DIM}inkd status${RESET}
    ${DIM}inkd project create --name my-agent --agent --endpoint https://api.example.com${RESET}
    ${DIM}inkd project get 1${RESET}
    ${DIM}inkd version push --id 1 --hash abc123xyz --tag v0.1.0 --changelog "initial release"${RESET}
    ${DIM}inkd agent list --limit 50${RESET}
    ${DIM}inkd agent lookup my-agent${RESET}
    ${DIM}inkd search "trading bot" --agents${RESET}
    ${DIM}inkd watch versions --poll 5000${RESET}
    ${DIM}inkd watch --json | jq .${RESET}
    ${DIM}inkd token balance${RESET}
    ${DIM}inkd token balance 0xABC...${RESET}
    ${DIM}inkd token approve 10${RESET}
    ${DIM}inkd token transfer 0xDEF... 5${RESET}
    ${DIM}inkd token info --json${RESET}
    ${DIM}INKD_AGENT_NAME=my-bot inkd agentd start --interval 30000${RESET}
    ${DIM}inkd agentd start --once${RESET}
    ${DIM}inkd agentd status${RESET}
    ${DIM}inkd agentd peers${RESET}

  ${BOLD}DOCS${RESET}    https://inkdprotocol.xyz/docs
  ${BOLD}GITHUB${RESET}  https://github.com/inkdprotocol/inkd-protocol
`)
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [,, cmd, ...rest] = process.argv

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    showHelp()
    return
  }

  if (cmd === '--version' || cmd === '-v') {
    console.log('0.1.0')
    return
  }

  switch (cmd) {
    case 'init':
      await cmdInit(rest)
      break

    case 'status':
      await cmdStatus()
      break

    case 'project': {
      const sub = rest[0]
      const subArgs = rest.slice(1)
      switch (sub) {
        case 'create':   await cmdProjectCreate(subArgs);           break
        case 'get':      await cmdProjectGet(rest.slice(1));        break
        case 'list':     await cmdProjectList(rest.slice(1));       break
        case 'transfer': await cmdProjectTransfer(subArgs);         break
        case 'collab':   await cmdProjectCollab(rest.slice(1));     break
        default:
          console.error(`\n  ${YELLOW}Unknown project sub-command: ${sub}${RESET}`)
          console.error(`  Run ${DIM}inkd help${RESET} for usage.\n`)
          process.exit(1)
      }
      break
    }

    case 'version': {
      const sub = rest[0]
      switch (sub) {
        case 'push': await cmdVersionPush(rest.slice(1)); break
        case 'list': await cmdVersionList(rest.slice(1)); break
        case 'show': await cmdVersionShow(rest.slice(1)); break
        default:
          console.error(`\n  ${YELLOW}Unknown version sub-command: ${sub}${RESET}`)
          console.error(`  Run ${DIM}inkd help${RESET} for usage.\n`)
          process.exit(1)
      }
      break
    }

    case 'agent': {
      const sub = rest[0]
      switch (sub) {
        case 'list':   await cmdAgentList(rest.slice(1));   break
        case 'lookup': await cmdAgentLookup(rest.slice(1)); break
        default:
          console.error(`\n  ${YELLOW}Unknown agent sub-command: ${sub}${RESET}`)
          console.error(`  Run ${DIM}inkd help${RESET} for usage.\n`)
          process.exit(1)
      }
      break
    }

    case 'token':
      await cmdToken(rest)
      break

    case 'search':
      await cmdSearch(rest)
      break

    case 'watch':
      await cmdWatch(rest)
      break

    case 'agentd':
      await cmdAgentd(rest)
      break

    default:
      console.error(`\n  ${YELLOW}Unknown command: ${cmd}${RESET}`)
      console.error(`  Run ${DIM}inkd help${RESET} for usage.\n`)
      process.exit(1)
  }
}

export { main }

// Auto-run only when executed directly (not imported in tests)
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1].endsWith('/inkd') ||
   process.argv[1].endsWith('/index.js') ||
   process.argv[1].endsWith('/index.ts'))

if (isMain && process.env['INKD_TEST'] !== '1') {
  main().catch((err: Error) => {
    console.error(`\n  ${'\x1b[31m'}✗${'\x1b[0m'} ${err.message}\n`)
    if (process.env['INKD_DEBUG']) console.error(err.stack)
    process.exit(1)
  })
}
