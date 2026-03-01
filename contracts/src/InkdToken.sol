// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  InkdToken
 * @author Inkd Protocol
 * @notice The access pass and vessel for the Inkd Protocol on Base.
 *
 *         Every file is a token. Every wallet is a brain.
 *
 *         You must OWN an InkdToken to use the protocol.
 *         Each InkdToken can hold multiple inscriptions (files/data on Arweave).
 *         Transfer your InkdToken = everything inscribed moves with it.
 *         Burn your InkdToken = everything inscribed is gone forever.
 *
 * @dev    UUPS-upgradeable ERC-721 with ERC-2981 royalties, dynamic on-chain SVG,
 *         configurable mint price, max supply of 10,000, and batch mint support.
 */

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721RoyaltyUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721RoyaltyUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract InkdToken is
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721RoyaltyUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    using Strings for uint256;
    using Strings for address;

    // ─── Constants ────────────────────────────────────────────────────────

    /// @notice Maximum supply of InkdTokens.
    uint256 public constant MAX_SUPPLY = 10_000;

    /// @notice Maximum tokens per batch mint.
    uint256 public constant MAX_BATCH_SIZE = 10;

    // ─── Storage ──────────────────────────────────────────────────────────

    /// @notice Next token ID to mint.
    uint256 public nextTokenId;

    /// @notice Current mint price in wei.
    uint256 public mintPrice;

    /// @notice Timestamp when each token was minted.
    mapping(uint256 => uint256) public mintedAt;

    /// @notice Number of inscriptions on each token.
    mapping(uint256 => uint256) public inscriptionCount;

    /// @notice Address of the InkdVault contract (set after deployment).
    address public vault;

    /// @notice Accumulated mint revenue available for withdrawal.
    uint256 public mintRevenue;

    // ─── Events ───────────────────────────────────────────────────────────

    /// @notice Emitted when a new InkdToken is minted.
    event TokenMinted(uint256 indexed tokenId, address indexed owner, uint256 price);

    /// @notice Emitted when multiple tokens are minted in one transaction.
    event BatchMinted(uint256[] tokenIds, address indexed owner, uint256 totalPrice);

    /// @notice Emitted when the mint price is updated.
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);

    /// @notice Emitted when the vault address is set.
    event VaultUpdated(address indexed oldVault, address indexed newVault);

    /// @notice Emitted when an inscription count changes (called by vault).
    event InscriptionCountUpdated(uint256 indexed tokenId, uint256 newCount);

    /// @notice Emitted when mint revenue is withdrawn.
    event RevenueWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────

    /// @dev Max supply has been reached.
    error MaxSupplyReached();

    /// @dev Batch size exceeds maximum.
    error BatchTooLarge(uint256 requested, uint256 max);

    /// @dev Insufficient ETH sent for minting.
    error InsufficientPayment(uint256 required, uint256 sent);

    /// @dev Only the vault contract can call this function.
    error OnlyVault();

    /// @dev ETH transfer failed.
    error TransferFailed();

    /// @dev No revenue to withdraw.
    error NoRevenue();

    /// @dev Zero address not allowed.
    error ZeroAddress();

    // ─── Modifiers ────────────────────────────────────────────────────────

    /// @dev Restricts function access to the vault contract.
    modifier onlyVault() {
        _onlyVault();
        _;
    }

    function _onlyVault() internal view {
        if (msg.sender != vault) revert OnlyVault();
    }

    // ─── Initializer ──────────────────────────────────────────────────────

    /// @notice Initializes the InkdToken contract.
    /// @param _owner Contract owner who receives royalties and can configure.
    /// @param _mintPrice Initial mint price in wei.
    /// @param _royaltyBps Royalty percentage in basis points (e.g. 500 = 5%).
    function initialize(
        address _owner,
        uint256 _mintPrice,
        uint96 _royaltyBps
    ) public initializer {
        if (_owner == address(0)) revert ZeroAddress();

        __ERC721_init("Inkd Token", "INKD");
        __ERC721Enumerable_init();
        __ERC721Royalty_init();
        __Ownable_init(_owner);

        mintPrice = _mintPrice;
        _setDefaultRoyalty(_owner, _royaltyBps);

        emit MintPriceUpdated(0, _mintPrice);
    }

    // ─── Minting ──────────────────────────────────────────────────────────

    /// @notice Mint a single InkdToken.
    /// @return tokenId The newly minted token's ID.
    function mint() external payable nonReentrant returns (uint256 tokenId) {
        if (msg.value < mintPrice) revert InsufficientPayment(mintPrice, msg.value);
        if (nextTokenId >= MAX_SUPPLY) revert MaxSupplyReached();

        tokenId = nextTokenId++;
        mintedAt[tokenId] = block.timestamp;
        mintRevenue += msg.value;

        _safeMint(msg.sender, tokenId);

        emit TokenMinted(tokenId, msg.sender, msg.value);
    }

    /// @notice Mint multiple InkdTokens in a single transaction (max 10).
    /// @param quantity Number of tokens to mint.
    /// @return tokenIds Array of newly minted token IDs.
    function batchMint(uint256 quantity) external payable nonReentrant returns (uint256[] memory tokenIds) {
        if (quantity > MAX_BATCH_SIZE) revert BatchTooLarge(quantity, MAX_BATCH_SIZE);
        uint256 totalCost = mintPrice * quantity;
        if (msg.value < totalCost) revert InsufficientPayment(totalCost, msg.value);
        if (nextTokenId + quantity > MAX_SUPPLY) revert MaxSupplyReached();

        tokenIds = new uint256[](quantity);
        mintRevenue += msg.value;

        for (uint256 i; i < quantity; ) {
            uint256 tokenId = nextTokenId++;
            tokenIds[i] = tokenId;
            mintedAt[tokenId] = block.timestamp;

            _safeMint(msg.sender, tokenId);

            unchecked { ++i; }
        }

        emit BatchMinted(tokenIds, msg.sender, msg.value);
    }

    // ─── Vault Integration ────────────────────────────────────────────────

    /// @notice Update the inscription count for a token. Only callable by vault.
    /// @param tokenId The token to update.
    /// @param newCount The new inscription count.
    function setInscriptionCount(uint256 tokenId, uint256 newCount) external onlyVault {
        inscriptionCount[tokenId] = newCount;
        emit InscriptionCountUpdated(tokenId, newCount);
    }

    // ─── On-Chain SVG Metadata ────────────────────────────────────────────

    /// @notice Returns fully on-chain token metadata with dynamic SVG.
    /// @param tokenId The token to query.
    /// @return Base64-encoded JSON metadata URI.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        uint256 count = inscriptionCount[tokenId];
        uint256 minted = mintedAt[tokenId];
        address tokenOwner = ownerOf(tokenId);

        string memory svg = _generateSvg(tokenId, count, minted);
        string memory attributes = _generateAttributes(tokenId, count, minted, tokenOwner);

        string memory json = string(abi.encodePacked(
            '{"name":"Inkd #', tokenId.toString(),
            '","description":"Inkd Token - the ownership vessel for AI agent data on Base. This token holds ',
            count.toString(), ' inscriptions.',
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","attributes":', attributes, '}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    /// @notice Check if an address holds at least one InkdToken.
    /// @param wallet The address to check.
    /// @return True if the address owns at least one InkdToken.
    function isInkdHolder(address wallet) external view returns (bool) {
        return balanceOf(wallet) > 0;
    }

    /// @notice Get all token IDs owned by an address.
    /// @param wallet The address to query.
    /// @return tokenIds Array of owned token IDs.
    function getTokensByOwner(address wallet) external view returns (uint256[] memory tokenIds) {
        uint256 count = balanceOf(wallet);
        tokenIds = new uint256[](count);
        for (uint256 i; i < count; ) {
            tokenIds[i] = tokenOfOwnerByIndex(wallet, i);
            unchecked { ++i; }
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    /// @notice Update the mint price.
    /// @param newPrice New price in wei.
    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
    }

    /// @notice Set the vault contract address.
    /// @param _vault Address of the InkdVault contract.
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        address oldVault = vault;
        vault = _vault;
        emit VaultUpdated(oldVault, _vault);
    }

    /// @notice Update the default royalty configuration.
    /// @param receiver Address to receive royalties.
    /// @param feeBps Royalty percentage in basis points.
    function setRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBps);
    }

    /// @notice Withdraw accumulated mint revenue.
    function withdrawRevenue() external onlyOwner {
        uint256 amount = mintRevenue;
        if (amount == 0) revert NoRevenue();
        mintRevenue = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit RevenueWithdrawn(owner(), amount);
    }

    // ─── Internal: SVG Generation ─────────────────────────────────────────

    /// @dev Generates a dynamic SVG based on token data.
    function _generateSvg(
        uint256 tokenId,
        uint256 count,
        uint256 minted
    ) internal pure returns (string memory) {
        string memory glowOpacity = count > 50 ? "0.9" : count > 20 ? "0.7" : count > 5 ? "0.5" : "0.3";
        string memory circleCount = count > 0 ? _generateInscriptionCircles(count) : "";
        string memory ageLabel = _formatAge(minted);

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">'
            '<defs>'
            '<radialGradient id="glow">'
            '<stop offset="0%" stop-color="#00D4FF" stop-opacity="', glowOpacity, '"/>'
            '<stop offset="100%" stop-color="#0A0A0A" stop-opacity="1"/>'
            '</radialGradient>'
            '<linearGradient id="border" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0%" stop-color="#00D4FF"/>'
            '<stop offset="100%" stop-color="#7B2FFF"/>'
            '</linearGradient>'
            '</defs>'
            '<rect width="400" height="400" fill="url(#glow)"/>'
            '<rect x="8" y="8" width="384" height="384" rx="20" fill="none" stroke="url(#border)" stroke-width="2"/>'
            '<text x="200" y="60" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="14" font-weight="bold">INKD</text>'
            '<text x="200" y="180" text-anchor="middle" fill="#00D4FF" font-family="monospace" font-size="48" font-weight="bold">#',
            tokenId.toString(),
            '</text>'
            '<text x="200" y="220" text-anchor="middle" fill="#888888" font-family="monospace" font-size="12">',
            count.toString(), ' inscriptions</text>',
            circleCount,
            '<text x="200" y="370" text-anchor="middle" fill="#555555" font-family="monospace" font-size="10">',
            ageLabel,
            '</text>'
            '</svg>'
        ));
    }

    /// @dev Generates visual circles representing inscriptions.
    function _generateInscriptionCircles(uint256 count) internal pure returns (string memory) {
        uint256 display = count > 10 ? 10 : count;
        bytes memory circles;
        for (uint256 i; i < display; ) {
            uint256 cx = 120 + (i * 18);
            circles = abi.encodePacked(
                circles,
                '<circle cx="', cx.toString(), '" cy="260" r="5" fill="#00D4FF" opacity="0.6"/>'
            );
            unchecked { ++i; }
        }
        if (count > 10) {
            circles = abi.encodePacked(
                circles,
                '<text x="310" y="264" fill="#00D4FF" font-family="monospace" font-size="10">+',
                (count - 10).toString(), '</text>'
            );
        }
        return string(circles);
    }

    /// @dev Formats token age as a human-readable label.
    function _formatAge(uint256 minted) internal pure returns (string memory) {
        if (minted == 0) return "age: unknown";
        return string(abi.encodePacked("minted: block ", minted.toString()));
    }

    /// @dev Generates JSON attributes array.
    function _generateAttributes(
        uint256 tokenId,
        uint256 count,
        uint256 minted,
        address tokenOwner
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '[{"trait_type":"Token ID","value":"', tokenId.toString(),
            '"},{"trait_type":"Inscriptions","value":', count.toString(),
            '},{"trait_type":"Minted At","value":', minted.toString(),
            '},{"trait_type":"Tier","display_type":"string","value":"',
            _getTier(count),
            '"},{"trait_type":"Owner","value":"',
            Strings.toHexString(tokenOwner),
            '"}]'
        ));
    }

    /// @dev Returns tier based on inscription count.
    function _getTier(uint256 count) internal pure returns (string memory) {
        if (count >= 100) return "Mythic";
        if (count >= 50) return "Legendary";
        if (count >= 20) return "Epic";
        if (count >= 5) return "Rare";
        if (count >= 1) return "Common";
        return "Blank";
    }

    // ─── Required Overrides ───────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721RoyaltyUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
