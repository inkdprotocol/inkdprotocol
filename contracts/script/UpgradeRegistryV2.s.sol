// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {InkdRegistryV2} from "../src/InkdRegistryV2.sol";
import {InkdRegistry}   from "../src/InkdRegistry.sol";

/**
 * @title UpgradeRegistryV2
 *
 * @notice UUPS upgrade script: deploys InkdRegistryV2 impl and prints Safe TX calldata.
 *
 * Usage:
 *   # Step 1: Dry-run (no broadcast) — get calldata
 *   forge script script/UpgradeRegistryV2.s.sol \
 *     --rpc-url $BASE_RPC_URL \
 *     -vvvv
 *
 *   # Step 2: Broadcast (deployer must be owner OR submit via DEV_SAFE)
 *   forge script script/UpgradeRegistryV2.s.sol \
 *     --rpc-url $BASE_RPC_URL \
 *     --broadcast \
 *     --private-key $DEPLOYER_KEY \
 *     -vvvv
 *
 * Environment variables:
 *   INKD_REGISTRY_PROXY  — proxy address (required if not hardcoded)
 *   INKD_SETTLER         — server wallet address to configure as settler
 *   BASE_RPC_URL         — Base Mainnet RPC URL
 *
 * @dev If the proxy owner is a multisig (DEV_SAFE), run in dry-run mode to get
 *      calldata, then submit via Safe UI at app.safe.global.
 */
contract UpgradeRegistryV2 is Script {
    // ─── Mainnet addresses ────────────────────────────────────────────────────
    address constant REGISTRY_PROXY = 0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d;

    function run() external {
        address registryProxy = vm.envOr("INKD_REGISTRY_PROXY", REGISTRY_PROXY);
        address settler       = vm.envOr("INKD_SETTLER", address(0));

        vm.startBroadcast();

        // 1. Deploy new V2 implementation
        InkdRegistryV2 v2Impl = new InkdRegistryV2();
        console.log("V2 impl deployed:", address(v2Impl));

        // 2. Encode upgradeToAndCall calldata for Safe TX
        // If settler is set: initialize it in the same TX via upgradeToAndCall
        bytes memory initData = settler != address(0)
            ? abi.encodeCall(InkdRegistryV2.setSettler, (settler))
            : bytes("");

        bytes memory upgradeCalldata = abi.encodeCall(
            InkdRegistry(registryProxy).upgradeToAndCall,
            (address(v2Impl), initData)
        );

        console.log("\n=== SAFE TX CALLDATA ===");
        console.log("To:    ", registryProxy);
        console.log("Value:  0");
        console.logBytes(upgradeCalldata);
        console.log("========================\n");

        // 3. If running with a private key that owns the proxy: upgrade directly
        // If proxy owner is a Safe, this will revert — that's expected; use calldata above.
        try InkdRegistry(registryProxy).upgradeToAndCall(address(v2Impl), initData) {
            console.log("Upgrade executed directly.");

            // Verify
            string memory ver = InkdRegistryV2(registryProxy).version();
            console.log("Registry version:", ver);

            if (settler != address(0)) {
                address settlerSet = InkdRegistryV2(registryProxy).settler();
                console.log("Settler set to:", settlerSet);
            }
        } catch {
            console.log("Direct upgrade failed (expected if owner is a Safe).");
            console.log("Submit the calldata above via app.safe.global");
        }

        vm.stopBroadcast();
    }
}
