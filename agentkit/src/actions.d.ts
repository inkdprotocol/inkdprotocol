import { z } from 'zod';
/**
 * Action schemas for inkd AgentKit provider.
 * These define what the LLM can call and with what parameters.
 */
export declare const CreateProjectSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    license: z.ZodOptional<z.ZodEnum<["MIT", "Apache-2.0", "GPL-3.0", "Proprietary", "UNLICENSED"]>>;
    isPublic: z.ZodOptional<z.ZodBoolean>;
    isAgent: z.ZodOptional<z.ZodBoolean>;
    agentEndpoint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    license?: "MIT" | "Apache-2.0" | "GPL-3.0" | "Proprietary" | "UNLICENSED" | undefined;
    isPublic?: boolean | undefined;
    isAgent?: boolean | undefined;
    agentEndpoint?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    license?: "MIT" | "Apache-2.0" | "GPL-3.0" | "Proprietary" | "UNLICENSED" | undefined;
    isPublic?: boolean | undefined;
    isAgent?: boolean | undefined;
    agentEndpoint?: string | undefined;
}>;
export declare const PushVersionSchema: z.ZodObject<{
    projectId: z.ZodString;
    tag: z.ZodString;
    contentHash: z.ZodString;
    metadataHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    tag: string;
    contentHash: string;
    metadataHash?: string | undefined;
}, {
    projectId: string;
    tag: string;
    contentHash: string;
    metadataHash?: string | undefined;
}>;
export declare const GetProjectSchema: z.ZodObject<{
    projectId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    projectId: string;
}, {
    projectId: string;
}>;
export declare const ListAgentsSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const INKD_ACTIONS: {
    readonly CREATE_PROJECT: "inkd_create_project";
    readonly PUSH_VERSION: "inkd_push_version";
    readonly GET_PROJECT: "inkd_get_project";
    readonly LIST_AGENTS: "inkd_list_agents";
};
