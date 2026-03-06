/**
 * inkd watch — stream on-chain Inkd Protocol events in real-time
 *
 * Sub-commands:
 *   all      — all events (default)
 *   projects — ProjectCreated + ProjectUpdated events only
 *   versions — VersionPushed events only
 *   agents   — agent-related events only
 *
 * Flags:
 *   --poll <ms>    Polling interval in ms (default: 3000)
 *   --from <block> Start block (default: latest - 1000)
 *   --json         Output raw JSON (for piping)
 */
export declare function cmdWatch(args: string[]): Promise<void>;
