/**
 * Inkd Protocol — minimal ABIs for the API server
 * Only the functions/events needed to serve API requests.
 * Reflects InkdRegistryV2 (UUPS upgraded proxy on Base Mainnet).
 */

export const REGISTRY_ABI = [
  // ── Read: Projects ────────────────────────────────────────────────────────
  {
    name: 'projectCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getProject',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id',            type: 'uint256' },
          { name: 'name',          type: 'string'  },
          { name: 'description',   type: 'string'  },
          { name: 'license',       type: 'string'  },
          { name: 'readmeHash',    type: 'string'  },
          { name: 'owner',         type: 'address' },
          { name: 'isPublic',      type: 'bool'    },
          { name: 'isAgent',       type: 'bool'    },
          { name: 'agentEndpoint', type: 'string'  },
          { name: 'createdAt',     type: 'uint256' },
          { name: 'versionCount',  type: 'uint256' },
          { name: 'exists',        type: 'bool'    },
        ],
      },
    ],
  },
  // ── Read: V2 Project Metadata ─────────────────────────────────────────────
  {
    name: 'projectMetadataUri',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'projectForkOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'projectAccessManifest',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'projectTagsHash',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ type: 'bytes32' }],
  },
  // ── Read: Versions ────────────────────────────────────────────────────────
  {
    name: 'getVersionCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getVersion',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'projectId',     type: 'uint256' },
      { name: 'versionIndex',  type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'projectId',   type: 'uint256' },
          { name: 'arweaveHash', type: 'string'  },
          { name: 'versionTag',  type: 'string'  },
          { name: 'changelog',   type: 'string'  },
          { name: 'pushedBy',    type: 'address' },
          { name: 'pushedAt',    type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getVersionAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'projectId',    type: 'uint256' },
      { name: 'versionIndex', type: 'uint256' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'versionMetaHash',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'projectId',    type: 'uint256' },
      { name: 'versionIndex', type: 'uint256' },
    ],
    outputs: [{ type: 'string' }],
  },
  // ── Read: Agents ──────────────────────────────────────────────────────────
  {
    name: 'getAgentProjects',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit',  type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id',            type: 'uint256' },
          { name: 'name',          type: 'string'  },
          { name: 'description',   type: 'string'  },
          { name: 'license',       type: 'string'  },
          { name: 'readmeHash',    type: 'string'  },
          { name: 'owner',         type: 'address' },
          { name: 'isPublic',      type: 'bool'    },
          { name: 'isAgent',       type: 'bool'    },
          { name: 'agentEndpoint', type: 'string'  },
          { name: 'createdAt',     type: 'uint256' },
          { name: 'versionCount',  type: 'uint256' },
          { name: 'exists',        type: 'bool'    },
        ],
      },
    ],
  },
  // ── Write: V1 (direct on-chain, fee-pull model) ───────────────────────────
  {
    name: 'createProject',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name',          type: 'string' },
      { name: 'description',   type: 'string' },
      { name: 'license',       type: 'string' },
      { name: 'isPublic',      type: 'bool'   },
      { name: 'readmeHash',    type: 'string' },
      { name: 'isAgent',       type: 'bool'   },
      { name: 'agentEndpoint', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'pushVersion',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId',   type: 'uint256' },
      { name: 'arweaveHash', type: 'string'  },
      { name: 'versionTag',  type: 'string'  },
      { name: 'changelog',   type: 'string'  },
    ],
    outputs: [],
  },
  // ── Write: V2 (x402 payment pre-verified, settler-only) ───────────────────
  {
    name: 'createProjectV2',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner',              type: 'address' },
      { name: 'name',               type: 'string'  },
      { name: 'description',        type: 'string'  },
      { name: 'license',            type: 'string'  },
      { name: 'isPublic',           type: 'bool'    },
      { name: 'readmeHash',         type: 'string'  },
      { name: 'isAgent',            type: 'bool'    },
      { name: 'agentEndpoint',      type: 'string'  },
      { name: 'metadataUri',        type: 'string'  },
      { name: 'forkOf',             type: 'uint256' },
      { name: 'accessManifestHash', type: 'string'  },
      { name: 'tagsHash',           type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'pushVersionV2',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId',                  type: 'uint256' },
      { name: 'arweaveHash',                type: 'string'  },
      { name: 'versionTag',                 type: 'string'  },
      { name: 'changelog',                  type: 'string'  },
      { name: 'agentAddress',               type: 'address' },
      { name: 'versionMetadataArweaveHash', type: 'string'  },
    ],
    outputs: [],
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'ProjectCreated',
    inputs: [
      { name: 'projectId', type: 'uint256', indexed: true  },
      { name: 'owner',     type: 'address', indexed: true  },
      { name: 'name',      type: 'string',  indexed: false },
      { name: 'license',   type: 'string',  indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProjectCreatedV2',
    inputs: [
      { name: 'projectId',   type: 'uint256', indexed: true  },
      { name: 'owner',       type: 'address', indexed: true  },
      { name: 'name',        type: 'string',  indexed: false },
      { name: 'forkOf',      type: 'uint256', indexed: false },
      { name: 'metadataUri', type: 'string',  indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VersionPushed',
    inputs: [
      { name: 'projectId',   type: 'uint256', indexed: true  },
      { name: 'arweaveHash', type: 'string',  indexed: false },
      { name: 'versionTag',  type: 'string',  indexed: false },
      { name: 'pushedBy',    type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VersionPushedV2',
    inputs: [
      { name: 'projectId',    type: 'uint256', indexed: true  },
      { name: 'versionIndex', type: 'uint256', indexed: true  },
      { name: 'arweaveHash',  type: 'string',  indexed: false },
      { name: 'versionTag',   type: 'string',  indexed: false },
      { name: 'agentAddress', type: 'address', indexed: true  },
    ],
  },
] as const

export const TOKEN_ABI = [
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

export const TREASURY_ABI = [
  {
    name: 'settle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'total',        type: 'uint256' },
      { name: 'arweaveCost',  type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'calculateTotal',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'arweaveCost', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'markupBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'feeSplit',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'toArweave',  type: 'uint256' },
      { name: 'toBuyback',  type: 'uint256' },
      { name: 'toTreasury', type: 'uint256' },
    ],
  },
  {
    name: 'serviceFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const
