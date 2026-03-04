// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Minimal interface to trigger Buyback deposit
interface IInkdBuyback {
    function deposit(uint256 amount) external;
}

/// @title InkdTreasury — X402 USDC fee collector and auto-split
///
/// @notice Payment flow:
///   1. Agent pays $5 USDC via X402 → USDC lands here directly
///   2. API server (settler) calls settle(5_000_000) after X402 verification
///   3. Treasury splits: $1 → arweaveWallet, $2 → InkdBuyback, $2 → stays here
///   4. InkdBuyback auto-buys $INKD when it accumulates ≥ threshold
///
/// @dev settler = trusted server wallet address (set by owner/multisig)
contract InkdTreasury is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ───── State ─────────────────────────────────────────────────────────────
    IERC20  public usdc;

    /// @notice InkdRegistry — trusted caller for on-chain flow
    address public registry;

    /// @notice API server wallet — trusted caller for X402 flow
    address public settler;

    /// @notice Arweave wallet receives $1 per payment for storage costs
    address public arweaveWallet;

    /// @notice InkdBuyback contract address
    address public buybackContract;

    /// @dev Arweave portion in USDC (6 decimals). Default: $1.00
    uint256 public arweaveFee;

    /// @dev Total fee agents pay per action. Default: $5.00
    uint256 public serviceFee;

    /// @notice Total USDC settled (lifetime)
    uint256 public totalSettled;

    // ───── Events ────────────────────────────────────────────────────────────
    event Settled(address indexed settler, uint256 amount, uint256 toArweave, uint256 toBuyback, uint256 toTreasury);
    event Withdrawn(address indexed to, uint256 amount);
    event SettlerSet(address indexed settler);
    event ArweaveWalletSet(address indexed wallet);
    event BuybackContractSet(address indexed buyback);
    event ArweaveFeeSet(uint256 fee);
    event ServiceFeeSet(uint256 fee);

    // ───── Errors ────────────────────────────────────────────────────────────
    error Unauthorized();
    error ZeroAddress();
    error ArweaveFeeExceedsService();

    // ───── Modifiers ─────────────────────────────────────────────────────────
    /// @dev Callable by settler (API server) OR registry (on-chain direct flow)
    modifier onlyTrusted() {
        if (msg.sender != settler && msg.sender != registry) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    // ───── Init ──────────────────────────────────────────────────────────────

    /// @param owner_          Protocol owner / Safe Multisig
    /// @param usdc_           USDC address on Base (6 decimals)
    /// @param settler_        API server wallet — calls settle() after X402 payment
    /// @param arweaveWallet_  Receives $1 per payment for Arweave storage
    /// @param buybackContract_ InkdBuyback contract — receives $2 per payment
    function initialize(
        address owner_,
        address usdc_,
        address settler_,
        address arweaveWallet_,
        address buybackContract_
    ) external initializer {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (settler_ == address(0)) revert ZeroAddress();
        if (arweaveWallet_ == address(0)) revert ZeroAddress();
        if (buybackContract_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        usdc            = IERC20(usdc_);
        settler         = settler_;
        arweaveWallet   = arweaveWallet_;
        buybackContract = buybackContract_;
        arweaveFee      = 1_000_000;  // $1.00 USDC
        serviceFee      = 5_000_000;  // $5.00 USDC
    }

    // ───── Core: X402 Settlement ──────────────────────────────────────────────

    /**
     * @notice Split an incoming X402 USDC payment.
     * @dev Called by the API server (settler) after X402 verifies payment landed here.
     *      USDC must already be in this contract before calling.
     *
     * Split (default $5 total):
     *   $1.00 → arweaveWallet  (Arweave storage cost)
     *   $2.00 → InkdBuyback    (auto-buys $INKD)
     *   $2.00 → stays here     (treasury revenue)
     *
     * @param amount  USDC amount to settle (6 decimals, e.g. 5_000_000 = $5)
     */
    /// @notice Alias for backward compatibility with InkdRegistry
    function receivePayment(uint256 amount) external onlyTrusted { _split(amount); }

    function settle(uint256 amount) external onlyTrusted {
        _split(amount);
    }

    function _split(uint256 amount) internal {
        uint256 toArweave  = arweaveFee <= amount ? arweaveFee : amount;
        uint256 revenue    = amount - toArweave;
        uint256 toBuyback  = revenue / 2;
        uint256 toTreasury = revenue - toBuyback;

        if (toArweave > 0 && arweaveWallet != address(0)) {
            usdc.safeTransfer(arweaveWallet, toArweave);
        }
        if (toBuyback > 0 && buybackContract != address(0)) {
            usdc.safeTransfer(buybackContract, toBuyback);
            // Notify buyback contract — only call if it's actually a contract
            address _buyback = buybackContract;
            uint256 codeSize;
            assembly { codeSize := extcodesize(_buyback) }
            if (codeSize > 0) {
                try IInkdBuyback(_buyback).deposit(toBuyback) {} catch {}
            }
        }

        totalSettled += amount;
        emit Settled(msg.sender, amount, toArweave, toBuyback, toTreasury);
    }

    // ───── Admin ─────────────────────────────────────────────────────────────

    function setRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = registry_;
    }

    function setSettler(address settler_) external onlyOwner {
        if (settler_ == address(0)) revert ZeroAddress();
        settler = settler_;
        emit SettlerSet(settler_);
    }

    function setArweaveWallet(address wallet_) external onlyOwner {
        if (wallet_ == address(0)) revert ZeroAddress();
        arweaveWallet = wallet_;
        emit ArweaveWalletSet(wallet_);
    }

    function setBuybackContract(address buyback_) external onlyOwner {
        if (buyback_ == address(0)) revert ZeroAddress();
        buybackContract = buyback_;
        emit BuybackContractSet(buyback_);
    }

    function setArweaveFee(uint256 fee_) external onlyOwner {
        if (fee_ > serviceFee) revert ArweaveFeeExceedsService();
        arweaveFee = fee_;
        emit ArweaveFeeSet(fee_);
    }

    function setServiceFee(uint256 fee_) external onlyOwner {
        if (fee_ < arweaveFee) revert ArweaveFeeExceedsService();
        serviceFee = fee_;
        emit ServiceFeeSet(fee_);
    }

    /// @notice View fee split breakdown
    function feeSplit() external view returns (uint256 toArweave, uint256 toBuyback, uint256 toTreasury) {
        toArweave  = arweaveFee;
        uint256 revenue = serviceFee > arweaveFee ? serviceFee - arweaveFee : 0;
        toBuyback  = revenue / 2;
        toTreasury = revenue - toBuyback;
    }

    /// @notice Withdraw USDC treasury balance. Owner only (Multisig).
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Emergency: withdraw any ERC20. Owner only.
    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    receive() external payable {}

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
