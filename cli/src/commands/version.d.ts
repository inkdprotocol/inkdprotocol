/**
 * inkd version <sub-command> — version management (x402 payment flow)
 *
 * Sub-commands:
 *   push  — upload content to Arweave + push version on-chain ($2 USDC via x402)
 *   list  — list all versions for a project
 *   show  — show a specific version by index
 */
export declare function cmdVersionPush(args: string[]): Promise<void>;
export declare function cmdVersionList(args: string[]): Promise<void>;
export declare function cmdVersionShow(args: string[]): Promise<void>;
