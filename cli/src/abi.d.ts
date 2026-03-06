/**
 * Inkd CLI — Minimal ABIs for registry + token interactions
 */
export declare const REGISTRY_ABI: readonly [{
    readonly name: "createProject";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "name";
        readonly type: "string";
    }, {
        readonly name: "description";
        readonly type: "string";
    }, {
        readonly name: "license";
        readonly type: "string";
    }, {
        readonly name: "isPublic";
        readonly type: "bool";
    }, {
        readonly name: "readmeHash";
        readonly type: "string";
    }, {
        readonly name: "isAgent";
        readonly type: "bool";
    }, {
        readonly name: "agentEndpoint";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "pushVersion";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "arweaveHash";
        readonly type: "string";
    }, {
        readonly name: "versionTag";
        readonly type: "string";
    }, {
        readonly name: "changelog";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "transferProject";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "newOwner";
        readonly type: "address";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "addCollaborator";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "collaborator";
        readonly type: "address";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "removeCollaborator";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "collaborator";
        readonly type: "address";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setVisibility";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "isPublic";
        readonly type: "bool";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setReadme";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "arweaveHash";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setAgentEndpoint";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "endpoint";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getProject";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "id";
            readonly type: "uint256";
        }, {
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly name: "description";
            readonly type: "string";
        }, {
            readonly name: "license";
            readonly type: "string";
        }, {
            readonly name: "readmeHash";
            readonly type: "string";
        }, {
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly name: "isPublic";
            readonly type: "bool";
        }, {
            readonly name: "isAgent";
            readonly type: "bool";
        }, {
            readonly name: "agentEndpoint";
            readonly type: "string";
        }, {
            readonly name: "createdAt";
            readonly type: "uint256";
        }, {
            readonly name: "versionCount";
            readonly type: "uint256";
        }, {
            readonly name: "exists";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "getVersion";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "versionIndex";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "projectId";
            readonly type: "uint256";
        }, {
            readonly name: "arweaveHash";
            readonly type: "string";
        }, {
            readonly name: "versionTag";
            readonly type: "string";
        }, {
            readonly name: "changelog";
            readonly type: "string";
        }, {
            readonly name: "pushedBy";
            readonly type: "address";
        }, {
            readonly name: "pushedAt";
            readonly type: "uint256";
        }];
    }];
}, {
    readonly name: "getVersionCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getCollaborators";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
    }];
}, {
    readonly name: "getOwnerProjects";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "owner_";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
    }];
}, {
    readonly name: "getAgentProjects";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "offset";
        readonly type: "uint256";
    }, {
        readonly name: "limit";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly name: "id";
            readonly type: "uint256";
        }, {
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly name: "description";
            readonly type: "string";
        }, {
            readonly name: "license";
            readonly type: "string";
        }, {
            readonly name: "readmeHash";
            readonly type: "string";
        }, {
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly name: "isPublic";
            readonly type: "bool";
        }, {
            readonly name: "isAgent";
            readonly type: "bool";
        }, {
            readonly name: "agentEndpoint";
            readonly type: "string";
        }, {
            readonly name: "createdAt";
            readonly type: "uint256";
        }, {
            readonly name: "versionCount";
            readonly type: "uint256";
        }, {
            readonly name: "exists";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "projectCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "versionFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "serviceFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "nameTaken";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "name";
        readonly type: "string";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}];
export declare const TOKEN_ABI: readonly [{
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "transfer";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "decimals";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}];
