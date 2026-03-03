// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdTestToken} from "../src/InkdTestToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/// @title InkdTestToken test suite
/// @notice Tests for $TEST ERC-20 (beta launch token). 0% → 100% coverage.
contract InkdTestTokenTest is Test {
    InkdTestToken public token;
    address public deployer = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    // EIP-2612 permit domain & type hashes (reproduced locally for permit tests)
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        token = new InkdTestToken();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Metadata
    // ═══════════════════════════════════════════════════════════════════════

    function test_name() public view {
        assertEq(token.name(), "Inkd Test");
    }

    function test_symbol() public view {
        assertEq(token.symbol(), "TEST");
    }

    function test_decimals() public view {
        assertEq(token.decimals(), 18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Supply
    // ═══════════════════════════════════════════════════════════════════════

    function test_totalSupply() public view {
        assertEq(token.totalSupply(), 1_000_000_000 ether);
    }

    function test_totalSupply_constant() public view {
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000 ether);
    }

    function test_initialBalance_deployer() public view {
        // Deployer (address(this)) receives full TOTAL_SUPPLY on construction
        assertEq(token.balanceOf(deployer), 1_000_000_000 ether);
    }

    function test_totalSupply_matches_constant() public view {
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ERC-20 — Transfer
    // ═══════════════════════════════════════════════════════════════════════

    function test_transfer() public {
        token.transfer(alice, 1000 ether);
        assertEq(token.balanceOf(alice), 1000 ether);
        assertEq(token.balanceOf(deployer), 1_000_000_000 ether - 1000 ether);
    }

    function test_transfer_emitsTransfer() public {
        vm.expectEmit(true, true, false, true);
        emit IERC20.Transfer(deployer, alice, 500 ether);
        token.transfer(alice, 500 ether);
    }

    function test_transfer_reverts_insufficientBalance() public {
        vm.prank(alice); // alice has 0 balance
        vm.expectRevert();
        token.transfer(bob, 1 ether);
    }

    function test_transfer_zeroValue() public {
        uint256 balBefore = token.balanceOf(deployer);
        token.transfer(alice, 0);
        assertEq(token.balanceOf(deployer), balBefore);
        assertEq(token.balanceOf(alice), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ERC-20 — Approve / TransferFrom
    // ═══════════════════════════════════════════════════════════════════════

    function test_approve() public {
        token.approve(alice, 200 ether);
        assertEq(token.allowance(deployer, alice), 200 ether);
    }

    function test_approve_emitsApproval() public {
        vm.expectEmit(true, true, false, true);
        emit IERC20.Approval(deployer, alice, 100 ether);
        token.approve(alice, 100 ether);
    }

    function test_transferFrom() public {
        token.approve(alice, 300 ether);
        vm.prank(alice);
        token.transferFrom(deployer, bob, 300 ether);
        assertEq(token.balanceOf(bob), 300 ether);
        assertEq(token.allowance(deployer, alice), 0);
    }

    function test_transferFrom_reverts_insufficientAllowance() public {
        token.approve(alice, 50 ether);
        vm.prank(alice);
        vm.expectRevert();
        token.transferFrom(deployer, bob, 51 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ERC-20Burnable
    // ═══════════════════════════════════════════════════════════════════════

    function test_burn() public {
        uint256 supplyBefore = token.totalSupply();
        token.burn(10 ether);
        assertEq(token.totalSupply(), supplyBefore - 10 ether);
        assertEq(token.balanceOf(deployer), supplyBefore - 10 ether);
    }

    function test_burn_emitsTransfer() public {
        vm.expectEmit(true, true, false, true);
        emit IERC20.Transfer(deployer, address(0), 5 ether);
        token.burn(5 ether);
    }

    function test_burn_reverts_insufficientBalance() public {
        vm.prank(alice); // alice has 0 tokens
        vm.expectRevert();
        token.burn(1 ether);
    }

    function test_burnFrom() public {
        token.approve(alice, 50 ether);
        uint256 supplyBefore = token.totalSupply();
        vm.prank(alice);
        token.burnFrom(deployer, 50 ether);
        assertEq(token.totalSupply(), supplyBefore - 50 ether);
        assertEq(token.allowance(deployer, alice), 0);
    }

    function test_burnFrom_reverts_insufficientAllowance() public {
        token.approve(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert();
        token.burnFrom(deployer, 11 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ERC-2612 Permit
    // ═══════════════════════════════════════════════════════════════════════

    function test_permit_domainSeparator_nonZero() public view {
        // Verify the domain separator is set and non-zero
        bytes32 sep = IERC20Permit(address(token)).DOMAIN_SEPARATOR();
        assertNotEq(sep, bytes32(0));
    }

    function test_permit_nonce_startsAtZero() public view {
        assertEq(IERC20Permit(address(token)).nonces(deployer), 0);
    }

    function test_permit_allowsGaslessApproval() public {
        // Generate a signer with known private key
        uint256 privKey = 0xA11CE;
        address signer = vm.addr(privKey);
        token.transfer(signer, 100 ether);

        uint256 value = 50 ether;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = IERC20Permit(address(token)).nonces(signer);

        bytes32 domainSep = IERC20Permit(address(token)).DOMAIN_SEPARATOR();
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, signer, alice, value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);

        IERC20Permit(address(token)).permit(signer, alice, value, deadline, v, r, s);

        assertEq(token.allowance(signer, alice), value);
        assertEq(IERC20Permit(address(token)).nonces(signer), 1);
    }

    function test_permit_reverts_expiredDeadline() public {
        uint256 privKey = 0xB0B;
        address signer = vm.addr(privKey);

        uint256 value = 1 ether;
        uint256 deadline = block.timestamp - 1; // expired
        uint256 nonce = IERC20Permit(address(token)).nonces(signer);

        bytes32 domainSep = IERC20Permit(address(token)).DOMAIN_SEPARATOR();
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, signer, alice, value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);

        vm.expectRevert();
        IERC20Permit(address(token)).permit(signer, alice, value, deadline, v, r, s);
    }

    function test_permit_reverts_wrongSigner() public {
        uint256 privKey = 0xCAFE;
        address signer = vm.addr(privKey);
        uint256 wrongPrivKey = 0xDEAD;

        uint256 value = 1 ether;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = IERC20Permit(address(token)).nonces(signer);

        bytes32 domainSep = IERC20Permit(address(token)).DOMAIN_SEPARATOR();
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, signer, alice, value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));

        // Sign with wrong key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivKey, digest);

        vm.expectRevert();
        IERC20Permit(address(token)).permit(signer, alice, value, deadline, v, r, s);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Fuzz
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_transfer_roundtrip(uint256 amount) public {
        amount = bound(amount, 0, token.TOTAL_SUPPLY());
        token.transfer(alice, amount);
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(deployer), token.TOTAL_SUPPLY() - amount);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function testFuzz_burn_reducesSupply(uint256 amount) public {
        amount = bound(amount, 0, token.TOTAL_SUPPLY());
        uint256 supplyBefore = token.totalSupply();
        token.burn(amount);
        assertEq(token.totalSupply(), supplyBefore - amount);
    }
}
