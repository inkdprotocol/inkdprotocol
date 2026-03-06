/**
 * E2E Mainnet Test — Full Flow
 *
 * 1. Upload test content to Arweave via /v1/upload
 * 2. Create project via /v1/projects ($5 USDC via x402)
 * 3. Push version with real Arweave hash ($2 USDC via x402)
 * 4. Read back and verify
 *
 * Run: AGENT_PRIVATE_KEY=0x... npx tsx examples/e2e-mainnet.ts
 */
export {};
