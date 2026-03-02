#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const config_js_1 = require("./config.js");
const init_js_1 = require("./commands/init.js");
const status_js_1 = require("./commands/status.js");
const project_js_1 = require("./commands/project.js");
const version_js_1 = require("./commands/version.js");
const agent_js_1 = require("./commands/agent.js");
const watch_js_1 = require("./commands/watch.js");
const search_js_1 = require("./commands/search.js");
const agentd_js_1 = require("./commands/agentd.js");
const token_js_1 = require("./commands/token.js");
// ─── Help ─────────────────────────────────────────────────────────────────────
function showHelp() {
    console.log(`
  ${config_js_1.BOLD}inkd${config_js_1.RESET} — Inkd Protocol CLI  ${config_js_1.DIM}v0.1.0${config_js_1.RESET}

  ${config_js_1.DIM}Ownership layer for AI agents. Every file is a token.${config_js_1.RESET}

  ${config_js_1.BOLD}USAGE${config_js_1.RESET}
    inkd <command> [sub-command] [flags]

  ${config_js_1.BOLD}COMMANDS${config_js_1.RESET}
    ${config_js_1.CYAN}init${config_js_1.RESET}                          Scaffold ${config_js_1.DIM}inkd.config.json${config_js_1.RESET} in current dir
    ${config_js_1.CYAN}status${config_js_1.RESET}                        Show network, contract addresses, and fees
    ${config_js_1.CYAN}help${config_js_1.RESET}                          Show this help message

  ${config_js_1.BOLD}PROJECT${config_js_1.RESET}
    ${config_js_1.CYAN}project create${config_js_1.RESET}                Register a new project (locks 1 $INKD)
      ${config_js_1.DIM}--name      <name>${config_js_1.RESET}           Project name (required, unique, lowercased)
      ${config_js_1.DIM}--description <desc>${config_js_1.RESET}         Short description
      ${config_js_1.DIM}--license   <spdx>${config_js_1.RESET}           SPDX license identifier (default: MIT)
      ${config_js_1.DIM}--readme    <arweave-hash>${config_js_1.RESET}   Arweave hash of the README
      ${config_js_1.DIM}--private${config_js_1.RESET}                    Make project private (default: public)
      ${config_js_1.DIM}--agent${config_js_1.RESET}                      Flag as AI agent project
      ${config_js_1.DIM}--endpoint  <url>${config_js_1.RESET}            Agent endpoint URL (if --agent)

    ${config_js_1.CYAN}project get${config_js_1.RESET} <id>              Fetch project details
    ${config_js_1.CYAN}project list${config_js_1.RESET} <address>        List projects owned by address
    ${config_js_1.CYAN}project transfer${config_js_1.RESET}              Transfer project ownership
      ${config_js_1.DIM}--id  <id>${config_js_1.RESET}                   Project ID (required)
      ${config_js_1.DIM}--to  <address>${config_js_1.RESET}              New owner address (required)

    ${config_js_1.CYAN}project collab${config_js_1.RESET} add|remove     Manage collaborators
      ${config_js_1.DIM}--id      <id>${config_js_1.RESET}               Project ID (required)
      ${config_js_1.DIM}--address <address>${config_js_1.RESET}          Collaborator address (required)

  ${config_js_1.BOLD}VERSION${config_js_1.RESET}
    ${config_js_1.CYAN}version push${config_js_1.RESET}                  Push a new version (requires versionFee ETH)
      ${config_js_1.DIM}--id         <id>${config_js_1.RESET}            Project ID (required)
      ${config_js_1.DIM}--hash        <arweave-hash>${config_js_1.RESET} Arweave content hash (required)
      ${config_js_1.DIM}--tag         <semver>${config_js_1.RESET}       Version tag e.g. v1.2.3 (required)
      ${config_js_1.DIM}--changelog   <text>${config_js_1.RESET}         Changelog notes

    ${config_js_1.CYAN}version list${config_js_1.RESET} <id>             List all versions for a project
    ${config_js_1.CYAN}version show${config_js_1.RESET}                  Show a specific version
      ${config_js_1.DIM}--id    <id>${config_js_1.RESET}                 Project ID (required)
      ${config_js_1.DIM}--index <n>${config_js_1.RESET}                  Version index, 0-based (required)

  ${config_js_1.BOLD}AGENT${config_js_1.RESET}
    ${config_js_1.CYAN}agent list${config_js_1.RESET}                    Browse the agent project directory
      ${config_js_1.DIM}--offset <n>${config_js_1.RESET}                 Pagination offset (default: 0)
      ${config_js_1.DIM}--limit  <n>${config_js_1.RESET}                 Page size (default: 25)

    ${config_js_1.CYAN}agent lookup${config_js_1.RESET} <name>           Find agent project by name

  ${config_js_1.BOLD}TOKEN${config_js_1.RESET}
    ${config_js_1.CYAN}token balance${config_js_1.RESET} [address]        Show $INKD + ETH balance (default: own wallet)
    ${config_js_1.CYAN}token allowance${config_js_1.RESET} [address]      Check registry spend allowance
    ${config_js_1.CYAN}token approve${config_js_1.RESET} <amount>         Approve registry to spend N $INKD
    ${config_js_1.CYAN}token transfer${config_js_1.RESET} <to> <amount>   Send $INKD to another address
    ${config_js_1.CYAN}token info${config_js_1.RESET}                     Show total supply + token metadata
      ${config_js_1.DIM}--json${config_js_1.RESET}                       JSON output for all token commands

  ${config_js_1.BOLD}SEARCH${config_js_1.RESET}
    ${config_js_1.CYAN}search${config_js_1.RESET} <query>                Search projects by name or description
      ${config_js_1.DIM}--agents${config_js_1.RESET}                     Only search agent projects
      ${config_js_1.DIM}--limit  <n>${config_js_1.RESET}                 Max results (default: 20)
      ${config_js_1.DIM}--json${config_js_1.RESET}                       JSON output (for scripting)

  ${config_js_1.BOLD}DAEMON${config_js_1.RESET}
    ${config_js_1.CYAN}agentd start${config_js_1.RESET}                  Run autonomous agent daemon (long-running)
      ${config_js_1.DIM}--interval <ms>${config_js_1.RESET}              Sync interval in ms (default: 60000)
      ${config_js_1.DIM}--dry-run${config_js_1.RESET}                    Simulate only — no on-chain transactions
      ${config_js_1.DIM}--quiet${config_js_1.RESET}                      Only print errors
      ${config_js_1.DIM}--json${config_js_1.RESET}                       Newline-delimited JSON output (for log pipelines)
      ${config_js_1.DIM}--once${config_js_1.RESET}                       Single cycle then exit (great for cron)

    ${config_js_1.CYAN}agentd status${config_js_1.RESET}                 Print current daemon state
    ${config_js_1.CYAN}agentd peers${config_js_1.RESET}                  List all discovered peer agents

    ${config_js_1.DIM}Env vars:${config_js_1.RESET}
      ${config_js_1.GREEN}INKD_AGENT_NAME${config_js_1.RESET}             Your agent's project name (required)
      ${config_js_1.GREEN}INKD_AGENT_ENDPOINT${config_js_1.RESET}         API endpoint to advertise to peers
      ${config_js_1.GREEN}INKD_INTERVAL${config_js_1.RESET}               Default interval override in ms

  ${config_js_1.BOLD}WATCH${config_js_1.RESET}
    ${config_js_1.CYAN}watch${config_js_1.RESET} [filter]                Stream real-time on-chain events
      ${config_js_1.DIM}filter: all | projects | versions | agents${config_js_1.RESET}  (default: all)
      ${config_js_1.DIM}--poll <ms>${config_js_1.RESET}                  Polling interval (default: 3000)
      ${config_js_1.DIM}--from <block>${config_js_1.RESET}               Start from block (default: latest-1000)
      ${config_js_1.DIM}--json${config_js_1.RESET}                       Newline-delimited JSON output

  ${config_js_1.BOLD}ENVIRONMENT${config_js_1.RESET}
    ${config_js_1.GREEN}INKD_PRIVATE_KEY${config_js_1.RESET}              Wallet private key (hex, with or without 0x)
    ${config_js_1.GREEN}INKD_NETWORK${config_js_1.RESET}                  ${config_js_1.DIM}mainnet${config_js_1.RESET} | ${config_js_1.DIM}testnet${config_js_1.RESET} (overrides config file)
    ${config_js_1.GREEN}INKD_RPC_URL${config_js_1.RESET}                  Custom RPC endpoint

  ${config_js_1.BOLD}EXAMPLES${config_js_1.RESET}
    ${config_js_1.DIM}inkd init${config_js_1.RESET}
    ${config_js_1.DIM}inkd status${config_js_1.RESET}
    ${config_js_1.DIM}inkd project create --name my-agent --agent --endpoint https://api.example.com${config_js_1.RESET}
    ${config_js_1.DIM}inkd project get 1${config_js_1.RESET}
    ${config_js_1.DIM}inkd version push --id 1 --hash abc123xyz --tag v0.1.0 --changelog "initial release"${config_js_1.RESET}
    ${config_js_1.DIM}inkd agent list --limit 50${config_js_1.RESET}
    ${config_js_1.DIM}inkd agent lookup my-agent${config_js_1.RESET}
    ${config_js_1.DIM}inkd search "trading bot" --agents${config_js_1.RESET}
    ${config_js_1.DIM}inkd watch versions --poll 5000${config_js_1.RESET}
    ${config_js_1.DIM}inkd watch --json | jq .${config_js_1.RESET}
    ${config_js_1.DIM}inkd token balance${config_js_1.RESET}
    ${config_js_1.DIM}inkd token balance 0xABC...${config_js_1.RESET}
    ${config_js_1.DIM}inkd token approve 10${config_js_1.RESET}
    ${config_js_1.DIM}inkd token transfer 0xDEF... 5${config_js_1.RESET}
    ${config_js_1.DIM}inkd token info --json${config_js_1.RESET}
    ${config_js_1.DIM}INKD_AGENT_NAME=my-bot inkd agentd start --interval 30000${config_js_1.RESET}
    ${config_js_1.DIM}inkd agentd start --once${config_js_1.RESET}
    ${config_js_1.DIM}inkd agentd status${config_js_1.RESET}
    ${config_js_1.DIM}inkd agentd peers${config_js_1.RESET}

  ${config_js_1.BOLD}DOCS${config_js_1.RESET}    https://inkdprotocol.xyz/docs
  ${config_js_1.BOLD}GITHUB${config_js_1.RESET}  https://github.com/inkdprotocol/inkd-protocol
`);
}
// ─── Router ───────────────────────────────────────────────────────────────────
async function main() {
    const [, , cmd, ...rest] = process.argv;
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        showHelp();
        return;
    }
    if (cmd === '--version' || cmd === '-v') {
        console.log('0.1.0');
        return;
    }
    switch (cmd) {
        case 'init':
            await (0, init_js_1.cmdInit)(rest);
            break;
        case 'status':
            await (0, status_js_1.cmdStatus)();
            break;
        case 'project': {
            const sub = rest[0];
            const subArgs = rest.slice(1);
            switch (sub) {
                case 'create':
                    await (0, project_js_1.cmdProjectCreate)(subArgs);
                    break;
                case 'get':
                    await (0, project_js_1.cmdProjectGet)(rest.slice(1));
                    break;
                case 'list':
                    await (0, project_js_1.cmdProjectList)(rest.slice(1));
                    break;
                case 'transfer':
                    await (0, project_js_1.cmdProjectTransfer)(subArgs);
                    break;
                case 'collab':
                    await (0, project_js_1.cmdProjectCollab)(rest.slice(1));
                    break;
                default:
                    console.error(`\n  ${config_js_1.YELLOW}Unknown project sub-command: ${sub}${config_js_1.RESET}`);
                    console.error(`  Run ${config_js_1.DIM}inkd help${config_js_1.RESET} for usage.\n`);
                    process.exit(1);
            }
            break;
        }
        case 'version': {
            const sub = rest[0];
            switch (sub) {
                case 'push':
                    await (0, version_js_1.cmdVersionPush)(rest.slice(1));
                    break;
                case 'list':
                    await (0, version_js_1.cmdVersionList)(rest.slice(1));
                    break;
                case 'show':
                    await (0, version_js_1.cmdVersionShow)(rest.slice(1));
                    break;
                default:
                    console.error(`\n  ${config_js_1.YELLOW}Unknown version sub-command: ${sub}${config_js_1.RESET}`);
                    console.error(`  Run ${config_js_1.DIM}inkd help${config_js_1.RESET} for usage.\n`);
                    process.exit(1);
            }
            break;
        }
        case 'agent': {
            const sub = rest[0];
            switch (sub) {
                case 'list':
                    await (0, agent_js_1.cmdAgentList)(rest.slice(1));
                    break;
                case 'lookup':
                    await (0, agent_js_1.cmdAgentLookup)(rest.slice(1));
                    break;
                default:
                    console.error(`\n  ${config_js_1.YELLOW}Unknown agent sub-command: ${sub}${config_js_1.RESET}`);
                    console.error(`  Run ${config_js_1.DIM}inkd help${config_js_1.RESET} for usage.\n`);
                    process.exit(1);
            }
            break;
        }
        case 'token':
            await (0, token_js_1.cmdToken)(rest);
            break;
        case 'search':
            await (0, search_js_1.cmdSearch)(rest);
            break;
        case 'watch':
            await (0, watch_js_1.cmdWatch)(rest);
            break;
        case 'agentd':
            await (0, agentd_js_1.cmdAgentd)(rest);
            break;
        default:
            console.error(`\n  ${config_js_1.YELLOW}Unknown command: ${cmd}${config_js_1.RESET}`);
            console.error(`  Run ${config_js_1.DIM}inkd help${config_js_1.RESET} for usage.\n`);
            process.exit(1);
    }
}
main().catch((err) => {
    console.error(`\n  ${'\x1b[31m'}✗${'\x1b[0m'} ${err.message}\n`);
    if (process.env['INKD_DEBUG'])
        console.error(err.stack);
    process.exit(1);
});
//# sourceMappingURL=index.js.map