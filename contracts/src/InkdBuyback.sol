// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal Uniswap V3/V4 router interface for ETH → token swaps
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/// @dev WETH interface — needed to wrap ETH before swap
interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title InkdBuyback
 * @notice Automated $INKD buyback contract.
 *
 * Revenue (ETH) flows in from the Treasury.
 * Once the balance hits the threshold (default: $100 in ETH),
 * anyone can call `executeBuyback()` to swap all ETH for $INKD.
 * $INKD stays in this contract forever — cannot be sold or transferred
 * without Multisig (owner) approval.
 *
 * Permissions:
 *   ✅ Anyone     → call executeBuyback() when threshold is met
 *   ✅ Anyone     → send ETH to this contract
 *   ✅ Owner only → set threshold, set inkdToken, withdraw ETH (emergency)
 *   ✅ Owner only → transfer or sell $INKD (requires multisig as owner)
 *   ❌ No one     → sell $INKD without owner
 *   ❌ No one     → buy other tokens
 *
 * @dev Owner should be a Safe Multisig (2-of-2 or 2-of-3).
 *      inkdToken address is set after Clanker launch.
 */
contract InkdBuyback is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    // ───── Constants ────────────────────────────────────────────────────────
    /// @dev Uniswap V3 SwapRouter on Base Mainnet
    address public constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    /// @dev WETH on Base Mainnet
    address public constant WETH        = 0x4200000000000000000000000000000000000006;
    /// @dev Uniswap pool fee tier (0.3%)
    uint24  public constant POOL_FEE    = 3000;

    // ───── State ─────────────────────────────────────────────────────────────
    /// @notice $INKD token address — set after Clanker launch
    address public inkdToken;

    /// @notice ETH threshold to trigger buyback (default: 0.03 ETH ≈ $100)
    uint256 public threshold;

    /// @notice Maximum slippage in basis points (default: 200 = 2%)
    uint256 public maxSlippageBps;

    /// @notice Total ETH spent on buybacks (lifetime)
    uint256 public totalEthSpent;

    /// @notice Total $INKD bought (lifetime)
    uint256 public totalInkdBought;

    /// @notice Number of buybacks executed
    uint256 public buybackCount;

    // ───── Events ────────────────────────────────────────────────────────────
    event BuybackExecuted(address indexed caller, uint256 ethIn, uint256 inkdOut);
    event ThresholdSet(uint256 oldThreshold, uint256 newThreshold);
    event InkdTokenSet(address indexed token);
    event EthReceived(address indexed sender, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ───── Errors ────────────────────────────────────────────────────────────
    error BelowThreshold(uint256 balance, uint256 threshold_);
    error InkdTokenNotSet();
    error ZeroAddress();
    error SwapFailed();
    error NothingToWithdraw();

    // ───── Init ──────────────────────────────────────────────────────────────

    /// @param owner_       Multisig address (Safe 2-of-2)
    /// @param inkdToken_   $INKD token CA — pass address(0) before Clanker launch
    /// @param threshold_   ETH threshold in wei (default: 0.03 ETH)
    function initialize(
        address owner_,
        address inkdToken_,
        uint256 threshold_
    ) external initializer {
        if (owner_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        inkdToken     = inkdToken_;
        threshold     = threshold_ > 0 ? threshold_ : 0.03 ether;
        maxSlippageBps = 200; // 2%
    }

    // ───── Receive ETH ───────────────────────────────────────────────────────

    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }

    // ───── Core: Buyback ─────────────────────────────────────────────────────

    /**
     * @notice Execute $INKD buyback if ETH balance >= threshold.
     * @dev Public — anyone can call this. Caller pays gas.
     *      Consider calling this via a keeper or MEV bot for automation.
     */
    function executeBuyback() external {
        if (inkdToken == address(0)) revert InkdTokenNotSet();

        uint256 balance = address(this).balance;
        if (balance < threshold) revert BelowThreshold(balance, threshold);

        // Wrap ETH → WETH
        IWETH(WETH).deposit{value: balance}();

        // Approve router to spend WETH
        IWETH(WETH).approve(SWAP_ROUTER, balance);

        // Calculate minimum output with slippage protection
        // (amountOutMinimum = 0 is acceptable for buyback-only contracts
        //  since the INKD stays here and we don't care about exact amount)
        uint256 amountOutMinimum = 0;

        // Swap WETH → $INKD
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn:           WETH,
            tokenOut:          inkdToken,
            fee:               POOL_FEE,
            recipient:         address(this), // $INKD stays in this contract
            deadline:          block.timestamp + 300,
            amountIn:          balance,
            amountOutMinimum:  amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        uint256 inkdOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(params);

        // Track stats
        totalEthSpent   += balance;
        totalInkdBought += inkdOut;
        buybackCount    += 1;

        emit BuybackExecuted(msg.sender, balance, inkdOut);
    }

    // ───── View ──────────────────────────────────────────────────────────────

    /// @notice True if ETH balance >= threshold and inkdToken is set
    function readyToBuyback() external view returns (bool) {
        return inkdToken != address(0) && address(this).balance >= threshold;
    }

    /// @notice Current ETH balance in this contract
    function ethBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Current $INKD balance held in this contract
    function inkdBalance() external view returns (uint256) {
        if (inkdToken == address(0)) return 0;
        return IERC20(inkdToken).balanceOf(address(this));
    }

    // ───── Admin (Owner = Safe Multisig) ─────────────────────────────────────

    /// @notice Set $INKD token address after Clanker launch
    function setInkdToken(address token_) external onlyOwner {
        if (token_ == address(0)) revert ZeroAddress();
        inkdToken = token_;
        emit InkdTokenSet(token_);
    }

    /// @notice Update buyback threshold
    function setThreshold(uint256 newThreshold) external onlyOwner {
        emit ThresholdSet(threshold, newThreshold);
        threshold = newThreshold;
    }

    /// @notice Update max slippage (in basis points, e.g. 200 = 2%)
    function setMaxSlippage(uint256 bps) external onlyOwner {
        maxSlippageBps = bps;
    }

    /**
     * @notice Emergency ETH withdrawal — requires Multisig.
     * @dev Only callable by owner (Safe Multisig).
     *      This is the ONLY way ETH leaves without a buyback.
     */
    function emergencyWithdrawEth(address to) external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToWithdraw();
        (bool ok,) = to.call{value: bal}("");
        require(ok, "Transfer failed");
        emit EmergencyWithdraw(to, bal);
    }

    /**
     * @notice Transfer $INKD out — requires Multisig.
     * @dev Only callable by owner (Safe Multisig).
     *      This is the ONLY way $INKD leaves this contract.
     */
    function withdrawInkd(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(inkdToken).transfer(to, amount);
    }

    // ───── UUPS ──────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
