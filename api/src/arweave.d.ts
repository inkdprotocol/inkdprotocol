/**
 * Arweave / Irys pricing utilities.
 *
 * Fetches real-time upload cost from Irys network.
 * Used to calculate dynamic X402 payment amounts (cost × 1.20).
 */
/**
 * Get Arweave upload cost in USDC (6 decimals) for a given content size.
 *
 * @param bytes  Content size in bytes
 * @returns      USDC amount in base units (e.g. 1_500_000 = $1.50)
 */
export declare function getArweaveCostUsdc(bytes: number): Promise<bigint>;
/**
 * Calculate total charge including service markup.
 *
 * @param arweaveCostUsdc  Raw Arweave cost in USDC base units
 * @param markupBps        Markup in basis points (2000 = 20%)
 * @returns                { arweaveCost, markup, total } all in USDC base units
 */
export declare function calculateCharge(arweaveCostUsdc: bigint, markupBps?: number): {
    arweaveCost: bigint;
    markup: bigint;
    total: bigint;
};
/**
 * Format USDC base units to human-readable string (e.g. "$1.50").
 */
export declare function formatUsdc(amount: bigint): string;
