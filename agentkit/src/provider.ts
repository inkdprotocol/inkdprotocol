/**
 * InkdActionProvider — AgentKit Action Provider for inkd Protocol
 *
 * Integrates inkd's x402-enabled API into any AgentKit-powered agent.
 * The agent's wallet signs x402 payments automatically.
 */

import { z }                    from 'zod'
import type { InkdConfig, InkdProject, InkdVersion } from './types.js'
import {
  CreateProjectSchema,
  PushVersionSchema,
  GetProjectSchema,
  GetLatestVersionSchema,
  ListAgentsSchema,
  SearchProjectsSchema,
  INKD_ACTIONS,
} from './actions.js'

const DEFAULT_API_URL = 'https://api.inkdprotocol.com'

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
export class InkdActionProvider {
  readonly name = 'inkd'

  private readonly apiUrl: string
  private fetch: typeof globalThis.fetch

  constructor(config: InkdConfig = {}) {
    this.apiUrl = config.apiUrl ?? DEFAULT_API_URL
    this.fetch  = globalThis.fetch
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
      this.getStatsAction(),
    ]
  }

  // ─── inkd_create_project ──────────────────────────────────────────────────

  private createProjectAction() {
    return {
      name:        INKD_ACTIONS.CREATE_PROJECT,
      description: `Register a new project on inkd Protocol on Base. Costs $0.10 USDC via x402 (auto-paid). The agent wallet becomes the on-chain owner permanently. Returns projectId, txHash, owner address.`,
      schema:      CreateProjectSchema,
      invoke:      async (
        params: z.infer<typeof CreateProjectSchema>,
        // AgentKit passes the wallet client — we use it for x402 signing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context?: any,
      ) => {
        const walletAddress = await this.getWalletAddress(context)

        // Use x402-enabled fetch if wallet is available, otherwise plain fetch
        const fetchFn = await this.buildFetch(context)

        const res = await fetchFn(`${this.apiUrl}/v1/projects`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            name:          params.name,
            description:   params.description ?? '',
            license:       params.license ?? 'MIT',
            isPublic:      params.isPublic ?? true,
            isAgent:       params.isAgent ?? false,
            agentEndpoint: params.agentEndpoint ?? '',
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
          throw new Error(`inkd createProject failed: ${JSON.stringify(err)}`)
        }

        const result = await res.json() as Record<string, unknown>
        return {
          success:   true,
          projectId: result.projectId,
          txHash:    result.txHash,
          owner:     result.owner ?? walletAddress,
          message:   `Project "${params.name}" registered on-chain as #${result.projectId}. Owner: ${result.owner}. TX: ${result.txHash}`,
        }
      },
    }
  }

  // ─── inkd_push_version ────────────────────────────────────────────────────

  private pushVersionAction() {
    return {
      name:        INKD_ACTIONS.PUSH_VERSION,
      description: `Upload content to Arweave and register the version on-chain. Costs Arweave storage + 20% markup (min $0.10 USDC), paid automatically via x402. Nothing is overwritten — all versions are permanent. Returns txHash, arweaveHash, versionTag.`,
      schema:      PushVersionSchema,
      invoke:      async (
        params: z.infer<typeof PushVersionSchema>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context?: any,
      ) => {
        const fetchFn = await this.buildFetch(context)

        const res = await fetchFn(
          `${this.apiUrl}/v1/projects/${params.projectId}/versions`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              versionTag:   params.tag,
              arweaveHash:  params.contentHash,
              changelog:    params.metadataHash ?? '',
              contentSize:  0,
            }),
          }
        )

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
          throw new Error(`inkd pushVersion failed: ${JSON.stringify(err)}`)
        }

        const result = await res.json() as Record<string, unknown>
        return {
          success:   true,
          txHash:    result.txHash,
          projectId: params.projectId,
          tag:       params.tag,
          message:   `Version "${params.tag}" pushed to project #${params.projectId}. TX: ${result.txHash}`,
        }
      },
    }
  }

  // ─── inkd_get_project ─────────────────────────────────────────────────────

  private getProjectAction() {
    return {
      name:        INKD_ACTIONS.GET_PROJECT,
      description: `Get details about an inkd project by ID. Returns project metadata including owner, version count, license, and description. Free — no payment needed.`,
      schema:      GetProjectSchema,
      invoke:      async (params: z.infer<typeof GetProjectSchema>) => {
        const res = await this.fetch(`${this.apiUrl}/v1/projects/${params.projectId}`)

        if (res.status === 404) {
          return { success: false, message: `Project #${params.projectId} not found.` }
        }

        if (!res.ok) throw new Error(`inkd getProject failed: ${res.statusText}`)

        const { data } = await res.json() as { data: InkdProject }
        return {
          success: true,
          project: data,
          message: `Project #${data.id}: "${data.name}" by ${data.owner}. ${data.versionCount} versions. License: ${data.license}.`,
        }
      },
    }
  }

  // ─── inkd_get_latest_version ──────────────────────────────────────────────

  private getLatestVersionAction() {
    return {
      name:        INKD_ACTIONS.GET_LATEST_VERSION,
      description: `Get the latest version of an inkd project. Returns arweaveHash, versionTag, and Arweave URL. Use this to check if a tool or dependency has been updated. Free — no payment needed.`,
      schema:      GetLatestVersionSchema,
      invoke:      async (params: z.infer<typeof GetLatestVersionSchema>) => {
        const res = await this.fetch(`${this.apiUrl}/v1/projects/${params.projectId}/versions?limit=1`)
        if (!res.ok) throw new Error(`inkd getLatestVersion failed: ${res.statusText}`)
        const { data } = await res.json() as { data: InkdVersion[] }
        if (!data?.length) return { success: false, message: `No versions found for project #${params.projectId}.` }
        const v = data[0]
        return {
          success:     true,
          version:     v,
          arweaveUrl:  `https://arweave.net/${v.arweaveHash}`,
          message:     `Latest version of #${params.projectId}: ${v.versionTag} — https://arweave.net/${v.arweaveHash}`,
        }
      },
    }
  }

  // ─── inkd_search_projects ─────────────────────────────────────────────────

  private searchProjectsAction() {
    return {
      name:        INKD_ACTIONS.SEARCH_PROJECTS,
      description: `Search public inkd projects by name. Use to discover tools, libraries, or agents registered on-chain. Free — no payment needed.`,
      schema:      SearchProjectsSchema,
      invoke:      async (params: z.infer<typeof SearchProjectsSchema>) => {
        const qs = new URLSearchParams({ q: params.query, limit: String(params.limit ?? 10) })
        const res = await this.fetch(`${this.apiUrl}/v1/search/projects?${qs}`)
        if (!res.ok) throw new Error(`inkd searchProjects failed: ${res.statusText}`)
        const { data, total } = await res.json() as { data: InkdProject[], total: string }
        return {
          success: true,
          results: data,
          total,
          message: `Found ${total} projects matching "${params.query}". Showing ${data.length}.`,
        }
      },
    }
  }

  // ─── inkd_get_buybacks ────────────────────────────────────────────────────

  private getBuybacksAction() {
    return {
      name:        INKD_ACTIONS.GET_BUYBACKS,
      description: 'Get recent $INKD buyback events — USDC spent, $INKD received, Basescan links, and totals.',
      schema:      z.object({
        limit: z.number().int().min(1).max(100).default(20).describe('Number of events to return'),
        skip:  z.number().int().min(0).default(0).describe('Offset for pagination'),
      }),
      async invoke(params: { limit?: number; skip?: number }) {
        const limit = params.limit ?? 20
        const skip  = params.skip  ?? 0
        const res   = await globalThis.fetch(`https://api.inkdprotocol.com/v1/buybacks?limit=${limit}&skip=${skip}`)
        if (!res.ok) throw new Error(`inkd getBuybacks failed: ${res.statusText}`)
        const data = await res.json() as Record<string, unknown>
        return { success: true, ...data }
      },
    }
  }

  // ─── inkd_get_stats ───────────────────────────────────────────────────────

  private getStatsAction() {
    return {
      name:        INKD_ACTIONS.GET_STATS,
      description: 'Get protocol-wide stats: total projects, versions, USDC volume processed, $INKD token supply.',
      schema:      z.object({}),
      async invoke() {
        const res  = await globalThis.fetch('https://api.inkdprotocol.com/v1/stats')
        if (!res.ok) throw new Error(`inkd getStats failed: ${res.statusText}`)
        const data = await res.json() as Record<string, unknown>
        return { success: true, ...data }
      },
    }
  }

  // ─── inkd_list_agents ─────────────────────────────────────────────────────

  private listAgentsAction() {
    return {
      name:        INKD_ACTIONS.LIST_AGENTS,
      description: `Discover AI agents registered on inkd Protocol. Returns a list of agents with their endpoints, owners, and project IDs. Free — no payment needed.`,
      schema:      ListAgentsSchema,
      invoke:      async (params: z.infer<typeof ListAgentsSchema>) => {
        const qs = new URLSearchParams({
          limit:  String(params.limit  ?? 20),
          offset: String(params.offset ?? 0),
        })

        const res = await this.fetch(`${this.apiUrl}/v1/agents?${qs}`)
        if (!res.ok) throw new Error(`inkd listAgents failed: ${res.statusText}`)

        const { data, total } = await res.json() as { data: InkdProject[], total: string }
        return {
          success: true,
          agents:  data,
          total,
          message: `Found ${total} registered agents. Showing ${data.length}.`,
        }
      },
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Build an x402-enabled fetch if AgentKit wallet context is available.
   * Falls back to plain fetch for read-only actions.
   */
  private async buildFetch(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context?: any,
  ): Promise<typeof globalThis.fetch> {
    if (!context?.walletProvider) return this.fetch

    try {
      // Try to use @x402/fetch with the agent's wallet
      // @ts-ignore
      const { wrapFetchWithPayment } = await import('@x402/fetch')
      const { privateKeyToAccount }  = await import('viem/accounts')
      const { base, baseSepolia }    = await import('viem/chains')

      // Extract private key from AgentKit wallet context
      const privateKey = context.walletProvider?.privateKey as `0x${string}` | undefined
      if (!privateKey) return this.fetch

      const account = privateKeyToAccount(privateKey)
      const chain   = this.apiUrl.includes('sepolia') ? baseSepolia : base
      return wrapFetchWithPayment(account, chain) as typeof globalThis.fetch
    } catch {
      // @x402/fetch not installed — fall back to plain fetch
      // Agent will get 402 errors on write endpoints
      return this.fetch
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getWalletAddress(context?: any): Promise<string | undefined> {
    try {
      return await context?.walletProvider?.getAddress?.()
    } catch {
      return undefined
    }
  }
}
