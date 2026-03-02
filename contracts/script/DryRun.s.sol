// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  DryRun — Inkd Protocol dry-run deployment simulation
 * @notice Simulates the full deployment WITHOUT broadcasting to the network.
 *         Use this to validate config, estimate gas, and verify contract logic
 *         before spending real ETH.
 *
 *         Usage (Base Mainnet simulation, no broadcast):
 *           forge script script/DryRun.s.sol:DryRun \
 *             --rpc-url base \
 *             -vvvv
 *
 *         Usage (Base Sepolia simulation):
 *           forge script script/DryRun.s.sol:DryRun \
 *             --rpc-url base_sepolia \
 *             -vvvv
 *
 *         Note: Omitting --broadcast means nothing is sent to the network.
 *               This is a pure simulation run.
 */

import {Script, console} from "forge-std/Script.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DryRun is Script {
    // ── Expected constants ────────────────────────────────────────────────────
    uint256 constant EXPECTED_SUPPLY        = 1_000_000_000 ether;
    uint256 constant EXPECTED_LOCK_AMOUNT   = 1 ether;          // 1 INKD
    uint256 constant EXPECTED_VERSION_FEE   = 0.001 ether;
    uint256 constant EXPECTED_TRANSFER_FEE  = 0.005 ether;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("========================================");
        console.log("  Inkd Protocol - DRY RUN (no broadcast)");
        console.log("========================================");
        console.log("Deployer:   ", deployer);
        console.log("ETH Balance:", deployer.balance / 1e18, "ETH");
        console.log("Chain ID:   ", block.chainid);
        console.log("Block:      ", block.number);
        console.log("");

        _checkBalance(deployer);

        vm.startBroadcast(deployerKey);

        // ─── 1. InkdToken ──────────────────────────────────────────────────
        InkdToken token = new InkdToken();
        _assert(token.totalSupply() == EXPECTED_SUPPLY,       "FAIL: Supply mismatch");
        _assert(token.balanceOf(deployer) == EXPECTED_SUPPLY, "FAIL: Deployer balance mismatch");
        _assert(token.decimals() == 18,                       "FAIL: Decimals mismatch");
        // TOKEN_LOCK_AMOUNT lives on InkdRegistry, checked after registry deployment
        console.log("[OK] InkdToken");
        console.log("     Address:", address(token));
        console.log("     Supply: ", token.totalSupply() / 1e18, "INKD");

        // ─── 2. InkdTreasury ──────────────────────────────────────────────
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer))
        );
        InkdTreasury treasury = InkdTreasury(payable(address(treasuryProxy)));
        _assert(treasury.owner() == deployer, "FAIL: Treasury owner mismatch");
        console.log("[OK] InkdTreasury (UUPS proxy)");
        console.log("     Impl: ", address(treasuryImpl));
        console.log("     Proxy:", address(treasuryProxy));

        // ─── 3. InkdRegistry ──────────────────────────────────────────────
        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (
                deployer,
                address(token),
                address(treasuryProxy)
            ))
        );
        InkdRegistry registry = InkdRegistry(address(registryProxy));
        _assert(registry.owner() == deployer,                       "FAIL: Registry owner mismatch");
        _assert(address(registry.inkdToken()) == address(token),    "FAIL: Token link mismatch");
        _assert(address(registry.treasury()) == address(treasury),  "FAIL: Treasury link mismatch");
        console.log("[OK] InkdRegistry (UUPS proxy)");
        console.log("     Impl: ", address(registryImpl));
        console.log("     Proxy:", address(registryProxy));

        // ─── 4. Link treasury → registry ──────────────────────────────────
        treasury.setRegistry(address(registryProxy));
        _assert(treasury.registry() == address(registryProxy), "FAIL: Registry link mismatch");
        console.log("[OK] Treasury linked to Registry");

        // ─── 5. Spot-check protocol parameters ─────────────────────────────
        _assert(registry.TOKEN_LOCK_AMOUNT() == EXPECTED_LOCK_AMOUNT, "FAIL: Lock amount mismatch");
        _assert(registry.versionFee()        == EXPECTED_VERSION_FEE, "FAIL: Version fee mismatch");
        _assert(registry.transferFee()       == EXPECTED_TRANSFER_FEE,"FAIL: Transfer fee mismatch");
        console.log("[OK] Protocol parameters");
        console.log("     Lock per project:", registry.TOKEN_LOCK_AMOUNT() / 1e18, "INKD");
        console.log("     Version fee:     ", registry.versionFee(), "wei (0.001 ETH)");
        console.log("     Transfer fee:    ", registry.transferFee(), "wei (0.005 ETH)");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  DRY RUN PASSED - Ready to deploy");
        console.log("========================================");
        console.log("Run the real deployment with:");
        console.log("  forge script script/Deploy.s.sol:Deploy \\");
        if (block.chainid == 8453) {
            console.log("    --rpc-url base \\");
        } else {
            console.log("    --rpc-url base_sepolia \\");
        }
        console.log("    --broadcast --verify -vvvv");
    }

    function _checkBalance(address deployer) internal view {
        uint256 estimatedCost = 5_000_000 * tx.gasprice;
        if (deployer.balance < estimatedCost) {
            console.log("WARNING: Low ETH balance - fund deployer before broadcasting");
        } else {
            console.log("[OK] Deployer ETH balance sufficient");
        }
    }

    function _assert(bool condition, string memory message) internal pure {
        require(condition, message);
    }
}
