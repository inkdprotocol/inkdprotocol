// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  Deploy — Inkd Protocol deployment script
 * @notice Deploys all 6 Inkd Protocol contracts:
 *           1. InkdToken       — ERC-20, fixed supply, non-upgradeable
 *           2. InkdTreasury    — Fee collector, UUPS proxy
 *           3. InkdRegistry    — Agent/project registry, UUPS proxy
 *           4. InkdTimelock    — 48-hour governance timelock
 *
 *         After deployment, ownership of InkdTreasury and InkdRegistry
 *         remains with the deployer EOA. Run the ownership-transfer step
 *         (POST_DEPLOY.md Step 4.5) once testnet smoke tests pass.
 *
 *         Usage (Base Sepolia):
 *           forge script script/Deploy.s.sol:Deploy \
 *             --rpc-url base_sepolia \
 *             --broadcast \
 *             --verify \
 *             -vvvv
 *
 *         Usage (Base Mainnet):
 *           forge script script/Deploy.s.sol:Deploy \
 *             --rpc-url base \
 *             --broadcast \
 *             --verify \
 *             -vvvv
 */

import {Script, console} from "forge-std/Script.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {InkdTimelock} from "../src/InkdTimelock.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("========================================");
        console.log("  Inkd Protocol Deployment");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerKey);

        // ─── 1. Deploy InkdToken (standard ERC-20, no proxy) ────────────

        InkdToken token = new InkdToken();
        console.log("InkdToken:", address(token));
        console.log("  Supply:", token.totalSupply());

        // ─── 2. Deploy InkdTreasury (UUPS proxy) ────────────────────────

        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer))
        );
        InkdTreasury treasury = InkdTreasury(payable(address(treasuryProxy)));
        console.log("InkdTreasury Implementation:", address(treasuryImpl));
        console.log("InkdTreasury Proxy:", address(treasuryProxy));

        // ─── 3. Deploy InkdRegistry (UUPS proxy) ────────────────────────

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
        console.log("InkdRegistry Implementation:", address(registryImpl));
        console.log("InkdRegistry Proxy:", address(registryProxy));

        // ─── 4. Deploy InkdTimelock (48-hour governance timelock) ────────
        //
        //   admin = deployer EOA initially.
        //   After smoke tests, transfer ownership of Registry + Treasury
        //   to this address (see POST_DEPLOY.md Step 4.5).

        InkdTimelock timelock = new InkdTimelock(deployer);
        console.log("InkdTimelock:", address(timelock));
        console.log("  Admin:", timelock.admin());
        console.log("  Delay:", timelock.DELAY(), "seconds (48h)");

        // ─── 5. Link registry in treasury ────────────────────────────────

        treasury.setRegistry(address(registryProxy));
        console.log("");
        console.log("Registry linked to Treasury: OK");

        // ─── 6. Verify initialization ────────────────────────────────────

        require(token.totalSupply() == 1_000_000_000 ether, "Supply mismatch");
        require(token.balanceOf(deployer) == 1_000_000_000 ether, "Balance mismatch");
        require(treasury.owner() == deployer, "Treasury owner mismatch");
        require(treasury.registry() == address(registryProxy), "Registry link mismatch");
        require(registry.owner() == deployer, "Registry owner mismatch");
        require(address(registry.inkdToken()) == address(token), "Token link mismatch");
        require(timelock.admin() == deployer, "Timelock admin mismatch");

        console.log("");
        console.log("========================================");
        console.log("  Deployment Verified");
        console.log("========================================");
        console.log("Token Supply: 1,000,000,000 INKD");
        console.log("Version Fee: 0.001 ETH (configurable)");
        console.log("Transfer Fee: 0.005 ETH (configurable)");
        console.log("Token Lock: 1 INKD per project");
        console.log("Timelock Delay: 48 hours");
        console.log("========================================");
        console.log("");
        console.log("NEXT STEP: Run POST_DEPLOY.md Step 4.5 to transfer");
        console.log("  Registry + Treasury ownership to InkdTimelock.");
        console.log("  DO NOT skip this step before mainnet launch.");
        console.log("========================================");

        vm.stopBroadcast();
    }
}
