import "./chunk-WUKYLWAZ.mjs";

// src/provider.ts
import { z as z2 } from "zod";

// src/actions.ts
import { z } from "zod";
var CreateProjectSchema = z.object({
  name: z.string().min(1).max(64).describe(
    "Unique project name (1-64 chars). Once registered on-chain, this name is permanent."
  ),
  description: z.string().max(256).optional().describe(
    "Short description of the project (max 256 chars)."
  ),
  license: z.enum(["MIT", "Apache-2.0", "GPL-3.0", "Proprietary", "UNLICENSED"]).optional().describe(
    "Open source license. Defaults to MIT."
  ),
  isPublic: z.boolean().optional().describe(
    "REQUIRED DECISION \u2014 set this explicitly. true = code stored publicly on Arweave, anyone can read it. false = code encrypted client-side with AES-256-GCM, only authorized wallets can decrypt. Default: true. Cannot be changed after project creation."
  ),
  isAgent: z.boolean().optional().describe(
    "Mark this project as an AI agent. Enables discovery via inkd_list_agents."
  ),
  agentEndpoint: z.string().url().optional().describe(
    "If isAgent=true, the HTTP endpoint where this agent can be called."
  )
});
var PushVersionSchema = z.object({
  projectId: z.string().describe(
    "The numeric ID of the project to push a version to."
  ),
  tag: z.string().min(1).max(64).describe(
    'Version tag, e.g. "v1.0.0", "alpha", "2025-03-04".'
  ),
  contentHash: z.string().min(1).describe(
    "Arweave hash (ar://...) or IPFS hash (ipfs://...) of the content to register."
  ),
  metadataHash: z.string().optional().describe(
    "Optional Arweave or IPFS hash of additional metadata."
  )
});
var GetProjectSchema = z.object({
  projectId: z.string().describe("The numeric project ID to look up.")
});
var ListAgentsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe(
    "Maximum number of agents to return. Default: 20."
  ),
  offset: z.number().int().min(0).optional().describe(
    "Pagination offset. Default: 0."
  )
});
var INKD_ACTIONS = {
  CREATE_PROJECT: "inkd_create_project",
  PUSH_VERSION: "inkd_push_version",
  GET_PROJECT: "inkd_get_project",
  GET_LATEST_VERSION: "inkd_get_latest_version",
  LIST_AGENTS: "inkd_list_agents",
  SEARCH_PROJECTS: "inkd_search_projects",
  GET_BUYBACKS: "inkd_get_buybacks",
  GET_STATS: "inkd_get_stats"
};
var GetLatestVersionSchema = z.object({
  projectId: z.string().describe("The numeric project ID to get the latest version for.")
});
var SearchProjectsSchema = z.object({
  query: z.string().describe("Name or keyword to search for."),
  limit: z.number().int().min(1).max(50).optional().describe("Max results. Default: 10.")
});

// src/provider.ts
var DEFAULT_API_URL = "https://api.inkdprotocol.com";
var InkdActionProvider = class {
  name = "inkd";
  apiUrl;
  fetch;
  constructor(config = {}) {
    this.apiUrl = config.apiUrl ?? DEFAULT_API_URL;
    this.fetch = globalThis.fetch;
  }
  /**
   * Returns all actions available from this provider.
   * AgentKit calls this to register actions with the LLM.
   */
  getActions() {
    return [
      this.createProjectAction(),
      this.pushVersionAction(),
      this.getProjectAction(),
      this.getLatestVersionAction(),
      this.listAgentsAction(),
      this.searchProjectsAction(),
      this.getBuybacksAction(),
      this.getStatsAction()
    ];
  }
  // ─── inkd_create_project ──────────────────────────────────────────────────
  createProjectAction() {
    return {
      name: INKD_ACTIONS.CREATE_PROJECT,
      description: `Register a new project on inkd Protocol on Base. Costs $0.10 USDC via x402 (auto-paid). The agent wallet becomes the on-chain owner permanently. Returns projectId, txHash, owner address.`,
      schema: CreateProjectSchema,
      invoke: async (params, context) => {
        const walletAddress = await this.getWalletAddress(context);
        const fetchFn = await this.buildFetch(context);
        const res = await fetchFn(`${this.apiUrl}/v1/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: params.name,
            description: params.description ?? "",
            license: params.license ?? "MIT",
            isPublic: params.isPublic ?? true,
            isAgent: params.isAgent ?? false,
            agentEndpoint: params.agentEndpoint ?? ""
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
          throw new Error(`inkd createProject failed: ${JSON.stringify(err)}`);
        }
        const result = await res.json();
        return {
          success: true,
          projectId: result.projectId,
          txHash: result.txHash,
          owner: result.owner ?? walletAddress,
          message: `Project "${params.name}" registered on-chain as #${result.projectId}. Owner: ${result.owner}. TX: ${result.txHash}`
        };
      }
    };
  }
  // ─── inkd_push_version ────────────────────────────────────────────────────
  pushVersionAction() {
    return {
      name: INKD_ACTIONS.PUSH_VERSION,
      description: `Upload content to Arweave and register the version on-chain. Costs Arweave storage + 20% markup (min $0.10 USDC), paid automatically via x402. Nothing is overwritten \u2014 all versions are permanent. Returns txHash, arweaveHash, versionTag.`,
      schema: PushVersionSchema,
      invoke: async (params, context) => {
        const fetchFn = await this.buildFetch(context);
        const res = await fetchFn(
          `${this.apiUrl}/v1/projects/${params.projectId}/versions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              versionTag: params.tag,
              arweaveHash: params.contentHash,
              changelog: params.metadataHash ?? "",
              contentSize: 0
            })
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
          throw new Error(`inkd pushVersion failed: ${JSON.stringify(err)}`);
        }
        const result = await res.json();
        return {
          success: true,
          txHash: result.txHash,
          projectId: params.projectId,
          tag: params.tag,
          message: `Version "${params.tag}" pushed to project #${params.projectId}. TX: ${result.txHash}`
        };
      }
    };
  }
  // ─── inkd_get_project ─────────────────────────────────────────────────────
  getProjectAction() {
    return {
      name: INKD_ACTIONS.GET_PROJECT,
      description: `Get details about an inkd project by ID. Returns project metadata including owner, version count, license, and description. Free \u2014 no payment needed.`,
      schema: GetProjectSchema,
      invoke: async (params) => {
        const res = await this.fetch(`${this.apiUrl}/v1/projects/${params.projectId}`);
        if (res.status === 404) {
          return { success: false, message: `Project #${params.projectId} not found.` };
        }
        if (!res.ok) throw new Error(`inkd getProject failed: ${res.statusText}`);
        const { data } = await res.json();
        return {
          success: true,
          project: data,
          message: `Project #${data.id}: "${data.name}" by ${data.owner}. ${data.versionCount} versions. License: ${data.license}.`
        };
      }
    };
  }
  // ─── inkd_get_latest_version ──────────────────────────────────────────────
  getLatestVersionAction() {
    return {
      name: INKD_ACTIONS.GET_LATEST_VERSION,
      description: `Get the latest version of an inkd project. Returns arweaveHash, versionTag, and Arweave URL. Use this to check if a tool or dependency has been updated. Free \u2014 no payment needed.`,
      schema: GetLatestVersionSchema,
      invoke: async (params) => {
        const res = await this.fetch(`${this.apiUrl}/v1/projects/${params.projectId}/versions?limit=1`);
        if (!res.ok) throw new Error(`inkd getLatestVersion failed: ${res.statusText}`);
        const { data } = await res.json();
        if (!data?.length) return { success: false, message: `No versions found for project #${params.projectId}.` };
        const v = data[0];
        return {
          success: true,
          version: v,
          arweaveUrl: `https://arweave.net/${v.arweaveHash}`,
          message: `Latest version of #${params.projectId}: ${v.versionTag} \u2014 https://arweave.net/${v.arweaveHash}`
        };
      }
    };
  }
  // ─── inkd_search_projects ─────────────────────────────────────────────────
  searchProjectsAction() {
    return {
      name: INKD_ACTIONS.SEARCH_PROJECTS,
      description: `Search public inkd projects by name. Use to discover tools, libraries, or agents registered on-chain. Free \u2014 no payment needed.`,
      schema: SearchProjectsSchema,
      invoke: async (params) => {
        const qs = new URLSearchParams({ q: params.query, limit: String(params.limit ?? 10) });
        const res = await this.fetch(`${this.apiUrl}/v1/search/projects?${qs}`);
        if (!res.ok) throw new Error(`inkd searchProjects failed: ${res.statusText}`);
        const { data, total } = await res.json();
        return {
          success: true,
          results: data,
          total,
          message: `Found ${total} projects matching "${params.query}". Showing ${data.length}.`
        };
      }
    };
  }
  // ─── inkd_get_buybacks ────────────────────────────────────────────────────
  getBuybacksAction() {
    return {
      name: INKD_ACTIONS.GET_BUYBACKS,
      description: "Get recent $INKD buyback events \u2014 USDC spent, $INKD received, Basescan links, and totals.",
      schema: z2.object({
        limit: z2.number().int().min(1).max(100).default(20).describe("Number of events to return"),
        skip: z2.number().int().min(0).default(0).describe("Offset for pagination")
      }),
      async invoke(params) {
        const limit = params.limit ?? 20;
        const skip = params.skip ?? 0;
        const res = await globalThis.fetch(`https://api.inkdprotocol.com/v1/buybacks?limit=${limit}&skip=${skip}`);
        if (!res.ok) throw new Error(`inkd getBuybacks failed: ${res.statusText}`);
        const data = await res.json();
        return { success: true, ...data };
      }
    };
  }
  // ─── inkd_get_stats ───────────────────────────────────────────────────────
  getStatsAction() {
    return {
      name: INKD_ACTIONS.GET_STATS,
      description: "Get protocol-wide stats: total projects, versions, USDC volume processed, $INKD token supply.",
      schema: z2.object({}),
      async invoke() {
        const res = await globalThis.fetch("https://api.inkdprotocol.com/v1/stats");
        if (!res.ok) throw new Error(`inkd getStats failed: ${res.statusText}`);
        const data = await res.json();
        return { success: true, ...data };
      }
    };
  }
  // ─── inkd_list_agents ─────────────────────────────────────────────────────
  listAgentsAction() {
    return {
      name: INKD_ACTIONS.LIST_AGENTS,
      description: `Discover AI agents registered on inkd Protocol. Returns a list of agents with their endpoints, owners, and project IDs. Free \u2014 no payment needed.`,
      schema: ListAgentsSchema,
      invoke: async (params) => {
        const qs = new URLSearchParams({
          limit: String(params.limit ?? 20),
          offset: String(params.offset ?? 0)
        });
        const res = await this.fetch(`${this.apiUrl}/v1/agents?${qs}`);
        if (!res.ok) throw new Error(`inkd listAgents failed: ${res.statusText}`);
        const { data, total } = await res.json();
        return {
          success: true,
          agents: data,
          total,
          message: `Found ${total} registered agents. Showing ${data.length}.`
        };
      }
    };
  }
  // ─── Helpers ──────────────────────────────────────────────────────────────
  /**
   * Build an x402-enabled fetch if AgentKit wallet context is available.
   * Falls back to plain fetch for read-only actions.
   */
  async buildFetch(context) {
    if (!context?.walletProvider) return this.fetch;
    try {
      const { wrapFetchWithPayment } = await import("./esm-U2YKRQY5.mjs");
      const { privateKeyToAccount } = await import("viem/accounts");
      const { base, baseSepolia } = await import("viem/chains");
      const privateKey = context.walletProvider?.privateKey;
      if (!privateKey) return this.fetch;
      const account = privateKeyToAccount(privateKey);
      const chain = this.apiUrl.includes("sepolia") ? baseSepolia : base;
      return wrapFetchWithPayment(account, chain);
    } catch {
      return this.fetch;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getWalletAddress(context) {
    try {
      return await context?.walletProvider?.getAddress?.();
    } catch {
      return void 0;
    }
  }
};
export {
  INKD_ACTIONS,
  InkdActionProvider
};
