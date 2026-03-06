/**
 * inkd agentd — Autonomous agent daemon
 *
 * Long-running process that keeps an AI agent's on-chain identity alive,
 * periodically syncing state, discovering peers, and responding to events.
 *
 * Commands:
 *   inkd agentd start    Run the daemon (blocks until SIGINT/SIGTERM)
 *   inkd agentd status   Print current daemon status + last run
 *   inkd agentd peers    List all discovered peer agents
 *
 * Flags:
 *   --interval <ms>      Sync interval in ms (default: 60000 = 1 min)
 *   --dry-run            Simulate only — no on-chain transactions
 *   --quiet              Only print errors
 *   --json               Output as newline-delimited JSON (for log ingestion)
 *   --once               Run a single sync cycle then exit (great for cron)
 *
 * Environment:
 *   INKD_PRIVATE_KEY     Wallet private key (required for transactions)
 *   INKD_NETWORK         mainnet | testnet (default: testnet)
 *   INKD_RPC_URL         Custom RPC endpoint
 *   INKD_AGENT_NAME      Name of this agent's project (required)
 *   INKD_AGENT_ENDPOINT  API endpoint to advertise to peers
 *   INKD_INTERVAL        Sync interval override in ms
 *
 * What it does on each cycle:
 *   1. Reads on-chain registry to discover all peer agents
 *   2. Probes this agent's own project to confirm it exists
 *   3. Checks ETH balance (warns if < 0.01 ETH — can't pay version fees)
 *   4. Emits a heartbeat version to Arweave every N cycles (configurable)
 *   5. Writes a local state file (.agentd-state.json) for introspection
 */
export declare function cmdAgentd(args: string[]): Promise<void>;
