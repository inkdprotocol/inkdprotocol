"use strict";
/**
 * @file treasury.ts
 * @description AssemblyScript event handlers for InkdTreasury.
 *              Tracks all ETH flows in and out of the protocol treasury.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDeposited = handleDeposited;
exports.handleWithdrawn = handleWithdrawn;
exports.handleReceived = handleReceived;
const schema_1 = require("../generated/schema");
const utils_1 = require("./utils");
// ─── Event Handlers ───────────────────────────────────────────────────────────
/**
 * Deposited — ETH received from InkdRegistry (version push or transfer fee).
 */
function handleDeposited(event) {
    let id = (0, utils_1.buildId)([
        event.transaction.hash.toHexString(),
        event.logIndex.toString(),
    ]);
    let ev = new schema_1.TreasuryEvent(id);
    ev.eventType = "deposit";
    ev.account = event.params.from;
    ev.amount = event.params.amount;
    ev.timestamp = event.block.timestamp;
    ev.blockNumber = event.block.number;
    ev.transactionHash = event.transaction.hash;
    ev.save();
}
/**
 * Withdrawn — ETH sent from treasury to a recipient (owner withdrawal).
 */
function handleWithdrawn(event) {
    let id = (0, utils_1.buildId)([
        event.transaction.hash.toHexString(),
        event.logIndex.toString(),
    ]);
    let ev = new schema_1.TreasuryEvent(id);
    ev.eventType = "withdraw";
    ev.account = event.params.to;
    ev.amount = event.params.amount;
    ev.timestamp = event.block.timestamp;
    ev.blockNumber = event.block.number;
    ev.transactionHash = event.transaction.hash;
    ev.save();
}
/**
 * Received — ETH sent directly to the treasury via the receive() fallback.
 */
function handleReceived(event) {
    let id = (0, utils_1.buildId)([
        event.transaction.hash.toHexString(),
        event.logIndex.toString(),
    ]);
    let ev = new schema_1.TreasuryEvent(id);
    ev.eventType = "receive";
    ev.account = event.params.sender;
    ev.amount = event.params.amount;
    ev.timestamp = event.block.timestamp;
    ev.blockNumber = event.block.number;
    ev.transactionHash = event.transaction.hash;
    ev.save();
}
//# sourceMappingURL=treasury.js.map