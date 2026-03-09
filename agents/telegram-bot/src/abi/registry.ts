export const REGISTRY_ABI = [
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
] as const
