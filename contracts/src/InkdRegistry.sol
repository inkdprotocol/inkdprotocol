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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    /// @notice Registration entry for a token.
    struct TokenRegistration {
        uint256 tokenId;
        address owner;
        bool isPublic;          // Public = discoverable, Private = hidden
        uint256 registeredAt;
        string[] tags;
    }

    /// @notice Marketplace listing for token sale.
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;          // Price in wei
        uint256 listedAt;
        bool active;
    }

    /// @notice Tag metadata for search.
    struct TagEntry {
        uint256 tokenId;
        uint256 inscriptionIndex;
        string tag;
    }

    // ─── Storage ──────────────────────────────────────────────────────────

    /// @notice Reference to the InkdToken contract.
    IInkdTokenForRegistry public inkdToken;

    /// @notice Protocol fee on marketplace sales in basis points.
    uint256 public marketplaceFeeBps;

    /// @notice Accumulated marketplace fees.
    uint256 public marketplaceFeeBalance;

    /// @notice tokenId => registration data.
    mapping(uint256 => TokenRegistration) public registrations;

    /// @notice tokenId => Listing data.
    mapping(uint256 => Listing) public listings;

    /// @notice tag string => array of tokenIds with this tag.
    mapping(string => uint256[]) internal _tagToTokens;

    /// @notice contentType string => array of tokenIds with this content type.
    mapping(string => uint256[]) internal _contentTypeToTokens;

    /// @notice owner address => array of registered tokenIds.
    mapping(address => uint256[]) internal _ownerTokens;

    /// @notice tokenId => inscriptionIndex => array of tags.
    mapping(uint256 => mapping(uint256 => string[])) internal _inscriptionTags;

    /// @notice Array of all registered token IDs (for enumeration).
    uint256[] internal _allRegisteredTokens;

    /// @notice Array of all active listing token IDs.
    uint256[] internal _activeListings;

    // ─── Stats ────────────────────────────────────────────────────────────

    /// @notice Total number of registered tokens.
    uint256 public totalRegisteredTokens;

    /// @notice Total inscriptions tracked across registry.
    uint256 public totalTrackedInscriptions;

    /// @notice Total sales volume in wei.
    uint256 public totalVolume;

    /// @notice Total number of completed sales.
    uint256 public totalSales;

    // ─── Events ───────────────────────────────────────────────────────────

    /// @notice Emitted when a token is registered.
    event TokenRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        bool isPublic
    );

    /// @notice Emitted when a token registration is updated.
    event RegistrationUpdated(
        uint256 indexed tokenId,
        bool isPublic
    );

    /// @notice Emitted when a token is unregistered.
    event TokenUnregistered(uint256 indexed tokenId);

    /// @notice Emitted when tags are added to an inscription.
    event TagsAdded(
        uint256 indexed tokenId,
        uint256 indexed inscriptionIndex,
        string[] tags
    );

    /// @notice Emitted when a token is listed for sale.
    event TokenListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    /// @notice Emitted when a listing is cancelled.
    event ListingCancelled(uint256 indexed tokenId);

    /// @notice Emitted when a token is sold via marketplace.
    event TokenSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 fee
    );

    /// @notice Emitted when marketplace fees are withdrawn.
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────

    /// @dev Caller does not hold any InkdToken.
    error NotInkdHolder();

    /// @dev Caller is not the owner of the specified token.
    error NotTokenOwner(uint256 tokenId, address caller);

    /// @dev Token is already registered.
    error AlreadyRegistered(uint256 tokenId);

    /// @dev Token is not registered.
    error NotRegistered(uint256 tokenId);

    /// @dev Token is not listed for sale.
    error NotListed(uint256 tokenId);

    /// @dev Insufficient payment for purchase.
    error InsufficientPayment(uint256 required, uint256 sent);

    /// @dev Cannot buy your own listing.
    error CannotBuyOwnListing();

    /// @dev ETH transfer failed.
    error TransferFailed();

    /// @dev No fees to withdraw.
    error NoFeesToWithdraw();

    /// @dev Zero address not allowed.
    error ZeroAddress();

    /// @dev Zero price not allowed for listings.
    error ZeroPrice();

    /// @dev Fee exceeds maximum.
    error FeeExceedsMax(uint256 bps);

    /// @dev Too many tags.
    error TooManyTags(uint256 count, uint256 max);

    // ─── Modifiers ────────────────────────────────────────────────────────

    modifier onlyInkdHolder() {
        if (!inkdToken.isInkdHolder(msg.sender)) revert NotInkdHolder();
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        if (inkdToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId, msg.sender);
        _;
    }

    // ─── Initializer ──────────────────────────────────────────────────────

    /// @notice Initializes the InkdRegistry.
    /// @param _owner Contract owner.
    /// @param _inkdToken Address of the InkdToken contract.
    function initialize(address _owner, address _inkdToken) public initializer {
        if (_owner == address(0) || _inkdToken == address(0)) revert ZeroAddress();

        __Ownable_init(_owner);



        inkdToken = IInkdTokenForRegistry(_inkdToken);
        marketplaceFeeBps = 250; // 2.5%
    }

    // ─── Registration ─────────────────────────────────────────────────────

    /// @notice Register your InkdToken as public or private.
    /// @param tokenId The token to register.
    /// @param isPublic Whether the token is publicly discoverable.
    /// @param tags Initial tags for the token.
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

        // Index tags
        for (uint256 i; i < tags.length; ) {
            _tagToTokens[tags[i]].push(tokenId);
            unchecked { ++i; }
        }

        emit TokenRegistered(tokenId, msg.sender, isPublic);
    }

    /// @notice Update the visibility of a registered token.
    /// @param tokenId The token to update.
    /// @param isPublic New visibility setting.
    function updateRegistration(
        uint256 tokenId,
        bool isPublic
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (registrations[tokenId].registeredAt == 0) revert NotRegistered(tokenId);
        registrations[tokenId].isPublic = isPublic;
        emit RegistrationUpdated(tokenId, isPublic);
    }

    // ─── Tagging ──────────────────────────────────────────────────────────

    /// @notice Add tags to an inscription for discovery.
    /// @param tokenId The token containing the inscription.
    /// @param inscriptionIndex The inscription index.
    /// @param tags Array of tag strings.
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

    /// @notice Get tags for an inscription.
    /// @param tokenId The token to query.
    /// @param inscriptionIndex The inscription index.
    /// @return Array of tag strings.
    function getInscriptionTags(
        uint256 tokenId,
        uint256 inscriptionIndex
    ) external view returns (string[] memory) {
        return _inscriptionTags[tokenId][inscriptionIndex];
    }

    // ─── Search ───────────────────────────────────────────────────────────

    /// @notice Search for tokens by tag.
    /// @param tag The tag to search for.
    /// @return tokenIds Array of token IDs with this tag.
    function searchByTag(string calldata tag) external view returns (uint256[] memory tokenIds) {
        return _tagToTokens[tag];
    }

    /// @notice Search for tokens by content type.
    /// @param contentType The content type to search for.
    /// @return tokenIds Array of token IDs with this content type.
    function searchByContentType(string calldata contentType) external view returns (uint256[] memory tokenIds) {
        return _contentTypeToTokens[contentType];
    }

    /// @notice Get all registered tokens by an owner.
    /// @param walletOwner The owner address.
    /// @return tokenIds Array of registered token IDs.
    function searchByOwner(address walletOwner) external view returns (uint256[] memory tokenIds) {
        return _ownerTokens[walletOwner];
    }

    /// @notice Get all public registered tokens (paginated).
    /// @param offset Start index.
    /// @param limit Maximum results to return.
    /// @return tokenIds Array of public token IDs.
    function getPublicTokens(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory tokenIds) {
        uint256 total = _allRegisteredTokens.length;
        if (offset >= total) {
            return new uint256[](0);
        }

        // Count public tokens in range
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 publicCount;
        for (uint256 i = offset; i < end; ) {
            uint256 tid = _allRegisteredTokens[i];
            if (registrations[tid].isPublic) {
                publicCount++;
            }
            unchecked { ++i; }
        }

        // Build result array
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

    /// @notice List a token for sale on the marketplace.
    /// @param tokenId The token to list.
    /// @param price Sale price in wei.
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

    /// @notice Cancel a listing.
    /// @param tokenId The token to delist.
    function cancelListing(
        uint256 tokenId
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (!listings[tokenId].active) revert NotListed(tokenId);
        listings[tokenId].active = false;
        emit ListingCancelled(tokenId);
    }

    /// @notice Buy a listed token from the marketplace.
    /// @param tokenId The token to buy.
    function buyToken(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed(tokenId);
        if (msg.value < listing.price) revert InsufficientPayment(listing.price, msg.value);
        if (msg.sender == listing.seller) revert CannotBuyOwnListing();

        address seller = listing.seller;
        uint256 price = listing.price;

        // Calculate fees
        uint256 fee = (price * marketplaceFeeBps) / 10_000;
        uint256 payout = price - fee;

        // Deactivate listing
        listing.active = false;
        marketplaceFeeBalance += fee;
        totalVolume += price;
        totalSales++;

        // Transfer token
        inkdToken.transferFrom(seller, msg.sender, tokenId);

        // Update registration owner
        if (registrations[tokenId].registeredAt != 0) {
            registrations[tokenId].owner = msg.sender;
            _ownerTokens[msg.sender].push(tokenId);
        }

        // Pay seller
        (bool success, ) = payable(seller).call{value: payout}("");
        if (!success) revert TransferFailed();

        // Refund excess
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit TokenSold(tokenId, seller, msg.sender, price, fee);
    }

    /// @notice Get all active marketplace listings (paginated).
    /// @param offset Start index.
    /// @param limit Maximum results to return.
    /// @return result Array of active listings.
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

    /// @notice Index a token by content type for search.
    /// @param tokenId The token to index.
    /// @param contentType The content type to associate.
    function indexContentType(
        uint256 tokenId,
        string calldata contentType
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        _contentTypeToTokens[contentType].push(tokenId);
    }

    // ─── Stats ────────────────────────────────────────────────────────────

    /// @notice Get protocol-wide statistics.
    /// @return _totalTokens Total registered tokens.
    /// @return _totalInscriptions Total tracked inscriptions.
    /// @return _totalVolume Total sales volume in wei.
    /// @return _totalSales Total completed sales.
    function getStats() external view returns (
        uint256 _totalTokens,
        uint256 _totalInscriptions,
        uint256 _totalVolume,
        uint256 _totalSales
    ) {
        return (totalRegisteredTokens, totalTrackedInscriptions, totalVolume, totalSales);
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    /// @notice Update the marketplace fee rate. Maximum 10% (1000 bps).
    /// @param bps New fee in basis points.
    function setMarketplaceFee(uint256 bps) external onlyOwner {
        if (bps > 1000) revert FeeExceedsMax(bps);
        marketplaceFeeBps = bps;
    }

    /// @notice Withdraw accumulated marketplace fees.
    function withdrawFees() external onlyOwner {
        uint256 amount = marketplaceFeeBalance;
        if (amount == 0) revert NoFeesToWithdraw();
        marketplaceFeeBalance = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), amount);
    }

    /// @notice Update the InkdToken contract address.
    function setInkdToken(address _inkdToken) external onlyOwner {
        if (_inkdToken == address(0)) revert ZeroAddress();
        inkdToken = IInkdTokenForRegistry(_inkdToken);
    }

    /// @dev UUPS upgrade authorization.
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
