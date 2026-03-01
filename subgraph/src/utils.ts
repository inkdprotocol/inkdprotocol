import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { ProtocolStats } from "../generated/schema";

export const GLOBAL_STATS_ID = "global";
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);

/**
 * Load or create the singleton ProtocolStats entity.
 */
export function loadOrCreateStats(timestamp: BigInt): ProtocolStats {
  let stats = ProtocolStats.load(GLOBAL_STATS_ID);
  if (stats == null) {
    stats = new ProtocolStats(GLOBAL_STATS_ID);
    stats.totalProjects = ZERO_BI;
    stats.totalVersions = ZERO_BI;
    stats.totalAgentProjects = ZERO_BI;
    stats.totalVersionFees = ZERO_BI;
    stats.totalTransferFees = ZERO_BI;
    stats.versionFee = BigInt.fromString("1000000000000000"); // 0.001 ETH default
    stats.transferFee = BigInt.fromString("5000000000000000"); // 0.005 ETH default
    stats.lastUpdated = timestamp;
  }
  return stats as ProtocolStats;
}

/**
 * Build a composite ID safe for use as an entity ID.
 */
export function buildId(parts: string[]): string {
  return parts.join("-");
}

/**
 * Convert a Bytes value to a hex string ID.
 */
export function bytesToId(b: Bytes): string {
  return b.toHexString();
}
