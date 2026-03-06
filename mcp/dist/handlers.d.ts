/**
 * inkd MCP Tool Handlers — pure, testable functions
 *
 * Extracted from server.ts so they can be unit-tested without
 * starting the MCP server or requiring stdio transport.
 */
export interface FetchFn {
    (url: string, init?: RequestInit): Promise<Response>;
}
export interface HandlerContext {
    apiUrl: string;
    fetch: FetchFn;
    readFetch: FetchFn;
}
export interface CreateProjectArgs {
    name: string;
    description?: string;
    license?: string;
    isPublic?: boolean;
    isAgent?: boolean;
    agentEndpoint?: string;
}
export declare function handleCreateProject(args: CreateProjectArgs, ctx: HandlerContext): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
export interface PushVersionArgs {
    projectId: string;
    tag: string;
    contentHash: string;
    metadataHash?: string;
}
export declare function handlePushVersion(args: PushVersionArgs, ctx: HandlerContext): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
export declare function handleGetProject(args: {
    projectId: string;
}, ctx: HandlerContext): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
export declare function handleGetVersions(args: {
    projectId: string;
    limit?: number;
    offset?: number;
}, ctx: HandlerContext): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
export declare function handleListAgents(args: {
    limit?: number;
    offset?: number;
}, ctx: HandlerContext): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
//# sourceMappingURL=handlers.d.ts.map