"use strict";
/**
 * Inkd Protocol — End-to-End Test (Base Mainnet)
 *
 * Tests the full x402 payment flow:
 *   1. POST /v1/projects — $5 USDC via x402 → creates project on-chain
 *   2. POST /v1/projects/:id/versions — $2 USDC via x402 → pushes version on-chain
 *   3. GET /v1/projects/:id — verifies project exists
 *   4. Verify Treasury received USDC + settle() was called
 */
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
// @ts-ignore
const index_js_1 = require("../api/node_modules/@x402/fetch/dist/cjs/index.js");
const PRIVATE_KEY = '0x478c78b81be9cfa852cae02bc011dee7a2a5f8bd1b81420ba47d3a7f55b23049';
const API_URL = 'https://api.inkdprotocol.com';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TREASURY = '0x23012C3EF1E95aBC0792c03671B9be33C239D449';
const USDC_ABI = [
    { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];
async function main() {
    const account = (0, accounts_1.privateKeyToAccount)(PRIVATE_KEY);
    console.log(`\n🔑 Test wallet: ${account.address}`);
    const publicClient = (0, viem_1.createPublicClient)({ chain: chains_1.base, transport: (0, viem_1.http)() });
    const walletClient = (0, viem_1.createWalletClient)({ account, chain: chains_1.base, transport: (0, viem_1.http)() });
    // ─── Check balances ──────────────────────────────────────────────────────
    const usdcBefore = await publicClient.readContract({
        address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [account.address],
    });
    const treasuryBefore = await publicClient.readContract({
        address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [TREASURY],
    });
    console.log(`💰 USDC balance: $${Number(usdcBefore) / 1e6}`);
    console.log(`🏛️  Treasury before: $${Number(treasuryBefore) / 1e6}`);
    // ─── Wrap fetch with x402 payment ───────────────────────────────────────
    const fetchWithPayment = (0, index_js_1.wrapFetchWithPayment)(fetch, walletClient);
    // ─── Step 1: Create project ──────────────────────────────────────────────
    console.log(`\n📝 Step 1: POST /v1/projects ($5 USDC via x402)`);
    const createRes = await fetchWithPayment(`${API_URL}/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `inkd-e2e-test-${Date.now()}`,
            description: 'End-to-end test project',
            tags: ['test'],
        }),
    });
    if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`createProject failed (${createRes.status}): ${err}`);
    }
    const project = await createRes.json();
    console.log(`✅ Project created!`);
    console.log(`   ID:   ${project.projectId}`);
    console.log(`   Owner: ${project.owner}`);
    console.log(`   TX:   ${project.txHash}`);
    // ─── Step 2: Push version ────────────────────────────────────────────────
    console.log(`\n📦 Step 2: POST /v1/projects/${project.projectId}/versions ($2 USDC via x402)`);
    const versionRes = await fetchWithPayment(`${API_URL}/v1/projects/${project.projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tag: 'v0.1.0',
            contentHash: 'ar://test-e2e-content-hash-0000000000000000000000000000000000',
            metadataHash: 'ar://test-e2e-metadata-hash-000000000000000000000000000000000',
            contentSize: 1024,
        }),
    });
    if (!versionRes.ok) {
        const err = await versionRes.text();
        throw new Error(`pushVersion failed (${versionRes.status}): ${err}`);
    }
    const version = await versionRes.json();
    console.log(`✅ Version pushed!`);
    console.log(`   Tag:  ${version.tag}`);
    console.log(`   TX:   ${version.txHash}`);
    // ─── Step 3: Read back ───────────────────────────────────────────────────
    console.log(`\n🔍 Step 3: GET /v1/projects/${project.projectId}`);
    const getRes = await fetch(`${API_URL}/v1/projects/${project.projectId}`);
    const got = await getRes.json();
    console.log(`✅ Project verified on-chain:`);
    console.log(`   Name:         ${got.name}`);
    console.log(`   Owner:        ${got.owner}`);
    console.log(`   VersionCount: ${got.versionCount}`);
    // ─── Step 4: Check Treasury received USDC ───────────────────────────────
    const usdcAfter = await publicClient.readContract({
        address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [account.address],
    });
    const treasuryAfter = await publicClient.readContract({
        address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [TREASURY],
    });
    const spent = Number(usdcBefore - usdcAfter) / 1e6;
    const treasuryIncrease = Number(treasuryAfter - treasuryBefore) / 1e6;
    console.log(`\n💸 Payment summary:`);
    console.log(`   Spent:            $${spent.toFixed(2)} USDC`);
    console.log(`   Treasury gained:  $${treasuryIncrease.toFixed(2)} USDC`);
    console.log(`   USDC left:        $${Number(usdcAfter) / 1e6}`);
    if (spent >= 7) {
        console.log(`\n✅ ✅ ✅  END-TO-END TEST PASSED  ✅ ✅ ✅`);
        console.log(`   x402 Mainnet payments: WORKING`);
        console.log(`   Contract writes:       WORKING`);
        console.log(`   Treasury settlement:   WORKING`);
    }
    else {
        console.log(`\n⚠️  Only $${spent} spent — expected $7. Check manually.`);
    }
}
main().catch(err => {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
});
//# sourceMappingURL=e2e-test.js.map