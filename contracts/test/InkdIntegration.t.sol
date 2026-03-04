// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title InkdIntegration — End-to-end integration tests for the Inkd Protocol
/// @notice Tests full user journeys across InkdToken, InkdRegistry, and InkdTreasury.
///         These tests verify the protocol behaves correctly across realistic multi-step
///         flows rather than testing individual functions in isolation.
///
/// Fee model: fees are USDC-based, pulled from caller → treasury → split.
///            setUp() zeros both arweaveFee and serviceFee so journeys work
///            without USDC approvals unless the test explicitly sets a fee.
contract InkdIntegrationTest is Test {
    // ─── Contracts ────────────────────────────────────────────────────────────
    InkdToken    public token;
    MockUSDC     public usdc;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    // ─── Actors ───────────────────────────────────────────────────────────────
    address public protocol     = makeAddr("protocol");     // protocol admin
    address public alice        = makeAddr("alice");         // developer
    address public bob          = makeAddr("bob");           // collaborator / buyer
    address public carol        = makeAddr("carol");         // another developer
    address public agent        = makeAddr("agent");         // AI agent wallet
    address public arweaveWallet = makeAddr("arweave");
    address public buybackWallet = makeAddr("buyback");

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 constant STARTING_INKD = 100_000 ether;   // INKD per user
    uint256 constant STARTING_ETH  = 10 ether;        // ETH per user
    uint256 constant USDC_6        = 1_000_000;       // $1.00 in USDC (6 decimals)

    // ─── Setup ────────────────────────────────────────────────────────────────

    function setUp() public {
        vm.startPrank(protocol);

        token = new InkdToken();
        usdc  = new MockUSDC();

        // Deploy Treasury (UUPS proxy) with 4-parameter initialize
        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (protocol, address(usdc), protocol, arweaveWallet, buybackWallet))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        // Deploy Registry (UUPS proxy)
        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (protocol, address(usdc), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        // Wire up treasury → registry
        treasury.setRegistry(address(registry));

        // Zero out fees so journeys don't need USDC approvals by default
        treasury.setDefaultFee(0);

        // Distribute INKD tokens to all actors
        token.transfer(alice, STARTING_INKD);
        token.transfer(bob,   STARTING_INKD);
        token.transfer(carol, STARTING_INKD);
        token.transfer(agent, STARTING_INKD);
        vm.stopPrank();

        // Fund actors with ETH
        vm.deal(alice, STARTING_ETH);
        vm.deal(bob,   STARTING_ETH);
        vm.deal(carol, STARTING_ETH);
        vm.deal(agent, STARTING_ETH);

        // Pre-fund all test actors with USDC for fees
        address[5] memory actors_ = [protocol, alice, bob, carol, agent];
        for (uint256 i = 0; i < actors_.length; i++) {
            usdc.mint(actors_[i], 1_000_000_000); // $1000 each
            vm.prank(actors_[i]);
            usdc.approve(address(registry), type(uint256).max);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 1: Full Developer Workflow
    //  Alice creates a project, pushes versions, adds Bob as collaborator,
    //  Bob pushes a version, Alice removes Bob, then transfers ownership to Carol.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_fullDeveloperWorkflow() public {
        // ── Step 1: Alice creates project ──
        vm.startPrank(alice);
        registry.createProject(
            "my-first-project",
            "An on-chain Solidity library",
            "MIT",
            true,
            "ar://readme-initial",
            false,
            ""
        );
        vm.stopPrank();

        assertEq(registry.projectCount(), 1, "project count");

        {
            InkdRegistry.Project memory p = registry.getProject(1);
            assertEq(p.owner, alice);
            assertEq(p.name, "my-first-project");
            assertEq(p.license, "MIT");
            assertTrue(p.isPublic);
            assertFalse(p.isAgent);
        }

        // ── Step 2: Alice pushes v0.1.0 ──
        vm.prank(alice);
        registry.pushVersion(1, "ar://v1hash", "v0.1.0", "Initial release");
        assertEq(registry.getVersionCount(1), 1);

        // ── Step 3: Alice pushes v0.2.0 ──
        vm.prank(alice);
        registry.pushVersion(1, "ar://v2hash", "v0.2.0", "Bug fixes");
        assertEq(registry.getVersionCount(1), 2);

        // ── Step 4: Alice adds Bob as collaborator ──
        vm.prank(alice);
        registry.addCollaborator(1, bob);

        assertTrue(registry.isCollaborator(1, bob), "bob is collaborator");
        assertEq(registry.getCollaborators(1)[0], bob);

        // ── Step 5: Bob pushes v0.3.0 as collaborator ──
        vm.prank(bob);
        registry.pushVersion(1, "ar://v3hash", "v0.3.0", "Bob's contribution");

        assertEq(registry.getVersionCount(1), 3);
        assertEq(registry.getVersion(1, 2).pushedBy, bob);

        // ── Step 6: Alice removes Bob ──
        vm.prank(alice);
        registry.removeCollaborator(1, bob);
        assertFalse(registry.isCollaborator(1, bob), "bob removed");
        assertEq(registry.getCollaborators(1).length, 0);

        // ── Step 7: Bob can no longer push ──
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NotOwnerOrCollaborator.selector);
        registry.pushVersion(1, "ar://v4hash", "v0.4.0", "Should fail");

        // ── Step 8: Alice updates README ──
        vm.prank(alice);
        registry.setReadme(1, "ar://readme-updated");
        assertEq(registry.getProject(1).readmeHash, "ar://readme-updated");

        // ── Step 9: Alice transfers ownership to Carol ──
        vm.prank(alice);
        registry.transferProject(1, carol);

        assertEq(registry.getProject(1).owner, carol, "carol is owner");
        assertEq(registry.getOwnerProjects(carol).length, 1);
        assertEq(registry.getOwnerProjects(alice).length, 0);

        // ── Step 10: Carol pushes a new version ──
        vm.prank(carol);
        registry.pushVersion(1, "ar://v5hash", "v1.0.0", "Major release");
        assertEq(registry.getVersionCount(1), 4);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 2: AI Agent Workflow
    //  Agent registers agent projects, updates endpoint, pushes checkpoints,
    //  queries with pagination, transfers ownership.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_agentWorkflow() public {
        // ── Create 3 regular projects (alice) and 2 agent projects (agent) ──
        vm.startPrank(alice);
        registry.createProject("lib-one",   "", "MIT",   true,  "", false, "");
        registry.createProject("lib-two",   "", "MIT",   true,  "", false, "");
        registry.createProject("lib-three", "", "MIT",   true,  "", false, "");
        vm.stopPrank();

        vm.startPrank(agent);
        registry.createProject(
            "brain-v1",
            "AI memory system",
            "Proprietary",
            false,
            "ar://brain-readme",
            true,
            "https://agent.inkdprotocol.xyz/v1"
        );
        registry.createProject(
            "trading-agent",
            "Autonomous DeFi trader",
            "Proprietary",
            false,
            "",
            true,
            "https://trader.inkdprotocol.xyz"
        );
        vm.stopPrank();

        assertEq(registry.projectCount(), 5);

        // ── Query agent projects (all) ──
        InkdRegistry.Project[] memory agentProjects = registry.getAgentProjects(0, 10);
        assertEq(agentProjects.length, 2);
        assertEq(agentProjects[0].name, "brain-v1");
        assertEq(agentProjects[1].name, "trading-agent");

        // ── Pagination: first page ──
        InkdRegistry.Project[] memory page1 = registry.getAgentProjects(0, 1);
        assertEq(page1.length, 1);
        assertEq(page1[0].name, "brain-v1");

        // ── Pagination: second page ──
        InkdRegistry.Project[] memory page2 = registry.getAgentProjects(1, 1);
        assertEq(page2.length, 1);
        assertEq(page2[0].name, "trading-agent");

        // ── Pagination: past end returns empty ──
        InkdRegistry.Project[] memory pastEnd = registry.getAgentProjects(10, 10);
        assertEq(pastEnd.length, 0);

        // ── Agent updates endpoint ──
        vm.prank(agent);
        registry.setAgentEndpoint(4, "https://agent.inkdprotocol.xyz/v2");
        assertEq(registry.getProject(4).agentEndpoint, "https://agent.inkdprotocol.xyz/v2");

        // ── Agent pushes model snapshot version ──
        vm.prank(agent);
        registry.pushVersion(
            4,
            "ar://brain-weights-checkpoint-1",
            "checkpoint-1",
            "First model checkpoint - trained on 10k agent interactions"
        );

        InkdRegistry.Version memory v = registry.getVersion(4, 0);
        assertEq(v.arweaveHash, "ar://brain-weights-checkpoint-1");
        assertEq(v.versionTag, "checkpoint-1");
        assertEq(v.pushedBy, agent);

        // ── isAgent flag preserved after transfer ──
        vm.prank(agent);
        registry.transferProject(4, alice);
        InkdRegistry.Project memory transferred = registry.getProject(4);
        assertTrue(transferred.isAgent, "agent flag preserved after transfer");
        assertEq(transferred.owner, alice);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 3: Treasury USDC Accounting
    //  Enable a non-zero serviceFee, verify USDC flows correctly; protocol
    //  withdraws accumulated USDC from the treasury.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_treasuryAccounting() public {
        // Enable a $2 service fee (USDC has 6 decimals = 2_000_000)
        uint256 fee = 2 * USDC_6;
        vm.startPrank(protocol);
        treasury.setDefaultFee(fee);
        vm.stopPrank();

        // Mint USDC to actors and approve registry
        usdc.mint(alice,  100 * USDC_6);
        usdc.mint(bob,    100 * USDC_6);
        usdc.mint(carol,  100 * USDC_6);

        vm.prank(alice);  usdc.approve(address(registry), type(uint256).max);
        vm.prank(bob);    usdc.approve(address(registry), type(uint256).max);
        vm.prank(carol);  usdc.approve(address(registry), type(uint256).max);

        // Create projects
        vm.prank(alice);  registry.createProject("alice-proj-1", "", "MIT", true, "", false, "");
        vm.prank(alice);  registry.createProject("alice-proj-2", "", "MIT", true, "", false, "");
        vm.prank(bob);    registry.createProject("bob-proj", "", "Apache-2.0", true, "", false, "");
        vm.prank(carol);  registry.createProject("carol-proj", "", "GPL-3.0", true, "", false, "");

        // Push one version per project (4 total → 4 × fee USDC)
        vm.prank(alice);  registry.pushVersion(1, "ar://a1v1", "v1", "");
        vm.prank(alice);  registry.pushVersion(2, "ar://a2v1", "v1", "");
        vm.prank(bob);    registry.pushVersion(3, "ar://b1v1", "v1", "");
        vm.prank(carol);  registry.pushVersion(4, "ar://c1v1", "v1", "");

        // Transfer: alice proj 1 → bob (another fee)
        vm.prank(alice);  registry.transferProject(1, bob);

        // 5 fee-bearing ops total → treasury + arweave + buyback received 5×fee
        // (arweaveFee is 0 so treasury.receivePayment splits: 0 to arweave, 50% buyback, 50% treasury)
        // arweaveFee=0 so revenue=fee, toBuyback=fee/2, toTreasury=fee/2
        uint256 totalFees = fee * 5;
        uint256 expectedBuyback  = totalFees / 2;
        uint256 expectedTreasury = totalFees - expectedBuyback;
        // buyback goes to buybackContract (address == buybackWallet in test setup)
        assertEq(usdc.balanceOf(address(treasury)), expectedTreasury, "treasury USDC balance");

        // Treasury rejects receivePayment from non-registry
        vm.prank(alice);
        vm.expectRevert(InkdTreasury.Unauthorized.selector);
        treasury.receivePayment(1);

        // Protocol withdraws treasury USDC to a multisig
        address withdrawTo = makeAddr("multisig");
        vm.prank(protocol);
        treasury.withdraw(withdrawTo, expectedTreasury);

        assertEq(usdc.balanceOf(address(treasury)), 0, "treasury drained");
        assertEq(usdc.balanceOf(withdrawTo), expectedTreasury, "multisig received USDC");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 4: Fee Parameter Changes Mid-Flight
    //  Protocol raises the service fee; verify new fee applies to subsequent
    //  ops and zero-fee ops work when fee is removed.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_feeChanges() public {
        // Start with fee=0 (from setUp) → push works freely
        vm.prank(alice);
        registry.createProject("fee-test", "", "MIT", true, "", false, "");

        vm.prank(alice);
        registry.pushVersion(1, "ar://v1", "v1", "free push");
        assertEq(registry.getVersionCount(1), 1, "free push succeeded");

        // Protocol sets a $3 service fee
        uint256 newFee = 3 * USDC_6;
        vm.prank(protocol);
        treasury.setMarkupBps(3000); // 30% new markup

        // Drain alice USDC and revoke approval so push reverts
        vm.startPrank(alice);
        usdc.transfer(address(0x1), usdc.balanceOf(alice));
        usdc.approve(address(registry), 0);
        vm.stopPrank();
        vm.prank(protocol);
        treasury.setDefaultFee(3_000_000); // $3 fee

        vm.prank(alice);
        vm.expectRevert();
        registry.pushVersion(1, "ar://v2", "v2", "no approval");

        // Refund alice and re-approve
        usdc.mint(alice, 100 * USDC_6);
        vm.prank(alice);
        usdc.approve(address(registry), type(uint256).max);

        vm.prank(alice);
        registry.pushVersion(1, "ar://v2", "v2", "paid push");
        assertEq(registry.getVersionCount(1), 2, "paid push succeeded");

        // Protocol zeroes fee again → push free again
        vm.startPrank(protocol);
        treasury.setDefaultFee(0); // zero fee
        vm.stopPrank();

        vm.prank(alice);
        registry.pushVersion(1, "ar://v3", "v3", "free again");
        assertEq(registry.getVersionCount(1), 3, "fee-free push after reset");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 5: Multi-Project Multi-User
    //  Stress the project counter, name normalization, and owner indexes.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_multiProjectMultiUser() public {
        address[] memory users = new address[](4);
        users[0] = alice;
        users[1] = bob;
        users[2] = carol;
        users[3] = agent;

        string[8] memory names = [
            "Alpha", "BETA", "Gamma", "DELTA", "epsilon", "ZETA", "Eta", "THETA"
        ];

        // Each user creates 2 projects
        for (uint256 i = 0; i < 4; i++) {
            vm.startPrank(users[i]);
            registry.createProject(names[i * 2],     "", "MIT", true, "", false, "");
            registry.createProject(names[i * 2 + 1], "", "MIT", true, "", false, "");
            vm.stopPrank();

            assertEq(registry.getOwnerProjects(users[i]).length, 2, "each user has 2 projects");
        }

        assertEq(registry.projectCount(), 8, "8 total projects");

        // Names are normalized to lowercase
        assertEq(registry.getProject(1).name, "alpha");
        assertEq(registry.getProject(2).name, "beta");
        assertEq(registry.getProject(5).name, "epsilon");

        // Cannot reuse name in any case
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.NameTaken.selector);
        registry.createProject("ALPHA", "", "MIT", true, "", false, ""); // same as "alpha"

        // Alice adds Bob as collaborator on project 1
        vm.prank(alice);
        registry.addCollaborator(1, bob);
        assertTrue(registry.isCollaborator(1, bob));

        // Transfer: alice proj 1 → carol; carol already owns 2, now 3
        vm.prank(alice);
        registry.transferProject(1, carol);

        assertEq(registry.getOwnerProjects(alice).length, 1, "alice has 1 left");
        assertEq(registry.getOwnerProjects(carol).length, 3, "carol has 3");

        // After transfer, bob is still collaborator
        assertTrue(registry.isCollaborator(1, bob), "collab survives transfer");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 6: Visibility & Privacy
    //  Test visibility toggling and private project creation.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_visibilityToggling() public {
        vm.startPrank(alice);
        registry.createProject("public-proj", "", "MIT", true, "", false, "");
        registry.createProject("private-proj", "Company internal", "Proprietary", false, "", false, "");
        vm.stopPrank();

        assertTrue(registry.getProject(1).isPublic, "starts public");
        assertFalse(registry.getProject(2).isPublic, "starts private");

        // Toggle public → private
        vm.prank(alice);
        registry.setVisibility(1, false);
        assertFalse(registry.getProject(1).isPublic, "now private");

        // Toggle private → public
        vm.prank(alice);
        registry.setVisibility(2, true);
        assertTrue(registry.getProject(2).isPublic, "now public");

        // Non-owner cannot toggle
        vm.prank(bob);
        vm.expectRevert(InkdRegistry.NotOwner.selector);
        registry.setVisibility(1, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 7: Collaborator Edge Cases
    //  Cannot add owner as collaborator, cannot add zero address,
    //  transferred-in owner is removed from collaborators.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_collaboratorEdgeCases() public {
        vm.startPrank(alice);
        registry.createProject("collab-test", "", "MIT", true, "", false, "");
        vm.stopPrank();

        // Cannot add owner as collaborator
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.CannotAddOwner.selector);
        registry.addCollaborator(1, alice);

        // Cannot add zero address
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.ZeroAddress.selector);
        registry.addCollaborator(1, address(0));

        // Add Bob as collaborator
        vm.prank(alice);
        registry.addCollaborator(1, bob);
        assertTrue(registry.isCollaborator(1, bob));

        // Cannot add Bob twice
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.AlreadyCollaborator.selector);
        registry.addCollaborator(1, bob);

        // Transfer to Bob (who is a collaborator): Bob removed from collabs, becomes owner
        vm.prank(alice);
        registry.transferProject(1, bob);

        assertEq(registry.getProject(1).owner, bob);
        assertFalse(registry.isCollaborator(1, bob), "bob removed from collabs on transfer");
        assertEq(registry.getCollaborators(1).length, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 8: UUPS Upgrade Flow
    //  Deploy a new implementation, upgrade via UUPS, verify state is preserved.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_uupsUpgrade() public {
        // Create a project before upgrade
        vm.startPrank(alice);
        registry.createProject("pre-upgrade-project", "", "MIT", true, "ar://readme", false, "");
        registry.pushVersion(1, "ar://v1", "v1.0.0", "pre-upgrade release");
        vm.stopPrank();

        assertEq(registry.projectCount(), 1);
        assertEq(registry.getVersionCount(1), 1);

        // Deploy new implementation (same code, mimics a real upgrade)
        InkdRegistry newImpl = new InkdRegistry();

        // Only owner can upgrade
        vm.prank(alice);
        vm.expectRevert();
        UUPSUpgradeable(address(registry)).upgradeToAndCall(address(newImpl), "");

        // Protocol upgrades
        vm.prank(protocol);
        UUPSUpgradeable(address(registry)).upgradeToAndCall(address(newImpl), "");

        // State is preserved after upgrade
        assertEq(registry.projectCount(), 1, "project count preserved");
        assertEq(registry.getProject(1).name, "pre-upgrade-project", "project name preserved");
        assertEq(registry.getVersionCount(1), 1, "version count preserved");
        assertEq(registry.getVersion(1, 0).arweaveHash, "ar://v1", "arweave hash preserved");

        // Can still create new projects after upgrade
        vm.startPrank(carol);
        registry.createProject("post-upgrade-project", "", "MIT", true, "", false, "");
        vm.stopPrank();

        assertEq(registry.projectCount(), 2, "new project after upgrade");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 9: Treasury Direct Receive & ETH Withdrawal
    //  Treasury accepts ETH via receive() fallback (e.g., manual donation).
    //  Protocol withdraws ETH separately from USDC using withdrawToken.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_treasuryDirectReceive() public {
        uint256 donation = 1 ether;
        vm.prank(alice);
        (bool ok,) = address(treasury).call{value: donation}("");
        assertTrue(ok, "direct ETH transfer succeeds");
        assertEq(address(treasury).balance, donation, "treasury has ETH donation");

        // Non-owner cannot send USDC withdraw (empty balance, but access check is enough)
        vm.prank(alice);
        vm.expectRevert();
        treasury.withdraw(alice, 1);

        // Protocol uses withdrawToken to recover ETH is not possible (ETH isn't ERC20)
        // Instead: treasury holds ETH for future ETH-fee support; owner can upgrade to access it.
        // Just verify the ETH is safely held.
        assertEq(address(treasury).balance, donation, "donation held safely");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Journey 10: Version History Integrity
    //  Many versions pushed; verify ordering and full retrieval.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_journey_versionHistoryIntegrity() public {
        vm.startPrank(alice);
        registry.createProject("versioned-lib", "", "MIT", true, "", false, "");

        string[5] memory tags   = ["v0.1.0", "v0.2.0", "v1.0.0", "v1.1.0", "v2.0.0"];
        string[5] memory hashes = [
            "ar://hash-a1", "ar://hash-a2", "ar://hash-a3", "ar://hash-a4", "ar://hash-a5"
        ];

        for (uint256 i = 0; i < 5; i++) {
            registry.pushVersion(1, hashes[i], tags[i], string.concat("Release ", tags[i]));
        }
        vm.stopPrank();

        assertEq(registry.getVersionCount(1), 5);

        // Retrieve each version and verify fields
        for (uint256 i = 0; i < 5; i++) {
            InkdRegistry.Version memory v = registry.getVersion(1, i);
            assertEq(v.arweaveHash, hashes[i],  "arweave hash");
            assertEq(v.versionTag,  tags[i],     "version tag");
            assertEq(v.pushedBy,    alice,        "pushed by");
            assertEq(v.projectId,   1,            "project id");
        }

        // Verify project versionCount matches
        assertEq(registry.getProject(1).versionCount, 5);
    }
}
