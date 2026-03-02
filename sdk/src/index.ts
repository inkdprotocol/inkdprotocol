/**
 * @inkd/sdk — Inkd Protocol TypeScript SDK
 * Permanent on-chain project registry on Base
 */

// ─── Event Subscriptions ─────────────────────────────────────────────────────
export {
  watchProjectCreated,
  watchVersionPushed,
  watchRegistryEvents,
} from "./events.js";
export type {
  ProjectCreatedEvent,
  VersionPushedEvent,
  Unwatch,
  ProjectCreatedFilter,
  VersionPushedFilter,
} from "./events.js";

// ─── Batch Reads (Multicall3) ─────────────────────────────────────────────────
export {
  batchGetProjects,
  batchGetVersions,
  batchGetFees,
  batchGetProjectsWithVersions,
} from "./multicall.js";
export type {
  ProjectData,
  VersionData,
  RegistryFees,
  BatchResult,
} from "./multicall.js";

import { 
  createPublicClient, createWalletClient, http, parseEther,
  type PublicClient, type WalletClient, type Address, type Hash
} from 'viem'
import { base, baseSepolia } from 'viem/chains'

// ─── ABIs (minimal) ──────────────────────────────────────────────────────────

const REGISTRY_ABI = [
  {
    name: 'createProject',
    type: 'function',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'license', type: 'string' },
      { name: 'readmeHash', type: 'string' },
      { name: 'agentEndpoint', type: 'string' },
      { name: 'isAgent', type: 'bool' },
      { name: 'isPublic', type: 'bool' },
    ],
    outputs: [{ name: 'projectId', type: 'uint256' }],
  },
  {
    name: 'pushVersion',
    type: 'function',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'arweaveHash', type: 'string' },
      { name: 'versionTag', type: 'string' },
      { name: 'changelog', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'transferProject',
    type: 'function',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'newOwner', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'addCollaborator',
    type: 'function',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'collaborator', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'getProject',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'license', type: 'string' },
        { name: 'readmeHash', type: 'string' },
        { name: 'agentEndpoint', type: 'string' },
        { name: 'owner', type: 'address' },
        { name: 'isAgent', type: 'bool' },
        { name: 'isPublic', type: 'bool' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'versionCount', type: 'uint256' },
        { name: 'exists', type: 'bool' },
      ]
    }],
  },
  {
    name: 'getVersions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'projectId', type: 'uint256' },
        { name: 'arweaveHash', type: 'string' },
        { name: 'versionTag', type: 'string' },
        { name: 'changelog', type: 'string' },
        { name: 'pushedBy', type: 'address' },
        { name: 'pushedAt', type: 'uint256' },
      ]
    }],
  },
  {
    name: 'versionFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transferFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getAgentProjects',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
  },
] as const

const TOKEN_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

// ─── Contract Addresses ───────────────────────────────────────────────────────

export const ADDRESSES = {
  mainnet: {
    token: '' as Address,     // TBD post-launch
    registry: '' as Address,
    treasury: '' as Address,
  },
  testnet: {
    token: '' as Address,     // TBD post-testnet deploy
    registry: '' as Address,
    treasury: '' as Address,
  },
}

// ─── Client ───────────────────────────────────────────────────────────────────

export interface InkdClientOptions {
  walletClient: WalletClient
  network?: 'mainnet' | 'testnet'
  rpcUrl?: string
}

export class InkdClient {
  private wallet: WalletClient
  private public: PublicClient
  private addrs: typeof ADDRESSES.mainnet

  constructor(opts: InkdClientOptions) {
    this.wallet = opts.walletClient
    const network = opts.network ?? 'testnet'
    const chain = network === 'mainnet' ? base : baseSepolia
    this.addrs = ADDRESSES[network]
    this.public = createPublicClient({
      chain,
      transport: http(opts.rpcUrl),
    }) as unknown as PublicClient
  }

  // ─── Token Helpers ──────────────────────────────────────────────────────────

  async approveToken(amount = parseEther('1')): Promise<Hash> {
    const [account] = await this.wallet.getAddresses()
    return this.wallet.writeContract({
      address: this.addrs.token,
      abi: TOKEN_ABI,
      functionName: 'approve',
      args: [this.addrs.registry, amount],
      account,
      chain: this.wallet.chain!,
    })
  }

  async tokenBalance(address?: Address): Promise<bigint> {
    const [account] = await this.wallet.getAddresses()
    return this.public.readContract({
      address: this.addrs.token,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [address ?? account],
    }) as Promise<bigint>
  }

  // ─── Projects ───────────────────────────────────────────────────────────────

  async createProject(opts: {
    name: string
    description: string
    license?: string
    readmeHash?: string
    isPublic?: boolean
    isAgent?: boolean
    agentEndpoint?: string
  }): Promise<Hash> {
    const [account] = await this.wallet.getAddresses()
    return this.wallet.writeContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'createProject',
      args: [
        opts.name,
        opts.description,
        opts.license ?? 'MIT',
        opts.readmeHash ?? '',
        opts.agentEndpoint ?? '',
        opts.isAgent ?? false,
        opts.isPublic ?? true,
      ],
      account,
      chain: this.wallet.chain!,
    })
  }

  async pushVersion(projectId: bigint, opts: {
    arweaveHash: string
    versionTag: string
    changelog?: string
  }): Promise<Hash> {
    const [account] = await this.wallet.getAddresses()
    const fee = await this.getVersionFee()
    return this.wallet.writeContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'pushVersion',
      args: [projectId, opts.arweaveHash, opts.versionTag, opts.changelog ?? ''],
      account,
      chain: this.wallet.chain!,
      value: fee,
    })
  }

  async getProject(projectId: bigint) {
    return this.public.readContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'getProject',
      args: [projectId],
    })
  }

  async getVersions(projectId: bigint) {
    return this.public.readContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'getVersions',
      args: [projectId],
    })
  }

  async getVersionFee(): Promise<bigint> {
    return this.public.readContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'versionFee',
    }) as Promise<bigint>
  }

  async transferProject(projectId: bigint, newOwner: Address): Promise<Hash> {
    const [account] = await this.wallet.getAddresses()
    const fee = await this.public.readContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'transferFee',
    }) as bigint
    return this.wallet.writeContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'transferProject',
      args: [projectId, newOwner],
      account,
      chain: this.wallet.chain!,
      value: fee,
    })
  }

  async getAgentProjects(offset = 0n, limit = 100n): Promise<readonly bigint[]> {
    return this.public.readContract({
      address: this.addrs.registry,
      abi: REGISTRY_ABI,
      functionName: 'getAgentProjects',
      args: [offset, limit],
    }) as Promise<readonly bigint[]>
  }
}
