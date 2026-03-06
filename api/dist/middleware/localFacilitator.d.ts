/**
 * Inkd Local Facilitator Client
 *
 * Replaces the CDP Facilitator for x402 payment processing.
 *
 * Why no CDP?
 *   - CDP's /supported endpoint requires JWT auth that's been flaky
 *   - We don't need CDP for Inkd: USDC goes to our Treasury contract directly
 *   - The route handler calls Treasury.settle() which handles revenue distribution
 *   - EIP-3009 signature verification is done cryptographically (no external call)
 *
 * Flow:
 *   1. Client sends X-PAYMENT header (EIP-3009 signed USDC transfer)
 *   2. This facilitator verifies the signature is valid + amount + recipient correct
 *   3. Route handler calls Treasury.settle() to split the USDC on-chain
 *   4. settle() here returns success (actual settlement is via smart contract)
 */
import type { Address } from 'viem';
interface SupportedKind {
    x402Version: number;
    scheme: string;
    network: string;
    extra?: Record<string, unknown>;
}
interface SupportedResponse {
    kinds: SupportedKind[];
}
interface VerifyResponse {
    isValid: boolean;
    invalidReason?: string;
    payer?: string;
}
interface SettleResponse {
    success: boolean;
    transaction: string;
    network: string;
    errorReason?: string;
}
export declare class LocalFacilitatorClient {
    private readonly network;
    private readonly usdcAddress;
    private readonly treasuryAddress;
    constructor(network: 'mainnet' | 'testnet', usdcAddress: Address, treasuryAddress: Address);
    /**
     * Return hardcoded supported kinds — no HTTP call needed.
     * We support exact/EIP-3009 on Base Mainnet and Sepolia.
     */
    getSupported(): Promise<SupportedResponse>;
    /**
     * Verify an EIP-3009 payment payload.
     *
     * Checks:
     *   1. Signature is present
     *   2. `to` = Treasury contract (payer is paying the right address)
     *   3. `value` >= required amount
     *   4. Authorization is not expired
     *
     * We trust the cryptographic signature — no on-chain RPC needed for basic checks.
     */
    verify(paymentPayload: any, paymentRequirements: any): Promise<VerifyResponse>;
    /**
     * Settlement: return success immediately.
     *
     * The actual USDC distribution is handled by Treasury.settle() in the route handler.
     * We don't need to do anything here — the EIP-3009 transfer already moved funds
     * to Treasury before the route handler was called.
     */
    settle(paymentPayload: any, paymentRequirements: any): Promise<SettleResponse>;
}
export {};
//# sourceMappingURL=localFacilitator.d.ts.map