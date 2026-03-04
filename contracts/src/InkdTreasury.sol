// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title InkdTreasury — Fee collector and auto-split for the Inkd Protocol
/// @notice Receives USDC from InkdRegistry. Splits revenue: arweave portion forwarded,
///         remaining 50% to buyback wallet, 50% held in treasury.
contract InkdTreasury is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ───── State ─────
    address public registry;
    IERC20 public usdc;

    /// @dev Arweave storage fee in USDC (6 decimals). Default: $1.00
    uint256 public arweaveFee;
    /// @dev Total service fee in USDC (6 decimals). Default: $5.00
    uint256 public serviceFee;
    /// @dev Wallet that receives arweave fee portion.
    address public arweaveWallet;
    /// @dev Wallet that receives 50% of remaining revenue for $INKD buybacks.
    address public buybackWallet;

    // ───── Events ─────
    event PaymentReceived(address indexed from, uint256 total);
    event PaymentSplit(uint256 toArweave, uint256 toBuyback, uint256 toTreasury);
    event Withdrawn(address indexed to, uint256 amount);
    event RegistrySet(address indexed registry);
    event UsdcSet(address indexed usdc);
    event ArweaveWalletSet(address indexed wallet);
    event BuybackWalletSet(address indexed wallet);
    event ArweaveFeeSet(uint256 fee);
    event ServiceFeeSet(uint256 fee);
    event Received(address indexed sender, uint256 amount);

    // ───── Errors ─────
    error OnlyRegistry();
    error ZeroAddress();
    error TransferFailed();
    error ArweaveFeeExceedsService();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param owner_         Protocol owner / multisig
    /// @param usdc_          USDC token address on this chain
    /// @param arweaveWallet_ Wallet to forward arweave fees to
    /// @param buybackWallet_ Wallet that executes $INKD buybacks
    function initialize(
        address owner_,
        address usdc_,
        address arweaveWallet_,
        address buybackWallet_
    ) external initializer {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (arweaveWallet_ == address(0)) revert ZeroAddress();
        if (buybackWallet_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        usdc = IERC20(usdc_);
        arweaveWallet = arweaveWallet_;
        buybackWallet = buybackWallet_;
        // Default fees (USDC has 6 decimals)
        arweaveFee = 1_000_000;  // $1.00
        serviceFee = 5_000_000;  // $5.00
    }

    // ───── Admin ─────

    function setRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = registry_;
        emit RegistrySet(registry_);
    }

    function setUsdc(address usdc_) external onlyOwner {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        emit UsdcSet(usdc_);
    }

    function setArweaveWallet(address wallet_) external onlyOwner {
        if (wallet_ == address(0)) revert ZeroAddress();
        arweaveWallet = wallet_;
        emit ArweaveWalletSet(wallet_);
    }

    function setBuybackWallet(address wallet_) external onlyOwner {
        if (wallet_ == address(0)) revert ZeroAddress();
        buybackWallet = wallet_;
        emit BuybackWalletSet(wallet_);
    }

    /// @notice Set arweave portion of the fee (must be <= serviceFee).
    function setArweaveFee(uint256 fee_) external onlyOwner {
        if (fee_ > serviceFee) revert ArweaveFeeExceedsService();
        arweaveFee = fee_;
        emit ArweaveFeeSet(fee_);
    }

    /// @notice Set total service fee (must be >= arweaveFee).
    function setServiceFee(uint256 fee_) external onlyOwner {
        if (fee_ < arweaveFee) revert ArweaveFeeExceedsService();
        serviceFee = fee_;
        emit ServiceFeeSet(fee_);
    }

    // ───── Core ─────

    /// @notice Called by InkdRegistry after transferring USDC here.
    ///         Splits: arweaveFee → arweaveWallet, 50% of remainder → buybackWallet,
    ///         50% of remainder → stays in treasury.
    function receivePayment(uint256 amount) external {
        if (msg.sender != registry) revert OnlyRegistry();

        uint256 toArweave = arweaveFee <= amount ? arweaveFee : amount;
        uint256 revenue = amount - toArweave;
        uint256 toBuyback = revenue / 2;
        uint256 toTreasury = revenue - toBuyback;

        if (toArweave > 0 && arweaveWallet != address(0)) {
            usdc.safeTransfer(arweaveWallet, toArweave);
        }
        if (toBuyback > 0) {
            usdc.safeTransfer(buybackWallet, toBuyback);
        }
        // toTreasury stays in this contract

        emit PaymentReceived(msg.sender, amount);
        emit PaymentSplit(toArweave, toBuyback, toTreasury);
    }

    /// @notice View current fee split breakdown.
    function feeSplit() external view returns (uint256 toArweave, uint256 toBuyback, uint256 toTreasury) {
        toArweave = arweaveFee;
        uint256 revenue = serviceFee > arweaveFee ? serviceFee - arweaveFee : 0;
        toBuyback = revenue / 2;
        toTreasury = revenue - toBuyback;
    }

    /// @notice Withdraw USDC from treasury. Owner only.
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Withdraw any ERC20 (emergency). Owner only.
    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Accept ETH directly (fallback — for future ETH fee support).
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
