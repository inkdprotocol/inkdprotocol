"use strict";
/**
 * Inkd Protocol — minimal ABIs for the API server
 * Only the functions/events needed to serve API requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDC_ABI = exports.TREASURY_ABI = exports.TOKEN_ABI = exports.REGISTRY_ABI = void 0;
exports.REGISTRY_ABI = [
    // ── Read ──────────────────────────────────────────────────────────────────
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
                    { name: 'id', type: 'uint256' },
                    { name: 'name', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'license', type: 'string' },
                    { name: 'readmeHash', type: 'string' },
                    { name: 'owner', type: 'address' },
                    { name: 'isPublic', type: 'bool' },
                    { name: 'isAgent', type: 'bool' },
                    { name: 'agentEndpoint', type: 'string' },
                    { name: 'createdAt', type: 'uint256' },
                    { name: 'versionCount', type: 'uint256' },
                    { name: 'exists', type: 'bool' },
                ],
            },
        ],
    },
    {
        name: 'getProjectByName',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'name', type: 'string' }],
        outputs: [{ type: 'uint256' }], // returns project id
    },
    {
        name: 'getProjectVersions',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'projectId', type: 'uint256' },
            { name: 'offset', type: 'uint256' },
            { name: 'limit', type: 'uint256' },
        ],
        outputs: [
            {
                name: '',
                type: 'tuple[]',
                components: [
                    { name: 'versionId', type: 'uint256' },
                    { name: 'projectId', type: 'uint256' },
                    { name: 'tag', type: 'string' },
                    { name: 'contentHash', type: 'string' },
                    { name: 'metadataHash', type: 'string' },
                    { name: 'pushedAt', type: 'uint256' },
                    { name: 'pusher', type: 'address' },
                ],
            },
        ],
    },
    {
        name: 'getAgentProjects',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'offset', type: 'uint256' },
            { name: 'limit', type: 'uint256' },
        ],
        outputs: [
            {
                name: '',
                type: 'tuple[]',
                components: [
                    { name: 'id', type: 'uint256' },
                    { name: 'name', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'owner', type: 'address' },
                    { name: 'agentEndpoint', type: 'string' },
                    { name: 'isPublic', type: 'bool' },
                    { name: 'versionCount', type: 'uint256' },
                    { name: 'createdAt', type: 'uint256' },
                ],
            },
        ],
    },
    // ── Write ─────────────────────────────────────────────────────────────────
    {
        name: 'createProject',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'license', type: 'string' },
            { name: 'isPublic', type: 'bool' },
            { name: 'readmeHash', type: 'string' },
            { name: 'isAgent', type: 'bool' },
            { name: 'agentEndpoint', type: 'string' },
        ],
        outputs: [],
    },
    {
        name: 'pushVersion',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'projectId', type: 'uint256' },
            { name: 'tag', type: 'string' },
            { name: 'contentHash', type: 'string' },
            { name: 'metadataHash', type: 'string' },
        ],
        outputs: [],
    },
    // ── Events ────────────────────────────────────────────────────────────────
    {
        type: 'event',
        name: 'ProjectCreated',
        inputs: [
            { name: 'projectId', type: 'uint256', indexed: true },
            { name: 'owner', type: 'address', indexed: true },
            { name: 'name', type: 'string', indexed: false },
            { name: 'isAgent', type: 'bool', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'VersionPushed',
        inputs: [
            { name: 'projectId', type: 'uint256', indexed: true },
            { name: 'versionId', type: 'uint256', indexed: true },
            { name: 'tag', type: 'string', indexed: false },
            { name: 'contentHash', type: 'string', indexed: false },
            { name: 'pusher', type: 'address', indexed: true },
        ],
    },
];
exports.TOKEN_ABI = [
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
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
    },
];
exports.TREASURY_ABI = [
    {
        name: 'settle',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'total', type: 'uint256' },
            { name: 'arweaveCost', type: 'uint256' },
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
            { name: 'toArweave', type: 'uint256' },
            { name: 'toBuyback', type: 'uint256' },
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
];
// ─── USDC EIP-3009 ABI (Circle FiatToken v2.x on Base) ───────────────────────
exports.USDC_ABI = [
    {
        name: 'transferWithAuthorization',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
    },
];
//# sourceMappingURL=abis.js.map