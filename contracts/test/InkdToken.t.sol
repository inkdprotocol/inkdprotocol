// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdToken} from "../src/InkdToken.sol";

contract InkdTokenTest is Test {
    InkdToken public token;
    address public deployer = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new InkdToken();
    }

    // ───── Basic ERC-20 ─────

    function test_name() public view {
        assertEq(token.name(), "Inkd");
    }

    function test_symbol() public view {
        assertEq(token.symbol(), "INKD");
    }

    function test_decimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_totalSupply() public view {
        assertEq(token.totalSupply(), 1_000_000_000 ether);
    }

    function test_deployerBalance() public view {
        assertEq(token.balanceOf(deployer), 1_000_000_000 ether);
    }

    function test_TOTAL_SUPPLY_constant() public view {
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000 ether);
    }

    // ───── Transfers ─────

    function test_transfer() public {
        token.transfer(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
        assertEq(token.balanceOf(deployer), 1_000_000_000 ether - 100 ether);
    }

    function test_transferFrom() public {
        token.transfer(alice, 100 ether);
        vm.prank(alice);
        token.approve(bob, 50 ether);
        vm.prank(bob);
        token.transferFrom(alice, bob, 50 ether);
        assertEq(token.balanceOf(bob), 50 ether);
        assertEq(token.balanceOf(alice), 50 ether);
    }

    function test_transferFrom_reverts_without_allowance() public {
        token.transfer(alice, 100 ether);
        vm.prank(bob);
        vm.expectRevert();
        token.transferFrom(alice, bob, 50 ether);
    }

    // ───── Burn ─────

    function test_burn() public {
        uint256 burnAmount = 500 ether;
        token.burn(burnAmount);
        assertEq(token.totalSupply(), 1_000_000_000 ether - burnAmount);
        assertEq(token.balanceOf(deployer), 1_000_000_000 ether - burnAmount);
    }

    function test_burnFrom() public {
        token.transfer(alice, 100 ether);
        vm.prank(alice);
        token.approve(deployer, 50 ether);
        token.burnFrom(alice, 50 ether);
        assertEq(token.balanceOf(alice), 50 ether);
        assertEq(token.totalSupply(), 1_000_000_000 ether - 50 ether);
    }

    // ───── Permit (EIP-2612) ─────

    function test_permit() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        token.transfer(signer, 100 ether);

        uint256 nonce = token.nonces(signer);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        bob,
                        50 ether,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);
        token.permit(signer, bob, 50 ether, deadline, v, r, s);

        assertEq(token.allowance(signer, bob), 50 ether);
    }

    function test_permit_expired_reverts() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        token.transfer(signer, 100 ether);

        uint256 nonce = token.nonces(signer);
        uint256 deadline = block.timestamp - 1; // expired

        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        bob,
                        50 ether,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);
        vm.expectRevert();
        token.permit(signer, bob, 50 ether, deadline, v, r, s);
    }
}
