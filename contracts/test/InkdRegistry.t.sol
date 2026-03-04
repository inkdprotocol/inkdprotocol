// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";

contract InkdRegistryTest is Test {
    MockUSDC public usdc;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public arweaveWallet = makeAddr("arweaveWallet");
    address public buybackWallet = makeAddr("buybackWallet");

    uint256 constant SERVICE_FEE = 5_000_000; // $5.00 USDC

    function setUp() public {
        usdc = new MockUSDC();

        // Deploy treasury proxy
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (owner, address(usdc), owner, arweaveWallet, buybackWallet))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        // Deploy registry proxy
        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (owner, address(usdc), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        // Link registry in treasury
        treasury.setRegistry(address(registry));

        // Default: serviceFee = 0 so most tests don't need USDC setup
        treasury.setDefaultFee(0);

        // Pre-fund all test accounts with USDC for fees
        address[4] memory actors = [alice, bob, charlie, owner];
        for (uint256 i = 0; i < actors.length; i++) {
            usdc.mint(actors[i], 1_000_000_000); // $1000 each
            vm.prank(actors[i]);
            usdc.approve(address(registry), type(uint256).max);
        }
    }

    // ───── Helpers ─────

    function _createProject(address who, string memory name) internal returns (uint256) {
        vm.prank(who);
        registry.createProject(name, "A test project", "MIT", true, "", false, "");
        return registry.projectCount();
    }

    function _createAgentProject(address who, string memory name, string memory endpoint) internal returns (uint256) {
        vm.prank(who);
        registry.createProject(name, "An agent project", "Apache-2.0", true, "", true, endpoint);
        return registry.projectCount();
    }

    /// @dev Push a version — auto-funds USDC if needed.
    function _pushVersion(address who, uint256 projectId) internal {
        _fundAndApproveIfNeeded(who, 5_000_000);
        vm.prank(who);
        registry.pushVersion(projectId, "ar://abc123", "1.0.0", "Initial release");
    }

    /// @dev Mint + approve only if balance insufficient.
    function _fundAndApproveIfNeeded(address who, uint256 amount) internal {
        if (usdc.balanceOf(who) < amount) {
            usdc.mint(who, amount);
        }
        vm.prank(who);
        usdc.approve(address(registry), amount);
    }

    /// @dev Mint USDC and approve treasury for service fee.
    function _fundAndApprove(address who) internal {
        usdc.mint(who, 5_000_000);
        vm.prank(who);
        usdc.approve(address(registry), 5_000_000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  createProject
    // ═══════════════════════════════════════════════════════════════════════

    function test_createProject() public {
        uint256 id = _createProject(alice, "my-project");

        assertEq(id, 1);

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

    function test_createProject_reverts_duplicateName() public {
        _createProject(alice, "taken-name");
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NameTaken.selector);
        registry.createProject("taken-name", "dup", "MIT", true, "", false, "");
    }

    function test_createProject_reverts_emptyName() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.EmptyName.selector);
        registry.createProject("", "desc", "MIT", true, "", false, "");
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
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NameTaken.selector);
        registry.createProject("myproject", "dup", "MIT", true, "", false, "");
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
        vm.prank(alice);
        registry.createProject("licensed-proj", "desc", "GPL-3.0", true, "", false, "");
        InkdRegistry.Project memory p = registry.getProject(1);
        assertEq(p.license, "GPL-3.0");
    }

    function test_createProject_license_proprietary() public {
        vm.prank(alice);
        registry.createProject("prop-proj", "desc", "Proprietary", false, "", false, "");
        InkdRegistry.Project memory p = registry.getProject(1);
        assertEq(p.license, "Proprietary");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  README Hash
    // ═══════════════════════════════════════════════════════════════════════

    function test_createProject_readmeHash() public {
        vm.prank(alice);
        registry.createProject("readme-proj", "desc", "MIT", true, "ar://readme123", false, "");
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
    //  pushVersion (fee = 0 by default)
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

    function test_pushVersion_reverts_notOwnerOrCollab() public {
        uint256 id = _createProject(alice, "restricted");
        vm.prank(charlie);
        vm.expectRevert(InkdRegistry.NotOwnerOrCollaborator.selector);
        registry.pushVersion(id, "ar://x", "0.1", "nope");
    }

    function test_pushVersion_reverts_noProject() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.pushVersion(999, "ar://x", "0.1", "nope");
    }

    function test_pushVersion_multipleVersions() public {
        uint256 id = _createProject(alice, "multi-ver");
        vm.startPrank(alice);
        registry.pushVersion(id, "ar://v1", "alpha", "First");
        registry.pushVersion(id, "ar://v2", "beta", "Second");
        registry.pushVersion(id, "ar://v3", "1.0.0", "Release");
        vm.stopPrank();

        assertEq(registry.getVersionCount(id), 3);
        InkdRegistry.Version memory v3 = registry.getVersion(id, 2);
        assertEq(v3.versionTag, "1.0.0");
    }

    function test_pushVersion_storesAllFields() public {
        uint256 id = _createProject(alice, "fields-check");
        vm.prank(alice);
        registry.pushVersion(id, "ar://hash-42", "3.1.4", "Fixed pi");

        InkdRegistry.Version memory v = registry.getVersion(id, 0);
        assertEq(v.projectId, id);
        assertEq(v.arweaveHash, "ar://hash-42");
        assertEq(v.versionTag, "3.1.4");
        assertEq(v.changelog, "Fixed pi");
        assertEq(v.pushedBy, alice);
        assertGt(v.pushedAt, 0);
    }

    function test_pushVersion_collaboratorStoresFields() public {
        uint256 id = _createProject(alice, "collab-push");
        vm.prank(alice);
        registry.addCollaborator(id, bob);

        vm.prank(bob);
        registry.pushVersion(id, "ar://collab-hash", "1.0.0", "Collab pushed");

        assertEq(registry.getVersionCount(id), 1);
        InkdRegistry.Version memory v = registry.getVersion(id, 0);
        assertEq(v.pushedBy, bob);
        assertEq(v.arweaveHash, "ar://collab-hash");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  USDC Fee Model
    // ═══════════════════════════════════════════════════════════════════════

    function test_pushVersion_with_usdc_fee() public {
        // Enable $5 fee + 20% markup
        treasury.setDefaultFee(5_000_000); // $5.00
        treasury.setMarkupBps(2000);       // 20% markup

        uint256 id = _createProject(alice, "fee-test");

        uint256 buybackBefore = usdc.balanceOf(buybackWallet);
        uint256 arweaveBefore = usdc.balanceOf(arweaveWallet);

        _pushVersion(alice, id);

        // receivePayment uses arweaveCost=0, full $5 split 50/50
        assertEq(usdc.balanceOf(arweaveWallet), arweaveBefore);          // $0 arweave (dynamic)
        assertEq(usdc.balanceOf(buybackWallet), buybackBefore + 2_500_000); // $2.50 buyback
        assertEq(usdc.balanceOf(address(treasury)), 2_500_000);             // $2.50 treasury
    }

    function test_pushVersion_reverts_insufficient_usdc() public {
        treasury.setMarkupBps(2000); // 20% markup

        treasury.setDefaultFee(5_000_000); // enable fee
        uint256 id = _createProject(alice, "no-usdc");
        // Revoke alice's approval and drain her USDC
        vm.prank(alice);
        usdc.approve(address(registry), 0);
        vm.prank(alice);
        usdc.transfer(address(0x1), usdc.balanceOf(alice)); // drain
        vm.prank(alice);
        vm.expectRevert();
        registry.pushVersion(id, "ar://x", "1.0", "no money");
    }

    function test_transferProject_with_usdc_fee() public {
        treasury.setDefaultFee(5_000_000);
        treasury.setMarkupBps(2000);

        uint256 id = _createProject(alice, "transfer-fee");

        vm.prank(alice);
        registry.transferProject(id, bob);

        assertEq(registry.getProject(id).owner, bob);
        assertGt(usdc.balanceOf(buybackWallet), 0);
    }

    function test_setUsdc() public {
        MockUSDC newUsdc = new MockUSDC();
        registry.setUsdc(address(newUsdc));
        assertEq(address(registry.usdc()), address(newUsdc));
    }

    function test_setUsdc_reverts_zero() public {
        vm.expectRevert(InkdRegistry.ZeroAddress.selector);
        registry.setUsdc(address(0));
    }

    function test_setUsdc_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setUsdc(address(usdc));
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

    function test_removeCollaborator_firstOfThree() public {
        uint256 id = _createProject(alice, "multi-collab-remove");
        address dave = makeAddr("dave");
        address eve = makeAddr("eve");

        vm.startPrank(alice);
        registry.addCollaborator(id, bob);
        registry.addCollaborator(id, dave);
        registry.addCollaborator(id, eve);
        vm.stopPrank();

        vm.prank(alice);
        registry.removeCollaborator(id, bob);

        address[] memory afterCollabs = registry.getCollaborators(id);
        assertEq(afterCollabs.length, 2);
        assertFalse(registry.isCollaborator(id, bob));
        assertTrue(registry.isCollaborator(id, dave));
        assertTrue(registry.isCollaborator(id, eve));
    }

    function test_removeCollaborator_middleOfThree() public {
        uint256 id = _createProject(alice, "multi-collab-middle");
        address dave = makeAddr("dave2");

        vm.startPrank(alice);
        registry.addCollaborator(id, bob);
        registry.addCollaborator(id, dave);
        registry.addCollaborator(id, charlie);
        vm.stopPrank();

        vm.prank(alice);
        registry.removeCollaborator(id, dave);

        assertFalse(registry.isCollaborator(id, dave));
        assertTrue(registry.isCollaborator(id, bob));
        assertTrue(registry.isCollaborator(id, charlie));
        assertEq(registry.getCollaborators(id).length, 2);
    }

    function test_removeCollaborator_canReadd() public {
        uint256 id = _createProject(alice, "readd-collab");
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        vm.prank(alice);
        registry.removeCollaborator(id, bob);
        vm.prank(alice);
        registry.addCollaborator(id, bob);
        assertTrue(registry.isCollaborator(id, bob));
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

        assertFalse(registry.isCollaborator(id, bob));
        assertEq(registry.getProject(id).owner, bob);
    }

    function test_transferProject_newOwnerIsFirstCollaborator() public {
        uint256 id = _createProject(alice, "transfer-first-collab");
        address dave = makeAddr("dave3");

        vm.startPrank(alice);
        registry.addCollaborator(id, bob);
        registry.addCollaborator(id, charlie);
        registry.addCollaborator(id, dave);
        vm.stopPrank();

        vm.prank(alice);
        registry.transferProject(id, bob);

        assertEq(registry.getProject(id).owner, bob);
        assertFalse(registry.isCollaborator(id, bob));
        assertTrue(registry.isCollaborator(id, charlie));
        assertTrue(registry.isCollaborator(id, dave));
        assertEq(registry.getCollaborators(id).length, 2);
    }

    function test_transferProject_newOwnerProjectsList() public {
        uint256 id = _createProject(alice, "transfer-list");
        vm.prank(alice);
        registry.transferProject(id, charlie);

        uint256[] memory charlieProjects = registry.getOwnerProjects(charlie);
        assertEq(charlieProjects.length, 1);
        assertEq(charlieProjects[0], id);

        uint256[] memory aliceProjects = registry.getOwnerProjects(alice);
        assertEq(aliceProjects.length, 0);
    }

    function test_ownerProjectList_transferFirstOfThree() public {
        vm.startPrank(alice);
        registry.createProject("proj-a", "desc", "MIT", false, "", false, "");
        registry.createProject("proj-b", "desc", "MIT", false, "", false, "");
        registry.createProject("proj-c", "desc", "MIT", false, "", false, "");
        vm.stopPrank();

        uint256 total = registry.projectCount();
        uint256 idA = total - 2;
        uint256 idB = total - 1;
        uint256 idC = total;

        vm.prank(alice);
        registry.transferProject(idA, bob);

        uint256[] memory afterList = registry.getOwnerProjects(alice);
        assertEq(afterList.length, 2);

        bool hasB; bool hasC;
        for (uint256 i; i < afterList.length; i++) {
            if (afterList[i] == idB) hasB = true;
            if (afterList[i] == idC) hasC = true;
        }
        assertTrue(hasB);
        assertTrue(hasC);

        uint256[] memory bobList = registry.getOwnerProjects(bob);
        assertEq(bobList.length, 1);
        assertEq(bobList[0], idA);
    }

    function test_ownerProjectList_transferMiddleOfThree() public {
        vm.startPrank(alice);
        registry.createProject("mid-a", "desc", "MIT", false, "", false, "");
        registry.createProject("mid-b", "desc", "MIT", false, "", false, "");
        registry.createProject("mid-c", "desc", "MIT", false, "", false, "");
        vm.stopPrank();

        uint256 total = registry.projectCount();
        uint256 idA = total - 2;
        uint256 idB = total - 1;
        uint256 idC = total;

        vm.prank(alice);
        registry.transferProject(idB, charlie);

        uint256[] memory afterList = registry.getOwnerProjects(alice);
        assertEq(afterList.length, 2);

        bool hasA; bool hasC;
        for (uint256 i; i < afterList.length; i++) {
            if (afterList[i] == idA) hasA = true;
            if (afterList[i] == idC) hasC = true;
        }
        assertTrue(hasA);
        assertTrue(hasC);
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

        InkdRegistry.Project[] memory page = registry.getAgentProjects(1, 1);
        assertEq(page.length, 1);
        assertEq(page[0].name, "agent-b");
    }

    function test_getAgentProjects_emptyOffset() public {
        _createAgentProject(alice, "agent-x", "https://x.io");
        InkdRegistry.Project[] memory agents = registry.getAgentProjects(5, 10);
        assertEq(agents.length, 0);
    }

    function test_getAgentProjects_offsetEqualsCount() public {
        vm.startPrank(alice);
        registry.createProject("ag-off-1", "desc", "MIT", false, "", true, "https://ep1");
        registry.createProject("ag-off-2", "desc", "MIT", false, "", true, "https://ep2");
        vm.stopPrank();

        InkdRegistry.Project[] memory result = registry.getAgentProjects(2, 10);
        assertEq(result.length, 0);
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

    function test_createAgentProject_emptyEndpoint_allowed() public {
        vm.prank(alice);
        registry.createProject("agent-no-ep", "desc", "MIT", true, "", true, "");
        uint256 id = registry.projectCount();
        assertEq(registry.getProject(id).agentEndpoint, "");
        assertTrue(registry.getProject(id).isAgent);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Integration — Full Flow
    // ═══════════════════════════════════════════════════════════════════════

    function test_fullFlow_noFee() public {
        // Alice creates project
        uint256 id = _createProject(alice, "full-flow");

        // Alice adds bob as collaborator
        vm.prank(alice);
        registry.addCollaborator(id, bob);

        // Bob pushes version
        vm.prank(bob);
        registry.pushVersion(id, "ar://v1", "alpha", "First draft");

        // Alice pushes version
        vm.prank(alice);
        registry.pushVersion(id, "ar://v2", "1.0.0", "Release");

        assertEq(registry.getVersionCount(id), 2);

        // Alice transfers to charlie
        vm.prank(alice);
        registry.transferProject(id, charlie);
        assertEq(registry.getProject(id).owner, charlie);

        // Charlie can push version
        vm.prank(charlie);
        registry.pushVersion(id, "ar://v3", "1.0.1", "Hotfix");
        assertEq(registry.getVersionCount(id), 3);
    }

    function test_fullFlow_with_usdc_fee() public {
        treasury.setDefaultFee(5_000_000);
        treasury.setMarkupBps(2000); // 20% markup

        uint256 id = _createProject(alice, "full-flow-fee");
        // alice is already funded from setUp

        vm.prank(alice);
        registry.pushVersion(id, "ar://v1", "1.0.0", "First");
        vm.prank(alice);
        registry.pushVersion(id, "ar://v2", "2.0.0", "Second");

        // Transfer project
        vm.prank(alice);
        registry.transferProject(id, bob);
        assertEq(registry.getProject(id).owner, bob);

        // Buyback wallet received funds
        assertGt(usdc.balanceOf(buybackWallet), 0);
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
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit InkdRegistry.ProjectCreated(1, alice, "emitted", "MIT");
        registry.createProject("emitted", "desc", "MIT", true, "", false, "");
    }

    function test_createProject_agentEmitsAgentRegistered() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.AgentRegistered(1, "https://agent.ai");
        registry.createProject("agent-emit", "desc", "MIT", true, "", true, "https://agent.ai");
    }

    function test_pushVersion_emitsVersionPushed() public {
        uint256 id = _createProject(alice, "push-emit");
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InkdRegistry.VersionPushed(id, "ar://xyz", "2.0.0", alice);
        registry.pushVersion(id, "ar://xyz", "2.0.0", "Changelog");
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
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit InkdRegistry.ProjectTransferred(id, alice, charlie);
        registry.transferProject(id, charlie);
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

    // ═══════════════════════════════════════════════════════════════════════
    //  Edge Cases
    // ═══════════════════════════════════════════════════════════════════════

    function test_getVersionCount_nonExistentProject() public view {
        assertEq(registry.getVersionCount(999), 0);
    }

    function test_getAgentProjects_zeroLimit() public {
        _createAgentProject(alice, "agent-limit", "https://agent.io");
        InkdRegistry.Project[] memory result = registry.getAgentProjects(0, 0);
        assertEq(result.length, 0);
    }

    function test_getOwnerProjects_noProjects() public view {
        uint256[] memory projects_ = registry.getOwnerProjects(address(0xdead));
        assertEq(projects_.length, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  onlyProjectOwner modifier — ProjectNotFound branch
    // ═══════════════════════════════════════════════════════════════════════

    function test_addCollaborator_reverts_projectNotFound() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.addCollaborator(999, bob);
    }

    function test_removeCollaborator_reverts_projectNotFound() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.removeCollaborator(999, bob);
    }

    function test_transferProject_reverts_projectNotFound() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.transferProject(999, bob);
    }

    function test_setVisibility_reverts_projectNotFound() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.setVisibility(999, true);
    }

    function test_setReadme_reverts_projectNotFound() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.setReadme(999, "ar://x");
    }

    function test_setAgentEndpoint_reverts_projectNotFound() public {
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ProjectNotFound.selector);
        registry.setAgentEndpoint(999, "https://agent.ai");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Implementation Guard
    // ═══════════════════════════════════════════════════════════════════════

    function test_implementation_cannotBeInitialized() public {
        InkdRegistry impl = new InkdRegistry();
        vm.expectRevert();
        impl.initialize(address(this), address(usdc), address(treasury));
    }

    function test_implementation_cannotBeInitialized_fresh() public {
        InkdRegistry impl2 = new InkdRegistry();
        vm.expectRevert();
        impl2.initialize(makeAddr("owner2"), address(usdc), address(treasury));
    }
}
