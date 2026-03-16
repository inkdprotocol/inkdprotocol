/**
 * @file graph.ts
 * @description The Graph subgraph client for Inkd Protocol.
 *
 * Provides typed GraphQL queries against the deployed subgraph.
 * Falls back to RPC-based queries when subgraph is unavailable.
 *
 * Subgraph: https://thegraph.com/studio/subgraph/inkd
 * Query endpoint: https://api.studio.thegraph.com/query/1743853/inkd/v0.1.0
 */
export interface GraphProject {
    id: string;
    name: string;
    description: string;
    owner: {
        id: string;
    };
    isAgent: boolean;
    versionCount: string;
    createdAt: string;
    readmeHash: string;
    metadataUri: string;
    forkOf: {
        id: string;
    } | null;
}
export interface GraphVersion {
    id: string;
    versionIndex: string;
    arweaveHash: string;
    versionTag: string;
    pushedBy: {
        id: string;
    };
    agentAddress: {
        id: string;
    } | null;
    createdAt: string;
}
export interface GraphAgent {
    id: string;
    name: string;
    description: string;
    owner: {
        id: string;
    };
    versionCount: string;
    createdAt: string;
    readmeHash: string;
}
export interface GraphStats {
    totalProjects: number;
    totalVersions: number;
    totalAgents: number;
    totalSettled: string;
}
export declare class GraphClient {
    private endpoint;
    constructor(endpoint: string);
    private query;
    /** List projects with optional pagination. */
    getProjects(options?: {
        offset?: number;
        limit?: number;
        isAgent?: boolean;
        owner?: string;
    }): Promise<GraphProject[]>;
    /** Get a single project by on-chain ID. */
    getProject(id: number): Promise<GraphProject | null>;
    /** Find a project by exact name (case-sensitive). */
    getProjectByName(name: string): Promise<GraphProject | null>;
    /** Search projects by name prefix or description substring. */
    searchProjects(query: string, limit?: number): Promise<GraphProject[]>;
    /** Get all versions for a project. */
    getProjectVersions(projectId: number, limit?: number): Promise<GraphVersion[]>;
    /** Get projects owned by a wallet address. */
    getProjectsByOwner(address: string, limit?: number): Promise<GraphProject[]>;
    /** Get protocol stats. */
    getStats(): Promise<GraphStats | null>;
    /** Count total projects (from stats entity). */
    getProjectCount(): Promise<number>;
}
export declare function getGraphClient(): GraphClient | null;
export declare function initGraphClient(endpoint: string): GraphClient;
//# sourceMappingURL=graph.d.ts.map