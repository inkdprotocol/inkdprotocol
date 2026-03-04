// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  DryRun — Inkd Protocol dry-run deployment simulation
 * @notice Simulates the full deployment WITHOUT broadcasting to the network.
 *
 *         Usage (Base Sepolia simulation):
 *           forge script script/DryRun.s.sol:DryRun \
 *             --rpc-url base_sepolia \
 *             -vvvv
 */

import {Script, console} from "forge-std/Script.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DryRun is Script {
    // Placeholder addresses for dry run
    address constant MOCK_USDC           = address(0x036CbD53842c5426634e7929541eC2318f3dCF7e); // Base Sepolia USDC
    address constant MOCK_ARWEAVE_WALLET = address(0x1111111111111111111111111111111111111111);
    address constant MOCK_BUYBACK_WALLET = address(0x2222222222222222222222222222222222222222);

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("========================================");
        console.log("  Inkd Protocol - DRY RUN (no broadcast)");
        console.log("========================================");
        console.log("Deployer:   ", deployer);
        console.log("Chain ID:   ", block.chainid);

        vm.startBroadcast(deployerKey);

        // ─── 1. InkdTreasury ──────────────────────────────────────────────
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer, MOCK_USDC, MOCK_ARWEAVE_WALLET, MOCK_BUYBACK_WALLET))
        );
        InkdTreasury treasury = InkdTreasury(payable(address(treasuryProxy)));
        _assert(treasury.owner() == deployer,              "FAIL: Treasury owner mismatch");
        _assert(address(treasury.usdc()) == MOCK_USDC,     "FAIL: Treasury USDC mismatch");
        _assert(treasury.serviceFee() == 5_000_000,        "FAIL: Service fee mismatch");
        _assert(treasury.arweaveFee() == 1_000_000,        "FAIL: Arweave fee mismatch");
        console.log("[OK] InkdTreasury (UUPS proxy)");
        console.log("     Impl: ", address(treasuryImpl));
        console.log("     Proxy:", address(treasuryProxy));

        // ─── 2. InkdRegistry ──────────────────────────────────────────────
        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (deployer, MOCK_USDC, address(treasuryProxy)))
        );
        InkdRegistry registry = InkdRegistry(address(registryProxy));
        _assert(registry.owner() == deployer,                          "FAIL: Registry owner mismatch");
        _assert(address(registry.usdc()) == MOCK_USDC,                 "FAIL: Registry USDC mismatch");
        _assert(address(registry.treasury()) == address(treasuryProxy),"FAIL: Treasury link mismatch");
        console.log("[OK] InkdRegistry (UUPS proxy)");
        console.log("     Impl: ", address(registryImpl));
        console.log("     Proxy:", address(registryProxy));

        // ─── 3. Link treasury → registry ──────────────────────────────────
        treasury.setRegistry(address(registryProxy));
        _assert(treasury.registry() == address(registryProxy), "FAIL: Registry link mismatch");
        console.log("[OK] Treasury linked to Registry");

        // ─── 4. Fee split check ─────────────────────────────────────────────
        (uint256 toArweave, uint256 toBuyback, uint256 toTreasury) = treasury.feeSplit();
        console.log("[OK] Fee split (USDC 6 decimals):");
        console.log("     Arweave:  ", toArweave);
        console.log("     Buyback:  ", toBuyback);
        console.log("     Treasury: ", toTreasury);

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  DRY RUN PASSED - Ready to deploy");
        console.log("========================================");
    }

    function _assert(bool condition, string memory message) internal pure {
        require(condition, message);
    }
}
