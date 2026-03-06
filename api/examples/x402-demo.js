"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@x402/fetch");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
// ─── Config ───────────────────────────────────────────────────────────────────
const AGENT_PRIVATE_KEY = (process.env['AGENT_PRIVATE_KEY'] ?? '');
const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';
if (!AGENT_PRIVATE_KEY) {
    console.error('Error: AGENT_PRIVATE_KEY environment variable required');
    process.exit(1);
}
// ─── Setup x402-enabled fetch ─────────────────────────────────────────────────
const account = (0, accounts_1.privateKeyToAccount)(AGENT_PRIVATE_KEY);
console.log(`\n  🤖 Agent wallet: ${account.address}`);
console.log(`  🌐 API endpoint: ${API_URL}`);
console.log(`  ⛓  Network: Base Sepolia\n`);
// wrapFetchWithPayment intercepts 402 responses and auto-pays
const fetchWithPayment = (0, fetch_1.wrapFetchWithPayment)(account, chains_1.baseSepolia);
// ─── Demo 1: Register a project ───────────────────────────────────────────────
async function registerProject() {
    console.log('─── Demo 1: Register a project ───────────────────────────────');
    console.log('  POST /v1/projects (agent will auto-pay 0.001 ETH if needed)\n');
    const response = await fetchWithPayment(`${API_URL}/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `agent-demo-${Date.now()}`,
            description: 'Autonomously registered by an AI agent via x402',
            license: 'MIT',
            isPublic: true,
            isAgent: true,
            agentEndpoint: 'https://agent.example.com/api',
        }),
    });
    if (!response.ok) {
        const error = await response.json();
        console.error('  ❌ Failed:', error);
        return null;
    }
    const result = await response.json();
    console.log('  ✅ Project registered!');
    console.log(`  📦 Project ID: ${result.projectId}`);
    console.log(`  👤 Owner:      ${result.owner}`);
    console.log(`  🔗 TX Hash:    ${result.txHash}\n`);
    return result.projectId;
}
// ─── Demo 2: Push a version ───────────────────────────────────────────────────
async function pushVersion(projectId) {
    console.log('─── Demo 2: Push a version ────────────────────────────────────');
    console.log(`  POST /v1/projects/${projectId}/versions\n`);
    const response = await fetchWithPayment(`${API_URL}/v1/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tag: 'v1.0.0',
            contentHash: 'ar://QmExampleArweaveHashHere1234567890',
            metadataHash: '',
        }),
    });
    if (!response.ok) {
        const error = await response.json();
        console.error('  ❌ Failed:', error);
        return;
    }
    const result = await response.json();
    console.log('  ✅ Version pushed!');
    console.log(`  🏷  Tag:    ${result.tag}`);
    console.log(`  📄 Hash:   ${result.contentHash}`);
    console.log(`  🔗 TX:     ${result.txHash}\n`);
}
// ─── Demo 3: Read back (free, no payment needed) ──────────────────────────────
async function readProject(projectId) {
    console.log('─── Demo 3: Read project (free) ───────────────────────────────');
    // Regular fetch — no payment needed for GET
    const response = await fetch(`${API_URL}/v1/projects/${projectId}`);
    const result = await response.json();
    console.log('  ✅ Project data:');
    console.log(JSON.stringify(result.data, null, 4));
}
// ─── Run ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  inkd x402 Demo — Autonomous Agent Registration');
    console.log('══════════════════════════════════════════════════════════════\n');
    const projectId = await registerProject();
    if (!projectId)
        return;
    await pushVersion(projectId);
    await readProject(projectId);
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  Done. Agent registered a project with zero human interaction.');
    console.log('  Wallet = identity. No API keys. No accounts. Pure x402.');
    console.log('══════════════════════════════════════════════════════════════\n');
}
main().catch(console.error);
//# sourceMappingURL=x402-demo.js.map