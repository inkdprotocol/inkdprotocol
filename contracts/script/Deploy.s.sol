// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  Deploy — Inkd Protocol deployment script
 * @notice Deploys InkdTreasury and InkdRegistry with UUPS proxies.
 *
 *         Required env vars:
 *           DEPLOYER_PRIVATE_KEY   — deployer EOA key
 *           USDC_ADDRESS           — USDC token on this chain
 *           ARWEAVE_WALLET         — wallet that receives arweave fee portion
 *           BUYBACK_WALLET         — wallet that executes $INKD buybacks
 *
 *         Usage (Base Sepolia):
 *           forge script script/Deploy.s.sol:Deploy \
 *             --rpc-url base_sepolia \
 *             --broadcast \
 *             --verify \
 *             -vvvv
 */

import {Script, console} from "forge-std/Script.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address usdc = vm.envAddress("USDC_ADDRESS");
        address arweaveWallet = vm.envAddress("ARWEAVE_WALLET");
        address buybackWallet = vm.envAddress("BUYBACK_WALLET");

        console.log("========================================");
        console.log("  Inkd Protocol Deployment");
        console.log("========================================");
        console.log("Deployer:       ", deployer);
        console.log("USDC:           ", usdc);
        console.log("Arweave Wallet: ", arweaveWallet);
        console.log("Buyback Wallet: ", buybackWallet);
        console.log("Chain ID:       ", block.chainid);

        vm.startBroadcast(deployerKey);

        // ─── 1. Deploy InkdTreasury (UUPS proxy) ────────────────────────

        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer, usdc, arweaveWallet, buybackWallet))
        );
        InkdTreasury treasury = InkdTreasury(payable(address(treasuryProxy)));
        console.log("InkdTreasury Impl:  ", address(treasuryImpl));
        console.log("InkdTreasury Proxy: ", address(treasuryProxy));

        // ─── 2. Deploy InkdRegistry (UUPS proxy) ────────────────────────

        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (deployer, usdc, address(treasuryProxy)))
        );
        InkdRegistry registry = InkdRegistry(address(registryProxy));
        console.log("InkdRegistry Impl:  ", address(registryImpl));
        console.log("InkdRegistry Proxy: ", address(registryProxy));

        // ─── 3. Link registry in treasury ───────────────────────────────

        treasury.setRegistry(address(registryProxy));

        vm.stopBroadcast();

        // ─── 4. Verify ──────────────────────────────────────────────────

        require(treasury.owner() == deployer, "Treasury owner mismatch");
        require(treasury.registry() == address(registryProxy), "Registry link mismatch");
        require(address(treasury.usdc()) == usdc, "Treasury USDC mismatch");
        require(treasury.buybackWallet() == buybackWallet, "Buyback wallet mismatch");
        require(registry.owner() == deployer, "Registry owner mismatch");
        require(address(registry.usdc()) == usdc, "Registry USDC mismatch");
        require(address(registry.treasury()) == address(treasuryProxy), "Treasury link mismatch");

        (uint256 toArweave, uint256 toBuyback, uint256 toTreasury) = treasury.feeSplit();

        console.log("");
        console.log("========================================");
        console.log("  Deployment Verified");
        console.log("========================================");
        console.log("Service Fee:   $5.00 USDC");
        console.log("  Arweave:    ", toArweave, "USDC (6 dec)");
        console.log("  Buyback:    ", toBuyback, "USDC (6 dec)");
        console.log("  Treasury:   ", toTreasury, "USDC (6 dec)");
        console.log("========================================");
    }
}
