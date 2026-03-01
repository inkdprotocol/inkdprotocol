// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  InkdRegistry
 * @author Inkd Protocol
 * @notice The discovery layer for the Inkd Protocol.
 *
 *         Register your InkdToken as public or private. Tag your inscriptions.
 *         Search by content type, owner, or tags. List inscriptions for sale.
 *
 * @dev    UUPS-upgradeable registry with tagging, search, marketplace listing,
 *         and protocol-wide statistics.
 */

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInkdTokenForRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isInkdHolder(address wallet) external view returns (bool);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract InkdRegistry is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    // ─── Types ────────────────────────────────────────────────────────────

    struct TokenRegistration {
        uint256 tokenId;
        address owner;
        bool isPublic;
        uint256 registeredAt;
        string[] tags;
    }

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        uint256 listedAt;
        bool active;
    }

    struct TagEntry {
        uint256 tokenId;
        uint256 inscriptionIndex;
        string tag;
    }

    // ─── Storage ──────────────────────────────────────────────────────────

    IInkdTokenForRegistry public inkdToken;
    uint256 public marketplaceFeeBps;
    uint256 public marketplaceFeeBalance;

    mapping(uint256 => TokenRegistration) public registrations;
    mapping(uint256 => Listing) public listings;
    mapping(string => uint256[]) internal _tagToTokens;
    mapping(string => uint256[]) internal _contentTypeToTokens;
    mapping(address => uint256[]) internal _ownerTokens;
    mapping(uint256 => mapping(uint256 => string[])) internal _inscriptionTags;

    uint256[] internal _allRegisteredTokens;
    uint256[] internal _activeListings;

    // ─── Stats ────────────────────────────────────────────────────────────

    uint256 public totalRegisteredTokens;
    uint256 public totalTrackedInscriptions;
    uint256 public totalVolume;
    uint256 public totalSales;

    // ─── Events ───────────────────────────────────────────────────────────

    event TokenRegistered(uint256 indexed tokenId, address indexed owner, bool isPublic);
    event RegistrationUpdated(uint256 indexed tokenId, bool isPublic);
    event TokenUnregistered(uint256 indexed tokenId);
    event TagsAdded(uint256 indexed tokenId, uint256 indexed inscriptionIndex, string[] tags);
    event TokenListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);
    event TokenSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 fee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────

    error NotInkdHolder();
    error NotTokenOwner(uint256 tokenId, address caller);
    error AlreadyRegistered(uint256 tokenId);
    error NotRegistered(uint256 tokenId);
    error NotListed(uint256 tokenId);
    error InsufficientPayment(uint256 required, uint256 sent);
    error CannotBuyOwnListing();
    error TransferFailed();
    error NoFeesToWithdraw();
    error ZeroAddress();
    error ZeroPrice();
    error FeeExceedsMax(uint256 bps);
    error TooManyTags(uint256 count, uint256 max);

    // ─── Modifiers ────────────────────────────────────────────────────────

    modifier onlyInkdHolder() {
        _onlyInkdHolder();
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        _onlyTokenOwner(tokenId);
        _;
    }

    function _onlyInkdHolder() internal view {
        if (!inkdToken.isInkdHolder(msg.sender)) revert NotInkdHolder();
    }

    function _onlyTokenOwner(uint256 tokenId) internal view {
        if (inkdToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId, msg.sender);
    }

    // ─── Initializer ──────────────────────────────────────────────────────

    function initialize(address _owner, address _inkdToken) public initializer {
        if (_owner == address(0) || _inkdToken == address(0)) revert ZeroAddress();

        __Ownable_init(_owner);

        inkdToken = IInkdTokenForRegistry(_inkdToken);
        marketplaceFeeBps = 250;
    }

    // ─── Registration ─────────────────────────────────────────────────────

    function registerToken(
        uint256 tokenId,
        bool isPublic,
        string[] calldata tags
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (registrations[tokenId].registeredAt != 0) revert AlreadyRegistered(tokenId);
        if (tags.length > 20) revert TooManyTags(tags.length, 20);

        registrations[tokenId] = TokenRegistration({
            tokenId: tokenId,
            owner: msg.sender,
            isPublic: isPublic,
            registeredAt: block.timestamp,
            tags: tags
        });

        _allRegisteredTokens.push(tokenId);
        _ownerTokens[msg.sender].push(tokenId);
        totalRegisteredTokens++;

        for (uint256 i; i < tags.length; ) {
            _tagToTokens[tags[i]].push(tokenId);
            unchecked { ++i; }
        }

        emit TokenRegistered(tokenId, msg.sender, isPublic);
    }

    function updateRegistration(
        uint256 tokenId,
        bool isPublic
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (registrations[tokenId].registeredAt == 0) revert NotRegistered(tokenId);
        registrations[tokenId].isPublic = isPublic;
        emit RegistrationUpdated(tokenId, isPublic);
    }

    // ─── Tagging ──────────────────────────────────────────────────────────

    function addTags(
        uint256 tokenId,
        uint256 inscriptionIndex,
        string[] calldata tags
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (tags.length > 10) revert TooManyTags(tags.length, 10);

        for (uint256 i; i < tags.length; ) {
            _inscriptionTags[tokenId][inscriptionIndex].push(tags[i]);
            _tagToTokens[tags[i]].push(tokenId);
            unchecked { ++i; }
        }

        totalTrackedInscriptions++;
        emit TagsAdded(tokenId, inscriptionIndex, tags);
    }

    function getInscriptionTags(
        uint256 tokenId,
        uint256 inscriptionIndex
    ) external view returns (string[] memory) {
        return _inscriptionTags[tokenId][inscriptionIndex];
    }

    // ─── Search ───────────────────────────────────────────────────────────

    function searchByTag(string calldata tag) external view returns (uint256[] memory tokenIds) {
        return _tagToTokens[tag];
    }

    function searchByContentType(string calldata contentType) external view returns (uint256[] memory tokenIds) {
        return _contentTypeToTokens[contentType];
    }

    function searchByOwner(address walletOwner) external view returns (uint256[] memory tokenIds) {
        return _ownerTokens[walletOwner];
    }

    function getPublicTokens(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory tokenIds) {
        uint256 total = _allRegisteredTokens.length;
        if (offset >= total) {
            return new uint256[](0);
        }

        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 publicCount;
        for (uint256 i = offset; i < end; ) {
            uint256 tid = _allRegisteredTokens[i];
            if (registrations[tid].isPublic) {
                publicCount++;
            }
            unchecked { ++i; }
        }

        tokenIds = new uint256[](publicCount);
        uint256 idx;
        for (uint256 i = offset; i < end; ) {
            uint256 tid = _allRegisteredTokens[i];
            if (registrations[tid].isPublic) {
                tokenIds[idx++] = tid;
            }
            unchecked { ++i; }
        }
    }

    // ─── Marketplace ──────────────────────────────────────────────────────

    function listForSale(
        uint256 tokenId,
        uint256 price
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (price == 0) revert ZeroPrice();

        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            listedAt: block.timestamp,
            active: true
        });

        _activeListings.push(tokenId);
        emit TokenListed(tokenId, msg.sender, price);
    }

    function cancelListing(
        uint256 tokenId
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (!listings[tokenId].active) revert NotListed(tokenId);
        listings[tokenId].active = false;
        emit ListingCancelled(tokenId);
    }

    function buyToken(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed(tokenId);
        if (msg.value < listing.price) revert InsufficientPayment(listing.price, msg.value);
        if (msg.sender == listing.seller) revert CannotBuyOwnListing();

        address seller = listing.seller;
        uint256 price = listing.price;

        uint256 fee = (price * marketplaceFeeBps) / 10_000;
        uint256 payout = price - fee;

        listing.active = false;
        marketplaceFeeBalance += fee;
        totalVolume += price;
        totalSales++;

        inkdToken.transferFrom(seller, msg.sender, tokenId);

        if (registrations[tokenId].registeredAt != 0) {
            registrations[tokenId].owner = msg.sender;
            _ownerTokens[msg.sender].push(tokenId);
        }

        (bool success, ) = payable(seller).call{value: payout}("");
        if (!success) revert TransferFailed();

        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit TokenSold(tokenId, seller, msg.sender, price, fee);
    }

    function getActiveListings(
        uint256 offset,
        uint256 limit
    ) external view returns (Listing[] memory result) {
        uint256 total = _activeListings.length;
        if (offset >= total) {
            return new Listing[](0);
        }

        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 activeCount;

        for (uint256 i = offset; i < end; ) {
            if (listings[_activeListings[i]].active) {
                activeCount++;
            }
            unchecked { ++i; }
        }

        result = new Listing[](activeCount);
        uint256 idx;
        for (uint256 i = offset; i < end; ) {
            uint256 tid = _activeListings[i];
            if (listings[tid].active) {
                result[idx++] = listings[tid];
            }
            unchecked { ++i; }
        }
    }

    // ─── Content Type Indexing ─────────────────────────────────────────────

    function indexContentType(
        uint256 tokenId,
        string calldata contentType
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        _contentTypeToTokens[contentType].push(tokenId);
    }

    // ─── Stats ────────────────────────────────────────────────────────────

    function getStats() external view returns (
        uint256 _totalTokens,
        uint256 _totalInscriptions,
        uint256 _totalVolume,
        uint256 _totalSales
    ) {
        return (totalRegisteredTokens, totalTrackedInscriptions, totalVolume, totalSales);
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function setMarketplaceFee(uint256 bps) external onlyOwner {
        if (bps > 1000) revert FeeExceedsMax(bps);
        marketplaceFeeBps = bps;
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = marketplaceFeeBalance;
        if (amount == 0) revert NoFeesToWithdraw();
        marketplaceFeeBalance = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), amount);
    }

    function setInkdToken(address _inkdToken) external onlyOwner {
        if (_inkdToken == address(0)) revert ZeroAddress();
        inkdToken = IInkdTokenForRegistry(_inkdToken);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
