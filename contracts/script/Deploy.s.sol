// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  Deploy — Inkd Protocol deployment script
 * @notice Deploys InkdToken, InkdVault, and InkdRegistry with UUPS proxies.
 *         Sets up correct permissions between contracts.
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
import {InkdVault} from "../src/InkdVault.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
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

        // ─── 1. Deploy InkdToken ──────────────────────────────────────────

        InkdToken tokenImpl = new InkdToken();
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            abi.encodeCall(InkdToken.initialize, (
                deployer,           // owner
                0.001 ether,        // mint price
                500                 // 5% royalty
            ))
        );
        InkdToken token = InkdToken(address(tokenProxy));
        console.log("InkdToken Implementation:", address(tokenImpl));
        console.log("InkdToken Proxy:", address(tokenProxy));

        // ─── 2. Deploy InkdVault ──────────────────────────────────────────

        InkdVault vaultImpl = new InkdVault();
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            abi.encodeCall(InkdVault.initialize, (
                deployer,
                address(tokenProxy)
            ))
        );
        InkdVault vault = InkdVault(address(vaultProxy));
        console.log("InkdVault Implementation:", address(vaultImpl));
        console.log("InkdVault Proxy:", address(vaultProxy));

        // ─── 3. Deploy InkdRegistry ───────────────────────────────────────

        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (
                deployer,
                address(tokenProxy)
            ))
        );
        InkdRegistry registry = InkdRegistry(address(registryProxy));
        console.log("InkdRegistry Implementation:", address(registryImpl));
        console.log("InkdRegistry Proxy:", address(registryProxy));

        // ─── 4. Set up permissions ────────────────────────────────────────

        // Link vault to token (so vault can update inscription counts)
        token.setVault(address(vaultProxy));
        console.log("");
        console.log("Vault linked to Token: OK");

        // ─── 5. Verify initialization ─────────────────────────────────────

        require(token.owner() == deployer, "Token owner mismatch");
        require(token.mintPrice() == 0.001 ether, "Mint price mismatch");
        require(token.vault() == address(vaultProxy), "Vault link mismatch");
        require(vault.owner() == deployer, "Vault owner mismatch");
        require(vault.protocolFeeBps() == 100, "Vault fee mismatch");
        require(registry.owner() == deployer, "Registry owner mismatch");
        require(registry.marketplaceFeeBps() == 250, "Registry fee mismatch");

        console.log("");
        console.log("========================================");
        console.log("  Deployment Verified");
        console.log("========================================");
        console.log("Mint Price: 0.001 ETH");
        console.log("Max Supply: 10,000");
        console.log("Vault Fee: 1%");
        console.log("Marketplace Fee: 2.5%");
        console.log("Royalty: 5%");
        console.log("========================================");

        vm.stopBroadcast();
    }
}
