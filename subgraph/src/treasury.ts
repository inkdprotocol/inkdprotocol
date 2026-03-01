/**
 * @file treasury.ts
 * @description AssemblyScript event handlers for InkdTreasury.
 *              Tracks all ETH flows in and out of the protocol treasury.
 */

import {
  Deposited,
  Withdrawn,
  Received,
} from "../generated/InkdTreasury/InkdTreasury";
import { TreasuryEvent } from "../generated/schema";
import { loadOrCreateStats, buildId } from "./utils";

// ─── Event Handlers ───────────────────────────────────────────────────────────

/**
 * Deposited — ETH received from InkdRegistry (version push or transfer fee).
 */
export function handleDeposited(event: Deposited): void {
  let id = buildId([
    event.transaction.hash.toHexString(),
    event.logIndex.toString(),
  ]);

  let ev = new TreasuryEvent(id);
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
export function handleWithdrawn(event: Withdrawn): void {
  let id = buildId([
    event.transaction.hash.toHexString(),
    event.logIndex.toString(),
  ]);

  let ev = new TreasuryEvent(id);
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
export function handleReceived(event: Received): void {
  let id = buildId([
    event.transaction.hash.toHexString(),
    event.logIndex.toString(),
  ]);

  let ev = new TreasuryEvent(id);
  ev.eventType = "receive";
  ev.account = event.params.sender;
  ev.amount = event.params.amount;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.transactionHash = event.transaction.hash;
  ev.save();
}
