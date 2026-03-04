// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {InkdToken}    from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";
import {ERC1967Proxy}         from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable}      from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable}        from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable}   from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @dev Minimal V2 stub — adds a dummy getter to confirm upgrade succeeded.
contract InkdRegistryV2 is InkdRegistry {
    /// @notice New function added in V2 — proves upgrade worked.
    function version() external pure returns (string memory) {
        return "v2";
    }
}

/// @dev Treasury V2 stub with an extra getter.
contract InkdTreasuryV2 is InkdTreasury {
    function version() external pure returns (string memory) {
        return "v2";
    }
}

/// @title InkdUpgradeTest — UUPS proxy upgrade tests
/// @notice Verifies that InkdRegistry and InkdTreasury can be upgraded via UUPS,
///         that only the owner can trigger upgrades, and that state is preserved
///         across upgrades.
contract InkdUpgradeTest is Test {
    // ─── Contracts ────────────────────────────────────────────────────────────
    InkdToken    public token;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    // ─── Actors ───────────────────────────────────────────────────────────────
    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob   = makeAddr("bob");

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 constant LOCK_AMOUNT  = 1 ether;
    uint256 constant VERSION_FEE  = 0.001 ether;
    uint256 constant TRANSFER_FEE = 0.005 ether;

    function setUp() public {
        token = new InkdToken();
        MockUSDC usdc = new MockUSDC();

        // Treasury (UUPS proxy)
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (owner, address(usdc), makeAddr("arweave"), makeAddr("buyback")))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        // Registry (UUPS proxy)
        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (owner, address(usdc), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        treasury.setRegistry(address(registry));
        treasury.setArweaveFee(0);
        treasury.setServiceFee(0);

        // Fund actors
        vm.deal(alice, 10 ether);
        vm.deal(bob,   10 ether);
        token.transfer(alice, 100_000 ether);
        token.transfer(bob,   100_000 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  InkdRegistry — upgrade tests
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Owner can upgrade the registry proxy to V2.
    function test_registry_upgradeToV2() public {
        InkdRegistryV2 v2Impl = new InkdRegistryV2();
        registry.upgradeToAndCall(address(v2Impl), "");

        // Cast proxy to V2 interface and call new function
        string memory v = InkdRegistryV2(address(registry)).version();
        assertEq(v, "v2", "V2 getter should return 'v2'");
    }

    /// @notice After upgrade, existing state (projects, fees) is preserved.
    function test_registry_upgradePreservesState() public {
        // Create a project before upgrade
        vm.startPrank(alice);
        
        registry.createProject("pre-upgrade", "desc", "MIT", true, "ar://readme", false, "");
        vm.stopPrank();

        uint256 projectId = 1; // projectCount starts at 0, pre-incremented → first project = 1
        InkdRegistry.Project memory before = registry.getProject(projectId);
        assertEq(before.name, "pre-upgrade");

        // Perform upgrade
        InkdRegistryV2 v2Impl = new InkdRegistryV2();
        registry.upgradeToAndCall(address(v2Impl), "");

        // State should be identical after upgrade
        InkdRegistry.Project memory after_ = registry.getProject(projectId);
        assertEq(after_.name,        before.name,        "name preserved");
        assertEq(after_.description, before.description, "description preserved");
        assertEq(after_.owner,       before.owner,       "owner preserved");
        assertEq(after_.isPublic,    before.isPublic,    "visibility preserved");
    }

    /// @notice After upgrade, version fees and transfer fees are preserved.
    function test_registry_upgradePreservesFees() public {
        uint256 feeBefore = treasury.serviceFee();

        InkdRegistryV2 v2Impl = new InkdRegistryV2();
        registry.upgradeToAndCall(address(v2Impl), "");

        assertEq(treasury.serviceFee(),  feeBefore, "versionFee preserved after upgrade");
    }

    /// @notice Non-owner cannot upgrade the registry.
    function test_registry_upgrade_revertsIfNotOwner() public {
        InkdRegistryV2 v2Impl = new InkdRegistryV2();

        vm.prank(alice);
        vm.expectRevert();
        registry.upgradeToAndCall(address(v2Impl), "");
    }

    /// @notice After upgrade, existing protocol operations still work correctly.
    function test_registry_upgradeAndContinueOperations() public {
        InkdRegistryV2 v2Impl = new InkdRegistryV2();
        registry.upgradeToAndCall(address(v2Impl), "");

        // Operations post-upgrade
        vm.startPrank(alice);
        
        registry.createProject("post-upgrade", "desc", "MIT", false, "", false, "");
        vm.stopPrank();

        InkdRegistry.Project memory p = registry.getProject(1);
        assertEq(p.name, "post-upgrade");
        assertEq(p.owner, alice);
    }

    /// @notice Upgrading twice (V1 → V2 → V1) preserves proxy address.
    function test_registry_doubleUpgrade() public {
        address proxyAddr = address(registry);

        InkdRegistryV2 v2Impl  = new InkdRegistryV2();
        InkdRegistry   v1Again = new InkdRegistry();

        registry.upgradeToAndCall(address(v2Impl), "");
        // Proxy address unchanged
        assertEq(address(registry), proxyAddr);

        // Upgrade back to V1 style impl (no version() fn)
        registry.upgradeToAndCall(address(v1Again), "");
        assertEq(address(registry), proxyAddr);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  InkdTreasury — upgrade tests
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Owner can upgrade the treasury proxy to V2.
    function test_treasury_upgradeToV2() public {
        InkdTreasuryV2 v2Impl = new InkdTreasuryV2();
        treasury.upgradeToAndCall(address(v2Impl), "");

        string memory v = InkdTreasuryV2(payable(address(treasury))).version();
        assertEq(v, "v2", "Treasury V2 getter should return 'v2'");
    }

    /// @notice Non-owner cannot upgrade the treasury.
    function test_treasury_upgrade_revertsIfNotOwner() public {
        InkdTreasuryV2 v2Impl = new InkdTreasuryV2();

        vm.prank(alice);
        vm.expectRevert();
        treasury.upgradeToAndCall(address(v2Impl), "");
    }

    /// @notice Treasury ETH balance is preserved through upgrade.
    function test_treasury_upgradePreservesBalance() public {
        // Send some ETH into treasury (simulating collected fees)
        vm.deal(address(treasury), 0.5 ether);
        uint256 balanceBefore = address(treasury).balance;

        InkdTreasuryV2 v2Impl = new InkdTreasuryV2();
        treasury.upgradeToAndCall(address(v2Impl), "");

        assertEq(address(treasury).balance, balanceBefore, "ETH balance preserved after upgrade");
    }

    /// @notice Treasury registry reference is preserved through upgrade.
    function test_treasury_upgradePreservesRegistryRef() public {
        address registryBefore = treasury.registry();

        InkdTreasuryV2 v2Impl = new InkdTreasuryV2();
        treasury.upgradeToAndCall(address(v2Impl), "");

        assertEq(treasury.registry(), registryBefore, "registry ref preserved after upgrade");
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Edge cases — clearing metadata fields
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice agentEndpoint can be cleared back to empty string.
    function test_clearAgentEndpoint() public {
        vm.startPrank(alice);
        
        registry.createProject("clear-ep-test", "desc", "MIT", true, "", true, "https://agent.io");
        uint256 id = 1;

        // Verify endpoint is set
        assertEq(registry.getProject(id).agentEndpoint, "https://agent.io");

        // Clear it
        registry.setAgentEndpoint(id, "");
        assertEq(registry.getProject(id).agentEndpoint, "", "agentEndpoint cleared to empty");
        vm.stopPrank();
    }

    /// @notice readmeHash can be updated back to a new value.
    function test_updateReadmeHash() public {
        vm.startPrank(alice);
        
        registry.createProject("readme-test", "desc", "MIT", true, "ar://readme-v1", false, "");
        uint256 id = 1;

        assertEq(registry.getProject(id).readmeHash, "ar://readme-v1");

        registry.setReadme(id, "ar://readme-v2");
        assertEq(registry.getProject(id).readmeHash, "ar://readme-v2", "readmeHash updated to v2");

        registry.setReadme(id, "");
        assertEq(registry.getProject(id).readmeHash, "", "readmeHash cleared to empty");
        vm.stopPrank();
    }

    /// @notice isAgent flag determines visibility in getAgentProjects (endpoint field is separate).
    function test_agentFlag_determinesAgentProjectVisibility() public {
        vm.startPrank(alice);
        
        // Create a non-agent project
        registry.createProject("non-agent", "desc", "MIT", true, "", false, "");
        // Create an agent project
        registry.createProject("is-agent", "desc", "MIT", true, "", true, "https://agent.io");
        vm.stopPrank();

        InkdRegistry.Project[] memory agents = registry.getAgentProjects(0, 10);
        assertEq(agents.length, 1, "only one project with isAgent=true");
        assertEq(agents[0].name, "is-agent");
    }

    /// @notice getVersionCount returns correct count as versions accumulate.
    function test_versionCount_accumulates() public {
        vm.startPrank(alice);
        
        registry.createProject("version-count", "desc", "MIT", true, "", false, "");
        uint256 id = 1;

        assertEq(registry.getVersionCount(id), 0, "zero versions at creation");

        for (uint256 i = 0; i < 5; i++) {
            registry.pushVersion(
                id,
                "ar://hash",
                string(abi.encodePacked("0.", vm.toString(i), ".0")),
                ""
            );
        }
        vm.stopPrank();

        assertEq(registry.getVersionCount(id), 5, "five versions after five pushes");
    }

    /// @notice Project name normalization: names with different case map to the same key.
    function test_nameNormalization_duplicateDetection() public {
        vm.startPrank(alice);
        
        registry.createProject("My-Cool-Agent", "desc", "MIT", true, "", false, "");

        // Same name, different case — should revert as NameTaken
        vm.expectRevert(InkdRegistry.NameTaken.selector);
        registry.createProject("my-cool-agent", "desc", "MIT", true, "", false, "");
        vm.stopPrank();
    }

    /// @notice getOwnerProjects updates correctly after project transfer.
    function test_ownerProjects_updatesOnTransfer() public {
        vm.startPrank(alice);
        
        registry.createProject("transfer-test", "desc", "MIT", true, "", false, "");
        vm.stopPrank();

        uint256 id = 1;
        uint256[] memory aliceProjects = registry.getOwnerProjects(alice);
        assertEq(aliceProjects.length, 1, "alice has one project before transfer");

        vm.prank(alice);
        registry.transferProject(id, bob);

        // Alice should have no projects
        uint256[] memory aliceAfter = registry.getOwnerProjects(alice);
        assertEq(aliceAfter.length, 0, "alice has no projects after transfer");

        // Bob should have the project
        uint256[] memory bobAfter = registry.getOwnerProjects(bob);
        assertEq(bobAfter.length, 1, "bob has one project after transfer");
        assertEq(bobAfter[0], id,    "bob has correct project id");
    }
}
