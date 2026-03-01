// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {InkdTreasury} from "./InkdTreasury.sol";

/// @title InkdRegistry — Project registry for the Inkd Protocol
/// @notice Lock 1 $INKD to create a project. Push versions for 0.001 ETH each.
contract InkdRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ───── Constants ─────
    uint256 public constant VERSION_FEE = 0.001 ether;
    uint256 public constant TOKEN_LOCK_AMOUNT = 1 ether; // 1 $INKD (18 decimals)

    // ───── State ─────
    IERC20 public inkdToken;
    InkdTreasury public treasury;
    uint256 public projectCount;

    // ───── Structs ─────
    struct Project {
        uint256 id;
        string name;
        string description;
        address owner;
        bool isPublic;
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
    event ProjectCreated(uint256 indexed projectId, address indexed owner, string name);
    event VersionPushed(uint256 indexed projectId, string arweaveHash, string versionTag, address pushedBy);
    event CollaboratorAdded(uint256 indexed projectId, address collaborator);
    event CollaboratorRemoved(uint256 indexed projectId, address collaborator);
    event ProjectTransferred(uint256 indexed projectId, address indexed oldOwner, address indexed newOwner);
    event VisibilityChanged(uint256 indexed projectId, bool isPublic);

    // ───── Errors ─────
    error NameTaken();
    error EmptyName();
    error ProjectNotFound();
    error NotOwner();
    error NotOwnerOrCollaborator();
    error InsufficientFee();
    error AlreadyCollaborator();
    error NotCollaborator();
    error CannotAddOwner();
    error ZeroAddress();

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

    function initialize(address owner_, address token_, address treasury_) external initializer {
        __Ownable_init(owner_);
        inkdToken = IERC20(token_);
        treasury = InkdTreasury(payable(treasury_));
    }

    // ───── Core Functions ─────

    /// @notice Create a project. Locks 1 $INKD from the caller.
    function createProject(string calldata name, string calldata description, bool isPublic) external {
        if (bytes(name).length == 0) revert EmptyName();
        if (nameTaken[name]) revert NameTaken();

        // Lock 1 $INKD in this contract
        inkdToken.safeTransferFrom(msg.sender, address(this), TOKEN_LOCK_AMOUNT);

        uint256 id = ++projectCount;
        projects[id] = Project({
            id: id,
            name: name,
            description: description,
            owner: msg.sender,
            isPublic: isPublic,
            createdAt: block.timestamp,
            versionCount: 0,
            exists: true
        });

        nameTaken[name] = true;
        _ownerProjects[msg.sender].push(id);

        emit ProjectCreated(id, msg.sender, name);
    }

    /// @notice Push a new version. Requires 0.001 ETH sent to Treasury.
    function pushVersion(
        uint256 projectId,
        string calldata arweaveHash,
        string calldata versionTag,
        string calldata changelog
    ) external payable {
        Project storage p = projects[projectId];
        if (!p.exists) revert ProjectNotFound();
        if (p.owner != msg.sender && !isCollaborator[projectId][msg.sender]) {
            revert NotOwnerOrCollaborator();
        }
        if (msg.value < VERSION_FEE) revert InsufficientFee();

        _versions[projectId].push(Version({
            projectId: projectId,
            arweaveHash: arweaveHash,
            versionTag: versionTag,
            changelog: changelog,
            pushedBy: msg.sender,
            pushedAt: block.timestamp
        }));
        p.versionCount++;

        // Forward fee to treasury
        treasury.deposit{value: msg.value}();

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

        // Remove from array
        address[] storage collabs = _collaborators[projectId];
        for (uint256 i; i < collabs.length; i++) {
            if (collabs[i] == collaborator) {
                collabs[i] = collabs[collabs.length - 1];
                collabs.pop();
                break;
            }
        }

        emit CollaboratorRemoved(projectId, collaborator);
    }

    /// @notice Transfer project ownership. $INKD stays locked.
    function transferProject(uint256 projectId, address newOwner) external onlyProjectOwner(projectId) {
        if (newOwner == address(0)) revert ZeroAddress();

        address oldOwner = projects[projectId].owner;
        projects[projectId].owner = newOwner;

        // Update owner project lists
        _ownerProjects[newOwner].push(projectId);
        _removeFromOwnerProjects(oldOwner, projectId);

        // Remove new owner from collaborators if they were one
        if (isCollaborator[projectId][newOwner]) {
            isCollaborator[projectId][newOwner] = false;
            address[] storage collabs = _collaborators[projectId];
            for (uint256 i; i < collabs.length; i++) {
                if (collabs[i] == newOwner) {
                    collabs[i] = collabs[collabs.length - 1];
                    collabs.pop();
                    break;
                }
            }
        }

        emit ProjectTransferred(projectId, oldOwner, newOwner);
    }

    /// @notice Set project visibility. Owner only.
    function setVisibility(uint256 projectId, bool isPublic) external onlyProjectOwner(projectId) {
        projects[projectId].isPublic = isPublic;
        emit VisibilityChanged(projectId, isPublic);
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

    // ───── Internal ─────

    function _removeFromOwnerProjects(address owner_, uint256 projectId) internal {
        uint256[] storage ids = _ownerProjects[owner_];
        for (uint256 i; i < ids.length; i++) {
            if (ids[i] == projectId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
