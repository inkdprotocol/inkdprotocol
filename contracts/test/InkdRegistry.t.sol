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

        // Give alice, bob, charlie tokens
        token.transfer(alice, 100 ether);
        token.transfer(bob, 100 ether);
        token.transfer(charlie, 100 ether);
    }

    // ───── Helpers ─────

    function _createProject(address who, string memory name) internal returns (uint256) {
        vm.startPrank(who);
        token.approve(address(registry), 1 ether);
        registry.createProject(name, "A test project", "MIT", true, "", false, "");
        vm.stopPrank();
        return registry.projectCount();
    }

    function _createAgentProject(address who, string memory name, string memory endpoint) internal returns (uint256) {
        vm.startPrank(who);
        token.approve(address(registry), 1 ether);
        registry.createProject(name, "An agent project", "Apache-2.0", true, "", true, endpoint);
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
        assertEq(p.license, "MIT");
        assertEq(p.readmeHash, "");
        assertFalse(p.isAgent);
        assertEq(p.agentEndpoint, "");
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
        registry.createProject("taken-name", "dup", "MIT", true, "", false, "");
        vm.stopPrank();
    }

    function test_createProject_reverts_emptyName() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        vm.expectRevert(InkdRegistry.EmptyName.selector);
        registry.createProject("", "desc", "MIT", true, "", false, "");
        vm.stopPrank();
    }

    function test_createProject_reverts_noApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.createProject("no-approval", "desc", "MIT", true, "", false, "");
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
    //  Name Normalization
    // ═══════════════════════════════════════════════════════════════════════

    function test_nameNormalization_lowercased() public {
        uint256 id = _createProject(alice, "MyProject");
        InkdRegistry.Project memory p = registry.getProject(id);
        assertEq(p.name, "myproject");
    }

    function test_nameNormalization_duplicateCaseInsensitive() public {
        _createProject(alice, "MyProject");
        vm.startPrank(bob);
        token.approve(address(registry), 1 ether);
        vm.expectRevert(InkdRegistry.NameTaken.selector);
        registry.createProject("myproject", "dup", "MIT", true, "", false, "");
        vm.stopPrank();
    }

    function test_nameNormalization_mixedCase() public {
        _createProject(alice, "HELLO-WORLD");
        assertTrue(registry.nameTaken("hello-world"));
        assertFalse(registry.nameTaken("HELLO-WORLD"));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  License
    // ═══════════════════════════════════════════════════════════════════════

    function test_createProject_license() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        registry.createProject("licensed-proj", "desc", "GPL-3.0", true, "", false, "");
        vm.stopPrank();

        InkdRegistry.Project memory p = registry.getProject(1);
        assertEq(p.license, "GPL-3.0");
    }

    function test_createProject_license_proprietary() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        registry.createProject("prop-proj", "desc", "Proprietary", false, "", false, "");
        vm.stopPrank();

        InkdRegistry.Project memory p = registry.getProject(1);
        assertEq(p.license, "Proprietary");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  README Hash
    // ═══════════════════════════════════════════════════════════════════════

    function test_createProject_readmeHash() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        registry.createProject("readme-proj", "desc", "MIT", true, "ar://readme123", false, "");
        vm.stopPrank();

        InkdRegistry.Project memory p = registry.getProject(1);
        assertEq(p.readmeHash, "ar://readme123");
    }

    function test_setReadme() public {
        uint256 id = _createProject(alice, "readme-update");
        assertEq(registry.getProject(id).readmeHash, "");

        vm.prank(alice);
        registry.setReadme(id, "ar://newreadme456");

        assertEq(registry.getProject(id).readmeHash, "ar://newreadme456");
    }

    function test_setReadme_reverts_notOwner() public {
        uint256 id = _createProject(alice, "readme-fail");
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NotOwner.selector);
        registry.setReadme(id, "ar://hacked");
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
    //  Variable Version Fee
    // ═══════════════════════════════════════════════════════════════════════

    function test_versionFee_default() public view {
        assertEq(registry.versionFee(), 0.001 ether);
    }

    function test_setVersionFee() public {
        registry.setVersionFee(0.005 ether);
        assertEq(registry.versionFee(), 0.005 ether);
    }

    function test_setVersionFee_reverts_exceedsMax() public {
        vm.expectRevert(InkdRegistry.FeeExceedsMax.selector);
        registry.setVersionFee(0.02 ether);
    }

    function test_setVersionFee_reverts_notOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setVersionFee(0.002 ether);
    }

    function test_pushVersion_withNewFee() public {
        registry.setVersionFee(0.005 ether);

        uint256 id = _createProject(alice, "new-fee-proj");
        vm.deal(alice, 1 ether);

        // Old fee should fail
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.InsufficientFee.selector);
        registry.pushVersion{value: 0.001 ether}(id, "ar://x", "0.1", "nope");

        // New fee should succeed
        vm.prank(alice);
        registry.pushVersion{value: 0.005 ether}(id, "ar://x", "0.1", "works");
        assertEq(registry.getVersionCount(id), 1);
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
    //  Transfer (now requires transferFee)
    // ═══════════════════════════════════════════════════════════════════════

    function test_transferFee_default() public view {
        assertEq(registry.transferFee(), 0.005 ether);
    }

    function test_transferProject() public {
        uint256 id = _createProject(alice, "transfer-proj");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(id, bob);

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

    function test_transferProject_sendsFeeToTreasury() public {
        uint256 id = _createProject(alice, "transfer-fee-test");
        vm.deal(alice, 1 ether);
        uint256 treasuryBefore = address(treasury).balance;
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(id, bob);
        assertEq(address(treasury).balance, treasuryBefore + 0.005 ether);
    }

    function test_transferProject_reverts_insufficientFee() public {
        uint256 id = _createProject(alice, "transfer-cheap");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.InsufficientFee.selector);
        registry.transferProject{value: 0.001 ether}(id, bob);
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

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(id, bob);

        // Bob is now owner, no longer collaborator
        assertFalse(registry.isCollaborator(id, bob));
        assertEq(registry.getProject(id).owner, bob);
    }

    function test_setTransferFee() public {
        registry.setTransferFee(0.01 ether);
        assertEq(registry.transferFee(), 0.01 ether);
    }

    function test_setTransferFee_reverts_exceedsMax() public {
        vm.expectRevert(InkdRegistry.FeeExceedsMax.selector);
        registry.setTransferFee(0.1 ether);
    }

    function test_setTransferFee_reverts_notOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setTransferFee(0.01 ether);
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
    //  Agent Registry
    // ═══════════════════════════════════════════════════════════════════════

    function test_createAgentProject() public {
        uint256 id = _createAgentProject(alice, "my-agent", "https://api.agent.io/v1");

        InkdRegistry.Project memory p = registry.getProject(id);
        assertTrue(p.isAgent);
        assertEq(p.agentEndpoint, "https://api.agent.io/v1");
        assertEq(p.license, "Apache-2.0");
    }

    function test_getAgentProjects() public {
        _createProject(alice, "normal-1");
        _createAgentProject(alice, "agent-1", "https://agent1.io");
        _createProject(bob, "normal-2");
        _createAgentProject(bob, "agent-2", "https://agent2.io");
        _createAgentProject(charlie, "agent-3", "https://agent3.io");

        InkdRegistry.Project[] memory agents = registry.getAgentProjects(0, 10);
        assertEq(agents.length, 3);
        assertEq(agents[0].name, "agent-1");
        assertEq(agents[1].name, "agent-2");
        assertEq(agents[2].name, "agent-3");
    }

    function test_getAgentProjects_pagination() public {
        _createAgentProject(alice, "agent-a", "https://a.io");
        _createAgentProject(bob, "agent-b", "https://b.io");
        _createAgentProject(charlie, "agent-c", "https://c.io");

        // offset=1, limit=1 => second agent only
        InkdRegistry.Project[] memory page = registry.getAgentProjects(1, 1);
        assertEq(page.length, 1);
        assertEq(page[0].name, "agent-b");
    }

    function test_getAgentProjects_emptyOffset() public {
        _createAgentProject(alice, "agent-x", "https://x.io");

        InkdRegistry.Project[] memory agents = registry.getAgentProjects(5, 10);
        assertEq(agents.length, 0);
    }

    function test_setAgentEndpoint() public {
        uint256 id = _createAgentProject(alice, "endpoint-agent", "https://old.io");

        vm.prank(alice);
        registry.setAgentEndpoint(id, "https://new.io");

        assertEq(registry.getProject(id).agentEndpoint, "https://new.io");
    }

    function test_setAgentEndpoint_reverts_notOwner() public {
        uint256 id = _createAgentProject(alice, "endpoint-fail", "https://old.io");

        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NotOwner.selector);
        registry.setAgentEndpoint(id, "https://hacked.io");
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

        // Alice transfers to charlie (requires transfer fee)
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(id, charlie);

        // Charlie is new owner
        assertEq(registry.getProject(id).owner, charlie);

        // Token still locked
        assertEq(token.balanceOf(address(registry)), 1 ether);

        // Treasury has version fees + transfer fee
        assertEq(address(treasury).balance, 0.007 ether);

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

    // ═══════════════════════════════════════════════════════════════════════
    //  Event Emissions
    // ═══════════════════════════════════════════════════════════════════════

    function test_createProject_emitsProjectCreated() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        vm.expectEmit(true, true, false, true);
        emit InkdRegistry.ProjectCreated(1, alice, "emitted", "MIT");
        registry.createProject("emitted", "desc", "MIT", true, "", false, "");
        vm.stopPrank();
    }

    function test_createProject_agentEmitsAgentRegistered() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.AgentRegistered(1, "https://agent.ai");
        registry.createProject("agent-emit", "desc", "MIT", true, "", true, "https://agent.ai");
        vm.stopPrank();
    }

    function test_pushVersion_emitsVersionPushed() public {
        uint256 id = _createProject(alice, "push-emit");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.VersionPushed(id, "ar://xyz", "2.0.0", alice);
        registry.pushVersion{value: 0.001 ether}(id, "ar://xyz", "2.0.0", "Changelog");
    }

    function test_addCollaborator_emitsEvent() public {
        uint256 id = _createProject(alice, "collab-emit");
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.CollaboratorAdded(id, bob);
        registry.addCollaborator(id, bob);
    }

    function test_removeCollaborator_emitsEvent() public {
        uint256 id = _createProject(alice, "remove-emit");
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.CollaboratorRemoved(id, bob);
        registry.removeCollaborator(id, bob);
    }

    function test_transferProject_emitsEvent() public {
        uint256 id = _createProject(alice, "transfer-emit");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit InkdRegistry.ProjectTransferred(id, alice, charlie);
        registry.transferProject{value: 0.005 ether}(id, charlie);
    }

    function test_setVisibility_emitsEvent() public {
        uint256 id = _createProject(alice, "vis-emit");
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.VisibilityChanged(id, false);
        registry.setVisibility(id, false);
    }

    function test_setReadme_emitsEvent() public {
        uint256 id = _createProject(alice, "readme-emit");
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.ReadmeUpdated(id, "ar://readme-hash");
        registry.setReadme(id, "ar://readme-hash");
    }

    function test_setAgentEndpoint_emitsAgentRegistered() public {
        uint256 id = _createAgentProject(alice, "agent-ep-emit", "https://old.io");
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.AgentRegistered(id, "https://new.io");
        registry.setAgentEndpoint(id, "https://new.io");
    }

    function test_setVersionFee_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit InkdRegistry.VersionFeeUpdated(0.001 ether, 0.002 ether);
        registry.setVersionFee(0.002 ether);
    }

    function test_setTransferFee_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit InkdRegistry.TransferFeeUpdated(0.005 ether, 0.01 ether);
        registry.setTransferFee(0.01 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Edge Cases
    // ═══════════════════════════════════════════════════════════════════════

    function test_getVersionCount_nonExistentProject() public view {
        // Non-existent project returns 0 (no revert)
        assertEq(registry.getVersionCount(999), 0);
    }

    function test_getAgentProjects_zeroLimit() public {
        _createAgentProject(alice, "agent-limit", "https://agent.io");
        InkdRegistry.Project[] memory result = registry.getAgentProjects(0, 0);
        assertEq(result.length, 0);
    }

    function test_transferProject_newOwnerProjectsList() public {
        uint256 id = _createProject(alice, "transfer-list");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(id, charlie);

        uint256[] memory charlieProjects = registry.getOwnerProjects(charlie);
        assertEq(charlieProjects.length, 1);
        assertEq(charlieProjects[0], id);

        uint256[] memory aliceProjects = registry.getOwnerProjects(alice);
        assertEq(aliceProjects.length, 0);
    }

    function test_removeCollaborator_canReadd() public {
        uint256 id = _createProject(alice, "readd-collab");
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        assertTrue(registry.isCollaborator(id, bob));

        vm.prank(alice);
        registry.removeCollaborator(id, bob);
        assertFalse(registry.isCollaborator(id, bob));

        // Re-add should succeed
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        assertTrue(registry.isCollaborator(id, bob));
    }

    function test_createAgentProject_emptyEndpoint_allowed() public {
        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        registry.createProject("agent-no-ep", "desc", "MIT", true, "", true, "");
        vm.stopPrank();
        uint256 id = registry.projectCount();
        assertEq(registry.getProject(id).agentEndpoint, "");
        assertTrue(registry.getProject(id).isAgent);
    }

    function test_pushVersion_storesAllFields() public {
        uint256 id = _createProject(alice, "fields-check");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.pushVersion{value: 0.001 ether}(id, "ar://hash-42", "3.1.4", "Fixed pi");

        InkdRegistry.Version memory v = registry.getVersion(id, 0);
        assertEq(v.projectId, id);
        assertEq(v.arweaveHash, "ar://hash-42");
        assertEq(v.versionTag, "3.1.4");
        assertEq(v.changelog, "Fixed pi");
        assertEq(v.pushedBy, alice);
        assertGt(v.pushedAt, 0);
    }

    function test_getOwnerProjects_noProjects() public view {
        uint256[] memory projects_ = registry.getOwnerProjects(address(0xdead));
        assertEq(projects_.length, 0);
    }

    // ───── Coverage: Array swap-and-pop branches ─────

    /// @notice Remove first-of-three collaborators — exercises swap-and-pop with non-last element.
    function test_removeCollaborator_firstOfThree() public {
        uint256 id = _createProject(alice, "multi-collab-remove");
        address dave = makeAddr("dave");
        address eve = makeAddr("eve");

        vm.startPrank(alice);
        registry.addCollaborator(id, bob);
        registry.addCollaborator(id, dave);
        registry.addCollaborator(id, eve);
        vm.stopPrank();

        // Confirm all three are collaborators
        address[] memory before = registry.getCollaborators(id);
        assertEq(before.length, 3);
        assertTrue(registry.isCollaborator(id, bob));
        assertTrue(registry.isCollaborator(id, dave));
        assertTrue(registry.isCollaborator(id, eve));

        // Remove first element (bob) — triggers swap-and-pop where bob ≠ last
        vm.prank(alice);
        registry.removeCollaborator(id, bob);

        address[] memory afterCollabs = registry.getCollaborators(id);
        assertEq(afterCollabs.length, 2);
        assertFalse(registry.isCollaborator(id, bob));
        // Remaining two should still be collaborators
        assertTrue(registry.isCollaborator(id, dave));
        assertTrue(registry.isCollaborator(id, eve));
    }

    /// @notice Remove middle collaborator of three — swap brings last element into middle slot.
    function test_removeCollaborator_middleOfThree() public {
        uint256 id = _createProject(alice, "multi-collab-middle");
        address dave = makeAddr("dave2");

        vm.startPrank(alice);
        registry.addCollaborator(id, bob);
        registry.addCollaborator(id, dave);
        registry.addCollaborator(id, charlie);
        vm.stopPrank();

        // Remove middle element (dave)
        vm.prank(alice);
        registry.removeCollaborator(id, dave);

        assertFalse(registry.isCollaborator(id, dave));
        assertTrue(registry.isCollaborator(id, bob));
        assertTrue(registry.isCollaborator(id, charlie));
        assertEq(registry.getCollaborators(id).length, 2);
    }

    /// @notice Transfer to a collaborator who is NOT the last in a 3-collab array.
    function test_transferProject_newOwnerIsFirstCollaborator() public {
        uint256 id = _createProject(alice, "transfer-first-collab");
        address dave = makeAddr("dave3");

        vm.startPrank(alice);
        registry.addCollaborator(id, bob);    // index 0 — will be new owner
        registry.addCollaborator(id, charlie); // index 1
        registry.addCollaborator(id, dave);    // index 2
        vm.stopPrank();

        assertEq(registry.getCollaborators(id).length, 3);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(id, bob);

        // Bob is owner, no longer a collaborator
        assertEq(registry.getProject(id).owner, bob);
        assertFalse(registry.isCollaborator(id, bob));
        // Other collabs unaffected
        assertTrue(registry.isCollaborator(id, charlie));
        assertTrue(registry.isCollaborator(id, dave));
        assertEq(registry.getCollaborators(id).length, 2);
    }

    /// @notice _removeFromOwnerProjects: Alice owns 3 projects, transfers the first one.
    /// Verifies the owner's project list shrinks and remaining IDs are intact.
    function test_ownerProjectList_transferFirstOfThree() public {
        // Alice creates 3 projects
        vm.startPrank(alice);
        token.approve(address(registry), 300 ether);
        registry.createProject("proj-a", "desc", "MIT", false, "", false, "");
        registry.createProject("proj-b", "desc", "MIT", false, "", false, "");
        registry.createProject("proj-c", "desc", "MIT", false, "", false, "");
        vm.stopPrank();

        uint256 total = registry.projectCount();
        uint256 idA = total - 2;
        uint256 idB = total - 1;
        uint256 idC = total;

        // Confirm Alice owns all three
        uint256[] memory beforeList = registry.getOwnerProjects(alice);
        assertEq(beforeList.length, 3);

        // Transfer the first project — exercises _removeFromOwnerProjects with a non-last element
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(idA, bob);

        // Alice now owns two
        uint256[] memory afterList = registry.getOwnerProjects(alice);
        assertEq(afterList.length, 2);

        // The two remaining IDs should be B and C (order may vary due to swap)
        bool hasB;
        bool hasC;
        for (uint256 i; i < afterList.length; i++) {
            if (afterList[i] == idB) hasB = true;
            if (afterList[i] == idC) hasC = true;
        }
        assertTrue(hasB, "idB should remain in Alice list");
        assertTrue(hasC, "idC should remain in Alice list");

        // Bob owns the transferred project
        uint256[] memory bobList = registry.getOwnerProjects(bob);
        assertEq(bobList.length, 1);
        assertEq(bobList[0], idA);
    }

    /// @notice _removeFromOwnerProjects: Transfer the middle project of three.
    function test_ownerProjectList_transferMiddleOfThree() public {
        vm.startPrank(alice);
        token.approve(address(registry), 300 ether);
        registry.createProject("mid-a", "desc", "MIT", false, "", false, "");
        registry.createProject("mid-b", "desc", "MIT", false, "", false, "");
        registry.createProject("mid-c", "desc", "MIT", false, "", false, "");
        vm.stopPrank();

        uint256 total = registry.projectCount();
        uint256 idA = total - 2;
        uint256 idB = total - 1; // middle
        uint256 idC = total;

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.transferProject{value: 0.005 ether}(idB, charlie);

        uint256[] memory afterList = registry.getOwnerProjects(alice);
        assertEq(afterList.length, 2);

        bool hasA;
        bool hasC;
        for (uint256 i; i < afterList.length; i++) {
            if (afterList[i] == idA) hasA = true;
            if (afterList[i] == idC) hasC = true;
        }
        assertTrue(hasA, "idA should remain in Alice list");
        assertTrue(hasC, "idC should remain in Alice list");
    }

    /// @notice getAgentProjects: offset equals exactly the count — returns empty.
    function test_getAgentProjects_offsetEqualsCount() public {
        // Create 2 agent projects
        vm.startPrank(alice);
        token.approve(address(registry), 200 ether);
        registry.createProject("ag-off-1", "desc", "MIT", false, "", true, "https://ep1");
        registry.createProject("ag-off-2", "desc", "MIT", false, "", true, "https://ep2");
        vm.stopPrank();

        // Offset == count returns empty
        InkdRegistry.Project[] memory result = registry.getAgentProjects(2, 10);
        assertEq(result.length, 0);
    }

    /// @notice pushVersion: collaborator stores arweaveHash and pushedBy correctly.
    function test_pushVersion_collaboratorStoresFields() public {
        uint256 id = _createProject(alice, "collab-push");
        vm.prank(alice);
        registry.addCollaborator(id, bob);

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        registry.pushVersion{value: 0.001 ether}(id, "ar://collab-hash", "1.0.0", "Collab pushed");

        assertEq(registry.getVersionCount(id), 1);
        InkdRegistry.Version memory v = registry.getVersion(id, 0);
        assertEq(v.pushedBy, bob);
        assertEq(v.arweaveHash, "ar://collab-hash");
    }
}
