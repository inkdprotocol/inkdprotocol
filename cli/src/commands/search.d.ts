/**
 * inkd search — search projects by name or description
 *
 * Usage:
 *   inkd search <query>
 *   inkd search <query> --agents     (only agent projects)
 *   inkd search <query> --limit <n>  (max results, default 20)
 *   inkd search <query> --json       (JSON output)
 *
 * Performs a case-insensitive substring match across name + description fields.
 * Uses parallel batched reads for speed.
 */
export declare function cmdSearch(args: string[]): Promise<void>;
