/**
 * @file registry.ts
 * @description AssemblyScript event handlers for InkdRegistry.
 *              Maps on-chain events → subgraph entities.
 */
import { ProjectCreated, VersionPushed, CollaboratorAdded, CollaboratorRemoved, ProjectTransferred, VisibilityChanged, VersionFeeUpdated, TransferFeeUpdated, ReadmeUpdated, AgentRegistered } from "../generated/InkdRegistry/InkdRegistry";
/**
 * ProjectCreated — fired when a user locks 1 $INKD and registers a project.
 */
export declare function handleProjectCreated(event: ProjectCreated): void;
/**
 * VersionPushed — fired when a new file version is pushed to Arweave.
 */
export declare function handleVersionPushed(event: VersionPushed): void;
/**
 * CollaboratorAdded — project owner added a new collaborator.
 */
export declare function handleCollaboratorAdded(event: CollaboratorAdded): void;
/**
 * CollaboratorRemoved — project owner removed a collaborator.
 */
export declare function handleCollaboratorRemoved(event: CollaboratorRemoved): void;
/**
 * ProjectTransferred — project ownership changed hands.
 */
export declare function handleProjectTransferred(event: ProjectTransferred): void;
/**
 * VisibilityChanged — project toggled public/private.
 */
export declare function handleVisibilityChanged(event: VisibilityChanged): void;
/**
 * VersionFeeUpdated — admin changed the per-version push fee.
 */
export declare function handleVersionFeeUpdated(event: VersionFeeUpdated): void;
/**
 * TransferFeeUpdated — admin changed the project transfer fee.
 */
export declare function handleTransferFeeUpdated(event: TransferFeeUpdated): void;
/**
 * ReadmeUpdated — project owner updated the README Arweave hash.
 */
export declare function handleReadmeUpdated(event: ReadmeUpdated): void;
/**
 * AgentRegistered — a project registered (or updated) as an AI agent.
 */
export declare function handleAgentRegistered(event: AgentRegistered): void;
