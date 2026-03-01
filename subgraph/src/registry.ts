/**
 * @file registry.ts
 * @description AssemblyScript event handlers for InkdRegistry.
 *              Maps on-chain events → subgraph entities.
 */

import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ProjectCreated,
  VersionPushed,
  CollaboratorAdded,
  CollaboratorRemoved,
  ProjectTransferred,
  VisibilityChanged,
  VersionFeeUpdated,
  TransferFeeUpdated,
  ReadmeUpdated,
  AgentRegistered,
} from "../generated/InkdRegistry/InkdRegistry";
import {
  Project,
  Version,
  Collaborator,
  ProjectTransfer,
  Account,
} from "../generated/schema";
import {
  loadOrCreateStats,
  buildId,
  ONE_BI,
  ZERO_BI,
} from "./utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadOrCreateAccount(address: Bytes): Account {
  let id = address.toHexString();
  let account = Account.load(id);
  if (account == null) {
    account = new Account(id);
    account.save();
  }
  return account as Account;
}

function loadProject(projectId: BigInt): Project {
  let project = Project.load(projectId.toString());
  // Defensive: should always exist by the time downstream events fire
  if (project == null) {
    project = new Project(projectId.toString());
    project.projectId = projectId;
    project.name = "";
    project.description = "";
    project.license = "";
    project.readmeHash = "";
    project.owner = Bytes.empty();
    project.isPublic = false;
    project.isAgent = false;
    project.agentEndpoint = "";
    project.createdAt = ZERO_BI;
    project.versionCount = ZERO_BI;
  }
  return project as Project;
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

/**
 * ProjectCreated — fired when a user locks 1 $INKD and registers a project.
 */
export function handleProjectCreated(event: ProjectCreated): void {
  let projectId = event.params.projectId;
  let owner = event.params.owner;

  // Ensure the account entity exists
  loadOrCreateAccount(owner);

  // Create the project entity
  let project = new Project(projectId.toString());
  project.projectId = projectId;
  project.name = event.params.name;
  project.description = "";         // Not emitted; fetched from contract state if needed
  project.license = event.params.license;
  project.readmeHash = "";
  project.owner = owner;
  project.isPublic = true;          // Default; updated via VisibilityChanged
  project.isAgent = false;          // Updated via AgentRegistered
  project.agentEndpoint = "";
  project.createdAt = event.block.timestamp;
  project.versionCount = ZERO_BI;
  project.save();

  // Update global stats
  let stats = loadOrCreateStats(event.block.timestamp);
  stats.totalProjects = stats.totalProjects.plus(ONE_BI);
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

/**
 * VersionPushed — fired when a new file version is pushed to Arweave.
 */
export function handleVersionPushed(event: VersionPushed): void {
  let projectId = event.params.projectId;
  let project = loadProject(projectId);

  // Version index = current versionCount (0-based) before increment
  let versionIndex = project.versionCount;
  let versionId = buildId([projectId.toString(), versionIndex.toString()]);

  let version = new Version(versionId);
  version.project = project.id;
  version.arweaveHash = event.params.arweaveHash;
  version.versionTag = event.params.versionTag;
  version.changelog = "";           // Not emitted; use contract call for full changelog
  version.pushedBy = event.params.pushedBy;
  version.pushedAt = event.block.timestamp;
  version.blockNumber = event.block.number;
  version.transactionHash = event.transaction.hash;
  version.save();

  // Ensure pusher account exists
  loadOrCreateAccount(event.params.pushedBy);

  // Increment project version count
  project.versionCount = project.versionCount.plus(ONE_BI);
  project.save();

  // Update global stats
  let stats = loadOrCreateStats(event.block.timestamp);
  stats.totalVersions = stats.totalVersions.plus(ONE_BI);
  stats.totalVersionFees = stats.totalVersionFees.plus(stats.versionFee);
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

/**
 * CollaboratorAdded — project owner added a new collaborator.
 */
export function handleCollaboratorAdded(event: CollaboratorAdded): void {
  let projectId = event.params.projectId;
  let collaboratorAddr = event.params.collaborator;

  let collaboratorId = buildId([projectId.toString(), collaboratorAddr.toHexString()]);
  let collaborator = Collaborator.load(collaboratorId);

  if (collaborator == null) {
    collaborator = new Collaborator(collaboratorId);
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
export function handleCollaboratorRemoved(event: CollaboratorRemoved): void {
  let projectId = event.params.projectId;
  let collaboratorAddr = event.params.collaborator;

  let collaboratorId = buildId([projectId.toString(), collaboratorAddr.toHexString()]);
  let collaborator = Collaborator.load(collaboratorId);

  if (collaborator != null) {
    collaborator.active = false;
    collaborator.save();
  }
}

/**
 * ProjectTransferred — project ownership changed hands.
 */
export function handleProjectTransferred(event: ProjectTransferred): void {
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
  let transferId = buildId([
    event.transaction.hash.toHexString(),
    event.logIndex.toString(),
  ]);
  let transfer = new ProjectTransfer(transferId);
  transfer.project = project.id;
  transfer.from = oldOwner;
  transfer.to = newOwner;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  // Update stats for transfer fee
  let stats = loadOrCreateStats(event.block.timestamp);
  stats.totalTransferFees = stats.totalTransferFees.plus(stats.transferFee);
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

/**
 * VisibilityChanged — project toggled public/private.
 */
export function handleVisibilityChanged(event: VisibilityChanged): void {
  let project = loadProject(event.params.projectId);
  project.isPublic = event.params.isPublic;
  project.save();
}

/**
 * VersionFeeUpdated — admin changed the per-version push fee.
 */
export function handleVersionFeeUpdated(event: VersionFeeUpdated): void {
  let stats = loadOrCreateStats(event.block.timestamp);
  stats.versionFee = event.params.newFee;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

/**
 * TransferFeeUpdated — admin changed the project transfer fee.
 */
export function handleTransferFeeUpdated(event: TransferFeeUpdated): void {
  let stats = loadOrCreateStats(event.block.timestamp);
  stats.transferFee = event.params.newFee;
  stats.lastUpdated = event.block.timestamp;
  stats.save();
}

/**
 * ReadmeUpdated — project owner updated the README Arweave hash.
 */
export function handleReadmeUpdated(event: ReadmeUpdated): void {
  let project = loadProject(event.params.projectId);
  project.readmeHash = event.params.arweaveHash;
  project.save();
}

/**
 * AgentRegistered — a project registered (or updated) as an AI agent.
 */
export function handleAgentRegistered(event: AgentRegistered): void {
  let project = loadProject(event.params.projectId);
  let wasAgent = project.isAgent;
  project.isAgent = true;
  project.agentEndpoint = event.params.endpoint;
  project.save();

  // Only increment agent count on first registration
  if (!wasAgent) {
    let stats = loadOrCreateStats(event.block.timestamp);
    stats.totalAgentProjects = stats.totalAgentProjects.plus(ONE_BI);
    stats.lastUpdated = event.block.timestamp;
    stats.save();
  }
}
