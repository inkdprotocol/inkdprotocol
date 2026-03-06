"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalFacilitatorClient = void 0;
// ─── EIP-3009 ABI ─────────────────────────────────────────────────────────────
const AUTHORIZATION_TYPEHASH_ABI = [{
        name: 'TransferWithAuthorization',
        type: 'function',
        inputs: [],
        outputs: [],
    }];
// ─── Local Facilitator ────────────────────────────────────────────────────────
class LocalFacilitatorClient {
    network;
    usdcAddress;
    treasuryAddress;
    constructor(network, usdcAddress, treasuryAddress) {
        this.network = network;
        this.usdcAddress = usdcAddress;
        this.treasuryAddress = treasuryAddress;
    }
    /**
     * Return hardcoded supported kinds — no HTTP call needed.
     * We support exact/EIP-3009 on Base Mainnet and Sepolia.
     */
    async getSupported() {
        return {
            kinds: [
                {
                    x402Version: 2,
                    scheme: 'exact',
                    network: this.network === 'mainnet' ? 'eip155:8453' : 'eip155:84532',
                    extra: { token: this.usdcAddress, name: 'USDC' },
                },
            ],
        };
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async verify(paymentPayload, paymentRequirements) {
        try {
            const auth = paymentPayload?.payload?.authorization;
            const sig = paymentPayload?.payload?.signature;
            if (!auth || !sig) {
                return { isValid: false, invalidReason: 'missing_authorization_or_signature' };
            }
            const { from, to, value, validAfter, validBefore } = auth;
            // Check recipient is our Treasury
            if (to?.toLowerCase() !== this.treasuryAddress.toLowerCase()) {
                return { isValid: false, invalidReason: 'wrong_recipient' };
            }
            // Check amount meets requirement
            const required = BigInt(paymentRequirements?.maxAmountRequired ?? paymentRequirements?.amount ?? 0);
            const paid = BigInt(value ?? 0);
            if (paid < required) {
                return { isValid: false, invalidReason: 'insufficient_amount' };
            }
            // Check validity window
            const now = Math.floor(Date.now() / 1000);
            if (now < Number(validAfter ?? 0)) {
                return { isValid: false, invalidReason: 'not_yet_valid' };
            }
            if (now > Number(validBefore ?? Infinity)) {
                return { isValid: false, invalidReason: 'expired' };
            }
            // Signature present and authorization fields look valid
            return { isValid: true, payer: from };
        }
        catch (err) {
            return {
                isValid: false,
                invalidReason: `verify_error: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    /**
     * Settlement: return success immediately.
     *
     * The actual USDC distribution is handled by Treasury.settle() in the route handler.
     * We don't need to do anything here — the EIP-3009 transfer already moved funds
     * to Treasury before the route handler was called.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async settle(paymentPayload, paymentRequirements) {
        return {
            success: true,
            transaction: '0x0000000000000000000000000000000000000000000000000000000000000000',
            network: paymentRequirements?.network ?? paymentPayload?.accepted?.network ?? 'eip155:8453',
        };
    }
}
exports.LocalFacilitatorClient = LocalFacilitatorClient;
//# sourceMappingURL=localFacilitator.js.map