"use strict";
/**
 * Arweave / Irys pricing utilities.
 *
 * Fetches real-time upload cost from Irys network.
 * Used to calculate dynamic X402 payment amounts (cost × 1.20).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArweaveCostUsdc = getArweaveCostUsdc;
exports.calculateCharge = calculateCharge;
exports.formatUsdc = formatUsdc;
const IRYS_NODE = 'https://node2.irys.xyz';
const ARWEAVE_GW = 'https://arweave.net';
const USDC_DECIMALS = 6;
// AR/USD price cache (5-minute TTL)
let cachedArUsd = null;
let cacheExpiry = 0;
/**
 * Fetch current AR/USD price from CoinGecko.
 */
async function getArUsdPrice() {
    if (cachedArUsd && Date.now() < cacheExpiry)
        return cachedArUsd;
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        throw new Error(`CoinGecko error: ${res.status}`);
    const data = await res.json();
    cachedArUsd = data.arweave.usd;
    cacheExpiry = Date.now() + 5 * 60 * 1000;
    return cachedArUsd;
}
/**
 * Fetch Arweave upload cost in Winston for a given byte size.
 * Uses the Arweave network price oracle.
 */
async function getArweavePriceWinston(bytes) {
    const res = await fetch(`${ARWEAVE_GW}/price/${bytes}`, {
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok)
        throw new Error(`Arweave price error: ${res.status}`);
    const winston = await res.text();
    return BigInt(winston.trim());
}
/**
 * Convert Winston to AR.
 * 1 AR = 1_000_000_000_000 Winston
 */
function winstonToAr(winston) {
    return Number(winston) / 1e12;
}
/**
 * Get Arweave upload cost in USDC (6 decimals) for a given content size.
 *
 * @param bytes  Content size in bytes
 * @returns      USDC amount in base units (e.g. 1_500_000 = $1.50)
 */
async function getArweaveCostUsdc(bytes) {
    const [winston, arUsd] = await Promise.all([
        getArweavePriceWinston(bytes),
        getArUsdPrice(),
    ]);
    const arCost = winstonToAr(winston);
    const usdCost = arCost * arUsd;
    // Convert to USDC base units (6 decimals), add 10% buffer for price movement
    const usdcWithBuffer = usdCost * 1.10;
    return BigInt(Math.ceil(usdcWithBuffer * 10 ** USDC_DECIMALS));
}
/**
 * Calculate total charge including service markup.
 *
 * @param arweaveCostUsdc  Raw Arweave cost in USDC base units
 * @param markupBps        Markup in basis points (2000 = 20%)
 * @returns                { arweaveCost, markup, total } all in USDC base units
 */
function calculateCharge(arweaveCostUsdc, markupBps = 2000) {
    const markup = arweaveCostUsdc * BigInt(markupBps) / 10000n;
    const total = arweaveCostUsdc + markup;
    return { arweaveCost: arweaveCostUsdc, markup, total };
}
/**
 * Format USDC base units to human-readable string (e.g. "$1.50").
 */
function formatUsdc(amount) {
    const dollars = Number(amount) / 10 ** USDC_DECIMALS;
    return `$${dollars.toFixed(2)}`;
}
//# sourceMappingURL=arweave.js.map