// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";

contract InkdTreasuryTest is Test {
    InkdTreasury public treasury;
    MockUSDC public usdc;
    address public owner = address(this);
    address public registry = makeAddr("registry");
    address public arweaveWallet = makeAddr("arweaveWallet");
    address public buybackWallet = makeAddr("buybackWallet");
    address public alice = makeAddr("alice");

    uint256 constant SERVICE_FEE = 5_000_000; // $5.00
    uint256 constant ARWEAVE_FEE = 1_000_000; // $1.00

    function setUp() public {
        usdc = new MockUSDC();
        InkdTreasury impl = new InkdTreasury();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(InkdTreasury.initialize, (owner, address(usdc), arweaveWallet, buybackWallet))
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

    function test_usdc() public view {
        assertEq(address(treasury.usdc()), address(usdc));
    }

    function test_arweaveWallet() public view {
        assertEq(treasury.arweaveWallet(), arweaveWallet);
    }

    function test_buybackWallet() public view {
        assertEq(treasury.buybackWallet(), buybackWallet);
    }

    function test_serviceFee_default() public view {
        assertEq(treasury.serviceFee(), SERVICE_FEE);
    }

    function test_arweaveFee_default() public view {
        assertEq(treasury.arweaveFee(), ARWEAVE_FEE);
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

    function test_setRegistry_reverts_zero() public {
        vm.expectRevert(InkdTreasury.ZeroAddress.selector);
        treasury.setRegistry(address(0));
    }

    // ───── setArweaveWallet ─────

    function test_setArweaveWallet() public {
        address newWallet = makeAddr("newArweave");
        treasury.setArweaveWallet(newWallet);
        assertEq(treasury.arweaveWallet(), newWallet);
    }

    function test_setArweaveWallet_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setArweaveWallet(alice);
    }

    function test_setArweaveWallet_reverts_zero() public {
        vm.expectRevert(InkdTreasury.ZeroAddress.selector);
        treasury.setArweaveWallet(address(0));
    }

    // ───── setBuybackWallet ─────

    function test_setBuybackWallet() public {
        address newWallet = makeAddr("newBuyback");
        treasury.setBuybackWallet(newWallet);
        assertEq(treasury.buybackWallet(), newWallet);
    }

    function test_setBuybackWallet_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setBuybackWallet(alice);
    }

    function test_setBuybackWallet_reverts_zero() public {
        vm.expectRevert(InkdTreasury.ZeroAddress.selector);
        treasury.setBuybackWallet(address(0));
    }

    // ───── setArweaveFee / setServiceFee ─────

    function test_setArweaveFee() public {
        treasury.setArweaveFee(2_000_000);
        assertEq(treasury.arweaveFee(), 2_000_000);
    }

    function test_setArweaveFee_reverts_exceeds_service() public {
        vm.expectRevert(InkdTreasury.ArweaveFeeExceedsService.selector);
        treasury.setArweaveFee(SERVICE_FEE + 1);
    }

    function test_setServiceFee() public {
        treasury.setServiceFee(10_000_000);
        assertEq(treasury.serviceFee(), 10_000_000);
    }

    function test_setServiceFee_reverts_below_arweave() public {
        vm.expectRevert(InkdTreasury.ArweaveFeeExceedsService.selector);
        treasury.setServiceFee(ARWEAVE_FEE - 1);
    }

    function test_setArweaveFee_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setArweaveFee(500_000);
    }

    function test_setServiceFee_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setServiceFee(10_000_000);
    }

    // ───── feeSplit ─────

    function test_feeSplit_default() public view {
        (uint256 toArweave, uint256 toBuyback, uint256 toTreasury) = treasury.feeSplit();
        assertEq(toArweave, ARWEAVE_FEE);          // $1.00
        assertEq(toBuyback, 2_000_000);             // $2.00 (50% of $4)
        assertEq(toTreasury, 2_000_000);            // $2.00 (50% of $4)
    }

    // ───── receivePayment ─────

    function test_receivePayment_splits_correctly() public {
        usdc.mint(address(treasury), SERVICE_FEE);

        uint256 arweaveBefore = usdc.balanceOf(arweaveWallet);
        uint256 buybackBefore = usdc.balanceOf(buybackWallet);
        uint256 treasuryBefore = usdc.balanceOf(address(treasury));

        vm.prank(registry);
        treasury.receivePayment(SERVICE_FEE);

        assertEq(usdc.balanceOf(arweaveWallet), arweaveBefore + ARWEAVE_FEE);
        assertEq(usdc.balanceOf(buybackWallet), buybackBefore + 2_000_000);
        assertEq(usdc.balanceOf(address(treasury)), treasuryBefore - SERVICE_FEE + 2_000_000);
    }

    function test_receivePayment_emits_events() public {
        usdc.mint(address(treasury), SERVICE_FEE);
        vm.expectEmit(true, false, false, true);
        emit InkdTreasury.PaymentReceived(registry, SERVICE_FEE);
        vm.expectEmit(false, false, false, true);
        emit InkdTreasury.PaymentSplit(ARWEAVE_FEE, 2_000_000, 2_000_000);
        vm.prank(registry);
        treasury.receivePayment(SERVICE_FEE);
    }

    function test_receivePayment_reverts_nonRegistry() public {
        vm.prank(alice);
        vm.expectRevert(InkdTreasury.OnlyRegistry.selector);
        treasury.receivePayment(SERVICE_FEE);
    }

    // ───── withdraw ─────

    function test_withdraw() public {
        usdc.mint(address(treasury), 10_000_000);
        treasury.withdraw(alice, 10_000_000);
        assertEq(usdc.balanceOf(alice), 10_000_000);
    }

    function test_withdraw_reverts_nonOwner() public {
        usdc.mint(address(treasury), 10_000_000);
        vm.prank(alice);
        vm.expectRevert();
        treasury.withdraw(alice, 10_000_000);
    }

    function test_withdraw_reverts_zero_address() public {
        usdc.mint(address(treasury), 10_000_000);
        vm.expectRevert(InkdTreasury.ZeroAddress.selector);
        treasury.withdraw(address(0), 10_000_000);
    }

    // ───── withdrawToken ─────

    function test_withdrawToken() public {
        MockUSDC other = new MockUSDC();
        other.mint(address(treasury), 5_000_000);
        treasury.withdrawToken(address(other), alice, 5_000_000);
        assertEq(other.balanceOf(alice), 5_000_000);
    }

    // ───── ETH fallback ─────

    function test_receive_eth() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(treasury).call{value: 0.1 ether}("");
        assertTrue(ok);
        assertEq(address(treasury).balance, 0.1 ether);
    }

    // ───── UUPS upgrade ─────

    function test_upgrade_reverts_nonOwner() public {
        InkdTreasury newImpl = new InkdTreasury();
        vm.prank(alice);
        vm.expectRevert();
        treasury.upgradeToAndCall(address(newImpl), "");
    }
}
