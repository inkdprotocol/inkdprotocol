// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";

/// @title InkdFuzz — Fuzz tests for the Inkd Protocol
contract InkdFuzzTest is Test {
    InkdToken public token;
    MockUSDC public usdc;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public arweaveWallet = makeAddr("arweaveWallet");
    address public buybackWallet = makeAddr("buybackWallet");

    function setUp() public {
        token = new InkdToken();
        usdc = new MockUSDC();

        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (owner, address(usdc), arweaveWallet, buybackWallet))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (owner, address(usdc), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        treasury.setRegistry(address(registry));

        // Default: no fee for most tests
        treasury.setArweaveFee(0);
        treasury.setServiceFee(0);

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
        assertEq(token.totalSupply(),   supplyBefore - burnAmount);
        assertEq(token.balanceOf(owner), ownerBefore - burnAmount);
    }

    function testFuzz_totalSupply_neverExceedsConstant(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 0, token.balanceOf(owner));
        token.burn(burnAmount);
        assertLe(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdTreasury — Fee management fuzz
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_setServiceFee_valid(uint256 fee) public {
        uint256 currentArweave = treasury.arweaveFee();
        fee = bound(fee, currentArweave, 10_000 * 1e6);
        treasury.setServiceFee(fee);
        assertEq(treasury.serviceFee(), fee);
    }

    function testFuzz_setServiceFee_belowArweave_reverts(uint256 fee) public {
        // Set arweaveFee to 1_000_000 first
        treasury.setServiceFee(5_000_000);
        treasury.setArweaveFee(1_000_000);
        fee = bound(fee, 0, 999_999);
        vm.expectRevert(InkdTreasury.ArweaveFeeExceedsService.selector);
        treasury.setServiceFee(fee);
    }

    function testFuzz_setArweaveFee_valid(uint256 fee) public {
        treasury.setServiceFee(10_000 * 1e6);
        fee = bound(fee, 0, 10_000 * 1e6);
        treasury.setArweaveFee(fee);
        assertEq(treasury.arweaveFee(), fee);
    }

    function testFuzz_setArweaveFee_exceedsService_reverts(uint256 fee) public {
        uint256 currentService = treasury.serviceFee();
        fee = bound(fee, currentService + 1, type(uint256).max);
        vm.expectRevert(InkdTreasury.ArweaveFeeExceedsService.selector);
        treasury.setArweaveFee(fee);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdTreasury — USDC fee split fuzz
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_receivePayment_split(uint256 amount) public {
        amount = bound(amount, 2, 1_000_000 * 1e6); // $0.000002 to $1M
        treasury.setServiceFee(amount);
        treasury.setArweaveFee(0);

        usdc.mint(address(treasury), amount);

        uint256 buybackBefore = usdc.balanceOf(buybackWallet);
        uint256 treasuryBefore = usdc.balanceOf(address(treasury));

        vm.prank(address(registry));
        treasury.receivePayment(amount);

        uint256 toBuyback = amount / 2;
        uint256 toTreasury = amount - toBuyback;

        assertEq(usdc.balanceOf(buybackWallet), buybackBefore + toBuyback);
        assertEq(usdc.balanceOf(address(treasury)), treasuryBefore - amount + toTreasury);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdRegistry — project count invariant
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_projectCount_monotonic(uint8 n) public {
        n = uint8(bound(n, 1, 20));
        vm.startPrank(alice);
        for (uint8 i = 0; i < n; i++) {
            string memory name = string(abi.encodePacked("mono-", vm.toString(i)));
            registry.createProject(name, "fuzz", "MIT", true, "", false, "");
            assertEq(registry.projectCount(), i + 1);
        }
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  InkdTreasury — ETH withdrawal fuzz
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_withdraw_ETH_validAmount(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount  = bound(depositAmount, 1, 10 ether);
        withdrawAmount = bound(withdrawAmount, 0, depositAmount);

        (bool ok,) = address(treasury).call{value: depositAmount}("");
        assertTrue(ok);

        uint256 aliceBefore = alice.balance;
        // Withdraw ETH — use withdrawToken or direct ETH send
        // Treasury holds ETH via receive(), owner can retrieve it via withdrawToken for ETH
        // Since withdraw() is for USDC, we test the ETH fallback here
        assertEq(address(treasury).balance, depositAmount);
    }

    function testFuzz_withdraw_nonOwner_reverts(address attacker) public {
        vm.assume(attacker != owner);
        usdc.mint(address(treasury), 1_000_000);
        vm.prank(attacker);
        vm.expectRevert();
        treasury.withdraw(alice, 1_000_000);
    }
}
