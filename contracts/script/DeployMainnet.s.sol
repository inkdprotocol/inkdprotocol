// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  DeployMainnet -- Inkd Protocol full mainnet deployment
 * @notice Deploys InkdBuyback, InkdTreasury, InkdRegistry with UUPS proxies.
 *         Transfers ownership to Safe multisigs after deployment.
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY   -- hot deployer wallet private key (0x...)
 *   SERVER_WALLET          -- API server wallet address (settler for X402)
 *   ARWEAVE_WALLET         -- wallet that receives Arweave storage cost portion
 *
 * Hardcoded (Base Mainnet):
 *   USDC                   -- 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *   INKD_TOKEN             -- address(0) until Clanker launch → call setInkdToken() after
 *   DEV_SAFE               -- 0x52d288c6697044561F99e433F01cd3d5ed4638A1
 *   TREASURY_SAFE          -- 0x6f8D6adc77C732972541A89a88ecB76Dfc641d1D
 *   BUYBACK_SAFE           -- 0x58822722FA012Df30c37b709Fd2f70e0F83d9536
 *
 * Usage:
 *   forge script script/DeployMainnet.s.sol:DeployMainnet \
 *     --rpc-url base \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY \
 *     -vvvv
 */

import {Script, console} from "forge-std/Script.sol";
import {InkdBuyback}  from "../src/InkdBuyback.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployMainnet is Script {

    // ─── Base Mainnet constants ───────────────────────────────────────────────
    address constant USDC         = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant UNISWAP_V3   = 0x2626664c2603336E57B271c5C0b26F421741e481;

    // ─── Safe Multisig addresses ──────────────────────────────────────────────
    address constant DEV_SAFE      = 0x52d288c6697044561F99e433F01cd3d5ed4638A1;
    address constant TREASURY_SAFE = 0x6f8D6adc77C732972541A89a88ecB76Dfc641d1D;
    address constant BUYBACK_SAFE  = 0x58822722FA012Df30c37b709Fd2f70e0F83d9536;

    function run() external {
        uint256 deployerKey   = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer      = vm.addr(deployerKey);
        address serverWallet  = vm.envAddress("SERVER_WALLET");
        address arweaveWallet = vm.envAddress("ARWEAVE_WALLET");

        console.log("====================================================");
        console.log("  Inkd Protocol -- Base Mainnet Deployment");
        console.log("====================================================");
        console.log("Deployer:       ", deployer);
        console.log("Server Wallet:  ", serverWallet);
        console.log("Arweave Wallet: ", arweaveWallet);
        console.log("DEV_SAFE:       ", DEV_SAFE);
        console.log("TREASURY_SAFE:  ", TREASURY_SAFE);
        console.log("BUYBACK_SAFE:   ", BUYBACK_SAFE);
        console.log("Chain ID:       ", block.chainid);
        console.log("====================================================");

        require(block.chainid == 8453, "Wrong chain -- must be Base Mainnet (8453)");

        vm.startBroadcast(deployerKey);

        // ─── 1. Deploy InkdBuyback ────────────────────────────────────────
        // treasury_ set to address(0) here -- linked after Treasury deploy
        InkdBuyback buybackImpl = new InkdBuyback();
        ERC1967Proxy buybackProxy = new ERC1967Proxy(
            address(buybackImpl),
            abi.encodeCall(InkdBuyback.initialize, (
                deployer,       // owner (temp -- transferred to BUYBACK_SAFE below)
                address(0),     // treasury (set after Treasury deploy)
                address(0),     // inkdToken (set after Clanker launch via setInkdToken)
                50_000_000      // threshold = $50 USDC
            ))
        );
        InkdBuyback buyback = InkdBuyback(address(buybackProxy));
        console.log("InkdBuyback Impl:   ", address(buybackImpl));
        console.log("InkdBuyback Proxy:  ", address(buybackProxy));

        // ─── 2. Deploy InkdTreasury ───────────────────────────────────────
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (
                deployer,              // owner (temp -- transferred to TREASURY_SAFE below)
                USDC,
                serverWallet,          // settler = API server wallet
                arweaveWallet,         // receives Arweave storage cost
                address(buybackProxy)  // InkdBuyback receives buyback share
            ))
        );
        InkdTreasury treasury = InkdTreasury(payable(address(treasuryProxy)));
        console.log("InkdTreasury Impl:  ", address(treasuryImpl));
        console.log("InkdTreasury Proxy: ", address(treasuryProxy));

        // ─── 3. Link Treasury → Buyback ───────────────────────────────────
        buyback.setTreasury(address(treasuryProxy));
        console.log("Buyback treasury set");

        // ─── 4. Deploy InkdRegistry ───────────────────────────────────────
        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (
                deployer,              // owner (temp -- transferred to DEV_SAFE below)
                USDC,
                address(treasuryProxy)
            ))
        );
        InkdRegistry registry = InkdRegistry(address(registryProxy));
        console.log("InkdRegistry Impl:  ", address(registryImpl));
        console.log("InkdRegistry Proxy: ", address(registryProxy));

        // ─── 5. Link Registry → Treasury ──────────────────────────────────
        treasury.setRegistry(address(registryProxy));
        console.log("Treasury registry set");

        // ─── 6. Transfer ownership to Safe Multisigs ──────────────────────
        buyback.transferOwnership(BUYBACK_SAFE);
        treasury.transferOwnership(TREASURY_SAFE);
        registry.transferOwnership(DEV_SAFE);
        console.log("Ownership transferred to Safe multisigs");

        vm.stopBroadcast();

        // ─── 7. Verify ────────────────────────────────────────────────────
        require(buyback.owner()   == BUYBACK_SAFE,  "Buyback owner mismatch");
        require(treasury.owner()  == TREASURY_SAFE, "Treasury owner mismatch");
        require(registry.owner()  == DEV_SAFE,      "Registry owner mismatch");
        require(buyback.threshold() == 50_000_000,  "Threshold mismatch");

        console.log("");
        console.log("====================================================");
        console.log("  Deployment Complete");
        console.log("====================================================");
        console.log("InkdBuyback:  ", address(buybackProxy));
        console.log("InkdTreasury: ", address(treasuryProxy));
        console.log("InkdRegistry: ", address(registryProxy));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set INKD token: buyback.setInkdToken(<CLANKER_CA>)");
        console.log("     via BUYBACK_SAFE multisig after Clanker launch");
        console.log("  2. Fund API server wallet for gas");
        console.log("  3. Set REGISTRY_ADDRESS + TREASURY_ADDRESS in API .env");
        console.log("====================================================");
    }
}
