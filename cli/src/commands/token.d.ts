/**
 * inkd token — Manage $INKD token balance, allowances, and transfers
 *
 * Usage:
 *   inkd token balance [address]          Show INKD + ETH balance for address (default: own wallet)
 *   inkd token approve <amount>            Approve the registry to spend N INKD
 *   inkd token allowance [address]         Check current registry allowance for address
 *   inkd token transfer <to> <amount>      Transfer INKD to another address
 *   inkd token info                        Show total supply and token metadata
 *
 * Flags:
 *   --json                                 JSON output (for scripting)
 *
 * Environment:
 *   INKD_PRIVATE_KEY   Required for approve/transfer
 *   INKD_NETWORK       mainnet | testnet
 *   INKD_RPC_URL       Custom RPC
 */
/**
 * inkd token balance [address] [--json]
 * Show INKD balance + ETH balance for an address.
 * Defaults to own wallet if INKD_PRIVATE_KEY is set.
 */
export declare function cmdTokenBalance(args: string[]): Promise<void>;
/**
 * inkd token allowance [address] [--json]
 * Show how much INKD the registry is approved to spend on behalf of address.
 */
export declare function cmdTokenAllowance(args: string[]): Promise<void>;
/**
 * inkd token approve <amount> [--json]
 * Approve the registry contract to spend <amount> INKD on your behalf.
 */
export declare function cmdTokenApprove(args: string[]): Promise<void>;
/**
 * inkd token transfer <to> <amount> [--json]
 * Transfer <amount> INKD tokens to <to> address.
 */
export declare function cmdTokenTransfer(args: string[]): Promise<void>;
/**
 * inkd token info [--json]
 * Show $INKD token metadata: name, symbol, decimals, total supply.
 */
export declare function cmdTokenInfo(args: string[]): Promise<void>;
export declare function cmdToken(args: string[]): Promise<void>;
