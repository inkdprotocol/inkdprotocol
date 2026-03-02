/**
 * @file ProjectRegistry.ts
 * @description TypeScript client for InkdRegistry.sol — the core project registry contract.
 *              Use this module to create projects, push versions, manage collaborators,
 *              and transfer ownership on-chain.
 *
 * @example
 * ```ts
 * import { ProjectRegistry } from "@inkd/sdk";
 * import { createWalletClient, createPublicClient, http } from "viem";
 * import { base } from "viem/chains";
 *
 * const registry = new ProjectRegistry({
 *   registryAddress: "0x...",
 *   tokenAddress: "0x...",
 *   chainId: 8453,
 * });
 *
 * registry.connect(walletClient, publicClient);
 *
 * // Create a project (locks 1 $INKD)
 * const { projectId } = await registry.createProject({
 *   name: "my-agent-brain",
 *   description: "Persistent memory store for AI agent",
 *   license: "MIT",
 *   isPublic: true,
 *   isAgent: true,
 *   agentEndpoint: "https://api.myagent.xyz",
 * });
 *
 * // Push a version
 * await registry.pushVersion({
 *   projectId,
 *   arweaveHash: "ar://your-file-hash",
 *   versionTag: "v1.0.0",
 *   changelog: "Initial release",
 * });
 * ```
 */

import type {
  PublicClient,
  WalletClient,
  Account,
  Chain,
  Transport,
  Log,
} from "viem";

// ─── ABIs ─────────────────────────────────────────────────────────────────────

/** Minimal ABI fragment for InkdRegistry.sol */
export const INKD_REGISTRY_ABI = [
  // ── Read ──────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "projectCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "versionFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "TOKEN_LOCK_AMOUNT",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProject",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id",            type: "uint256" },
          { name: "name",          type: "string"  },
          { name: "description",   type: "string"  },
          { name: "license",       type: "string"  },
          { name: "readmeHash",    type: "string"  },
          { name: "owner",         type: "address" },
          { name: "isPublic",      type: "bool"    },
          { name: "isAgent",       type: "bool"    },
          { name: "agentEndpoint", type: "string"  },
          { name: "createdAt",     type: "uint256" },
          { name: "versionCount",  type: "uint256" },
          { name: "exists",        type: "bool"    },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVersion",
    inputs: [
      { name: "projectId",    type: "uint256" },
      { name: "versionIndex", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "projectId",   type: "uint256" },
          { name: "arweaveHash", type: "string"  },
          { name: "versionTag",  type: "string"  },
          { name: "changelog",   type: "string"  },
          { name: "pushedBy",    type: "address" },
          { name: "pushedAt",    type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVersionCount",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCollaborators",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOwnerProjects",
    inputs: [{ name: "owner_", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentProjects",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit",  type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id",            type: "uint256" },
          { name: "name",          type: "string"  },
          { name: "description",   type: "string"  },
          { name: "license",       type: "string"  },
          { name: "readmeHash",    type: "string"  },
          { name: "owner",         type: "address" },
          { name: "isPublic",      type: "bool"    },
          { name: "isAgent",       type: "bool"    },
          { name: "agentEndpoint", type: "string"  },
          { name: "createdAt",     type: "uint256" },
          { name: "versionCount",  type: "uint256" },
          { name: "exists",        type: "bool"    },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isCollaborator",
    inputs: [
      { name: "projectId",    type: "uint256" },
      { name: "collaborator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nameTaken",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // ── Write ─────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "createProject",
    inputs: [
      { name: "name",          type: "string"  },
      { name: "description",   type: "string"  },
      { name: "license",       type: "string"  },
      { name: "isPublic",      type: "bool"    },
      { name: "readmeHash",    type: "string"  },
      { name: "isAgent",       type: "bool"    },
      { name: "agentEndpoint", type: "string"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pushVersion",
    inputs: [
      { name: "projectId",   type: "uint256" },
      { name: "arweaveHash", type: "string"  },
      { name: "versionTag",  type: "string"  },
      { name: "changelog",   type: "string"  },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "addCollaborator",
    inputs: [
      { name: "projectId",    type: "uint256" },
      { name: "collaborator", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeCollaborator",
    inputs: [
      { name: "projectId",    type: "uint256" },
      { name: "collaborator", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferProject",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "newOwner",  type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "setVisibility",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "isPublic",  type: "bool"    },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setReadme",
    inputs: [
      { name: "projectId",   type: "uint256" },
      { name: "arweaveHash", type: "string"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setAgentEndpoint",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "endpoint",  type: "string"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "ProjectCreated",
    inputs: [
      { name: "projectId", type: "uint256", indexed: true },
      { name: "owner",     type: "address", indexed: true },
      { name: "name",      type: "string",  indexed: false },
      { name: "license",   type: "string",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "VersionPushed",
    inputs: [
      { name: "projectId",   type: "uint256", indexed: true  },
      { name: "arweaveHash", type: "string",  indexed: false },
      { name: "versionTag",  type: "string",  indexed: false },
      { name: "pushedBy",    type: "address", indexed: false },
    ],
  },
] as const;

/** Minimal ABI fragment for InkdToken.sol (ERC-20 approve) */
export const INKD_ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type Address = `0x${string}`;

/** Mirrors InkdRegistry.Project struct */
export interface Project {
  id: bigint;
  name: string;
  description: string;
  license: string;
  readmeHash: string;
  owner: Address;
  isPublic: boolean;
  isAgent: boolean;
  agentEndpoint: string;
  createdAt: bigint;
  versionCount: bigint;
  exists: boolean;
}

/** Mirrors InkdRegistry.Version struct */
export interface ProjectVersion {
  projectId: bigint;
  arweaveHash: string;
  versionTag: string;
  changelog: string;
  pushedBy: Address;
  pushedAt: bigint;
}

/** Options for creating a project */
export interface CreateProjectOptions {
  /** Unique project name. Normalized to lowercase on-chain. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** SPDX license identifier, e.g. "MIT", "GPL-3.0", "Proprietary". */
  license?: string;
  /** Whether the project is publicly listed. Default: true. */
  isPublic?: boolean;
  /** Arweave hash of the README file. */
  readmeHash?: string;
  /** Whether this project represents an AI agent. */
  isAgent?: boolean;
  /** Agent API endpoint (only relevant when isAgent=true). */
  agentEndpoint?: string;
}

/** Options for pushing a version */
export interface PushVersionOptions {
  /** Project ID to push to. */
  projectId: bigint;
  /** Arweave transaction hash of the uploaded file. */
  arweaveHash: string;
  /** Version identifier, e.g. "v1.0.0" or "checkpoint-42". */
  versionTag: string;
  /** Human-readable changelog entry. */
  changelog?: string;
}

/** Result from createProject() */
export interface CreateProjectResult {
  /** Transaction hash. */
  hash: Address;
  /** The new project's on-chain ID. */
  projectId: bigint;
}

/** Result from pushVersion() */
export interface PushVersionResult {
  /** Transaction hash. */
  hash: Address;
  /** The version index within the project (0-based). */
  versionIndex: bigint;
}

/** Registry client configuration */
export interface ProjectRegistryConfig {
  /** InkdRegistry proxy address. */
  registryAddress: Address;
  /** $INKD ERC-20 token address. */
  tokenAddress: Address;
  /** Chain ID (8453 = Base, 84532 = Base Sepolia). */
  chainId: 8453 | 84532;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class RegistryNotConnected extends Error {
  constructor() {
    super("ProjectRegistry: call connect() before making on-chain calls");
    this.name = "RegistryNotConnected";
  }
}

export class InsufficientInkdBalance extends Error {
  constructor(balance: bigint, required: bigint) {
    super(
      `ProjectRegistry: insufficient $INKD balance. ` +
        `Have ${balance}, need ${required}`
    );
    this.name = "InsufficientInkdBalance";
  }
}

export class InsufficientEthBalance extends Error {
  constructor(fee: bigint) {
    super(
      `ProjectRegistry: insufficient ETH. Need at least ${fee} wei for fees`
    );
    this.name = "InsufficientEthBalance";
  }
}

// ─── ProjectRegistry ──────────────────────────────────────────────────────────

/**
 * TypeScript client for InkdRegistry.sol.
 *
 * Wraps all on-chain registry operations with typed inputs/outputs,
 * automatic $INKD approval, and fee estimation.
 */
export class ProjectRegistry {
  private config: ProjectRegistryConfig;
  private walletClient: WalletClient<Transport, Chain, Account> | null = null;
  private publicClient: PublicClient | null = null;

  constructor(config: ProjectRegistryConfig) {
    this.config = config;
  }

  // ─── Connection ─────────────────────────────────────────────────────────────

  /**
   * Attach viem wallet + public clients.
   * Must be called before any on-chain write.
   */
  connect(
    walletClient: WalletClient<Transport, Chain, Account>,
    publicClient: PublicClient
  ): void {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  /** Get a project by ID. Returns null if the project does not exist. */
  async getProject(projectId: bigint): Promise<Project | null> {
    this.requirePublic();
    const raw = await this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "getProject",
      args: [projectId],
    }) as Project;
    return raw.exists ? raw : null;
  }

  /** Get a specific version from a project. */
  async getVersion(
    projectId: bigint,
    versionIndex: bigint
  ): Promise<ProjectVersion> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "getVersion",
      args: [projectId, versionIndex],
    }) as Promise<ProjectVersion>;
  }

  /** Get all versions of a project in chronological order. */
  async getAllVersions(projectId: bigint): Promise<ProjectVersion[]> {
    this.requirePublic();
    const count = await this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "getVersionCount",
      args: [projectId],
    }) as bigint;

    return Promise.all(
      Array.from({ length: Number(count) }, (_, i) =>
        this.getVersion(projectId, BigInt(i))
      )
    );
  }

  /** Get all project IDs owned by an address. */
  async getOwnerProjects(owner: Address): Promise<bigint[]> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "getOwnerProjects",
      args: [owner],
    }) as Promise<bigint[]>;
  }

  /** Get all collaborators of a project. */
  async getCollaborators(projectId: bigint): Promise<Address[]> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "getCollaborators",
      args: [projectId],
    }) as Promise<Address[]>;
  }

  /** Check if an address is a collaborator on a project. */
  async isCollaborator(projectId: bigint, address: Address): Promise<boolean> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "isCollaborator",
      args: [projectId, address],
    }) as Promise<boolean>;
  }

  /** Check if a project name is already taken (case-insensitive). */
  async isNameTaken(name: string): Promise<boolean> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "nameTaken",
      args: [name.toLowerCase()],
    }) as Promise<boolean>;
  }

  /** Get all agent projects with optional pagination. */
  async getAgentProjects(
    offset = 0n,
    limit = 100n
  ): Promise<Project[]> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "getAgentProjects",
      args: [offset, limit],
    }) as Promise<Project[]>;
  }

  /** Get the current version fee (ETH wei). */
  async getVersionFee(): Promise<bigint> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "versionFee",
    }) as Promise<bigint>;
  }

  /** Get the current transfer fee (ETH wei). */
  async getTransferFee(): Promise<bigint> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "transferFee",
    }) as Promise<bigint>;
  }

  /** Get the total number of projects on-chain. */
  async getProjectCount(): Promise<bigint> {
    this.requirePublic();
    return this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "projectCount",
    }) as Promise<bigint>;
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  /**
   * Create a new project on-chain.
   *
   * Automatically approves the 1 $INKD token lock if the current allowance
   * is insufficient.
   *
   * @throws {InsufficientInkdBalance} if caller has less than 1 $INKD.
   */
  async createProject(opts: CreateProjectOptions): Promise<CreateProjectResult> {
    this.requireWallet();

    const lockAmount = await this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "TOKEN_LOCK_AMOUNT",
    }) as bigint;

    const account = this.walletClient!.account.address as Address;

    // Check balance
    const balance = await this.publicClient!.readContract({
      address: this.config.tokenAddress,
      abi: INKD_ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    }) as bigint;

    if (balance < lockAmount) {
      throw new InsufficientInkdBalance(balance, lockAmount);
    }

    // Approve if needed
    const allowance = await this.publicClient!.readContract({
      address: this.config.tokenAddress,
      abi: INKD_ERC20_ABI,
      functionName: "allowance",
      args: [account, this.config.registryAddress],
    }) as bigint;

    if (allowance < lockAmount) {
      const approveTx = await this.walletClient!.writeContract({
        address: this.config.tokenAddress,
        abi: INKD_ERC20_ABI,
        functionName: "approve",
        args: [this.config.registryAddress, lockAmount],
      });
      await this.publicClient!.waitForTransactionReceipt({ hash: approveTx });
    }

    // Create project
    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "createProject",
      args: [
        opts.name,
        opts.description ?? "",
        opts.license ?? "MIT",
        opts.isPublic ?? true,
        opts.readmeHash ?? "",
        opts.isAgent ?? false,
        opts.agentEndpoint ?? "",
      ],
    });

    const receipt = await this.publicClient!.waitForTransactionReceipt({ hash });
    const projectId = this.extractProjectIdFromLogs(receipt.logs);

    return { hash, projectId };
  }

  /**
   * Push a new version to an existing project.
   *
   * Automatically reads the current versionFee and sends the exact amount.
   * If you want to overpay (all excess goes to treasury), pass `value` explicitly.
   *
   * @throws {InsufficientEthBalance} if caller's ETH balance < versionFee.
   */
  async pushVersion(
    opts: PushVersionOptions,
    value?: bigint
  ): Promise<PushVersionResult> {
    this.requireWallet();

    const fee = value ?? (await this.getVersionFee());

    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "pushVersion",
      args: [
        opts.projectId,
        opts.arweaveHash,
        opts.versionTag,
        opts.changelog ?? "",
      ],
      value: fee,
    });

    await this.publicClient!.waitForTransactionReceipt({ hash });
    const versionCount = await this.publicClient!.readContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "getVersionCount",
      args: [opts.projectId],
    }) as bigint;

    return { hash, versionIndex: versionCount - 1n };
  }

  /** Add a collaborator to a project. Caller must be the project owner. */
  async addCollaborator(projectId: bigint, collaborator: Address): Promise<Address> {
    this.requireWallet();
    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "addCollaborator",
      args: [projectId, collaborator],
    });
    await this.publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  /** Remove a collaborator from a project. Caller must be the project owner. */
  async removeCollaborator(projectId: bigint, collaborator: Address): Promise<Address> {
    this.requireWallet();
    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "removeCollaborator",
      args: [projectId, collaborator],
    });
    await this.publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  /**
   * Transfer project ownership to a new address.
   * Automatically reads the current transferFee and sends the exact amount.
   *
   * Note: the 1 $INKD lock stays with the project — it is NOT refunded or
   * transferred back to the old owner.
   */
  async transferProject(
    projectId: bigint,
    newOwner: Address,
    value?: bigint
  ): Promise<Address> {
    this.requireWallet();
    const fee = value ?? (await this.getTransferFee());
    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "transferProject",
      args: [projectId, newOwner],
      value: fee,
    });
    await this.publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  /** Set project public/private visibility. Caller must be the project owner. */
  async setVisibility(projectId: bigint, isPublic: boolean): Promise<Address> {
    this.requireWallet();
    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "setVisibility",
      args: [projectId, isPublic],
    });
    await this.publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  /** Update the README Arweave hash. Caller must be the project owner. */
  async setReadme(projectId: bigint, arweaveHash: string): Promise<Address> {
    this.requireWallet();
    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "setReadme",
      args: [projectId, arweaveHash],
    });
    await this.publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  /** Update the agent endpoint URL. Caller must be the project owner. */
  async setAgentEndpoint(projectId: bigint, endpoint: string): Promise<Address> {
    this.requireWallet();
    const hash = await this.walletClient!.writeContract({
      address: this.config.registryAddress,
      abi: INKD_REGISTRY_ABI,
      functionName: "setAgentEndpoint",
      args: [projectId, endpoint],
    });
    await this.publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Estimate the total ETH cost of one version push.
   * (versionFee — gas excluded)
   */
  async estimatePushCost(): Promise<bigint> {
    return this.getVersionFee();
  }

  /**
   * Estimate the total ETH cost of a project transfer.
   * (transferFee — gas excluded)
   */
  async estimateTransferCost(): Promise<bigint> {
    return this.getTransferFee();
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private requireWallet(): void {
    if (!this.walletClient || !this.publicClient) {
      throw new RegistryNotConnected();
    }
  }

  private requirePublic(): void {
    if (!this.publicClient) throw new RegistryNotConnected();
  }

  /**
   * Extract the new project ID from the ProjectCreated event.
   * Falls back to 0n if not found (should not happen under normal conditions).
   */
  private extractProjectIdFromLogs(logs: readonly Log[]): bigint {
    for (const log of logs) {
      const l = log as { topics?: readonly string[] };
      // ProjectCreated(uint256 indexed projectId, ...)
      // topics[1] = projectId
      if (l.topics && l.topics.length >= 2) {
        try {
          return BigInt(l.topics[1]);
        } catch {
          continue;
        }
      }
    }
    return 0n;
  }
}
