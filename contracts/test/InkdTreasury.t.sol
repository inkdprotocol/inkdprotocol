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
            abi.encodeCall(InkdTreasury.initialize, (owner, address(usdc), owner, arweaveWallet, buybackWallet))
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
        assertEq(treasury.buybackContract(), buybackWallet);
    }

    function test_serviceFee_default() public view {
        assertEq(treasury.markupBps(), 2000); // default 20%
    }

    function test_markupBps_default() public view {
        assertEq(treasury.markupBps(), 2000); // 20%
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

    // ───── setBuybackContract ─────

    function test_setBuybackContract() public {
        address newWallet = makeAddr("newBuyback");
        treasury.setBuybackContract(newWallet);
        assertEq(treasury.buybackContract(), newWallet);
    }

    function test_setBuybackContract_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setBuybackContract(alice);
    }

    function test_setBuybackContract_reverts_zero() public {
        vm.expectRevert(InkdTreasury.ZeroAddress.selector);
        treasury.setBuybackContract(address(0));
    }

    // ───── setMarkupBps ─────

    function test_setMarkupBps() public {
        treasury.setMarkupBps(3000); // 30%
        assertEq(treasury.markupBps(), 3000);
    }

    function test_setMarkupBps_reverts_above_50pct() public {
        vm.expectRevert();
        treasury.setMarkupBps(5001); // above 50%, should revert
    }

    function test_setMarkupBps_reverts_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setMarkupBps(1000);
    }

    // ───── calculateTotal ─────

    function test_calculateTotal_20pct() public view {
        // $10 arweave cost → $12 total (20% markup)
        uint256 total = treasury.calculateTotal(10_000_000);
        assertEq(total, 12_000_000);
    }

    // ───── receivePayment ─────

    function test_receivePayment_splits_correctly() public {
        usdc.mint(address(treasury), 5_000_000);

        uint256 arweaveBefore = usdc.balanceOf(arweaveWallet);
        uint256 buybackBefore = usdc.balanceOf(buybackWallet);
        uint256 treasuryBefore = usdc.balanceOf(address(treasury));

        vm.prank(registry);
        treasury.receivePayment(5_000_000);

        // receivePayment passes arweaveCost=0, so full amount split 50/50
        assertEq(usdc.balanceOf(arweaveWallet), arweaveBefore); // no arweave portion
        assertEq(usdc.balanceOf(buybackWallet), buybackBefore + 2_500_000); // 50% of $5
        assertEq(usdc.balanceOf(address(treasury)), treasuryBefore - 5_000_000 + 2_500_000); // 50% stays
    }

    function test_receivePayment_emits_events() public {
        usdc.mint(address(treasury), 5_000_000);
        vm.expectEmit(true, false, false, true);
        emit InkdTreasury.Settled(registry, 5_000_000, 0, 2_500_000, 2_500_000); // arweaveCost=0
        vm.prank(registry);
        treasury.receivePayment(5_000_000);
    }

    function test_receivePayment_reverts_nonRegistry() public {
        vm.prank(alice);
        vm.expectRevert(InkdTreasury.Unauthorized.selector);
        treasury.receivePayment(5_000_000);
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
