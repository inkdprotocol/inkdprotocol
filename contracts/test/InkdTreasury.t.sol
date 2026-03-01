// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract InkdTreasuryTest is Test {
    InkdTreasury public treasury;
    address public owner = address(this);
    address public registry = makeAddr("registry");
    address public alice = makeAddr("alice");

    function setUp() public {
        InkdTreasury impl = new InkdTreasury();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(InkdTreasury.initialize, (owner))
        );
        treasury = InkdTreasury(payable(address(proxy)));
        treasury.setRegistry(registry);
    }

    // ───── Initialization ─────

    function test_owner() public view {
        assertEq(treasury.owner(), owner);
    }

    function test_registry() public view {
        assertEq(treasury.registry(), registry);
    }

    // ───── setRegistry ─────

    function test_setRegistry() public {
        address newRegistry = makeAddr("newRegistry");
        treasury.setRegistry(newRegistry);
        assertEq(treasury.registry(), newRegistry);
    }

    function test_setRegistry_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setRegistry(alice);
    }

    // ───── Deposit ─────

    function test_deposit_from_registry() public {
        vm.deal(registry, 1 ether);
        vm.prank(registry);
        treasury.deposit{value: 0.001 ether}();
        assertEq(address(treasury).balance, 0.001 ether);
    }

    function test_deposit_reverts_nonRegistry() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(InkdTreasury.OnlyRegistry.selector);
        treasury.deposit{value: 0.001 ether}();
    }

    // ───── Receive ─────

    function test_receive_eth() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(treasury).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(address(treasury).balance, 0.5 ether);
    }

    function test_receive_emitsReceived() public {
        vm.deal(alice, 1 ether);
        vm.expectEmit(true, false, false, true);
        emit InkdTreasury.Received(alice, 0.25 ether);
        vm.prank(alice);
        (bool ok,) = address(treasury).call{value: 0.25 ether}("");
        assertTrue(ok);
    }

    // ───── Withdraw ─────

    function test_withdraw() public {
        // Fund treasury
        vm.deal(registry, 1 ether);
        vm.prank(registry);
        treasury.deposit{value: 0.1 ether}();

        uint256 aliceBefore = alice.balance;
        treasury.withdraw(alice, 0.05 ether);
        assertEq(alice.balance, aliceBefore + 0.05 ether);
        assertEq(address(treasury).balance, 0.05 ether);
    }

    function test_withdraw_reverts_nonOwner() public {
        vm.deal(registry, 1 ether);
        vm.prank(registry);
        treasury.deposit{value: 0.1 ether}();

        vm.prank(alice);
        vm.expectRevert();
        treasury.withdraw(alice, 0.05 ether);
    }

    function test_withdraw_reverts_insufficient_balance() public {
        vm.expectRevert(InkdTreasury.TransferFailed.selector);
        treasury.withdraw(alice, 1 ether);
    }

    // ───── Multiple deposits ─────

    function test_multiple_deposits_accumulate() public {
        vm.deal(registry, 10 ether);
        vm.startPrank(registry);
        treasury.deposit{value: 0.001 ether}();
        treasury.deposit{value: 0.001 ether}();
        treasury.deposit{value: 0.001 ether}();
        vm.stopPrank();
        assertEq(address(treasury).balance, 0.003 ether);
    }
}
