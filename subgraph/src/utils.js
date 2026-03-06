"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ONE_BI = exports.ZERO_BI = exports.GLOBAL_STATS_ID = void 0;
exports.loadOrCreateStats = loadOrCreateStats;
exports.buildId = buildId;
exports.bytesToId = bytesToId;
const graph_ts_1 = require("@graphprotocol/graph-ts");
const schema_1 = require("../generated/schema");
exports.GLOBAL_STATS_ID = "global";
exports.ZERO_BI = graph_ts_1.BigInt.fromI32(0);
exports.ONE_BI = graph_ts_1.BigInt.fromI32(1);
/**
 * Load or create the singleton ProtocolStats entity.
 */
function loadOrCreateStats(timestamp) {
    let stats = schema_1.ProtocolStats.load(exports.GLOBAL_STATS_ID);
    if (stats == null) {
        stats = new schema_1.ProtocolStats(exports.GLOBAL_STATS_ID);
        stats.totalProjects = exports.ZERO_BI;
        stats.totalVersions = exports.ZERO_BI;
        stats.totalAgentProjects = exports.ZERO_BI;
        stats.totalVersionFees = exports.ZERO_BI;
        stats.totalTransferFees = exports.ZERO_BI;
        stats.versionFee = graph_ts_1.BigInt.fromString("1000000000000000"); // 0.001 ETH default
        stats.transferFee = graph_ts_1.BigInt.fromString("5000000000000000"); // 0.005 ETH default
        stats.lastUpdated = timestamp;
    }
    return stats;
}
/**
 * Build a composite ID safe for use as an entity ID.
 */
function buildId(parts) {
    return parts.join("-");
}
/**
 * Convert a Bytes value to a hex string ID.
 */
function bytesToId(b) {
    return b.toHexString();
}
//# sourceMappingURL=utils.js.map