"use strict";
/**
 * @file registry.ts
 * @description AssemblyScript event handlers for InkdRegistry.
 *              Maps on-chain events → subgraph entities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleProjectCreated = handleProjectCreated;
exports.handleVersionPushed = handleVersionPushed;
exports.handleCollaboratorAdded = handleCollaboratorAdded;
exports.handleCollaboratorRemoved = handleCollaboratorRemoved;
exports.handleProjectTransferred = handleProjectTransferred;
exports.handleVisibilityChanged = handleVisibilityChanged;
exports.handleVersionFeeUpdated = handleVersionFeeUpdated;
exports.handleTransferFeeUpdated = handleTransferFeeUpdated;
exports.handleReadmeUpdated = handleReadmeUpdated;
exports.handleAgentRegistered = handleAgentRegistered;
const graph_ts_1 = require("@graphprotocol/graph-ts");
const schema_1 = require("../generated/schema");
const utils_1 = require("./utils");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadOrCreateAccount(address) {
    let id = address.toHexString();
    let account = schema_1.Account.load(id);
    if (account == null) {
        account = new schema_1.Account(id);
        account.save();
    }
    return account;
}
function loadProject(projectId) {
    let project = schema_1.Project.load(projectId.toString());
    // Defensive: should always exist by the time downstream events fire
    if (project == null) {
        project = new schema_1.Project(projectId.toString());
        project.projectId = projectId;
        project.name = "";
        project.description = "";
        project.license = "";
        project.readmeHash = "";
        project.owner = graph_ts_1.Bytes.empty();
        project.isPublic = false;
        project.isAgent = false;
        project.agentEndpoint = "";
        project.createdAt = utils_1.ZERO_BI;
        project.versionCount = utils_1.ZERO_BI;
    }
    return project;
}
// ─── Event Handlers ───────────────────────────────────────────────────────────
/**
 * ProjectCreated — fired when a user locks 1 $INKD and registers a project.
 */
function handleProjectCreated(event) {
    let projectId = event.params.projectId;
    let owner = event.params.owner;
    // Ensure the account entity exists
    loadOrCreateAccount(owner);
    // Create the project entity
    let project = new schema_1.Project(projectId.toString());
    project.projectId = projectId;
    project.name = event.params.name;
    project.description = ""; // Not emitted; fetched from contract state if needed
    project.license = event.params.license;
    project.readmeHash = "";
    project.owner = owner;
    project.isPublic = true; // Default; updated via VisibilityChanged
    project.isAgent = false; // Updated via AgentRegistered
    project.agentEndpoint = "";
    project.createdAt = event.block.timestamp;
    project.versionCount = utils_1.ZERO_BI;
    project.save();
    // Update global stats
    let stats = (0, utils_1.loadOrCreateStats)(event.block.timestamp);
    stats.totalProjects = stats.totalProjects.plus(utils_1.ONE_BI);
    stats.lastUpdated = event.block.timestamp;
    stats.save();
}
/**
 * VersionPushed — fired when a new file version is pushed to Arweave.
 */
function handleVersionPushed(event) {
    let projectId = event.params.projectId;
    let project = loadProject(projectId);
    // Version index = current versionCount (0-based) before increment
    let versionIndex = project.versionCount;
    let versionId = (0, utils_1.buildId)([projectId.toString(), versionIndex.toString()]);
    let version = new schema_1.Version(versionId);
    version.project = project.id;
    version.arweaveHash = event.params.arweaveHash;
    version.versionTag = event.params.versionTag;
    version.changelog = ""; // Not emitted; use contract call for full changelog
    version.pushedBy = event.params.pushedBy;
    version.pushedAt = event.block.timestamp;
    version.blockNumber = event.block.number;
    version.transactionHash = event.transaction.hash;
    version.save();
    // Ensure pusher account exists
    loadOrCreateAccount(event.params.pushedBy);
    // Increment project version count
    project.versionCount = project.versionCount.plus(utils_1.ONE_BI);
    project.save();
    // Update global stats
    let stats = (0, utils_1.loadOrCreateStats)(event.block.timestamp);
    stats.totalVersions = stats.totalVersions.plus(utils_1.ONE_BI);
    stats.totalVersionFees = stats.totalVersionFees.plus(stats.versionFee);
    stats.lastUpdated = event.block.timestamp;
    stats.save();
}
/**
 * CollaboratorAdded — project owner added a new collaborator.
 */
function handleCollaboratorAdded(event) {
    let projectId = event.params.projectId;
    let collaboratorAddr = event.params.collaborator;
    let collaboratorId = (0, utils_1.buildId)([projectId.toString(), collaboratorAddr.toHexString()]);
    let collaborator = schema_1.Collaborator.load(collaboratorId);
    if (collaborator == null) {
        collaborator = new schema_1.Collaborator(collaboratorId);
        collaborator.project = projectId.toString();
        collaborator.address = collaboratorAddr;
        collaborator.addedAt = event.block.timestamp;
    }
    collaborator.active = true;
    collaborator.save();
    // Ensure account exists
    loadOrCreateAccount(collaboratorAddr);
}
/**
 * CollaboratorRemoved — project owner removed a collaborator.
 */
function handleCollaboratorRemoved(event) {
    let projectId = event.params.projectId;
    let collaboratorAddr = event.params.collaborator;
    let collaboratorId = (0, utils_1.buildId)([projectId.toString(), collaboratorAddr.toHexString()]);
    let collaborator = schema_1.Collaborator.load(collaboratorId);
    if (collaborator != null) {
        collaborator.active = false;
        collaborator.save();
    }
}
/**
 * ProjectTransferred — project ownership changed hands.
 */
function handleProjectTransferred(event) {
    let projectId = event.params.projectId;
    let oldOwner = event.params.oldOwner;
    let newOwner = event.params.newOwner;
    let project = loadProject(projectId);
    project.owner = newOwner;
    project.save();
    // Ensure both accounts exist
    loadOrCreateAccount(oldOwner);
    loadOrCreateAccount(newOwner);
    // Record the transfer
    let transferId = (0, utils_1.buildId)([
        event.transaction.hash.toHexString(),
        event.logIndex.toString(),
    ]);
    let transfer = new schema_1.ProjectTransfer(transferId);
    transfer.project = project.id;
    transfer.from = oldOwner;
    transfer.to = newOwner;
    transfer.timestamp = event.block.timestamp;
    transfer.blockNumber = event.block.number;
    transfer.transactionHash = event.transaction.hash;
    transfer.save();
    // Update stats for transfer fee
    let stats = (0, utils_1.loadOrCreateStats)(event.block.timestamp);
    stats.totalTransferFees = stats.totalTransferFees.plus(stats.transferFee);
    stats.lastUpdated = event.block.timestamp;
    stats.save();
}
/**
 * VisibilityChanged — project toggled public/private.
 */
function handleVisibilityChanged(event) {
    let project = loadProject(event.params.projectId);
    project.isPublic = event.params.isPublic;
    project.save();
}
/**
 * VersionFeeUpdated — admin changed the per-version push fee.
 */
function handleVersionFeeUpdated(event) {
    let stats = (0, utils_1.loadOrCreateStats)(event.block.timestamp);
    stats.versionFee = event.params.newFee;
    stats.lastUpdated = event.block.timestamp;
    stats.save();
}
/**
 * TransferFeeUpdated — admin changed the project transfer fee.
 */
function handleTransferFeeUpdated(event) {
    let stats = (0, utils_1.loadOrCreateStats)(event.block.timestamp);
    stats.transferFee = event.params.newFee;
    stats.lastUpdated = event.block.timestamp;
    stats.save();
}
/**
 * ReadmeUpdated — project owner updated the README Arweave hash.
 */
function handleReadmeUpdated(event) {
    let project = loadProject(event.params.projectId);
    project.readmeHash = event.params.arweaveHash;
    project.save();
}
/**
 * AgentRegistered — a project registered (or updated) as an AI agent.
 */
function handleAgentRegistered(event) {
    let project = loadProject(event.params.projectId);
    let wasAgent = project.isAgent;
    project.isAgent = true;
    project.agentEndpoint = event.params.endpoint;
    project.save();
    // Only increment agent count on first registration
    if (!wasAgent) {
        let stats = (0, utils_1.loadOrCreateStats)(event.block.timestamp);
        stats.totalAgentProjects = stats.totalAgentProjects.plus(utils_1.ONE_BI);
        stats.lastUpdated = event.block.timestamp;
        stats.save();
    }
}
//# sourceMappingURL=registry.js.map