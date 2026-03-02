// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title InkdFuzz — Fuzz and invariant tests for the Inkd Protocol
/// @notice Property-based tests that hammer edge cases unit tests can't catch.
contract InkdFuzzTest is Test {
    InkdToken public token;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new InkdToken();

        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (owner))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (owner, address(token), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        treasury.setRegistry(address(registry));

        token.transfer(alice, 100_000 ether);
        token.transfer(bob, 100_000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdToken — Fuzz
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_transfer(uint256 amount) public {
        amount = bound(amount, 0, token.balanceOf(owner));
        uint256 ownerBefore = token.balanceOf(owner);
        uint256 aliceBefore = token.balanceOf(alice);
        token.transfer(alice, amount);
        assertEq(token.balanceOf(owner), ownerBefore - amount);
        assertEq(token.balanceOf(alice), aliceBefore + amount);
    }

    function testFuzz_burn_reducesSupply(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 0, token.balanceOf(owner));
        uint256 supplyBefore = token.totalSupply();
        uint256 ownerBefore  = token.balanceOf(owner);
        token.burn(burnAmount);
        assertEq(token.totalSupply(),   supplyBefore - burnAmount, "supply decreases by burn amount");
        assertEq(token.balanceOf(owner), ownerBefore - burnAmount, "owner balance decreases by burn amount");
    }

    function testFuzz_totalSupply_neverExceedsConstant(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 0, token.balanceOf(owner));
        token.burn(burnAmount);
        assertLe(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — Fuzz
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_setVersionFee_valid(uint256 fee) public {
        fee = bound(fee, 0, registry.MAX_VERSION_FEE());
        registry.setVersionFee(fee);
        assertEq(registry.versionFee(), fee);
    }

    function testFuzz_setVersionFee_exceedsMax_reverts(uint256 fee) public {
        fee = bound(fee, registry.MAX_VERSION_FEE() + 1, type(uint256).max);
        vm.expectRevert(InkdRegistry.FeeExceedsMax.selector);
        registry.setVersionFee(fee);
    }

    function testFuzz_setTransferFee_valid(uint256 fee) public {
        fee = bound(fee, 0, registry.MAX_TRANSFER_FEE());
        registry.setTransferFee(fee);
        assertEq(registry.transferFee(), fee);
    }

    function testFuzz_setTransferFee_exceedsMax_reverts(uint256 fee) public {
        fee = bound(fee, registry.MAX_TRANSFER_FEE() + 1, type(uint256).max);
        vm.expectRevert(InkdRegistry.FeeExceedsMax.selector);
        registry.setTransferFee(fee);
    }

    function testFuzz_pushVersion_insufficientFee_reverts(uint256 feeSent) public {
        uint256 vFee = registry.versionFee();
        vm.assume(feeSent < vFee);

        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        registry.createProject("fuzz-proj", "fuzz", "MIT", true, "", false, "");
        vm.stopPrank();

        vm.deal(alice, vFee);
        vm.prank(alice);
        vm.expectRevert(InkdRegistry.InsufficientFee.selector);
        registry.pushVersion{value: feeSent}(1, "ar://x", "1.0", "fuzz");
    }

    function testFuzz_pushVersion_sufficientFee_forwardsToTreasury(uint256 extraETH) public {
        uint256 vFee = registry.versionFee();
        extraETH = bound(extraETH, 0, 10 ether);
        uint256 totalSent = vFee + extraETH;

        vm.startPrank(alice);
        token.approve(address(registry), 1 ether);
        registry.createProject("fuzz-proj2", "fuzz", "MIT", true, "", false, "");
        vm.stopPrank();

        vm.deal(alice, totalSent);
        uint256 treasuryBefore = address(treasury).balance;

        vm.prank(alice);
        registry.pushVersion{value: totalSent}(1, "ar://x", "1.0", "fuzz");

        assertEq(address(treasury).balance, treasuryBefore + totalSent);
        assertEq(address(registry).balance, 0);
    }

    function testFuzz_tokenLocked_perProject(uint8 projectCount_) public {
        uint256 count = bound(projectCount_, 1, 10);

        vm.startPrank(alice);
        token.approve(address(registry), count * 1 ether);
        for (uint256 i = 0; i < count; i++) {
            string memory name = string(abi.encodePacked("proj-", vm.toString(i)));
            registry.createProject(name, "fuzz", "MIT", true, "", false, "");
        }
        vm.stopPrank();

        assertEq(token.balanceOf(address(registry)), count * 1 ether);
    }

    function testFuzz_projectCount_monotonic(uint8 n) public {
        n = uint8(bound(n, 1, 20));

        vm.startPrank(alice);
        token.approve(address(registry), uint256(n) * 1 ether);
        for (uint8 i = 0; i < n; i++) {
            string memory name = string(abi.encodePacked("mono-", vm.toString(i)));
            registry.createProject(name, "fuzz", "MIT", true, "", false, "");
            assertEq(registry.projectCount(), i + 1);
        }
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdTreasury — Fuzz
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_withdraw_validAmount(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount = bound(depositAmount, 1, 10 ether);
        withdrawAmount = bound(withdrawAmount, 0, depositAmount);

        vm.deal(address(registry), depositAmount);
        vm.prank(address(registry));
        treasury.deposit{value: depositAmount}();

        uint256 aliceBefore = alice.balance;
        treasury.withdraw(alice, withdrawAmount);

        assertEq(alice.balance, aliceBefore + withdrawAmount);
        assertEq(address(treasury).balance, depositAmount - withdrawAmount);
    }

    function testFuzz_withdraw_nonOwner_reverts(uint256 amount, address attacker) public {
        vm.assume(attacker != owner);
        amount = bound(amount, 1, 1 ether);
        vm.deal(address(treasury), 1 ether);
        vm.prank(attacker);
        vm.expectRevert();
        treasury.withdraw(alice, amount);
    }
}
