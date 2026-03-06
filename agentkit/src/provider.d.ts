/**
 * InkdActionProvider — AgentKit Action Provider for inkd Protocol
 *
 * Integrates inkd's x402-enabled API into any AgentKit-powered agent.
 * The agent's wallet signs x402 payments automatically.
 */
import { z } from 'zod';
import type { InkdConfig, InkdProject } from './types.js';
import { CreateProjectSchema, PushVersionSchema, GetProjectSchema, ListAgentsSchema } from './actions.js';
/**
 * AgentKit Action Provider for inkd Protocol.
 *
 * @example
 * ```typescript
 * import { AgentKit } from '@coinbase/agentkit'
 * import { InkdActionProvider } from '@inkd/agentkit'
 *
 * const agentkit = await AgentKit.from({
 *   cdpApiKeyName: '...',
 *   cdpApiKeyPrivateKey: '...',
 *   actionProviders: [new InkdActionProvider()],
 * })
 *
 * // The agent can now call inkd actions:
 * // "Register my tool on inkd as 'my-summarizer' under MIT license"
 * // → agent calls inkd_create_project automatically
 * ```
 */
export declare class InkdActionProvider {
    readonly name = "inkd";
    private readonly apiUrl;
    private fetch;
    constructor(config?: InkdConfig);
    /**
     * Returns all actions available from this provider.
     * AgentKit calls this to register actions with the LLM.
     */
    getActions(): ({
        name: "inkd_create_project";
        description: string;
        schema: z.ZodObject<{
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
        invoke: (params: z.infer<typeof CreateProjectSchema>, context?: any) => Promise<{
            success: boolean;
            projectId: any;
            txHash: any;
            owner: any;
            message: string;
        }>;
    } | {
        name: "inkd_push_version";
        description: string;
        schema: z.ZodObject<{
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
        invoke: (params: z.infer<typeof PushVersionSchema>, context?: any) => Promise<{
            success: boolean;
            txHash: any;
            projectId: string;
            tag: string;
            message: string;
        }>;
    } | {
        name: "inkd_get_project";
        description: string;
        schema: z.ZodObject<{
            projectId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            projectId: string;
        }, {
            projectId: string;
        }>;
        invoke: (params: z.infer<typeof GetProjectSchema>) => Promise<{
            success: boolean;
            message: string;
            project?: undefined;
        } | {
            success: boolean;
            project: InkdProject;
            message: string;
        }>;
    } | {
        name: "inkd_list_agents";
        description: string;
        schema: z.ZodObject<{
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            limit?: number | undefined;
            offset?: number | undefined;
        }, {
            limit?: number | undefined;
            offset?: number | undefined;
        }>;
        invoke: (params: z.infer<typeof ListAgentsSchema>) => Promise<{
            success: boolean;
            agents: InkdProject[];
            total: string;
            message: string;
        }>;
    })[];
    private createProjectAction;
    private pushVersionAction;
    private getProjectAction;
    private listAgentsAction;
    /**
     * Build an x402-enabled fetch if AgentKit wallet context is available.
     * Falls back to plain fetch for read-only actions.
     */
    private buildFetch;
    private getWalletAddress;
}
