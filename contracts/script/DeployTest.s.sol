// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  DeployTest — Inkd Protocol beta/test deployment
 * @notice Deploys with $TEST token instead of $INKD. Same registry + treasury logic.
 *
 *         Usage (Base Mainnet):
 *           forge script script/DeployTest.s.sol:DeployTest \
 *             --rpc-url https://mainnet.base.org \
 *             --private-key $INKD_DEPLOYER_PRIVATE_KEY \
 *             --broadcast \
 *             -vvv
 */

import {Script, console} from "forge-std/Script.sol";
import {InkdTestToken} from "../src/InkdTestToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployTest is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("INKD_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("========================================");
        console.log("  Inkd Protocol - BETA Deployment ($TEST)");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerKey);

        // 1. Deploy $TEST token
        InkdTestToken token = new InkdTestToken();
        console.log("InkdTestToken ($TEST):", address(token));

        // 2. Deploy InkdTreasury (UUPS proxy)
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer, address(0x036CbD53842c5426634e7929541eC2318f3dCF7e), deployer, deployer, deployer))
        );
        InkdTreasury treasury = InkdTreasury(payable(address(treasuryProxy)));
        console.log("InkdTreasury Proxy:", address(treasuryProxy));

        // 3. Deploy InkdRegistry (UUPS proxy)
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
        console.log("InkdRegistry Proxy:", address(registryProxy));

        // 4. Link registry in treasury
        treasury.setRegistry(address(registryProxy));

        // 5. Verify
        require(token.totalSupply() == 1_000_000_000 ether, "Supply mismatch");
        require(token.balanceOf(deployer) == 1_000_000_000 ether, "Balance mismatch");
        require(treasury.registry() == address(registryProxy), "Registry link mismatch");
        require(registry.owner() == deployer, "Registry owner mismatch");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  BETA Deployment Complete");
        console.log("========================================");
        console.log("Token ($TEST):", address(token));
        console.log("Registry:     ", address(registryProxy));
        console.log("Treasury:     ", address(treasuryProxy));
        console.log("Supply:        1,000,000,000 TEST");
        console.log("========================================");
    }
}
