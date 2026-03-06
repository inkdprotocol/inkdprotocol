"use strict";
/**
 * inkd — Clanker Token Launch Script
 *
 * Deploys $INKD on Base Mainnet via Clanker SDK v4.
 * Uniswap V4 pool, automatic LP, sniper protection, creator fees.
 *
 * Prerequisites:
 *   - npm install clanker-sdk viem (in project root or scripts/)
 *   - PRIVATE_KEY env var (deployer wallet)
 *   - Enough ETH on Base for gas (~0.01 ETH)
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/clanker-launch.ts
 *   PRIVATE_KEY=0x... DRY_RUN=true npx tsx scripts/clanker-launch.ts
 *
 * Docs: https://clanker.gitbook.io/clanker-documentation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const v4_1 = require("clanker-sdk/v4");
const clanker_sdk_1 = require("clanker-sdk");
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
// ─── Config ───────────────────────────────────────────────────────────────────
const PRIVATE_KEY = (process.env['PRIVATE_KEY'] ?? '');
const DRY_RUN = process.env['DRY_RUN'] === 'true';
if (!PRIVATE_KEY) {
    console.error('Error: PRIVATE_KEY environment variable required');
    process.exit(1);
}
// Token config
const TOKEN_CONFIG = {
    name: 'inkd',
    symbol: 'INKD',
    // Upload logo to IPFS first (e.g. via nft.storage or Pinata)
    // Replace with actual IPFS hash before launch
    image: 'ipfs://bafybeig5fqkqyosig3b5lgubg3qn5nrsmntmflsqhv7ydkbrjnx4wwn2e',
};
// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const account = (0, accounts_1.privateKeyToAccount)(PRIVATE_KEY);
    const publicClient = (0, viem_1.createPublicClient)({ chain: chains_1.base, transport: (0, viem_1.http)() });
    const wallet = (0, viem_1.createWalletClient)({ account, chain: chains_1.base, transport: (0, viem_1.http)() });
    const clanker = new v4_1.Clanker({ wallet, publicClient });
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  inkd — Clanker Token Launch');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Token:      ${TOKEN_CONFIG.name} ($${TOKEN_CONFIG.symbol})`);
    console.log(`  Deployer:   ${account.address}`);
    console.log(`  Network:    Base Mainnet`);
    console.log(`  Dry run:    ${DRY_RUN}`);
    console.log('══════════════════════════════════════════════════════════\n');
    if (DRY_RUN) {
        console.log('DRY RUN — config only, no transaction sent:\n');
        console.log(JSON.stringify({
            ...TOKEN_CONFIG,
            tokenAdmin: account.address,
            chainId: chains_1.base.id,
            fees: 'FEE_CONFIGS.DynamicBasic (1-5% volatility-based)',
            sniperFees: { startingFee: '66.6%', endingFee: '4.2%', secondsToDecay: 15 },
            pool: { pairedToken: 'WETH', positions: 'POOL_POSITIONS.Standard' },
        }, null, 2));
        return;
    }
    console.log('Deploying...\n');
    const { txHash, waitForTransaction, error } = await clanker.deploy({
        name: TOKEN_CONFIG.name,
        symbol: TOKEN_CONFIG.symbol,
        image: TOKEN_CONFIG.image,
        tokenAdmin: account.address,
        chainId: chains_1.base.id,
        // 1-5% dynamic fee based on volatility — rises during pumps/dumps
        // Creator earns 100% of LP fees (via clanker.world)
        fees: clanker_sdk_1.FEE_CONFIGS.DynamicBasic,
        // Sniper protection — starts at 66.6% fee, decays to 4.2% over 15 seconds
        // Protects against bots sniping at launch
        sniperFees: {
            startingFee: 666_777, // 66.6777%
            endingFee: 41_673, // 4.1673%
            secondsToDecay: 15,
        },
        // Standard full-range liquidity pool
        pool: {
            pairedToken: 'WETH',
            positions: clanker_sdk_1.POOL_POSITIONS.Standard,
        },
        // Social provenance — marks this as an official inkd deploy
        context: {
            interface: 'inkd-launch-script',
            platform: 'base',
        },
    });
    if (error) {
        console.error('Deploy failed:', error.message);
        process.exit(1);
    }
    console.log(`  TX Hash: ${txHash}`);
    console.log('  Waiting for confirmation...\n');
    const { address, error: txError } = await waitForTransaction();
    if (txError) {
        console.error('Transaction failed:', txError.message);
        process.exit(1);
    }
    console.log('══════════════════════════════════════════════════════════');
    console.log('  ✅ $INKD launched successfully!');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Token address: ${address}`);
    console.log(`  TX Hash:       ${txHash}`);
    console.log(`  Basescan:      https://basescan.org/token/${address}`);
    console.log(`  Clanker admin: https://www.clanker.world/clanker/${address}/admin`);
    console.log(`  Uniswap:       https://app.uniswap.org/explore/tokens/base/${address}`);
    console.log('');
    console.log('  Next steps:');
    console.log('  1. Update INKD_TOKEN_ADDRESS in api/.env');
    console.log('  2. Deploy Registry + Treasury contracts with new token address');
    console.log('  3. Set up Safe Multisig as Registry/Treasury owner');
    console.log('  4. Claim LP fees via clanker.world/admin');
    console.log('══════════════════════════════════════════════════════════\n');
    // Save deployment info
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
    const deployInfo = {
        deployedAt: new Date().toISOString(),
        network: 'base-mainnet',
        tokenAddress: address,
        txHash,
        deployer: account.address,
        tokenName: TOKEN_CONFIG.name,
        tokenSymbol: TOKEN_CONFIG.symbol,
    };
    fs.writeFileSync('scripts/clanker-deploy-result.json', JSON.stringify(deployInfo, null, 2));
    console.log('  Deploy info saved to scripts/clanker-deploy-result.json');
}
main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
//# sourceMappingURL=clanker-launch.js.map