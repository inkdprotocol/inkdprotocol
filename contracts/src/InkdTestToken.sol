// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title InkdTestToken — $TEST ERC-20 (beta launch token)
/// @notice Same mechanics as $INKD. 1 billion supply. Beta/testnet launch.
contract InkdTestToken is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    constructor() ERC20("Inkd Test", "TEST") ERC20Permit("Inkd Test") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
