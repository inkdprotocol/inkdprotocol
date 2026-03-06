/**
 * @file treasury.ts
 * @description AssemblyScript event handlers for InkdTreasury.
 *              Tracks all ETH flows in and out of the protocol treasury.
 */
import { Deposited, Withdrawn, Received } from "../generated/InkdTreasury/InkdTreasury";
/**
 * Deposited — ETH received from InkdRegistry (version push or transfer fee).
 */
export declare function handleDeposited(event: Deposited): void;
/**
 * Withdrawn — ETH sent from treasury to a recipient (owner withdrawal).
 */
export declare function handleWithdrawn(event: Withdrawn): void;
/**
 * Received — ETH sent directly to the treasury via the receive() fallback.
 */
export declare function handleReceived(event: Received): void;
