// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  InkdVault
 * @author Inkd Protocol
 * @notice The decentralized ownership layer for AI Agents on Base.
 *
 *         Every file, code snippet, or piece of knowledge is a token.
 *         Own the token = own the data.
 *         Transfer the token = handover.
 *         Burn the token = delete.
 *         Your wallet = your entire brain / storage.
 *
 *         No servers. No humans needed. Just wallets.
 *
 * @dev    UUPS-upgradeable ERC-1155 vault with protocol fees, batch minting,
 *         version tracking, and temporary access grants.
 */

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract InkdVault is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    // ─── Storage ────────────────────────────────────────────────────────────

    /// @notice Auto-incrementing token ID counter.
    uint256 public nextTokenId;

    /// @notice Protocol fee in basis points (100 = 1%).
    uint256 public protocolFeeBps;

    /// @notice Accumulated protocol fee balance available for withdrawal.
    uint256 public protocolFeeBalance;

    /// @notice Core metadata for each minted data token.
    struct DataToken {
        address creator;        // Original minter
        string  arweaveHash;    // Current Arweave TX id (latest version)
        string  metadataURI;    // Off-chain metadata (name, description, type, size)
        uint256 price;          // Listing price in wei (0 = not for sale)
        uint256 createdAt;      // Block timestamp of creation
    }

    /// @notice Temporary read-access grant for a specific wallet.
    struct AccessGrant {
        address grantee;        // Wallet that was granted access
        uint256 expiresAt;      // Unix timestamp when access expires
    }

    /// @dev tokenId => DataToken metadata.
    mapping(uint256 => DataToken) public tokens;

    /// @dev tokenId => array of Arweave hashes (version history, index 0 = original).
    mapping(uint256 => string[]) public tokenVersions;

    /// @dev tokenId => grantee address => expiry timestamp.
    mapping(uint256 => mapping(address => uint256)) public accessGrants;

    // ─── Events ─────────────────────────────────────────────────────────────

    /// @notice Emitted when a new data token is minted.
    event DataMinted(
        uint256 indexed tokenId,
        address indexed creator,
        string  arweaveHash,
        string  metadataURI,
        uint256 price
    );

    /// @notice Emitted when multiple tokens are minted in a single transaction.
    event BatchMinted(
        uint256[] tokenIds,
        address indexed creator,
        uint256 count
    );

    /// @notice Emitted when a token is purchased and transferred.
    event DataPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 protocolFee
    );

    /// @notice Emitted when a token's listing price is updated.
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);

    /// @notice Emitted when a token is burned (access permanently revoked).
    event DataBurned(uint256 indexed tokenId, address indexed burner);

    /// @notice Emitted when a new version is pushed for a token.
    event VersionAdded(
        uint256 indexed tokenId,
        uint256 versionIndex,
        string  newArweaveHash
    );

    /// @notice Emitted when temporary access is granted to a wallet.
    event AccessGranted(
        uint256 indexed tokenId,
        address indexed grantee,
        uint256 expiresAt
    );

    /// @notice Emitted when a temporary access grant is revoked.
    event AccessRevoked(uint256 indexed tokenId, address indexed grantee);

    /// @notice Emitted when the protocol fee rate is updated.
    event ProtocolFeeUpdated(uint256 oldBps, uint256 newBps);

    /// @notice Emitted when accumulated protocol fees are withdrawn.
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ─────────────────────────────────────────────────────────────

    /// @dev Token is not listed for sale (price == 0).
    error NotForSale(uint256 tokenId);

    /// @dev Buyer sent insufficient ETH.
    error InsufficientPayment(uint256 required, uint256 sent);

    /// @dev Seller does not own the token.
    error SellerNotOwner(uint256 tokenId, address seller);

    /// @dev Caller does not own the token.
    error NotTokenOwner(uint256 tokenId, address caller);

    /// @dev Fee exceeds the 5% maximum.
    error FeeExceedsMax(uint256 bps);

    /// @dev Array length mismatch in batch operations.
    error ArrayLengthMismatch();

    /// @dev Expiry timestamp must be in the future.
    error ExpiryInPast(uint256 expiresAt);

    /// @dev ETH transfer failed.
    error TransferFailed();

    /// @dev No fees available to withdraw.
    error NoFeesToWithdraw();

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @notice Initializes the vault. Called once via proxy.
    /// @param _owner Address that will own the contract and receive protocol fees.
    function initialize(address _owner) public initializer {
        __ERC1155_init("");
        __Ownable_init(_owner);
        protocolFeeBps = 100; // 1%
    }

    // ─── Core: Mint ─────────────────────────────────────────────────────────

    /// @notice Mint a new data token — file, code, memory, anything.
    /// @param arweaveHash  Arweave transaction ID of the (optionally encrypted) payload.
    /// @param metadataURI  Off-chain URI containing name, description, type, size, etc.
    /// @param price        Listing price in wei. Set to 0 if not for sale.
    /// @return tokenId     The newly minted token's ID.
    function mint(
        string calldata arweaveHash,
        string calldata metadataURI,
        uint256 price
    ) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;

        tokens[tokenId] = DataToken({
            creator:     msg.sender,
            arweaveHash: arweaveHash,
            metadataURI: metadataURI,
            price:       price,
            createdAt:   block.timestamp
        });

        tokenVersions[tokenId].push(arweaveHash);

        _mint(msg.sender, tokenId, 1, "");

        emit DataMinted(tokenId, msg.sender, arweaveHash, metadataURI, price);
    }

    /// @notice Mint multiple data tokens in a single transaction.
    /// @param arweaveHashes  Array of Arweave transaction IDs.
    /// @param metadataURIs   Array of metadata URIs.
    /// @param prices         Array of listing prices.
    /// @return tokenIds      Array of newly minted token IDs.
    function batchMint(
        string[] calldata arweaveHashes,
        string[] calldata metadataURIs,
        uint256[] calldata prices
    ) external returns (uint256[] memory tokenIds) {
        uint256 len = arweaveHashes.length;
        if (len != metadataURIs.length || len != prices.length) {
            revert ArrayLengthMismatch();
        }

        tokenIds = new uint256[](len);

        for (uint256 i; i < len; ) {
            uint256 tokenId = nextTokenId++;
            tokenIds[i] = tokenId;

            tokens[tokenId] = DataToken({
                creator:     msg.sender,
                arweaveHash: arweaveHashes[i],
                metadataURI: metadataURIs[i],
                price:       prices[i],
                createdAt:   block.timestamp
            });

            tokenVersions[tokenId].push(arweaveHashes[i]);

            _mint(msg.sender, tokenId, 1, "");

            emit DataMinted(tokenId, msg.sender, arweaveHashes[i], metadataURIs[i], prices[i]);

            unchecked { ++i; }
        }

        emit BatchMinted(tokenIds, msg.sender, len);
    }

    // ─── Core: Purchase ─────────────────────────────────────────────────────

    /// @notice Purchase a token from its current owner. Pays seller minus protocol fee.
    /// @param tokenId  The token to purchase.
    /// @param seller   The current owner selling the token.
    function purchase(uint256 tokenId, address seller) external payable nonReentrant {
        DataToken storage dt = tokens[tokenId];

        if (dt.price == 0) revert NotForSale(tokenId);
        if (msg.value < dt.price) revert InsufficientPayment(dt.price, msg.value);
        if (balanceOf(seller, tokenId) < 1) revert SellerNotOwner(tokenId, seller);

        uint256 fee    = (msg.value * protocolFeeBps) / 10_000;
        uint256 payout = msg.value - fee;

        protocolFeeBalance += fee;

        _safeTransferFrom(seller, msg.sender, tokenId, 1, "");

        (bool success, ) = payable(seller).call{value: payout}("");
        if (!success) revert TransferFailed();

        emit DataPurchased(tokenId, msg.sender, seller, msg.value, fee);
    }

    // ─── Core: Price ────────────────────────────────────────────────────────

    /// @notice Update listing price for a token. Set to 0 to delist.
    /// @param tokenId  The token to update.
    /// @param price    New price in wei.
    function setPrice(uint256 tokenId, uint256 price) external {
        if (balanceOf(msg.sender, tokenId) < 1) revert NotTokenOwner(tokenId, msg.sender);
        tokens[tokenId].price = price;
        emit PriceUpdated(tokenId, price);
    }

    // ─── Core: Burn ─────────────────────────────────────────────────────────

    /// @notice Burn a token — permanently revokes access, data becomes unreachable.
    /// @param tokenId  The token to burn.
    function burn(uint256 tokenId) external {
        if (balanceOf(msg.sender, tokenId) < 1) revert NotTokenOwner(tokenId, msg.sender);
        _burn(msg.sender, tokenId, 1);
        emit DataBurned(tokenId, msg.sender);
    }

    // ─── Versioning ─────────────────────────────────────────────────────────

    /// @notice Push a new version of the data. Only the token owner can update.
    /// @param tokenId       The token to update.
    /// @param newArweaveHash New Arweave TX id for the updated payload.
    /// @return versionIndex  The index of the new version in the history.
    function addVersion(
        uint256 tokenId,
        string calldata newArweaveHash
    ) external returns (uint256 versionIndex) {
        if (balanceOf(msg.sender, tokenId) < 1) revert NotTokenOwner(tokenId, msg.sender);

        tokens[tokenId].arweaveHash = newArweaveHash;
        tokenVersions[tokenId].push(newArweaveHash);
        versionIndex = tokenVersions[tokenId].length - 1;

        emit VersionAdded(tokenId, versionIndex, newArweaveHash);
    }

    /// @notice Get the total number of versions for a token.
    /// @param tokenId The token to query.
    /// @return count  Number of versions (including original).
    function getVersionCount(uint256 tokenId) external view returns (uint256 count) {
        count = tokenVersions[tokenId].length;
    }

    /// @notice Get a specific version's Arweave hash.
    /// @param tokenId      The token to query.
    /// @param versionIndex  The version index (0 = original).
    /// @return arweaveHash  The Arweave TX id for that version.
    function getVersion(
        uint256 tokenId,
        uint256 versionIndex
    ) external view returns (string memory arweaveHash) {
        arweaveHash = tokenVersions[tokenId][versionIndex];
    }

    // ─── Access Grants ──────────────────────────────────────────────────────

    /// @notice Grant temporary read access to a wallet without transferring ownership.
    /// @param tokenId   The token to grant access to.
    /// @param wallet    The wallet to receive temporary access.
    /// @param expiresAt Unix timestamp when access expires.
    function grantAccess(
        uint256 tokenId,
        address wallet,
        uint256 expiresAt
    ) external {
        if (balanceOf(msg.sender, tokenId) < 1) revert NotTokenOwner(tokenId, msg.sender);
        if (expiresAt <= block.timestamp) revert ExpiryInPast(expiresAt);

        accessGrants[tokenId][wallet] = expiresAt;

        emit AccessGranted(tokenId, wallet, expiresAt);
    }

    /// @notice Revoke a previously granted temporary access.
    /// @param tokenId The token to revoke access for.
    /// @param wallet  The wallet to revoke access from.
    function revokeAccess(uint256 tokenId, address wallet) external {
        if (balanceOf(msg.sender, tokenId) < 1) revert NotTokenOwner(tokenId, msg.sender);

        delete accessGrants[tokenId][wallet];

        emit AccessRevoked(tokenId, wallet);
    }

    /// @notice Check if a wallet currently has access to a token (owner OR active grant).
    /// @param tokenId The token to check.
    /// @param wallet  The wallet to check.
    /// @return hasAccess True if the wallet owns the token or has an active grant.
    function checkAccess(
        uint256 tokenId,
        address wallet
    ) external view returns (bool hasAccess) {
        if (balanceOf(wallet, tokenId) >= 1) return true;
        uint256 expiry = accessGrants[tokenId][wallet];
        return expiry > block.timestamp;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    /// @notice Update the protocol fee rate. Maximum 5% (500 bps).
    /// @param bps New fee in basis points.
    function setProtocolFee(uint256 bps) external onlyOwner {
        if (bps > 500) revert FeeExceedsMax(bps);
        uint256 oldBps = protocolFeeBps;
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(oldBps, bps);
    }

    /// @notice Withdraw accumulated protocol fees to the contract owner.
    function withdrawFees() external onlyOwner {
        uint256 amount = protocolFeeBalance;
        if (amount == 0) revert NoFeesToWithdraw();
        protocolFeeBalance = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), amount);
    }

    /// @dev UUPS upgrade authorization — only contract owner.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Returns the metadata URI for a given token.
    /// @param tokenId The token to query.
    /// @return The metadata URI string.
    function uri(uint256 tokenId) public view override returns (string memory) {
        return tokens[tokenId].metadataURI;
    }
}
