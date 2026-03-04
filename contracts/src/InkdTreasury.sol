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

    /// @notice Service markup in basis points. Default: 2000 = 20%
    uint256 public markupBps;

    /// @notice Default flat fee for direct on-chain calls (no dynamic pricing). Default: $5.00
    uint256 public defaultFee;

    /// @notice Total USDC settled (lifetime)
    uint256 public totalSettled;

    // ───── Events ────────────────────────────────────────────────────────────
    event Settled(address indexed settler, uint256 total, uint256 arweaveCost, uint256 toBuyback, uint256 toTreasury);
    event Withdrawn(address indexed to, uint256 amount);
    event SettlerSet(address indexed settler);
    event ArweaveWalletSet(address indexed wallet);
    event BuybackContractSet(address indexed buyback);
    event MarkupBpsSet(uint256 bps);

    // ───── Errors ────────────────────────────────────────────────────────────
    error Unauthorized();
    error ZeroAddress();

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
        markupBps       = 2000;      // 20%
        defaultFee      = 5_000_000; // $5.00 USDC — for direct on-chain Registry calls
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
    /// @notice Called by InkdRegistry (legacy on-chain flow).
    ///         Arweave cost assumed = 0, full amount treated as markup revenue.
    function receivePayment(uint256 amount) external onlyTrusted { _split(amount, 0); }

    /**
     * @notice Settle an X402 USDC payment after Arweave upload.
     * @param total        Total USDC paid by agent (arweaveCost × 1.20)
     * @param arweaveCost  Actual Arweave upload cost in USDC (6 decimals)
     *
     * Split:
     *   arweaveCost        → arweaveWallet  (exact Arweave cost)
     *   (total-arweaveCost) × 50% → InkdBuyback
     *   (total-arweaveCost) × 50% → treasury
     */
    function settle(uint256 total, uint256 arweaveCost) external onlyTrusted {
        _split(total, arweaveCost);
    }

    function _split(uint256 total, uint256 arweaveCost) internal {
        uint256 toArweave  = arweaveCost <= total ? arweaveCost : total;
        uint256 revenue    = total - toArweave;
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

        totalSettled += total;
        emit Settled(msg.sender, total, toArweave, toBuyback, toTreasury);
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

    /// @notice Update service markup. Max 5000 bps (50%). Owner only.
    function setMarkupBps(uint256 bps) external onlyOwner {
        require(bps <= 5000, "Max 50%");
        markupBps = bps;
        emit MarkupBpsSet(bps);
    }

    /// @notice Calculate total charge for a given Arweave cost
    function calculateTotal(uint256 arweaveCost) external view returns (uint256) {
        return arweaveCost + (arweaveCost * markupBps / 10000);
    }

    /// @notice Alias for Registry backward-compat — returns defaultFee
    function serviceFee() external view returns (uint256) { return defaultFee; }

    function setDefaultFee(uint256 fee_) external onlyOwner {
        defaultFee = fee_;
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
