// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdBuyback} from "../src/InkdBuyback.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock ERC20 for $INKD (no real Uniswap needed in unit tests)
contract MockInkd is ERC20 {
    constructor() ERC20("Inkd", "INKD") {
        _mint(msg.sender, 1_000_000_000 ether);
    }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

/// @dev Mock SwapRouter — always returns 1000 INKD per swap
contract MockRouter {
    MockInkd public inkd;
    constructor(MockInkd _inkd) { inkd = _inkd; }

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256) {
        uint256 out = 1000 ether;
        inkd.mint(p.recipient, out);
        return out;
    }
}

contract InkdBuybackTest is Test {
    InkdBuyback buyback;
    MockInkd    inkd;
    MockRouter  router;

    address owner   = address(0x1111);
    address caller  = address(0x2222);
    address other   = address(0x3333);

    uint256 THRESHOLD = 0.03 ether;

    function setUp() public {
        inkd   = new MockInkd();
        router = new MockRouter(inkd);

        // Deploy proxy
        InkdBuyback impl = new InkdBuyback();
        bytes memory init = abi.encodeCall(
            InkdBuyback.initialize,
            (owner, address(0), THRESHOLD) // inkdToken = 0 initially
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        buyback = InkdBuyback(payable(address(proxy)));

        vm.deal(caller, 10 ether);
        vm.deal(other,  10 ether);
    }

    // ─── Initialize ─────────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(buyback.owner(), owner);
        assertEq(buyback.threshold(), THRESHOLD);
        assertEq(buyback.inkdToken(), address(0));
        assertEq(buyback.buybackCount(), 0);
    }

    // ─── Receive ETH ────────────────────────────────────────────────────────

    function test_ReceiveEth() public {
        vm.prank(caller);
        (bool ok,) = address(buyback).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(buyback.ethBalance(), 1 ether);
    }

    // ─── setInkdToken ───────────────────────────────────────────────────────

    function test_SetInkdToken_OnlyOwner() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        assertEq(buyback.inkdToken(), address(inkd));
    }

    function test_SetInkdToken_RevertNonOwner() public {
        vm.prank(caller);
        vm.expectRevert();
        buyback.setInkdToken(address(inkd));
    }

    function test_SetInkdToken_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(InkdBuyback.ZeroAddress.selector);
        buyback.setInkdToken(address(0));
    }

    // ─── setThreshold ───────────────────────────────────────────────────────

    function test_SetThreshold() public {
        vm.prank(owner);
        buyback.setThreshold(1 ether);
        assertEq(buyback.threshold(), 1 ether);
    }

    function test_SetThreshold_RevertNonOwner() public {
        vm.prank(caller);
        vm.expectRevert();
        buyback.setThreshold(1 ether);
    }

    // ─── readyToBuyback ─────────────────────────────────────────────────────

    function test_NotReady_NoToken() public {
        vm.deal(address(buyback), THRESHOLD);
        assertFalse(buyback.readyToBuyback());
    }

    function test_NotReady_BelowThreshold() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        vm.deal(address(buyback), THRESHOLD - 1);
        assertFalse(buyback.readyToBuyback());
    }

    function test_Ready() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        vm.deal(address(buyback), THRESHOLD);
        assertTrue(buyback.readyToBuyback());
    }

    // ─── executeBuyback (unit — mocked router) ──────────────────────────────

    function test_ExecuteBuyback_RevertNoToken() public {
        vm.deal(address(buyback), THRESHOLD);
        vm.prank(caller);
        vm.expectRevert(InkdBuyback.InkdTokenNotSet.selector);
        buyback.executeBuyback();
    }

    function test_ExecuteBuyback_RevertBelowThreshold() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        vm.deal(address(buyback), THRESHOLD - 1);
        vm.prank(caller);
        vm.expectRevert();
        buyback.executeBuyback();
    }

    // ─── emergencyWithdrawEth ────────────────────────────────────────────────

    function test_EmergencyWithdraw_OnlyOwner() public {
        vm.deal(address(buyback), 1 ether);
        uint256 before = owner.balance;
        vm.prank(owner);
        buyback.emergencyWithdrawEth(owner);
        assertEq(owner.balance, before + 1 ether);
        assertEq(buyback.ethBalance(), 0);
    }

    function test_EmergencyWithdraw_RevertNonOwner() public {
        vm.deal(address(buyback), 1 ether);
        vm.prank(caller);
        vm.expectRevert();
        buyback.emergencyWithdrawEth(caller);
    }

    function test_EmergencyWithdraw_RevertEmpty() public {
        vm.prank(owner);
        vm.expectRevert(InkdBuyback.NothingToWithdraw.selector);
        buyback.emergencyWithdrawEth(owner);
    }

    // ─── withdrawInkd ───────────────────────────────────────────────────────

    function test_WithdrawInkd_OnlyOwner() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        // Give contract some INKD
        inkd.mint(address(buyback), 500 ether);

        vm.prank(owner);
        buyback.withdrawInkd(other, 500 ether);
        assertEq(inkd.balanceOf(other), 500 ether);
    }

    function test_WithdrawInkd_RevertNonOwner() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        inkd.mint(address(buyback), 500 ether);

        vm.prank(caller);
        vm.expectRevert();
        buyback.withdrawInkd(caller, 500 ether);
    }

    function test_WithdrawInkd_RevertZeroAddress() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        vm.prank(owner);
        vm.expectRevert(InkdBuyback.ZeroAddress.selector);
        buyback.withdrawInkd(address(0), 1 ether);
    }

    // ─── inkdBalance ────────────────────────────────────────────────────────

    function test_InkdBalance_NoToken() public view {
        assertEq(buyback.inkdBalance(), 0);
    }

    function test_InkdBalance_WithToken() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        inkd.mint(address(buyback), 42 ether);
        assertEq(buyback.inkdBalance(), 42 ether);
    }

    // ─── Stats ──────────────────────────────────────────────────────────────

    function test_InitialStats() public view {
        assertEq(buyback.totalEthSpent(), 0);
        assertEq(buyback.totalInkdBought(), 0);
        assertEq(buyback.buybackCount(), 0);
    }
}
