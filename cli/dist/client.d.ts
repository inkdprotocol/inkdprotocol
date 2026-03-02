/**
 * Inkd CLI — viem client factory
 */
import { type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { InkdConfig } from './config.js';
import { ADDRESSES } from './config.js';
export { privateKeyToAccount };
export interface Clients {
    publicClient: PublicClient;
    walletClient: WalletClient;
    account: ReturnType<typeof privateKeyToAccount>;
    addrs: typeof ADDRESSES.testnet;
}
export declare function buildPublicClient(cfg: InkdConfig): PublicClient;
/** Build a WalletClient. If `account` is provided, use it; otherwise derive from cfg private key. */
export declare function buildWalletClient(cfg: InkdConfig, account?: ReturnType<typeof privateKeyToAccount>): WalletClient;
export declare function buildClients(cfg: InkdConfig): Clients;
//# sourceMappingURL=client.d.ts.map