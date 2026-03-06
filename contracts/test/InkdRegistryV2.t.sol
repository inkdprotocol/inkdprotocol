// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {InkdRegistry}   from "../src/InkdRegistry.sol";
import {InkdRegistryV2} from "../src/InkdRegistryV2.sol";
import {InkdTreasury}   from "../src/InkdTreasury.sol";
import {InkdBuyback}    from "../src/InkdBuyback.sol";
import {MockUSDC}        from "./helpers/MockUSDC.sol";
import {ERC1967Proxy}    from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title InkdRegistryV2Test — Full coverage for V2 features
contract InkdRegistryV2Test is Test {
    InkdRegistryV2 registry;
    InkdTreasury   treasury;
    MockUSDC        usdc;

    address owner   = makeAddr("owner");
    address settler = makeAddr("settler");
    address alice   = makeAddr("alice");
    address bob     = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();

        // Deploy treasury proxy
        InkdTreasury treasuryImpl = new InkdTreasury();
        bytes memory treasuryInit = abi.encodeCall(
            InkdTreasury.initialize,
            (owner, address(usdc), settler, owner, owner)
        );
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(address(treasuryImpl), treasuryInit);
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        // Deploy V1 registry proxy (simulates existing deployed state)
        InkdRegistry registryV1Impl = new InkdRegistry();
        bytes memory registryInit = abi.encodeCall(
            InkdRegistry.initialize,
            (owner, address(usdc), address(treasury))
        );
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryV1Impl), registryInit);

        // Upgrade proxy to V2
        InkdRegistryV2 registryV2Impl = new InkdRegistryV2();
        vm.prank(owner);
        InkdRegistry(address(registryProxy)).upgradeToAndCall(address(registryV2Impl), "");

        // Cast proxy to V2 interface
        registry = InkdRegistryV2(address(registryProxy));

        // Set settler on V2 registry
        vm.prank(owner);
        registry.setSettler(settler);

        // Wire treasury → registry
        vm.prank(owner);
        treasury.setRegistry(address(registry));
    }

    // ─── version() ────────────────────────────────────────────────────────────

    function test_version_returnsV2() public view {
        assertEq(registry.version(), "v2");
    }

    // ─── setSettler() ──────────────────────────────────────────────────────────

    function test_setSettler_ownerOnly() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setSettler(alice);
    }

    function test_setSettler_rejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(InkdRegistry.ZeroAddress.selector);
        registry.setSettler(address(0));
    }

    function test_setSettler_emitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit InkdRegistryV2.SettlerSet(alice);
        registry.setSettler(alice);
    }

    // ─── createProjectV2() ────────────────────────────────────────────────────

    function test_createProjectV2_succeeds() public {
        vm.prank(settler);
        registry.createProjectV2(
            "my-project", "desc", "MIT", true, "", false, "",
            "ar://metadata", 0, "", bytes32(0)
        );

        assertEq(registry.projectCount(), 1);
        InkdRegistry.Project memory p = registry.getProject(1);
        assertEq(p.name, "my-project");
        assertEq(p.owner, settler); // msg.sender is settler
        assertEq(registry.projectMetadataUri(1), "ar://metadata");
        assertEq(registry.projectForkOf(1), 0);
    }

    function test_createProjectV2_onlySettler() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistryV2.Unauthorized.selector);
        registry.createProjectV2(
            "proj", "d", "MIT", true, "", false, "",
            "", 0, "", bytes32(0)
        );
    }

    function test_createProjectV2_ownerCanAlsoCreate() public {
        vm.prank(owner);
        registry.createProjectV2(
            "owner-proj", "d", "MIT", true, "", false, "",
            "", 0, "", bytes32(0)
        );
        assertEq(registry.projectCount(), 1);
    }

    function test_createProjectV2_storesMetadataUri() public {
        vm.prank(settler);
        registry.createProjectV2(
            "proj", "d", "MIT", true, "", false, "",
            "ar://abc123", 0, "", bytes32(0)
        );
        assertEq(registry.projectMetadataUri(1), "ar://abc123");
    }

    function test_createProjectV2_storesAccessManifest() public {
        vm.prank(settler);
        registry.createProjectV2(
            "proj", "d", "MIT", false, "", false, "",
            "", 0, "ar://manifest", bytes32(0)
        );
        assertEq(registry.projectAccessManifest(1), "ar://manifest");
    }

    function test_createProjectV2_storesTagsHash() public {
        bytes32 tags = keccak256("ai,agent,base");
        vm.prank(settler);
        registry.createProjectV2(
            "proj", "d", "MIT", true, "", false, "",
            "", 0, "", tags
        );
        assertEq(registry.projectTagsHash(1), tags);
    }

    function test_createProjectV2_forkOf() public {
        // Create original
        vm.prank(settler);
        registry.createProjectV2(
            "original", "d", "MIT", true, "", false, "",
            "", 0, "", bytes32(0)
        );

        // Fork it
        vm.prank(settler);
        registry.createProjectV2(
            "forked", "d", "MIT", true, "", false, "",
            "", 1, "", bytes32(0)
        );

        assertEq(registry.projectForkOf(2), 1);
        uint256[] memory forks = registry.getForks(1);
        assertEq(forks.length, 1);
        assertEq(forks[0], 2);
    }

    function test_createProjectV2_invalidForkTarget() public {
        vm.prank(settler);
        vm.expectRevert(InkdRegistryV2.InvalidForkTarget.selector);
        registry.createProjectV2(
            "proj", "d", "MIT", true, "", false, "",
            "", 999, "", bytes32(0)
        );
    }

    function test_createProjectV2_emitsProjectCreated() public {
        vm.prank(settler);
        vm.expectEmit(true, true, false, true);
        emit InkdRegistry.ProjectCreated(1, settler, "proj", "MIT");
        registry.createProjectV2(
            "proj", "d", "MIT", true, "", false, "",
            "", 0, "", bytes32(0)
        );
    }

    function test_createProjectV2_emitsProjectCreatedV2() public {
        vm.prank(settler);
        vm.expectEmit(true, true, false, true);
        emit InkdRegistryV2.ProjectCreatedV2(1, settler, "proj", 0, "ar://meta");
        registry.createProjectV2(
            "proj", "d", "MIT", true, "", false, "",
            "ar://meta", 0, "", bytes32(0)
        );
    }

    function test_createProjectV2_emitsProjectForked() public {
        vm.prank(settler);
        registry.createProjectV2("original", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));

        vm.prank(settler);
        vm.expectEmit(true, true, true, false);
        emit InkdRegistryV2.ProjectForked(2, 1, settler);
        registry.createProjectV2("fork", "d", "MIT", true, "", false, "", "", 1, "", bytes32(0));
    }

    function test_createProjectV2_emptyMetadataNotStored() public {
        vm.prank(settler);
        registry.createProjectV2("proj", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));
        assertEq(bytes(registry.projectMetadataUri(1)).length, 0);
        assertEq(registry.projectForkOf(1), 0);
        assertEq(registry.projectTagsHash(1), bytes32(0));
    }

    function test_createProjectV2_normalizesName() public {
        vm.prank(settler);
        registry.createProjectV2("MyProject", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));
        assertEq(registry.getProject(1).name, "myproject");
    }

    function test_createProjectV2_rejectsEmptyName() public {
        vm.prank(settler);
        vm.expectRevert(InkdRegistry.EmptyName.selector);
        registry.createProjectV2("", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));
    }

    function test_createProjectV2_rejectsDuplicateName() public {
        vm.prank(settler);
        registry.createProjectV2("proj", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));

        vm.prank(settler);
        vm.expectRevert(InkdRegistry.NameTaken.selector);
        registry.createProjectV2("proj", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));
    }

    // ─── pushVersionV2() ──────────────────────────────────────────────────────

    function _createProject() internal returns (uint256 id) {
        vm.prank(settler);
        registry.createProjectV2("myproj", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));
        id = registry.projectCount();
    }

    function test_pushVersionV2_succeeds() public {
        uint256 id = _createProject();

        vm.prank(settler);
        registry.pushVersionV2(id, "ar://hash", "v1.0.0", "Initial release", alice, "ar://vmeta");

        assertEq(registry.getVersionCount(id), 1);
        InkdRegistry.Version memory v = registry.getVersion(id, 0);
        assertEq(v.arweaveHash, "ar://hash");
        assertEq(v.versionTag, "v1.0.0");
        assertEq(v.changelog, "Initial release");
        assertEq(v.pushedBy, settler);
    }

    function test_pushVersionV2_storesAgentAddress() public {
        uint256 id = _createProject();
        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h", "v1", "c", alice, "");
        assertEq(registry.getVersionAgent(id, 0), alice);
    }

    function test_pushVersionV2_storesVersionMetaHash() public {
        uint256 id = _createProject();
        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h", "v1", "c", alice, "ar://vmeta");
        assertEq(registry.versionMetaHash(id, 0), "ar://vmeta");
    }

    function test_pushVersionV2_zeroAgentAddressNotStored() public {
        uint256 id = _createProject();
        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h", "v1", "c", address(0), "");
        assertEq(registry.getVersionAgent(id, 0), address(0));
    }

    function test_pushVersionV2_onlySettler() public {
        uint256 id = _createProject();
        vm.prank(alice);
        vm.expectRevert(InkdRegistryV2.Unauthorized.selector);
        registry.pushVersionV2(id, "ar://h", "v1", "c", alice, "");
    }

    function test_pushVersionV2_rejectsNonExistentProject() public {
        vm.prank(settler);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.pushVersionV2(999, "ar://h", "v1", "c", alice, "");
    }

    function test_pushVersionV2_incrementsVersionCount() public {
        uint256 id = _createProject();

        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h1", "v1", "c", alice, "");
        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h2", "v2", "c", alice, "");

        assertEq(registry.getVersionCount(id), 2);
        assertEq(registry.getProject(id).versionCount, 2);
    }

    function test_pushVersionV2_multipleVersionsAgentAddresses() public {
        uint256 id = _createProject();

        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h1", "v1", "c", alice, "");
        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h2", "v2", "c", bob, "");

        assertEq(registry.getVersionAgent(id, 0), alice);
        assertEq(registry.getVersionAgent(id, 1), bob);
    }

    function test_pushVersionV2_emitsVersionPushed() public {
        uint256 id = _createProject();
        vm.prank(settler);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.VersionPushed(id, "ar://h", "v1.0.0", settler);
        registry.pushVersionV2(id, "ar://h", "v1.0.0", "c", alice, "");
    }

    function test_pushVersionV2_emitsVersionPushedV2() public {
        uint256 id = _createProject();
        vm.prank(settler);
        vm.expectEmit(true, true, true, true);
        emit InkdRegistryV2.VersionPushedV2(id, 0, "ar://h", "v1.0.0", alice);
        registry.pushVersionV2(id, "ar://h", "v1.0.0", "c", alice, "");
    }

    function test_pushVersionV2_noFeeCharged() public {
        uint256 id = _createProject();
        // settler has zero USDC balance — should NOT revert (no fee pull in V2)
        assertEq(usdc.balanceOf(settler), 0);
        vm.prank(settler);
        registry.pushVersionV2(id, "ar://h", "v1", "c", alice, "");
        // Still zero — no USDC moved
        assertEq(usdc.balanceOf(settler), 0);
    }

    // ─── V2 Setters ──────────────────────────────────────────────────────────

    function test_setMetadataUri_ownerOrCollaborator() public {
        uint256 id = _createProject();
        // settler is owner of the project — should succeed
        vm.prank(settler);
        registry.setMetadataUri(id, "ar://new");
        assertEq(registry.projectMetadataUri(id), "ar://new");
    }

    function test_setMetadataUri_rejectsStranger() public {
        uint256 id = _createProject();
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.NotOwnerOrCollaborator.selector);
        registry.setMetadataUri(id, "ar://bad");
    }

    function test_setAccessManifest_emitsEvent() public {
        uint256 id = _createProject();
        vm.prank(settler);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistryV2.AccessManifestUpdated(id, "ar://manifest");
        registry.setAccessManifest(id, "ar://manifest");
    }

    function test_setTagsHash_storesHash() public {
        uint256 id = _createProject();
        bytes32 h = keccak256("tag1,tag2");
        vm.prank(settler);
        registry.setTagsHash(id, h);
        assertEq(registry.projectTagsHash(id), h);
    }

    // ─── V1 Compatibility ────────────────────────────────────────────────────

    function test_v1_createProject_stillWorks() public {
        // Fund settler with USDC for service fee
        usdc.mint(settler, 10_000_000);
        vm.prank(settler);
        usdc.approve(address(registry), 10_000_000);

        // serviceFee() returns defaultFee ($5). V1 createProject has NO fee pull on create.
        // (only pushVersion has a fee). So this should succeed with zero USDC.
        vm.prank(settler);
        registry.createProject("v1-proj", "d", "MIT", true, "", false, "");
        assertEq(registry.projectCount(), 1);
    }

    function test_v1_state_preserved_after_v2_create() public {
        // Create via V1 first
        usdc.mint(settler, 10_000_000);
        vm.prank(settler);
        usdc.approve(address(registry), 10_000_000);
        vm.prank(settler);
        registry.createProject("v1-proj", "d", "MIT", true, "", false, "");

        // Create via V2
        vm.prank(settler);
        registry.createProjectV2("v2-proj", "d", "MIT", true, "", false, "", "ar://meta", 0, "", bytes32(0));

        assertEq(registry.projectCount(), 2);
        assertEq(registry.getProject(1).name, "v1-proj");
        assertEq(registry.getProject(2).name, "v2-proj");
        assertEq(registry.projectMetadataUri(1), ""); // V1 has no metadata URI
        assertEq(registry.projectMetadataUri(2), "ar://meta");
    }

    // ─── getProjectV2() ──────────────────────────────────────────────────────

    function test_getProjectV2_returnsAllFields() public {
        bytes32 tags = keccak256("ai,agent");
        vm.prank(settler);
        registry.createProjectV2(
            "full", "d", "MIT", true, "", false, "",
            "ar://meta", 0, "ar://manifest", tags
        );

        (
            InkdRegistry.Project memory p,
            string memory metaUri,
            uint256 forkOf,
            string memory manifest,
            bytes32 tagsHash
        ) = registry.getProjectV2(1);

        assertEq(p.name, "full");
        assertEq(metaUri, "ar://meta");
        assertEq(forkOf, 0);
        assertEq(manifest, "ar://manifest");
        assertEq(tagsHash, tags);
    }

    function test_getProjectV2_rejectsNonExistent() public {
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.getProjectV2(999);
    }

    // ─── getForks() ──────────────────────────────────────────────────────────

    function test_getForks_emptyForOriginal() public {
        vm.prank(settler);
        registry.createProjectV2("orig", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));
        assertEq(registry.getForks(1).length, 0);
    }

    function test_getForks_multipleForks() public {
        vm.prank(settler);
        registry.createProjectV2("orig", "d", "MIT", true, "", false, "", "", 0, "", bytes32(0));

        vm.prank(settler);
        registry.createProjectV2("fork-a", "d", "MIT", true, "", false, "", "", 1, "", bytes32(0));
        vm.prank(settler);
        registry.createProjectV2("fork-b", "d", "MIT", true, "", false, "", "", 1, "", bytes32(0));

        uint256[] memory forks = registry.getForks(1);
        assertEq(forks.length, 2);
        assertEq(forks[0], 2);
        assertEq(forks[1], 3);
    }
}
