/**
 * Inkd API Server — Configuration
 *
 * All config is via environment variables. See api/.env.example for defaults.
 */
import type { Address, Chain } from 'viem';
export declare const ADDRESSES: Record<Network, ContractAddresses>;
export type Network = 'mainnet' | 'testnet';
export interface ContractAddresses {
    token: Address;
    registry: Address;
    treasury: Address;
}
export interface ApiConfig {
    port: number;
    network: Network;
    rpcUrl: string;
    apiKey: string | null;
    corsOrigin: string;
    rateLimitWindowMs: number;
    rateLimitMax: number;
    serverWalletKey: string | null;
    serverWalletAddress: Address | null;
    x402FacilitatorUrl: string;
    x402Enabled: boolean;
}
export declare function loadConfig(): ApiConfig;
export declare function getChain(network: Network): Chain;
//# sourceMappingURL=config.d.ts.map