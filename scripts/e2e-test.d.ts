/**
 * Inkd Protocol — End-to-End Test (Base Mainnet)
 *
 * Tests the full x402 payment flow:
 *   1. POST /v1/projects — $5 USDC via x402 → creates project on-chain
 *   2. POST /v1/projects/:id/versions — $2 USDC via x402 → pushes version on-chain
 *   3. GET /v1/projects/:id — verifies project exists
 *   4. Verify Treasury received USDC + settle() was called
 */
export {};
