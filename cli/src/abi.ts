/**
 * Inkd CLI — Minimal ABIs for registry + token interactions
 */

export const REGISTRY_ABI = [
  // ─── Write ────────────────────────────────────────────────────────────────
  {
    name: 'createProject',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name',          type: 'string' },
      { name: 'description',   type: 'string' },
      { name: 'license',       type: 'string' },
      { name: 'isPublic',      type: 'bool' },
      { name: 'readmeHash',    type: 'string' },
      { name: 'isAgent',       type: 'bool' },
      { name: 'agentEndpoint', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'pushVersion',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'projectId',   type: 'uint256' },
      { name: 'arweaveHash', type: 'string' },
      { name: 'versionTag',  type: 'string' },
      { name: 'changelog',   type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'transferProject',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'newOwner',  type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'addCollaborator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId',    type: 'uint256' },
      { name: 'collaborator', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'removeCollaborator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId',    type: 'uint256' },
      { name: 'collaborator', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'setVisibility',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'isPublic',  type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'setReadme',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId',   type: 'uint256' },
      { name: 'arweaveHash', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'setAgentEndpoint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'endpoint',  type: 'string' },
    ],
    outputs: [],
  },
  // ─── Read ─────────────────────────────────────────────────────────────────
  {
    name: 'getProject',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{
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
    }],
  },
  {
    name: 'getVersion',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'projectId',     type: 'uint256' },
      { name: 'versionIndex',  type: 'uint256' },
    ],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'projectId',   type: 'uint256' },
        { name: 'arweaveHash', type: 'string'  },
        { name: 'versionTag',  type: 'string'  },
        { name: 'changelog',   type: 'string'  },
        { name: 'pushedBy',    type: 'address' },
        { name: 'pushedAt',    type: 'uint256' },
      ],
    }],
  },
  {
    name: 'getVersionCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCollaborators',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'getOwnerProjects',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner_', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
  },
  {
    name: 'getAgentProjects',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit',  type: 'uint256' },
    ],
    outputs: [{
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
    }],
  },
  {
    name: 'projectCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
    name: 'nameTaken',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
] as const

export const TOKEN_ABI = [
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
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
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
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const
