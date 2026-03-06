/**
 * inkd project <sub-command> — project management (x402 payment flow)
 *
 * Sub-commands:
 *   create   — register a new project ($5 USDC via x402)
 *   get      — fetch project details by ID
 *   list     — list projects owned by an address
 */
export declare function cmdProjectCreate(args: string[]): Promise<void>;
export declare function cmdProjectGet(args: string[]): Promise<void>;
export declare function cmdProjectList(args: string[]): Promise<void>;
