// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  InkdVault
 * @author Inkd Protocol
 * @notice The inscription engine for the Inkd Protocol.
 *
 *         Inscribe data onto your InkdToken. Each inscription = 1 file stored on Arweave.
 *         Only InkdToken holders can inscribe. Transfer your token = everything moves.
 *         Burn your token = everything inscribed is gone forever.
 *
 * @dev    UUPS-upgradeable inscription manager with protocol fees, access grants,
 *         versioning, and soft-delete support. Requires InkdToken ownership.
 */

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInkdToken {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function setInscriptionCount(uint256 tokenId, uint256 newCount) external;
    function isInkdHolder(address wallet) external view returns (bool);
}

contract InkdVault is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    // ─── Types ────────────────────────────────────────────────────────────

    /// @notice A single inscription on an InkdToken.
    struct Inscription {
        string arweaveHash;     // Arweave transaction ID
        string contentType;     // MIME type (e.g. "application/json", "image/png")
        uint256 size;           // File size in bytes
        string name;            // Human-readable name
        uint256 createdAt;      // Timestamp of creation
        bool isRemoved;         // Soft-delete flag
        uint256 version;        // Current version number
    }

    /// @notice Access grant for temporary read access.
    struct AccessGrant {
        address grantee;        // Wallet with access
        uint256 expiresAt;      // Expiry timestamp
        uint256 grantedAt;      // When access was granted
    }

    // ─── Storage ──────────────────────────────────────────────────────────

    /// @notice Reference to the InkdToken contract.
    IInkdToken public inkdToken;

    /// @notice Protocol fee in basis points (100 = 1%).
    uint256 public protocolFeeBps;

    /// @notice Accumulated protocol fees.
    uint256 public protocolFeeBalance;

    /// @notice tokenId => array of inscriptions.
    mapping(uint256 => Inscription[]) internal _inscriptions;

    /// @notice tokenId => inscriptionIndex => array of previous arweave hashes (version history).
    mapping(uint256 => mapping(uint256 => string[])) internal _versionHistory;

    /// @notice tokenId => grantee => AccessGrant.
    mapping(uint256 => mapping(address => AccessGrant)) public accessGrants;

    /// @notice tokenId => array of grantee addresses (for enumeration).
    mapping(uint256 => address[]) internal _grantees;

    /// @notice Total inscriptions created across all tokens.
    uint256 public totalInscriptions;

    // ─── Events ───────────────────────────────────────────────────────────

    /// @notice Emitted when data is inscribed onto a token.
    event Inscribed(
        uint256 indexed tokenId,
        uint256 indexed inscriptionIndex,
        string arweaveHash,
        string contentType,
        uint256 size,
        string name,
        uint256 protocolFee
    );

    /// @notice Emitted when an inscription is soft-deleted.
    event InscriptionRemoved(
        uint256 indexed tokenId,
        uint256 indexed inscriptionIndex
    );

    /// @notice Emitted when an inscription is updated with a new version.
    event InscriptionUpdated(
        uint256 indexed tokenId,
        uint256 indexed inscriptionIndex,
        string newArweaveHash,
        uint256 newVersion
    );

    /// @notice Emitted when read access is granted.
    event AccessGranted(
        uint256 indexed tokenId,
        address indexed grantee,
        uint256 expiresAt
    );

    /// @notice Emitted when read access is revoked.
    event AccessRevoked(
        uint256 indexed tokenId,
        address indexed grantee
    );

    /// @notice Emitted when the protocol fee rate is updated.
    event ProtocolFeeUpdated(uint256 oldBps, uint256 newBps);

    /// @notice Emitted when fees are withdrawn.
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────

    /// @dev Caller does not hold any InkdToken.
    error NotInkdHolder();

    /// @dev Caller is not the owner of the specified token.
    error NotTokenOwner(uint256 tokenId, address caller);

    /// @dev Inscription index is out of bounds.
    error InscriptionNotFound(uint256 tokenId, uint256 index);

    /// @dev Inscription has already been removed.
    error InscriptionAlreadyRemoved(uint256 tokenId, uint256 index);

    /// @dev Fee exceeds the 5% maximum.
    error FeeExceedsMax(uint256 bps);

    /// @dev Expiry timestamp must be in the future.
    error ExpiryInPast(uint256 expiresAt);

    /// @dev ETH transfer failed.
    error TransferFailed();

    /// @dev No fees available to withdraw.
    error NoFeesToWithdraw();

    /// @dev Empty arweave hash provided.
    error EmptyArweaveHash();

    /// @dev Zero address not allowed.
    error ZeroAddress();

    /// @dev Insufficient payment for inscription fee.
    error InsufficientFee(uint256 required, uint256 sent);

    // ─── Modifiers ────────────────────────────────────────────────────────

    /// @dev Blocks everyone who doesn't hold an InkdToken.
    modifier onlyInkdHolder() {
        if (!inkdToken.isInkdHolder(msg.sender)) revert NotInkdHolder();
        _;
    }

    /// @dev Requires caller to own the specific token.
    modifier onlyTokenOwner(uint256 tokenId) {
        if (inkdToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId, msg.sender);
        _;
    }

    // ─── Initializer ──────────────────────────────────────────────────────

    /// @notice Initializes the InkdVault.
    /// @param _owner Contract owner.
    /// @param _inkdToken Address of the InkdToken contract.
    function initialize(address _owner, address _inkdToken) public initializer {
        if (_owner == address(0) || _inkdToken == address(0)) revert ZeroAddress();

        __Ownable_init(_owner);
        // UUPSUpgradeable and ReentrancyGuard: no init needed in OZ v5

        inkdToken = IInkdToken(_inkdToken);
        protocolFeeBps = 100; // 1%
    }

    // ─── Core: Inscribe ───────────────────────────────────────────────────

    /// @notice Inscribe data onto your InkdToken. Requires 1% protocol fee.
    /// @param tokenId The token to inscribe on.
    /// @param arweaveHash Arweave transaction ID of the stored data.
    /// @param contentType MIME type of the data.
    /// @param size File size in bytes.
    /// @param name Human-readable name for the inscription.
    /// @return inscriptionIndex The index of the new inscription.
    function inscribe(
        uint256 tokenId,
        string calldata arweaveHash,
        string calldata contentType,
        uint256 size,
        string calldata name
    ) external payable onlyInkdHolder onlyTokenOwner(tokenId) nonReentrant returns (uint256 inscriptionIndex) {
        if (bytes(arweaveHash).length == 0) revert EmptyArweaveHash();

        // Calculate and collect protocol fee
        uint256 fee = _calculateFee(msg.value);
        if (fee > 0) {
            protocolFeeBalance += fee;
        }

        Inscription memory newInscription = Inscription({
            arweaveHash: arweaveHash,
            contentType: contentType,
            size: size,
            name: name,
            createdAt: block.timestamp,
            isRemoved: false,
            version: 1
        });

        _inscriptions[tokenId].push(newInscription);
        inscriptionIndex = _inscriptions[tokenId].length - 1;

        // Track version history
        _versionHistory[tokenId][inscriptionIndex].push(arweaveHash);

        // Update inscription count on the token
        uint256 activeCount = _getActiveInscriptionCount(tokenId);
        inkdToken.setInscriptionCount(tokenId, activeCount);

        totalInscriptions++;

        emit Inscribed(tokenId, inscriptionIndex, arweaveHash, contentType, size, name, fee);
    }

    // ─── Core: Remove ─────────────────────────────────────────────────────

    /// @notice Soft-delete an inscription. Marks it as removed but preserves history.
    /// @param tokenId The token containing the inscription.
    /// @param inscriptionIndex The index of the inscription to remove.
    function removeInscription(
        uint256 tokenId,
        uint256 inscriptionIndex
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (inscriptionIndex >= _inscriptions[tokenId].length) {
            revert InscriptionNotFound(tokenId, inscriptionIndex);
        }
        if (_inscriptions[tokenId][inscriptionIndex].isRemoved) {
            revert InscriptionAlreadyRemoved(tokenId, inscriptionIndex);
        }

        _inscriptions[tokenId][inscriptionIndex].isRemoved = true;

        // Update inscription count on the token
        uint256 activeCount = _getActiveInscriptionCount(tokenId);
        inkdToken.setInscriptionCount(tokenId, activeCount);

        emit InscriptionRemoved(tokenId, inscriptionIndex);
    }

    // ─── Core: Update ─────────────────────────────────────────────────────

    /// @notice Update an inscription with a new Arweave hash (new version).
    /// @param tokenId The token containing the inscription.
    /// @param inscriptionIndex The index of the inscription to update.
    /// @param newArweaveHash The new Arweave transaction ID.
    function updateInscription(
        uint256 tokenId,
        uint256 inscriptionIndex,
        string calldata newArweaveHash
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (inscriptionIndex >= _inscriptions[tokenId].length) {
            revert InscriptionNotFound(tokenId, inscriptionIndex);
        }
        if (_inscriptions[tokenId][inscriptionIndex].isRemoved) {
            revert InscriptionAlreadyRemoved(tokenId, inscriptionIndex);
        }
        if (bytes(newArweaveHash).length == 0) revert EmptyArweaveHash();

        Inscription storage insc = _inscriptions[tokenId][inscriptionIndex];
        insc.arweaveHash = newArweaveHash;
        insc.version++;

        // Track version history
        _versionHistory[tokenId][inscriptionIndex].push(newArweaveHash);

        emit InscriptionUpdated(tokenId, inscriptionIndex, newArweaveHash, insc.version);
    }

    // ─── Queries ──────────────────────────────────────────────────────────

    /// @notice Get all inscriptions on a token.
    /// @param tokenId The token to query.
    /// @return Array of all inscriptions (including removed ones).
    function getInscriptions(uint256 tokenId) external view returns (Inscription[] memory) {
        return _inscriptions[tokenId];
    }

    /// @notice Get a specific inscription.
    /// @param tokenId The token to query.
    /// @param inscriptionIndex The inscription index.
    /// @return The inscription data.
    function getInscription(
        uint256 tokenId,
        uint256 inscriptionIndex
    ) external view returns (Inscription memory) {
        if (inscriptionIndex >= _inscriptions[tokenId].length) {
            revert InscriptionNotFound(tokenId, inscriptionIndex);
        }
        return _inscriptions[tokenId][inscriptionIndex];
    }

    /// @notice Get the number of inscriptions on a token.
    /// @param tokenId The token to query.
    /// @return Total inscriptions (including removed).
    function getInscriptionCount(uint256 tokenId) external view returns (uint256) {
        return _inscriptions[tokenId].length;
    }

    /// @notice Get version history for an inscription.
    /// @param tokenId The token to query.
    /// @param inscriptionIndex The inscription index.
    /// @return Array of arweave hashes (version history).
    function getVersionHistory(
        uint256 tokenId,
        uint256 inscriptionIndex
    ) external view returns (string[] memory) {
        return _versionHistory[tokenId][inscriptionIndex];
    }

    // ─── Access Grants ────────────────────────────────────────────────────

    /// @notice Grant temporary read access to a wallet for a specific token.
    /// @param tokenId The token to grant access to.
    /// @param wallet The wallet to receive access.
    /// @param expiresAt Unix timestamp when access expires.
    function grantReadAccess(
        uint256 tokenId,
        address wallet,
        uint256 expiresAt
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (wallet == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp) revert ExpiryInPast(expiresAt);

        // Track grantee if new
        if (accessGrants[tokenId][wallet].grantee == address(0)) {
            _grantees[tokenId].push(wallet);
        }

        accessGrants[tokenId][wallet] = AccessGrant({
            grantee: wallet,
            expiresAt: expiresAt,
            grantedAt: block.timestamp
        });

        emit AccessGranted(tokenId, wallet, expiresAt);
    }

    /// @notice Revoke read access from a wallet.
    /// @param tokenId The token to revoke access for.
    /// @param wallet The wallet to revoke access from.
    function revokeAccess(
        uint256 tokenId,
        address wallet
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        delete accessGrants[tokenId][wallet];
        emit AccessRevoked(tokenId, wallet);
    }

    /// @notice Check if a wallet has access to a token (owner OR active grant).
    /// @param tokenId The token to check.
    /// @param wallet The wallet to check.
    /// @return True if the wallet has access.
    function hasAccess(
        uint256 tokenId,
        address wallet
    ) external view returns (bool) {
        // Owner always has access
        try inkdToken.ownerOf(tokenId) returns (address tokenOwner) {
            if (tokenOwner == wallet) return true;
        } catch {
            return false;
        }

        // Check active grant
        AccessGrant memory grant = accessGrants[tokenId][wallet];
        return grant.expiresAt > block.timestamp;
    }

    /// @notice Get all active access grants for a token.
    /// @param tokenId The token to query.
    /// @return grants Array of active access grants.
    function getActiveGrants(uint256 tokenId) external view returns (AccessGrant[] memory grants) {
        address[] memory granteeList = _grantees[tokenId];
        uint256 activeCount;

        // Count active grants
        for (uint256 i; i < granteeList.length; ) {
            if (accessGrants[tokenId][granteeList[i]].expiresAt > block.timestamp) {
                activeCount++;
            }
            unchecked { ++i; }
        }

        // Build array
        grants = new AccessGrant[](activeCount);
        uint256 idx;
        for (uint256 i; i < granteeList.length; ) {
            AccessGrant memory g = accessGrants[tokenId][granteeList[i]];
            if (g.expiresAt > block.timestamp) {
                grants[idx++] = g;
            }
            unchecked { ++i; }
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    /// @notice Update the protocol fee rate. Maximum 5% (500 bps).
    /// @param bps New fee in basis points.
    function setProtocolFee(uint256 bps) external onlyOwner {
        if (bps > 500) revert FeeExceedsMax(bps);
        uint256 oldBps = protocolFeeBps;
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(oldBps, bps);
    }

    /// @notice Withdraw accumulated protocol fees.
    function withdrawFees() external onlyOwner {
        uint256 amount = protocolFeeBalance;
        if (amount == 0) revert NoFeesToWithdraw();
        protocolFeeBalance = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), amount);
    }

    /// @notice Update the InkdToken contract address.
    /// @param _inkdToken New InkdToken contract address.
    function setInkdToken(address _inkdToken) external onlyOwner {
        if (_inkdToken == address(0)) revert ZeroAddress();
        inkdToken = IInkdToken(_inkdToken);
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    /// @dev Calculate the protocol fee from a payment.
    function _calculateFee(uint256 amount) internal view returns (uint256) {
        return (amount * protocolFeeBps) / 10_000;
    }

    /// @dev Count active (non-removed) inscriptions on a token.
    function _getActiveInscriptionCount(uint256 tokenId) internal view returns (uint256 count) {
        Inscription[] storage inscs = _inscriptions[tokenId];
        for (uint256 i; i < inscs.length; ) {
            if (!inscs[i].isRemoved) {
                count++;
            }
            unchecked { ++i; }
        }
    }

    /// @dev UUPS upgrade authorization.
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
