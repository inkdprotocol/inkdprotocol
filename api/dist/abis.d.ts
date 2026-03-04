/**
 * Inkd Protocol — minimal ABIs for the API server
 * Only the functions/events needed to serve API requests.
 */
export declare const REGISTRY_ABI: readonly [{
    readonly name: "projectCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getProject";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
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
    readonly name: "getProjectByName";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "name";
        readonly type: "string";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getProjectVersions";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "offset";
        readonly type: "uint256";
    }, {
        readonly name: "limit";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly name: "versionId";
            readonly type: "uint256";
        }, {
            readonly name: "projectId";
            readonly type: "uint256";
        }, {
            readonly name: "tag";
            readonly type: "string";
        }, {
            readonly name: "contentHash";
            readonly type: "string";
        }, {
            readonly name: "metadataHash";
            readonly type: "string";
        }, {
            readonly name: "pushedAt";
            readonly type: "uint256";
        }, {
            readonly name: "pusher";
            readonly type: "address";
        }];
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
        readonly name: "";
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
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly name: "agentEndpoint";
            readonly type: "string";
        }, {
            readonly name: "isPublic";
            readonly type: "bool";
        }, {
            readonly name: "versionCount";
            readonly type: "uint256";
        }, {
            readonly name: "createdAt";
            readonly type: "uint256";
        }];
    }];
}, {
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
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "tag";
        readonly type: "string";
    }, {
        readonly name: "contentHash";
        readonly type: "string";
    }, {
        readonly name: "metadataHash";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly type: "event";
    readonly name: "ProjectCreated";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "name";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "isAgent";
        readonly type: "bool";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "VersionPushed";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "versionId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "tag";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "contentHash";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "pusher";
        readonly type: "address";
        readonly indexed: true;
    }];
}];
export declare const TOKEN_ABI: readonly [{
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
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
}];
//# sourceMappingURL=abis.d.ts.map