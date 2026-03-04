// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdBuyback} from "../src/InkdBuyback.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock ERC20 used as both USDC and $INKD in tests
contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

/// @dev Mock SwapRouter — always returns 1000 INKD per USDC swap
contract MockRouter {
    MockToken public inkd;
    constructor(MockToken _inkd) { inkd = _inkd; }

    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee;
        address recipient; uint256 deadline; uint256 amountIn;
        uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external returns (uint256) {
        // Consume USDC from caller (already approved)
        ERC20(p.tokenIn).transferFrom(msg.sender, address(this), p.amountIn);
        uint256 out = 1000 * 1e18;
        inkd.mint(p.recipient, out);
        return out;
    }
}

contract InkdBuybackTest is Test {
    InkdBuyback buyback;
    MockToken   mockUsdc;
    MockToken   inkd;
    MockRouter  router;

    address owner    = address(0x1111);
    address treasury = address(0x2222);
    address other    = address(0x3333);

    uint256 THRESHOLD = 50_000_000; // $50 USDC (6 decimals)

    // Override USDC constant via vm.etch
    function setUp() public {
        inkd      = new MockToken("Inkd", "INKD");
        mockUsdc  = new MockToken("USD Coin", "USDC");
        router    = new MockRouter(inkd);

        // Deploy buyback impl
        InkdBuyback impl = new InkdBuyback();
        bytes memory init = abi.encodeCall(
            InkdBuyback.initialize,
            (owner, treasury, address(0), THRESHOLD)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        buyback = InkdBuyback(address(proxy));

        // Override USDC address in buyback to use our mock
        vm.mockCall(
            buyback.USDC(),
            abi.encodeWithSignature("balanceOf(address)", address(buyback)),
            abi.encode(uint256(0))
        );
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(buyback.owner(),     owner);
        assertEq(buyback.treasury(),  treasury);
        assertEq(buyback.threshold(), THRESHOLD);
        assertEq(buyback.inkdToken(), address(0));
        assertEq(buyback.buybackCount(), 0);
    }

    // ─── setInkdToken ───────────────────────────────────────────────────────

    function test_SetInkdToken_OnlyOwner() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        assertEq(buyback.inkdToken(), address(inkd));
    }

    function test_SetInkdToken_RevertNonOwner() public {
        vm.prank(other);
        vm.expectRevert();
        buyback.setInkdToken(address(inkd));
    }

    function test_SetInkdToken_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(InkdBuyback.ZeroAddress.selector);
        buyback.setInkdToken(address(0));
    }

    // ─── setThreshold ───────────────────────────────────────────────────────

    function test_SetThreshold_OnlyOwner() public {
        vm.prank(owner);
        buyback.setThreshold(100_000_000);
        assertEq(buyback.threshold(), 100_000_000);
    }

    function test_SetThreshold_RevertNonOwner() public {
        vm.prank(other);
        vm.expectRevert();
        buyback.setThreshold(100_000_000);
    }

    // ─── setTreasury ────────────────────────────────────────────────────────

    function test_SetTreasury_OnlyOwner() public {
        vm.prank(owner);
        buyback.setTreasury(address(0x9999));
        assertEq(buyback.treasury(), address(0x9999));
    }

    function test_SetTreasury_RevertNonOwner() public {
        vm.prank(other);
        vm.expectRevert();
        buyback.setTreasury(address(0x9999));
    }

    function test_SetTreasury_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(InkdBuyback.ZeroAddress.selector);
        buyback.setTreasury(address(0));
    }

    // ─── executeBuyback errors ───────────────────────────────────────────────

    function test_ExecuteBuyback_RevertNoToken() public {
        // Mock USDC balance above threshold
        vm.mockCall(
            buyback.USDC(),
            abi.encodeWithSignature("balanceOf(address)", address(buyback)),
            abi.encode(THRESHOLD)
        );
        vm.expectRevert(InkdBuyback.InkdTokenNotSet.selector);
        buyback.executeBuyback();
    }

    function test_ExecuteBuyback_RevertBelowThreshold() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        // Mock USDC balance below threshold
        vm.mockCall(
            buyback.USDC(),
            abi.encodeWithSignature("balanceOf(address)", address(buyback)),
            abi.encode(THRESHOLD - 1)
        );
        vm.expectRevert();
        buyback.executeBuyback();
    }

    // ─── withdrawInkd ───────────────────────────────────────────────────────

    function test_WithdrawInkd_OnlyOwner() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        inkd.mint(address(buyback), 500 ether);

        vm.prank(owner);
        buyback.withdrawInkd(other, 500 ether);
        assertEq(inkd.balanceOf(other), 500 ether);
    }

    function test_WithdrawInkd_RevertNonOwner() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        inkd.mint(address(buyback), 500 ether);

        vm.prank(other);
        vm.expectRevert();
        buyback.withdrawInkd(other, 500 ether);
    }

    function test_WithdrawInkd_RevertZeroAddress() public {
        vm.prank(owner);
        buyback.setInkdToken(address(inkd));
        vm.prank(owner);
        vm.expectRevert(InkdBuyback.ZeroAddress.selector);
        buyback.withdrawInkd(address(0), 1 ether);
    }

    // ─── emergencyWithdrawUsdc ───────────────────────────────────────────────

    function test_EmergencyWithdrawUsdc_RevertNonOwner() public {
        vm.prank(other);
        vm.expectRevert();
        buyback.emergencyWithdrawUsdc(other);
    }

    // ─── inkdBalance when no token ───────────────────────────────────────────

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
        assertEq(buyback.totalUsdcSpent(),  0);
        assertEq(buyback.totalInkdBought(), 0);
        assertEq(buyback.buybackCount(),    0);
    }
}
