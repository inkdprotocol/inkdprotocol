/**
 * inkd agent <sub-command> — AI agent project directory
 *
 * Sub-commands:
 *   list    — paginated list of registered agent projects
 *   lookup  — find agent by name
 */
export declare function cmdAgentList(args: string[]): Promise<void>;
export declare function cmdAgentLookup(args: string[]): Promise<void>;
