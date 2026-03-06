/**
 * x402 Demo — Autonomous Agent Registration
 *
 * Shows how an AI agent uses its wallet to autonomously pay for and register
 * a project on inkd — no API keys, no accounts, no human in the loop.
 *
 * Flow:
 *   1. Agent has a wallet (private key)
 *   2. Agent calls POST /v1/projects
 *   3. Server returns 402 with payment details (0.001 ETH)
 *   4. @x402/fetch auto-pays using the agent's wallet
 *   5. Server verifies payment via Coinbase facilitator
 *   6. Server calls Registry.createProject() on-chain
 *   7. Agent receives project ID — it now owns a project on-chain
 *
 * Run:
 *   cd api
 *   AGENT_PRIVATE_KEY=0x... API_URL=http://localhost:3000 npx tsx examples/x402-demo.ts
 */
export {};
