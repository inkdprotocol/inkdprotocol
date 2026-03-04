// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {InkdTreasury} from "./InkdTreasury.sol";

/// @title InkdRegistry — Project registry for the Inkd Protocol
/// @notice Register projects and push versions. Fees paid in USDC, auto-split by Treasury.
contract InkdRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ───── State ─────
    IERC20 public usdc;
    InkdTreasury public treasury;
    uint256 public projectCount;

    // ───── Structs ─────
    struct Project {
        uint256 id;
        string name;
        string description;
        string license;
        string readmeHash;
        address owner;
        bool isPublic;
        bool isAgent;
        string agentEndpoint;
        uint256 createdAt;
        uint256 versionCount;
        bool exists;
    }

    struct Version {
        uint256 projectId;
        string arweaveHash;
        string versionTag;
        string changelog;
        address pushedBy;
        uint256 pushedAt;
    }

    // ───── Mappings ─────
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Version[]) private _versions;
    mapping(uint256 => address[]) private _collaborators;
    mapping(string => bool) public nameTaken;
    mapping(address => uint256[]) private _ownerProjects;
    mapping(uint256 => mapping(address => bool)) public isCollaborator;

    // ───── Events ─────
    event ProjectCreated(uint256 indexed projectId, address indexed owner, string name, string license);
    event VersionPushed(uint256 indexed projectId, string arweaveHash, string versionTag, address pushedBy);
    event CollaboratorAdded(uint256 indexed projectId, address collaborator);
    event CollaboratorRemoved(uint256 indexed projectId, address collaborator);
    event ProjectTransferred(uint256 indexed projectId, address indexed oldOwner, address indexed newOwner);
    event VisibilityChanged(uint256 indexed projectId, bool isPublic);
    event VersionFeeUpdated(uint256 oldFee, uint256 newFee);
    event TransferFeeUpdated(uint256 oldFee, uint256 newFee);
    event UsdcSet(address indexed usdc);
    event ReadmeUpdated(uint256 indexed projectId, string arweaveHash);
    event AgentRegistered(uint256 indexed projectId, string endpoint);

    // ───── Errors ─────
    error NameTaken();
    error EmptyName();
    error ProjectNotFound();
    error NotOwner();
    error NotOwnerOrCollaborator();
    error InsufficientAllowance();
    error InsufficientFee();
    error AlreadyCollaborator();
    error NotCollaborator();
    error CannotAddOwner();
    error ZeroAddress();
    error FeeExceedsMax();

    // ───── Modifiers ─────
    modifier onlyProjectOwner(uint256 projectId) {
        if (!projects[projectId].exists) revert ProjectNotFound();
        if (projects[projectId].owner != msg.sender) revert NotOwner();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address usdc_, address treasury_) external initializer {
        __Ownable_init(owner_);
        usdc = IERC20(usdc_);
        treasury = InkdTreasury(payable(treasury_));
    }

    // ───── Admin Functions ─────

    /// @notice Update the USDC token address. Owner only.
    function setUsdc(address usdc_) external onlyOwner {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        emit UsdcSet(usdc_);
    }

    // ───── Core Functions ─────

    /// @notice Create a project. Locks 1 $INKD from the caller.
    function createProject(
        string calldata name,
        string calldata description,
        string calldata license,
        bool isPublic,
        string calldata readmeHash,
        bool isAgent,
        string calldata agentEndpoint
    ) external {
        if (bytes(name).length == 0) revert EmptyName();

        string memory normalized = _normalizeName(name);
        if (nameTaken[normalized]) revert NameTaken();

        uint256 id = ++projectCount;
        projects[id] = Project({
            id: id,
            name: normalized,
            description: description,
            license: license,
            readmeHash: readmeHash,
            owner: msg.sender,
            isPublic: isPublic,
            isAgent: isAgent,
            agentEndpoint: agentEndpoint,
            createdAt: block.timestamp,
            versionCount: 0,
            exists: true
        });

        nameTaken[normalized] = true;
        _ownerProjects[msg.sender].push(id);

        emit ProjectCreated(id, msg.sender, normalized, license);

        if (isAgent) {
            emit AgentRegistered(id, agentEndpoint);
        }
    }

    /// @notice Push a new version. Charges serviceFee USDC (set in Treasury). Auto-split on receipt.
    function pushVersion(
        uint256 projectId,
        string calldata arweaveHash,
        string calldata versionTag,
        string calldata changelog
    ) external {
        Project storage p = projects[projectId];
        if (!p.exists) revert ProjectNotFound();
        if (p.owner != msg.sender && !isCollaborator[projectId][msg.sender]) {
            revert NotOwnerOrCollaborator();
        }

        uint256 fee = treasury.serviceFee();
        if (fee > 0) {
            // Pull USDC from caller → treasury, then notify treasury to split
            usdc.safeTransferFrom(msg.sender, address(treasury), fee);
            treasury.receivePayment(fee);
        }

        _versions[projectId].push(Version({
            projectId: projectId,
            arweaveHash: arweaveHash,
            versionTag: versionTag,
            changelog: changelog,
            pushedBy: msg.sender,
            pushedAt: block.timestamp
        }));
        p.versionCount++;

        emit VersionPushed(projectId, arweaveHash, versionTag, msg.sender);
    }

    /// @notice Add a collaborator to a project. Owner only.
    function addCollaborator(uint256 projectId, address collaborator) external onlyProjectOwner(projectId) {
        if (collaborator == address(0)) revert ZeroAddress();
        if (collaborator == projects[projectId].owner) revert CannotAddOwner();
        if (isCollaborator[projectId][collaborator]) revert AlreadyCollaborator();

        isCollaborator[projectId][collaborator] = true;
        _collaborators[projectId].push(collaborator);

        emit CollaboratorAdded(projectId, collaborator);
    }

    /// @notice Remove a collaborator from a project. Owner only.
    function removeCollaborator(uint256 projectId, address collaborator) external onlyProjectOwner(projectId) {
        if (!isCollaborator[projectId][collaborator]) revert NotCollaborator();

        isCollaborator[projectId][collaborator] = false;
        _removeFromAddressArray(_collaborators[projectId], collaborator);

        emit CollaboratorRemoved(projectId, collaborator);
    }

    /// @notice Transfer project ownership. Charges serviceFee USDC.
    function transferProject(uint256 projectId, address newOwner) external onlyProjectOwner(projectId) {
        if (newOwner == address(0)) revert ZeroAddress();

        uint256 fee = treasury.serviceFee();
        if (fee > 0) {
            usdc.safeTransferFrom(msg.sender, address(treasury), fee);
            treasury.receivePayment(fee);
        }

        address oldOwner = projects[projectId].owner;
        projects[projectId].owner = newOwner;

        _ownerProjects[newOwner].push(projectId);
        _removeFromOwnerProjects(oldOwner, projectId);

        if (isCollaborator[projectId][newOwner]) {
            isCollaborator[projectId][newOwner] = false;
            _removeFromAddressArray(_collaborators[projectId], newOwner);
        }

        emit ProjectTransferred(projectId, oldOwner, newOwner);
    }

    /// @notice Set project visibility. Owner only.
    function setVisibility(uint256 projectId, bool isPublic) external onlyProjectOwner(projectId) {
        projects[projectId].isPublic = isPublic;
        emit VisibilityChanged(projectId, isPublic);
    }

    /// @notice Update the README/docs Arweave hash. Owner only.
    function setReadme(uint256 projectId, string calldata arweaveHash) external onlyProjectOwner(projectId) {
        projects[projectId].readmeHash = arweaveHash;
        emit ReadmeUpdated(projectId, arweaveHash);
    }

    /// @notice Update the agent endpoint. Owner only.
    function setAgentEndpoint(uint256 projectId, string calldata endpoint) external onlyProjectOwner(projectId) {
        projects[projectId].agentEndpoint = endpoint;
        emit AgentRegistered(projectId, endpoint);
    }

    // ───── View Functions ─────

    function getProject(uint256 projectId) external view returns (Project memory) {
        return projects[projectId];
    }

    function getVersion(uint256 projectId, uint256 versionIndex) external view returns (Version memory) {
        return _versions[projectId][versionIndex];
    }

    function getVersionCount(uint256 projectId) external view returns (uint256) {
        return _versions[projectId].length;
    }

    function getCollaborators(uint256 projectId) external view returns (address[] memory) {
        return _collaborators[projectId];
    }

    function getOwnerProjects(address owner_) external view returns (uint256[] memory) {
        return _ownerProjects[owner_];
    }

    /// @notice Returns agent projects with pagination.
    function getAgentProjects(uint256 offset, uint256 limit) external view returns (Project[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= projectCount; i++) {
            if (projects[i].isAgent) count++;
        }

        if (offset >= count) return new Project[](0);
        uint256 resultSize = count - offset;
        if (resultSize > limit) resultSize = limit;

        Project[] memory result = new Project[](resultSize);
        uint256 found;
        uint256 added;

        for (uint256 i = 1; i <= projectCount && added < resultSize; i++) {
            if (projects[i].isAgent) {
                if (found >= offset) {
                    result[added] = projects[i];
                    added++;
                }
                found++;
            }
        }

        return result;
    }

    // ───── Internal ─────

    /// @notice Convert a string to lowercase (ASCII A-Z only).
    function _normalizeName(string memory name) internal pure returns (string memory) {
        bytes memory b = bytes(name);
        for (uint256 i; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) {
                b[i] = bytes1(uint8(b[i]) + 32);
            }
        }
        return string(b);
    }

    function _removeFromOwnerProjects(address owner_, uint256 projectId) internal {
        _removeFromUint256Array(_ownerProjects[owner_], projectId);
    }

    /// @dev Swap-and-pop removal from an address array. O(n) search, O(1) delete.
    function _removeFromAddressArray(address[] storage arr, address item) internal {
        uint256 len = arr.length;
        for (uint256 i; i < len; i++) {
            if (arr[i] == item) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }

    /// @dev Swap-and-pop removal from a uint256 array. O(n) search, O(1) delete.
    function _removeFromUint256Array(uint256[] storage arr, uint256 item) internal {
        uint256 len = arr.length;
        for (uint256 i; i < len; i++) {
            if (arr[i] == item) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
