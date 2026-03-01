// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title InkdTreasury — Fee collector for the Inkd Protocol
/// @notice Receives 0.001 ETH per version push from InkdRegistry.
contract InkdTreasury is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address public registry;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event RegistrySet(address indexed registry);
    event Received(address indexed sender, uint256 amount);

    error OnlyRegistry();
    error TransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    /// @notice Set the registry address. Only the registry can deposit via `deposit()`.
    function setRegistry(address registry_) external onlyOwner {
        registry = registry_;
        emit RegistrySet(registry_);
    }

    /// @notice Called by InkdRegistry when a version is pushed.
    function deposit() external payable {
        if (msg.sender != registry) revert OnlyRegistry();
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw ETH to a given address. Owner only.
    function withdraw(address to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    /// @notice Accept ETH directly (fallback).
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
