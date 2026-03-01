// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract InkdRegistryTest is Test {
    InkdToken public token;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    function setUp() public {
        // Deploy token
        token = new InkdToken();

        // Deploy treasury proxy
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (owner))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        // Deploy registry proxy
        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (owner, address(token), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        // Link registry in treasury
        treasury.setRegistry(address(registry));

        // Give alice and bob tokens
        token.transfer(alice, 100 ether);
        token.transfer(bob, 100 ether);
        token.transfer(charlie, 100 ether);
    }

    // ───── Helpers ─────

    function _createProject(address who, string memory name) internal returns (uint256) {
        vm.startPrank(who);
        token.approve(address(registry), 1 ether);
        registry.createProject(name, "A test project", true);
        vm.stopPrank();
        return registry.projectCount();
    }

    function _pushVersion(address who, uint256 projectId) internal {
        vm.deal(who, 1 ether);
        vm.prank(who);
        registry.pushVersion{value: 0.001 ether}(projectId, "ar://abc123", "1.0.0", "Initial release");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  createProject
    // ═══════════════════════════════════════════════════════════════════════

    function test_createProject() public {
        uint256 aliceBefore = token.balanceOf(alice);

        uint256 id = _createProject(alice, "my-project");

        assertEq(id, 1);
        assertEq(token.balanceOf(alice), aliceBefore - 1 ether);
        assertEq(token.balanceOf(address(registry)), 1 ether);

        InkdRegistry.Project memory p = registry.getProject(id);
        assertEq(p.id, 1);
        assertEq(p.name, "my-project");
        assertEq(p.owner, alice);
        assertTrue(p.isPublic);
        assertTrue(p.exists);
        assertEq(p.versionCount, 0);
    }

    function test_createProject_incrementsCount() public {
        _createProject(alice, "proj-1");
        _createProject(bob, "proj-2");
        assertEq(registry.projectCount(), 2);
    }

    function test_createProject_locksToken() public {
        _createProject(alice, "proj-1");
        _createProject(alice, "proj-2");
        assertEq(token.balanceOf(address(registry)), 2 ether);
    }

    function test_createProject_reverts_duplicateName() public {
        _createProject(alice, "taken-name");
        vm.startPrank(bob);
        token.approve(address(registry), 1 ether);
        vm.expectRevert(InkdRegistry.NameTaken.selector);
        registry.createProject("taken-name", "dup", true);
        vm.stopPrank();
    }

    function test_createProject_reverts_emptyName() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        vm.expectRevert(InkdRegistry.EmptyName.selector);
        registry.createProject("", "desc", true);
        vm.stopPrank();
    }

    function test_createProject_reverts_noApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.createProject("no-approval", "desc", true);
    }

    function test_createProject_ownerProjectsList() public {
        _createProject(alice, "proj-a");
        _createProject(alice, "proj-b");

        uint256[] memory ids = registry.getOwnerProjects(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  pushVersion
    // ═══════════════════════════════════════════════════════════════════════

    function test_pushVersion_byOwner() public {
        uint256 id = _createProject(alice, "versioned");
        _pushVersion(alice, id);

        InkdRegistry.Version memory v = registry.getVersion(id, 0);
        assertEq(v.arweaveHash, "ar://abc123");
        assertEq(v.versionTag, "1.0.0");
        assertEq(v.changelog, "Initial release");
        assertEq(v.pushedBy, alice);
        assertEq(registry.getVersionCount(id), 1);

        InkdRegistry.Project memory p = registry.getProject(id);
        assertEq(p.versionCount, 1);
    }

    function test_pushVersion_byCollaborator() public {
        uint256 id = _createProject(alice, "collab-ver");
        vm.prank(alice);
        registry.addCollaborator(id, bob);

        _pushVersion(bob, id);
        assertEq(registry.getVersionCount(id), 1);

        InkdRegistry.Version memory v = registry.getVersion(id, 0);
        assertEq(v.pushedBy, bob);
    }

    function test_pushVersion_sendsFeeToTreasury() public {
        uint256 id = _createProject(alice, "fee-test");
        uint256 treasuryBefore = address(treasury).balance;
        _pushVersion(alice, id);
        assertEq(address(treasury).balance, treasuryBefore + 0.001 ether);
    }

    function test_pushVersion_reverts_notOwnerOrCollab() public {
        uint256 id = _createProject(alice, "restricted");
        vm.deal(charlie, 1 ether);
        vm.prank(charlie);
        vm.expectRevert(InkdRegistry.NotOwnerOrCollaborator.selector);
        registry.pushVersion{value: 0.001 ether}(id, "ar://x", "0.1", "nope");
    }

    function test_pushVersion_reverts_insufficientFee() public {
        uint256 id = _createProject(alice, "cheap");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.InsufficientFee.selector);
        registry.pushVersion{value: 0.0001 ether}(id, "ar://x", "0.1", "nope");
    }

    function test_pushVersion_reverts_noProject() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.pushVersion{value: 0.001 ether}(999, "ar://x", "0.1", "nope");
    }

    function test_pushVersion_multipleVersions() public {
        uint256 id = _createProject(alice, "multi-ver");
        vm.deal(alice, 10 ether);
        vm.startPrank(alice);
        registry.pushVersion{value: 0.001 ether}(id, "ar://v1", "alpha", "First");
        registry.pushVersion{value: 0.001 ether}(id, "ar://v2", "beta", "Second");
        registry.pushVersion{value: 0.001 ether}(id, "ar://v3", "1.0.0", "Release");
        vm.stopPrank();

        assertEq(registry.getVersionCount(id), 3);

        InkdRegistry.Version memory v3 = registry.getVersion(id, 2);
        assertEq(v3.versionTag, "1.0.0");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Collaborators
    // ═══════════════════════════════════════════════════════════════════════

    function test_addCollaborator() public {
        uint256 id = _createProject(alice, "collab-proj");
        vm.prank(alice);
        registry.addCollaborator(id, bob);

        assertTrue(registry.isCollaborator(id, bob));
        address[] memory collabs = registry.getCollaborators(id);
        assertEq(collabs.length, 1);
        assertEq(collabs[0], bob);
    }

    function test_addCollaborator_reverts_nonOwner() public {
        uint256 id = _createProject(alice, "collab-fail");
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NotOwner.selector);
        registry.addCollaborator(id, charlie);
    }

    function test_addCollaborator_reverts_duplicate() public {
        uint256 id = _createProject(alice, "collab-dup");
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.AlreadyCollaborator.selector);
        registry.addCollaborator(id, bob);
    }

    function test_addCollaborator_reverts_addOwner() public {
        uint256 id = _createProject(alice, "collab-owner");
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.CannotAddOwner.selector);
        registry.addCollaborator(id, alice);
    }

    function test_addCollaborator_reverts_zeroAddress() public {
        uint256 id = _createProject(alice, "collab-zero");
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ZeroAddress.selector);
        registry.addCollaborator(id, address(0));
    }

    function test_removeCollaborator() public {
        uint256 id = _createProject(alice, "collab-rm");
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        vm.prank(alice);
        registry.removeCollaborator(id, bob);

        assertFalse(registry.isCollaborator(id, bob));
        address[] memory collabs = registry.getCollaborators(id);
        assertEq(collabs.length, 0);
    }

    function test_removeCollaborator_reverts_notCollaborator() public {
        uint256 id = _createProject(alice, "collab-rm-fail");
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.NotCollaborator.selector);
        registry.removeCollaborator(id, bob);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Transfer
    // ═══════════════════════════════════════════════════════════════════════

    function test_transferProject() public {
        uint256 id = _createProject(alice, "transfer-proj");
        vm.prank(alice);
        registry.transferProject(id, bob);

        InkdRegistry.Project memory p = registry.getProject(id);
        assertEq(p.owner, bob);

        // Token stays locked
        assertEq(token.balanceOf(address(registry)), 1 ether);

        // Owner lists updated
        uint256[] memory aliceProjects = registry.getOwnerProjects(alice);
        assertEq(aliceProjects.length, 0);
        uint256[] memory bobProjects = registry.getOwnerProjects(bob);
        assertEq(bobProjects.length, 1);
        assertEq(bobProjects[0], id);
    }

    function test_transferProject_reverts_notOwner() public {
        uint256 id = _createProject(alice, "transfer-fail");
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NotOwner.selector);
        registry.transferProject(id, charlie);
    }

    function test_transferProject_reverts_zeroAddress() public {
        uint256 id = _createProject(alice, "transfer-zero");
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ZeroAddress.selector);
        registry.transferProject(id, address(0));
    }

    function test_transferProject_removesCollaboratorStatus() public {
        uint256 id = _createProject(alice, "transfer-collab");
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        assertTrue(registry.isCollaborator(id, bob));

        vm.prank(alice);
        registry.transferProject(id, bob);

        // Bob is now owner, no longer collaborator
        assertFalse(registry.isCollaborator(id, bob));
        assertEq(registry.getProject(id).owner, bob);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Visibility
    // ═══════════════════════════════════════════════════════════════════════

    function test_setVisibility() public {
        uint256 id = _createProject(alice, "vis-proj");
        assertTrue(registry.getProject(id).isPublic);

        vm.prank(alice);
        registry.setVisibility(id, false);
        assertFalse(registry.getProject(id).isPublic);

        vm.prank(alice);
        registry.setVisibility(id, true);
        assertTrue(registry.getProject(id).isPublic);
    }

    function test_setVisibility_reverts_notOwner() public {
        uint256 id = _createProject(alice, "vis-fail");
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NotOwner.selector);
        registry.setVisibility(id, false);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Integration
    // ═══════════════════════════════════════════════════════════════════════

    function test_fullFlow() public {
        // Alice creates project
        uint256 id = _createProject(alice, "full-flow");

        // Alice adds bob as collaborator
        vm.prank(alice);
        registry.addCollaborator(id, bob);

        // Bob pushes version
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        registry.pushVersion{value: 0.001 ether}(id, "ar://v1", "alpha", "First draft");

        // Alice pushes version
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.pushVersion{value: 0.001 ether}(id, "ar://v2", "1.0.0", "Release");

        // Treasury collected fees
        assertEq(address(treasury).balance, 0.002 ether);

        // 2 versions
        assertEq(registry.getVersionCount(id), 2);

        // Alice transfers to charlie
        vm.prank(alice);
        registry.transferProject(id, charlie);

        // Charlie is new owner
        assertEq(registry.getProject(id).owner, charlie);

        // Token still locked
        assertEq(token.balanceOf(address(registry)), 1 ether);

        // Charlie can push version
        vm.deal(charlie, 1 ether);
        vm.prank(charlie);
        registry.pushVersion{value: 0.001 ether}(id, "ar://v3", "1.0.1", "Hotfix");
        assertEq(registry.getVersionCount(id), 3);
    }

    function test_nameTaken_mapping() public {
        _createProject(alice, "unique-name");
        assertTrue(registry.nameTaken("unique-name"));
        assertFalse(registry.nameTaken("other-name"));
    }
}
