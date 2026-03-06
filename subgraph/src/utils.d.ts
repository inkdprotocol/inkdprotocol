import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { ProtocolStats } from "../generated/schema";
export declare const GLOBAL_STATS_ID = "global";
export declare const ZERO_BI: any;
export declare const ONE_BI: any;
/**
 * Load or create the singleton ProtocolStats entity.
 */
export declare function loadOrCreateStats(timestamp: BigInt): ProtocolStats;
/**
 * Build a composite ID safe for use as an entity ID.
 */
export declare function buildId(parts: string[]): string;
/**
 * Convert a Bytes value to a hex string ID.
 */
export declare function bytesToId(b: Bytes): string;
