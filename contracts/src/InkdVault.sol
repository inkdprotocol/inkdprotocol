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

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

interface IInkdToken {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function setInscriptionCount(uint256 tokenId, uint256 newCount) external;
    function isInkdHolder(address wallet) external view returns (bool);
}

contract InkdVault is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable
{
    // ─── Types ────────────────────────────────────────────────────────────

    struct Inscription {
        string arweaveHash;
        string contentType;
        uint256 size;
        string name;
        uint256 createdAt;
        bool isRemoved;
        uint256 version;
    }

    struct AccessGrant {
        address grantee;
        uint256 expiresAt;
        uint256 grantedAt;
    }

    // ─── Storage ──────────────────────────────────────────────────────────

    IInkdToken public inkdToken;
    uint256 public protocolFeeBps;
    uint256 public protocolFeeBalance;

    mapping(uint256 => Inscription[]) internal _inscriptions;
    mapping(uint256 => mapping(uint256 => string[])) internal _versionHistory;
    mapping(uint256 => mapping(address => AccessGrant)) public accessGrants;
    mapping(uint256 => address[]) internal _grantees;

    uint256 public totalInscriptions;
    uint256 public inscriptionFee;
    uint256 public constant MAX_GRANTS_PER_TOKEN = 100;

    // ─── Events ───────────────────────────────────────────────────────────

    event Inscribed(
        uint256 indexed tokenId,
        uint256 indexed inscriptionIndex,
        string arweaveHash,
        string contentType,
        uint256 size,
        string name,
        uint256 protocolFee
    );
    event InscriptionRemoved(uint256 indexed tokenId, uint256 indexed inscriptionIndex);
    event InscriptionUpdated(uint256 indexed tokenId, uint256 indexed inscriptionIndex, string newArweaveHash, uint256 newVersion);
    event AccessGranted(uint256 indexed tokenId, address indexed grantee, uint256 expiresAt);
    event AccessRevoked(uint256 indexed tokenId, address indexed grantee);
    event ProtocolFeeUpdated(uint256 oldBps, uint256 newBps);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────

    error NotInkdHolder();
    error NotTokenOwner(uint256 tokenId, address caller);
    error InscriptionNotFound(uint256 tokenId, uint256 index);
    error InscriptionAlreadyRemoved(uint256 tokenId, uint256 index);
    error FeeExceedsMax(uint256 bps);
    error ExpiryInPast(uint256 expiresAt);
    error TransferFailed();
    error NoFeesToWithdraw();
    error EmptyArweaveHash();
    error ZeroAddress();
    error InsufficientFee(uint256 required, uint256 sent);
    error TooManyGrants(uint256 tokenId);

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
        __Pausable_init();

        inkdToken = IInkdToken(_inkdToken);
        protocolFeeBps = 100;
        inscriptionFee = 0.0001 ether;
    }

    // ─── Core: Inscribe ───────────────────────────────────────────────────

    function inscribe(
        uint256 tokenId,
        string calldata arweaveHash,
        string calldata contentType,
        uint256 size,
        string calldata name
    ) external payable onlyInkdHolder onlyTokenOwner(tokenId) nonReentrant whenNotPaused returns (uint256 inscriptionIndex) {
        if (bytes(arweaveHash).length == 0) revert EmptyArweaveHash();
        if (msg.value < inscriptionFee) revert InsufficientFee(inscriptionFee, msg.value);

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

        _versionHistory[tokenId][inscriptionIndex].push(arweaveHash);

        uint256 activeCount = _getActiveInscriptionCount(tokenId);
        inkdToken.setInscriptionCount(tokenId, activeCount);

        totalInscriptions++;

        emit Inscribed(tokenId, inscriptionIndex, arweaveHash, contentType, size, name, fee);
    }

    // ─── Core: Remove ─────────────────────────────────────────────────────

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

        uint256 activeCount = _getActiveInscriptionCount(tokenId);
        inkdToken.setInscriptionCount(tokenId, activeCount);

        emit InscriptionRemoved(tokenId, inscriptionIndex);
    }

    // ─── Core: Update ─────────────────────────────────────────────────────

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

        _versionHistory[tokenId][inscriptionIndex].push(newArweaveHash);

        emit InscriptionUpdated(tokenId, inscriptionIndex, newArweaveHash, insc.version);
    }

    // ─── Queries ──────────────────────────────────────────────────────────

    function getInscriptions(uint256 tokenId) external view returns (Inscription[] memory) {
        return _inscriptions[tokenId];
    }

    function getInscription(
        uint256 tokenId,
        uint256 inscriptionIndex
    ) external view returns (Inscription memory) {
        if (inscriptionIndex >= _inscriptions[tokenId].length) {
            revert InscriptionNotFound(tokenId, inscriptionIndex);
        }
        return _inscriptions[tokenId][inscriptionIndex];
    }

    function getInscriptionCount(uint256 tokenId) external view returns (uint256) {
        return _inscriptions[tokenId].length;
    }

    function getVersionHistory(
        uint256 tokenId,
        uint256 inscriptionIndex
    ) external view returns (string[] memory) {
        return _versionHistory[tokenId][inscriptionIndex];
    }

    // ─── Access Grants ────────────────────────────────────────────────────

    function grantReadAccess(
        uint256 tokenId,
        address wallet,
        uint256 expiresAt
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        if (wallet == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp) revert ExpiryInPast(expiresAt);

        if (accessGrants[tokenId][wallet].grantee == address(0)) {
            if (_grantees[tokenId].length >= MAX_GRANTS_PER_TOKEN) revert TooManyGrants(tokenId);
            _grantees[tokenId].push(wallet);
        }

        accessGrants[tokenId][wallet] = AccessGrant({
            grantee: wallet,
            expiresAt: expiresAt,
            grantedAt: block.timestamp
        });

        emit AccessGranted(tokenId, wallet, expiresAt);
    }

    function revokeAccess(
        uint256 tokenId,
        address wallet
    ) external onlyInkdHolder onlyTokenOwner(tokenId) {
        delete accessGrants[tokenId][wallet];
        emit AccessRevoked(tokenId, wallet);
    }

    function hasAccess(
        uint256 tokenId,
        address wallet
    ) external view returns (bool) {
        try inkdToken.ownerOf(tokenId) returns (address tokenOwner) {
            if (tokenOwner == wallet) return true;
        } catch {
            return false;
        }

        AccessGrant memory grant = accessGrants[tokenId][wallet];
        return grant.expiresAt > block.timestamp;
    }

    function getActiveGrants(uint256 tokenId) external view returns (AccessGrant[] memory grants) {
        address[] memory granteeList = _grantees[tokenId];
        uint256 activeCount;

        for (uint256 i; i < granteeList.length; ) {
            if (accessGrants[tokenId][granteeList[i]].expiresAt > block.timestamp) {
                activeCount++;
            }
            unchecked { ++i; }
        }

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

    function setProtocolFee(uint256 bps) external onlyOwner {
        if (bps > 500) revert FeeExceedsMax(bps);
        uint256 oldBps = protocolFeeBps;
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(oldBps, bps);
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = protocolFeeBalance;
        if (amount == 0) revert NoFeesToWithdraw();
        protocolFeeBalance = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), amount);
    }

    function setInkdToken(address _inkdToken) external onlyOwner {
        if (_inkdToken == address(0)) revert ZeroAddress();
        inkdToken = IInkdToken(_inkdToken);
    }

    function setInscriptionFee(uint256 fee) external onlyOwner {
        inscriptionFee = fee;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    function _calculateFee(uint256 amount) internal view returns (uint256) {
        return (amount * protocolFeeBps) / 10_000;
    }

    function _getActiveInscriptionCount(uint256 tokenId) internal view returns (uint256 count) {
        Inscription[] storage inscs = _inscriptions[tokenId];
        for (uint256 i; i < inscs.length; ) {
            if (!inscs[i].isRemoved) {
                count++;
            }
            unchecked { ++i; }
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
