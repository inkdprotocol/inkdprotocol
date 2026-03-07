// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {InkdBuyback} from "../src/InkdBuyback.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";

/// @title InkdFuzz — Comprehensive fuzz tests for the Inkd Protocol
contract InkdFuzzTest is Test {
    InkdToken public token;
    MockUSDC public usdc;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    address public owner  = address(this);
    address public alice  = makeAddr("alice");
    address public bob    = makeAddr("bob");
    address public arweaveWallet = makeAddr("arweaveWallet");
    address public buybackWallet = makeAddr("buybackWallet");
    address public settler       = makeAddr("settler");

    uint256 constant MAX_FEE = 1_000_000 * 1e6; // $1M USDC

    function setUp() public {
        token = new InkdToken();
        usdc  = new MockUSDC();

        InkdTreasury tImpl = new InkdTreasury();
        treasury = InkdTreasury(payable(address(new ERC1967Proxy(
            address(tImpl),
            abi.encodeCall(InkdTreasury.initialize, (owner, address(usdc), settler, arweaveWallet, buybackWallet))
        ))));

        InkdRegistry rImpl = new InkdRegistry();
        registry = InkdRegistry(address(new ERC1967Proxy(
            address(rImpl),
            abi.encodeCall(InkdRegistry.initialize, (owner, address(usdc), address(treasury)))
        )));

        treasury.setRegistry(address(registry));
        treasury.setDefaultFee(0);

        usdc.mint(alice, 1_000_000 * 1e6);
        usdc.mint(bob,   1_000_000 * 1e6);
        token.transfer(alice, 100_000 ether);
        token.transfer(bob,   100_000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdToken
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_token_transfer(uint256 amount) public {
        amount = bound(amount, 0, token.balanceOf(owner));
        uint256 before = token.balanceOf(alice);
        token.transfer(alice, amount);
        assertEq(token.balanceOf(alice), before + amount);
        assertEq(token.balanceOf(owner), token.TOTAL_SUPPLY() - 200_000 ether - amount);
    }

    function testFuzz_token_burn_reducesSupply(uint256 amount) public {
        amount = bound(amount, 0, token.balanceOf(owner));
        uint256 supplyBefore = token.totalSupply();
        token.burn(amount);
        assertEq(token.totalSupply(), supplyBefore - amount);
        assertLe(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function testFuzz_token_transferFrom_requiresApproval(address spender, uint256 amount) public {
        vm.assume(spender != address(0) && spender != owner);
        amount = bound(amount, 1, token.balanceOf(owner));
        vm.prank(spender);
        vm.expectRevert();
        token.transferFrom(owner, spender, amount);
    }

    function testFuzz_token_burn_exceedBalance_reverts(uint256 extra) public {
        extra = bound(extra, 1, type(uint128).max);
        uint256 balance = token.balanceOf(owner);
        vm.expectRevert();
        token.burn(balance + extra);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdTreasury — Markup & Fees
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_treasury_setMarkupBps_valid(uint256 bps) public {
        bps = bound(bps, 0, 5000);
        treasury.setMarkupBps(bps);
        assertEq(treasury.markupBps(), bps);
    }

    function testFuzz_treasury_setMarkupBps_tooHigh_reverts(uint256 bps) public {
        bps = bound(bps, 5001, type(uint256).max);
        vm.expectRevert(bytes("Max 50%"));
        treasury.setMarkupBps(bps);
    }

    function testFuzz_treasury_setDefaultFee_onlyOwner(address caller, uint256 fee) public {
        vm.assume(caller != owner);
        fee = bound(fee, 0, MAX_FEE);
        vm.prank(caller);
        vm.expectRevert();
        treasury.setDefaultFee(fee);
    }

    function testFuzz_treasury_calculateTotal_correctMarkup(uint256 cost, uint256 bps) public {
        bps  = bound(bps, 0, 5000);
        cost = bound(cost, 0, 1_000_000 * 1e6);
        treasury.setMarkupBps(bps);
        uint256 total = treasury.calculateTotal(cost);
        assertEq(total, cost + (cost * bps / 10000));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdTreasury — Settle / Split
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_treasury_settle_splitCorrectly(uint256 amount, uint256 arweaveCost) public {
        amount      = bound(amount, 2, 1_000_000 * 1e6);
        arweaveCost = bound(arweaveCost, 0, amount / 2);

        usdc.mint(address(treasury), amount);
        uint256 markup = amount - arweaveCost;

        vm.prank(settler);
        treasury.settle(amount, arweaveCost);

        // arweaveCost → arweaveWallet; markup split 50/50
        uint256 toBuyback  = markup / 2;
        uint256 toTreasury = markup - toBuyback;

        assertEq(usdc.balanceOf(arweaveWallet), arweaveCost);
        assertEq(usdc.balanceOf(buybackWallet), toBuyback);
        assertEq(usdc.balanceOf(address(treasury)), toTreasury);
    }

    function testFuzz_treasury_settle_onlySettlerOrRegistry(address caller, uint256 amount) public {
        vm.assume(caller != settler && caller != address(registry));
        amount = bound(amount, 1, MAX_FEE);
        usdc.mint(address(treasury), amount);
        vm.prank(caller);
        vm.expectRevert();
        treasury.settle(amount, 0);
    }

    function testFuzz_treasury_withdraw_onlyOwner(address attacker, uint256 amount) public {
        vm.assume(attacker != owner);
        amount = bound(amount, 1, MAX_FEE);
        usdc.mint(address(treasury), amount);
        vm.prank(attacker);
        vm.expectRevert();
        treasury.withdraw(alice, amount);
    }

    function testFuzz_treasury_withdraw_cannotExceedBalance(uint256 deposit, uint256 extra) public {
        deposit = bound(deposit, 1, MAX_FEE);
        extra   = bound(extra, 1, type(uint64).max);
        usdc.mint(address(treasury), deposit);
        vm.expectRevert();
        treasury.withdraw(alice, deposit + extra);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — createProject
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_registry_createProject_idMonotonic(uint8 n) public {
        n = uint8(bound(n, 1, 20));
        for (uint8 i = 0; i < n; i++) {
            string memory name = string(abi.encodePacked("proj-", vm.toString(uint256(i))));
            vm.prank(alice);
            registry.createProject(name, "desc", "MIT", true, "", false, "");
            assertEq(registry.projectCount(), i + 1);
        }
    }

    function testFuzz_registry_createProject_ownerIsCreator(address creator) public {
        vm.assume(creator != address(0));
        string memory name = "unique-proj";
        vm.prank(creator);
        registry.createProject(name, "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        assertEq(registry.getProject(id).owner, creator);
    }

    function testFuzz_registry_duplicateName_reverts(uint8 seed) public {
        string memory name = string(abi.encodePacked("dup-", vm.toString(uint256(seed))));
        vm.prank(alice);
        registry.createProject(name, "d", "MIT", true, "", false, "");
        vm.prank(bob);
        vm.expectRevert();
        registry.createProject(name, "d2", "MIT", true, "", false, "");
    }

    function testFuzz_registry_nameTooLong_reverts(uint8 extra) public {
        extra = uint8(bound(extra, 1, 200));
        // Build a name of length 65+extra (max is 64)
        string memory name = new string(65 + uint256(extra));
        vm.prank(alice);
        vm.expectRevert();
        registry.createProject(name, "d", "MIT", true, "", false, "");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — pushVersion
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_registry_pushVersion_versionIndexMonotonic(uint8 n) public {
        n = uint8(bound(n, 1, 10));
        vm.prank(alice);
        registry.createProject("versioned", "d", "MIT", true, "", false, "");
        uint256 projectId = registry.projectCount();

        for (uint8 i = 0; i < n; i++) {
            vm.prank(alice);
            registry.pushVersion(projectId, "ar://hash", string(abi.encodePacked("v", vm.toString(uint256(i)))), "");
            assertEq(registry.getVersionCount(projectId), i + 1);
        }
    }

    function testFuzz_registry_pushVersion_onlyOwnerOrCollaborator(address attacker) public {
        vm.assume(attacker != alice && attacker != address(0));
        vm.prank(alice);
        registry.createProject("secure", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(attacker);
        vm.expectRevert();
        registry.pushVersion(id, "ar://x", "v1", "");
    }

    function testFuzz_registry_pushVersion_nonexistentProject_reverts(uint256 projectId) public {
        uint256 count = registry.projectCount();
        projectId = bound(projectId, count + 1, type(uint64).max);
        vm.prank(alice);
        vm.expectRevert();
        registry.pushVersion(projectId, "ar://x", "v1", "");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — transferProject
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_registry_transferProject_ownerChanges(address newOwner) public {
        vm.assume(newOwner != address(0) && newOwner != alice);
        vm.prank(alice);
        registry.createProject("transfer-me", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(alice);
        registry.transferProject(id, newOwner);
        assertEq(registry.getProject(id).owner, newOwner);
    }

    function testFuzz_registry_transferProject_nonOwner_reverts(address attacker) public {
        vm.assume(attacker != alice && attacker != address(0));
        vm.prank(alice);
        registry.createProject("mine", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(attacker);
        vm.expectRevert();
        registry.transferProject(id, attacker);
    }

    function testFuzz_registry_transferProject_toZero_reverts() public {
        vm.prank(alice);
        registry.createProject("no-zero", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(alice);
        vm.expectRevert();
        registry.transferProject(id, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — Collaborators
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_registry_collaborator_canPushVersion(address collab) public {
        vm.assume(collab != alice && collab != address(0));
        vm.prank(alice);
        registry.createProject("collab-proj", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(alice);
        registry.addCollaborator(id, collab);
        assertTrue(registry.isCollaborator(id, collab));
        vm.prank(collab);
        registry.pushVersion(id, "ar://collab", "v1", "collab pushed");
        assertEq(registry.getVersionCount(id), 1);
    }

    function testFuzz_registry_collaborator_cannotTransfer(address collab) public {
        vm.assume(collab != alice && collab != address(0));
        vm.prank(alice);
        registry.createProject("collab-no-transfer", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(alice);
        registry.addCollaborator(id, collab);
        vm.prank(collab);
        vm.expectRevert();
        registry.transferProject(id, collab);
    }

    function testFuzz_registry_removeCollaborator(address collab) public {
        vm.assume(collab != alice && collab != address(0));
        vm.prank(alice);
        registry.createProject("rm-collab", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(alice);
        registry.addCollaborator(id, collab);
        vm.prank(alice);
        registry.removeCollaborator(id, collab);
        assertFalse(registry.isCollaborator(id, collab));
        // should now fail to push
        vm.prank(collab);
        vm.expectRevert();
        registry.pushVersion(id, "ar://x", "v1", "");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — Access control: admin functions
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_registry_setVisibility_onlyOwner(address attacker) public {
        vm.assume(attacker != alice && attacker != address(0));
        vm.prank(alice);
        registry.createProject("vis-proj", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();
        vm.prank(attacker);
        vm.expectRevert();
        registry.setVisibility(id, false);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — Fee enforcement (pushVersion charges fee)
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_registry_pushVersion_feeDeducted(uint256 fee) public {
        fee = bound(fee, 1, 1_000 * 1e6);
        treasury.setDefaultFee(fee);

        // Create project (no fee)
        vm.prank(alice);
        registry.createProject("fee-proj", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();

        // Approve fee
        vm.prank(alice);
        usdc.approve(address(registry), fee);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        registry.pushVersion(id, "ar://hash", "v1", "");
        assertEq(usdc.balanceOf(alice), aliceBefore - fee);
    }

    function testFuzz_registry_pushVersion_noApproval_reverts(uint256 fee) public {
        fee = bound(fee, 1, 1_000 * 1e6);
        treasury.setDefaultFee(fee);

        vm.prank(alice);
        registry.createProject("no-approve-push", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();

        // No approval — must revert
        vm.prank(alice);
        vm.expectRevert();
        registry.pushVersion(id, "ar://hash", "v1", "");
    }

    function testFuzz_registry_transferProject_feeDeducted(uint256 fee) public {
        fee = bound(fee, 1, 1_000 * 1e6);
        treasury.setDefaultFee(fee);

        vm.prank(alice);
        registry.createProject("transfer-fee", "d", "MIT", true, "", false, "");
        uint256 id = registry.projectCount();

        vm.prank(alice);
        usdc.approve(address(registry), fee);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        registry.transferProject(id, bob);
        assertEq(usdc.balanceOf(alice), aliceBefore - fee);
        assertEq(registry.getProject(id).owner, bob);
    }
}
