/**
 * Inkd CLI — Config management
 * Reads inkd.config.json from cwd, or falls back to env vars.
 */
import type { Address } from 'viem';
export interface InkdConfig {
    network: 'mainnet' | 'testnet';
    rpcUrl?: string;
    /** Private key hex string. Prefer INKD_PRIVATE_KEY env var over storing in file. */
    privateKey?: string;
}
export declare const DEFAULT_CONFIG: InkdConfig;
export declare function loadConfig(): InkdConfig;
export declare function writeConfig(cfg: InkdConfig): void;
export declare function requirePrivateKey(cfg: InkdConfig): `0x${string}`;
export declare const ADDRESSES: {
    readonly mainnet: {
        readonly token: Address;
        readonly registry: Address;
        readonly treasury: Address;
    };
    readonly testnet: {
        readonly token: Address;
        readonly registry: Address;
        readonly treasury: Address;
    };
};
export type Network = keyof typeof ADDRESSES;
export declare function error(msg: string): never;
export declare function success(msg: string): void;
export declare function info(msg: string): void;
export declare function warn(msg: string): void;
export declare const RED: string;
export declare const GREEN: string;
export declare const YELLOW: string;
export declare const CYAN: string;
export declare const BOLD: string;
export declare const DIM: string;
export declare const RESET: string;
