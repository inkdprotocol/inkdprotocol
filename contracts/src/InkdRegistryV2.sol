// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {InkdRegistry} from "./InkdRegistry.sol";

/// @title InkdRegistryV2 — UUPS upgrade of InkdRegistry
/// @notice Adds rich metadata (metadataUri, forkOf, accessManifest, tagsHash) and
///         on-chain agent-address attribution for versions.
///
/// @dev V2 payment model:
///      - createProjectV2 / pushVersionV2 are SETTLER-ONLY — no USDC pull from msg.sender.
///      - Payment was already processed off-chain via x402 (USDC→Treasury→settle()).
///      - The settler address (API server wallet) is the only one allowed to call V2 write functions.
///      - V1 functions (createProject/pushVersion) remain for direct on-chain flows with fee pull.
///
/// @dev Storage layout:
///      All V2 fields use separate mappings appended AFTER all V1 state. Never modify V1 structs.
contract InkdRegistryV2 is InkdRegistry {

    // ───── V2 Storage ────────────────────────────────────────────────────────
    // NOTE: Storage order matters for proxy layout. These must always be appended at the end.

    /// @notice Authorized settler (API server wallet). Only address allowed to call V2 write functions.
    address public settler;

    /// @notice Arweave URI for rich off-chain project metadata (inkd/project/v1 JSON schema).
    mapping(uint256 => string) public projectMetadataUri;

    /// @notice Fork lineage: 0 = original, N = forked from project N.
    mapping(uint256 => uint256) public projectForkOf;

    /// @notice Arweave hash of the access control manifest (for private/encrypted projects).
    mapping(uint256 => string) public projectAccessManifest;

    /// @notice keccak256 of comma-separated tags string (for discovery).
    mapping(uint256 => bytes32) public projectTagsHash;

    /// @notice Fork index: _forks[originalId] = list of fork project IDs.
    mapping(uint256 => uint256[]) internal _forks;

    /// @notice Real agent address that triggered a version push (not the relayer/server wallet).
    /// @dev    versionAgent[projectId][versionIndex] = agentAddress
    mapping(uint256 => mapping(uint256 => address)) public versionAgent;

    /// @notice Arweave hash of per-version metadata JSON.
    /// @dev    versionMetaHash[projectId][versionIndex] = arweaveHash
    mapping(uint256 => mapping(uint256 => string)) public versionMetaHash;

    // ───── V2 Events ─────────────────────────────────────────────────────────

    event ProjectCreatedV2(
        uint256 indexed projectId,
        address indexed owner,
        string  name,
        uint256 forkOf,
        string  metadataUri
    );

    event VersionPushedV2(
        uint256 indexed projectId,
        uint256 indexed versionIndex,
        string  arweaveHash,
        string  versionTag,
        address indexed agentAddress
    );

    event MetadataUriUpdated(uint256 indexed projectId, string uri);
    event AccessManifestUpdated(uint256 indexed projectId, string manifestHash);
    event TagsHashUpdated(uint256 indexed projectId, bytes32 hash);
    event ProjectForked(uint256 indexed newProjectId, uint256 indexed originalProjectId, address indexed owner);
    event SettlerSet(address indexed settler);

    // ───── V2 Errors ─────────────────────────────────────────────────────────

    error Unauthorized();
    error InvalidForkTarget();

    // ───── Modifiers ─────────────────────────────────────────────────────────

    modifier onlySettler() {
        if (msg.sender != settler && msg.sender != owner()) revert Unauthorized();
        _;
    }

    // ───── V2 Admin ──────────────────────────────────────────────────────────

    /// @notice Set the settler address (API server wallet). Owner only.
    function setSettler(address settler_) external onlyOwner {
        if (settler_ == address(0)) revert ZeroAddress();
        settler = settler_;
        emit SettlerSet(settler_);
    }

    // ───── V2 Write Functions (settler-only, fee-free) ────────────────────────

    /// @notice Create a project with V2 metadata fields. Fee pre-paid via x402 off-chain.
    /// @param metadataUri_        Arweave URI for off-chain JSON metadata (optional).
    /// @param forkOf_             Project ID this forks from, 0 if original.
    /// @param accessManifestHash_ Arweave hash of access control manifest (optional).
    /// @param tagsHash_           keccak256 of comma-separated tags (optional).
    function createProjectV2(
        string calldata name,
        string calldata description,
        string calldata license,
        bool isPublic,
        string calldata readmeHash,
        bool isAgent,
        string calldata agentEndpoint,
        string calldata metadataUri_,
        uint256 forkOf_,
        string calldata accessManifestHash_,
        bytes32 tagsHash_
    ) external onlySettler {
        if (forkOf_ != 0 && !projects[forkOf_].exists) revert InvalidForkTarget();

        uint256 id = _createProjectCore(name, description, license, isPublic, readmeHash, isAgent, agentEndpoint);

        // V2 extra state (skip if empty/zero — saves gas)
        if (bytes(metadataUri_).length > 0)        projectMetadataUri[id]    = metadataUri_;
        if (forkOf_ != 0)                           projectForkOf[id]         = forkOf_;
        if (bytes(accessManifestHash_).length > 0)  projectAccessManifest[id] = accessManifestHash_;
        if (tagsHash_ != bytes32(0))                projectTagsHash[id]       = tagsHash_;

        emit ProjectCreatedV2(id, msg.sender, projects[id].name, forkOf_, metadataUri_);

        if (forkOf_ != 0) {
            _forks[forkOf_].push(id);
            emit ProjectForked(id, forkOf_, msg.sender);
        }
    }

    /// @notice Push a version with V2 attribution. Fee pre-paid via x402 off-chain.
    /// @param agentAddress_              Address of the agent that triggered this push.
    /// @param versionMetadataArweaveHash_ Arweave hash of version metadata JSON (optional).
    function pushVersionV2(
        uint256 projectId,
        string calldata arweaveHash,
        string calldata versionTag,
        string calldata changelog,
        address agentAddress_,
        string calldata versionMetadataArweaveHash_
    ) external onlySettler {
        Project storage p = projects[projectId];
        if (!p.exists) revert ProjectNotFound();

        uint256 versionIndex = _versions[projectId].length;

        _versions[projectId].push(Version({
            projectId:   projectId,
            arweaveHash: arweaveHash,
            versionTag:  versionTag,
            changelog:   changelog,
            pushedBy:    msg.sender,
            pushedAt:    block.timestamp
        }));
        p.versionCount++;

        // V2 attribution
        if (agentAddress_ != address(0))
            versionAgent[projectId][versionIndex] = agentAddress_;
        if (bytes(versionMetadataArweaveHash_).length > 0)
            versionMetaHash[projectId][versionIndex] = versionMetadataArweaveHash_;

        emit VersionPushed(projectId, arweaveHash, versionTag, msg.sender);
        emit VersionPushedV2(projectId, versionIndex, arweaveHash, versionTag, agentAddress_);
    }

    // ───── V2 Setters (owner/collaborator) ───────────────────────────────────

    function setMetadataUri(uint256 projectId, string calldata uri) external {
        if (projects[projectId].owner != msg.sender && !isCollaborator[projectId][msg.sender])
            revert NotOwnerOrCollaborator();
        projectMetadataUri[projectId] = uri;
        emit MetadataUriUpdated(projectId, uri);
    }

    function setAccessManifest(uint256 projectId, string calldata manifestHash) external {
        if (projects[projectId].owner != msg.sender && !isCollaborator[projectId][msg.sender])
            revert NotOwnerOrCollaborator();
        projectAccessManifest[projectId] = manifestHash;
        emit AccessManifestUpdated(projectId, manifestHash);
    }

    function setTagsHash(uint256 projectId, bytes32 hash_) external {
        if (projects[projectId].owner != msg.sender && !isCollaborator[projectId][msg.sender])
            revert NotOwnerOrCollaborator();
        projectTagsHash[projectId] = hash_;
        emit TagsHashUpdated(projectId, hash_);
    }

    // ───── V2 View Functions ──────────────────────────────────────────────────

    /// @notice Returns full V2 project metadata.
    function getProjectV2(uint256 projectId)
        external view
        returns (
            Project memory p,
            string memory metadataUri,
            uint256 forkOf,
            string memory accessManifest,
            bytes32 tagsHash
        )
    {
        if (!projects[projectId].exists) revert ProjectNotFound();
        return (
            projects[projectId],
            projectMetadataUri[projectId],
            projectForkOf[projectId],
            projectAccessManifest[projectId],
            projectTagsHash[projectId]
        );
    }

    /// @notice Returns the agent address for a given version.
    function getVersionAgent(uint256 projectId, uint256 versionIndex) external view returns (address) {
        return versionAgent[projectId][versionIndex];
    }

    /// @notice Returns list of fork project IDs for a given original project.
    function getForks(uint256 originalId) external view returns (uint256[] memory) {
        return _forks[originalId];
    }

    /// @notice Returns the protocol version string.
    function version() external pure override returns (string memory) {
        return "v2";
    }
}
