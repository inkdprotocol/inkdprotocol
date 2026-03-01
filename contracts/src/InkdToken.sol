// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title InkdToken — $INKD ERC-20
/// @notice 1 billion supply minted to deployer. Burnable with EIP-2612 permit.
contract InkdToken is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    constructor() ERC20("Inkd", "INKD") ERC20Permit("Inkd") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
