// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Uniswap V3 SwapRouter — USDC → $INKD directly, no WETH needed
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external returns (uint256 amountOut);
}

/**
 * @title InkdBuyback
 * @notice Automated $INKD buyback contract funded by USDC protocol revenue.
 *
 * InkdTreasury sends USDC here and calls deposit().
 * Once accumulated USDC >= threshold (default $50), the contract
 * swaps all USDC → $INKD via Uniswap. $INKD stays here permanently.
 *
 * No ETH needed. No WETH wrapping. Clean USDC → $INKD path.
 *
 * Permissions:
 *   ✅ InkdTreasury  → deposit(amount) — triggers auto-buyback check
 *   ✅ Anyone        → executeBuyback() — manual trigger if threshold met
 *   ✅ Owner only    → setInkdToken, setThreshold, withdrawInkd, emergencyWithdrawUsdc
 *   ❌ No one        → sell $INKD without Multisig owner
 *
 * @dev Owner should be a Safe Multisig (2-of-2 or 2-of-3).
 */
contract InkdBuyback is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ───── Constants ─────────────────────────────────────────────────────────
    /// @dev Uniswap V3 SwapRouter on Base Mainnet
    address public constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    /// @dev USDC on Base Mainnet
    address public constant USDC        = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    /// @dev 0.3% fee tier for USDC/$INKD pool
    uint24  public constant POOL_FEE    = 3000;

    // ───── State ─────────────────────────────────────────────────────────────
    /// @notice $INKD token address — set after Clanker launch
    address public inkdToken;

    /// @notice USDC threshold to trigger buyback. Default: $50 (50_000_000)
    uint256 public threshold;

    /// @notice Trusted depositor — InkdTreasury contract
    address public treasury;

    /// @notice Total USDC spent on buybacks (lifetime)
    uint256 public totalUsdcSpent;

    /// @notice Total $INKD bought (lifetime)
    uint256 public totalInkdBought;

    /// @notice Number of buybacks executed
    uint256 public buybackCount;

    // ───── Events ────────────────────────────────────────────────────────────
    event BuybackExecuted(address indexed caller, uint256 usdcIn, uint256 inkdOut);
    event Deposited(address indexed from, uint256 amount, uint256 newBalance);
    event ThresholdSet(uint256 oldThreshold, uint256 newThreshold);
    event InkdTokenSet(address indexed token);
    event TreasurySet(address indexed treasury);

    // ───── Errors ────────────────────────────────────────────────────────────
    error BelowThreshold(uint256 balance, uint256 threshold_);
    error InkdTokenNotSet();
    error ZeroAddress();
    error NothingToWithdraw();

    // ───── Init ──────────────────────────────────────────────────────────────

    /// @param owner_      Safe Multisig address
    /// @param treasury_   InkdTreasury address (trusted depositor)
    /// @param inkdToken_  $INKD CA — pass address(0) before Clanker launch
    /// @param threshold_  USDC threshold in 6-decimal units. 0 = use default $50
    function initialize(
        address owner_,
        address treasury_,
        address inkdToken_,
        uint256 threshold_
    ) external initializer {
        if (owner_   == address(0)) revert ZeroAddress();
        if (treasury_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        treasury  = treasury_;
        inkdToken = inkdToken_;
        threshold = threshold_ > 0 ? threshold_ : 50_000_000; // $50 USDC
    }

    // ───── Core ──────────────────────────────────────────────────────────────

    /**
     * @notice Called by InkdTreasury after transferring USDC here.
     *         Auto-triggers buyback if USDC balance >= threshold.
     * @param amount  Amount of USDC just deposited (for event only)
     */
    function deposit(uint256 amount) external {
        uint256 bal = IERC20(USDC).balanceOf(address(this));
        emit Deposited(msg.sender, amount, bal);
        // Auto-trigger if ready
        if (inkdToken != address(0) && bal >= threshold) {
            _executeBuyback();
        }
    }

    /**
     * @notice Manual buyback trigger — anyone can call when threshold is met.
     * @dev Fallback in case deposit() auto-trigger was insufficient.
     */
    function executeBuyback() external onlyOwner {
        if (inkdToken == address(0)) revert InkdTokenNotSet();
        uint256 bal = IERC20(USDC).balanceOf(address(this));
        if (bal < threshold) revert BelowThreshold(bal, threshold);
        _executeBuyback();
    }

    // ───── View ──────────────────────────────────────────────────────────────

    /// @notice True if USDC balance >= threshold and inkdToken is set
    function readyToBuyback() external view returns (bool) {
        return inkdToken != address(0) &&
               IERC20(USDC).balanceOf(address(this)) >= threshold;
    }

    /// @notice Current USDC balance pending buyback
    function usdcBalance() external view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }

    /// @notice Current $INKD held in this contract
    function inkdBalance() external view returns (uint256) {
        if (inkdToken == address(0)) return 0;
        return IERC20(inkdToken).balanceOf(address(this));
    }

    // ───── Admin (Owner = Safe Multisig) ─────────────────────────────────────

    /// @notice Set $INKD token after Clanker launch
    function setInkdToken(address token_) external onlyOwner {
        if (token_ == address(0)) revert ZeroAddress();
        inkdToken = token_;
        emit InkdTokenSet(token_);
    }

    function setThreshold(uint256 newThreshold) external onlyOwner {
        emit ThresholdSet(threshold, newThreshold);
        threshold = newThreshold;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    /// @notice Emergency: withdraw $INKD. Requires Multisig.
    function withdrawInkd(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(inkdToken).safeTransfer(to, amount);
    }

    /// @notice Emergency: withdraw USDC. Requires Multisig.
    function emergencyWithdrawUsdc(address to) external onlyOwner {
        uint256 bal = IERC20(USDC).balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();
        IERC20(USDC).safeTransfer(to, bal);
    }

    // ───── Internal ──────────────────────────────────────────────────────────

    function _executeBuyback() internal {
        uint256 usdcIn = IERC20(USDC).balanceOf(address(this));
        if (usdcIn == 0 || inkdToken == address(0)) return;

        // Approve router
        IERC20(USDC).approve(SWAP_ROUTER, usdcIn);

        // Swap USDC → $INKD directly (no WETH needed!)
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn:           USDC,
            tokenOut:          inkdToken,
            fee:               POOL_FEE,
            recipient:         address(this),
            deadline:          block.timestamp + 300,
            amountIn:          usdcIn,
            amountOutMinimum:  0,
            sqrtPriceLimitX96: 0
        });

        uint256 inkdOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(params);

        totalUsdcSpent  += usdcIn;
        totalInkdBought += inkdOut;
        buybackCount    += 1;

        emit BuybackExecuted(msg.sender, usdcIn, inkdOut);
    }

    // ───── UUPS ──────────────────────────────────────────────────────────────
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
