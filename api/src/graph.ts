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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphProject {
  id: string
  name: string
  description: string
  owner: { id: string }
  isAgent: boolean
  versionCount: string
  createdAt: string
  readmeHash: string
  metadataUri: string
  forkOf: { id: string } | null
 : string
}

export interface GraphVersion {
  id: string
  versionIndex: string
  readmeHash: string
  versionTag: string
  pushedBy: { id: string }
  agentAddress: { id: string } | null
  createdAt: string
}

export interface GraphAgent {
  id: string
  name: string
  description: string
  owner: { id: string }
  versionCount: string
  createdAt: string
  readmeHash: string
}

export interface GraphStats {
  totalProjects: number
  totalVersions: number
  totalAgents: number
  totalSettled: string
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class GraphClient {
  private endpoint: string

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  private async query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql, variables }),
    })

    if (!res.ok) {
      throw new Error(`Graph query failed: ${res.status} ${res.statusText}`)
    }

    const json = await res.json() as { data?: T; errors?: Array<{ message: string }> }

    if (json.errors?.length) {
      throw new Error(`Graph error: ${json.errors.map((e) => e.message).join(', ')}`)
    }

    return json.data as T
  }

  /** List projects with optional pagination. */
  async getProjects(options: { offset?: number; limit?: number; isAgent?: boolean; owner?: string } = {}): Promise<GraphProject[]> {
    const { offset = 0, limit = 20, isAgent, owner } = options

    const conditions: string[] = []
    if (isAgent !== undefined) conditions.push(`isAgent: ${isAgent}`)
    if (owner) conditions.push(`owner: "${owner.toLowerCase()}"`)
    const filter = conditions.length > 0 ? `where: { ${conditions.join(', ')} }` : ''

    const data = await this.query<{ projects: GraphProject[] }>(`
      query GetProjects($skip: Int!, $first: Int!) {
        projects(skip: $skip, first: $first, orderBy: createdAt, orderDirection: desc, ${filter}) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
          forkOf { id }
        }
      }
    `, { skip: offset, first: limit })

    return data.projects
  }

  /** Get a single project by on-chain ID. */
  async getProject(id: number): Promise<GraphProject | null> {
    const data = await this.query<{ project: GraphProject | null }>(`
      query GetProject($id: ID!) {
        project(id: $id) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
          forkOf { id }
        }
      }
    `, { id: id.toString() })

    return data.project
  }

  /** Find a project by exact name (case-sensitive). */
  async getProjectByName(name: string): Promise<GraphProject | null> {
    const data = await this.query<{ projects: GraphProject[] }>(`
      query GetProjectByName($name: String!) {
        projects(where: { name: $name }, first: 1) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
          forkOf { id }
        }
      }
    `, { name })

    return data.projects[0] ?? null
  }

  /** Search projects by name prefix or description substring. */
  async searchProjects(query: string, limit = 20): Promise<GraphProject[]> {
    const data = await this.query<{ projects: GraphProject[] }>(`
      query SearchProjects($query: String!, $first: Int!) {
        projects(
          where: { or: [{ name_contains_nocase: $query }, { description_contains_nocase: $query }] }
          first: $first
          orderBy: versionCount
          orderDirection: desc
        ) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
        }
      }
    `, { query, first: limit })

    return data.projects
  }

  /** Get all versions for a project. */
  async getProjectVersions(projectId: number, limit = 50): Promise<GraphVersion[]> {
    const data = await this.query<{ versions: GraphVersion[] }>(`
      query GetVersions($projectId: String!, $first: Int!) {
        versions(
          where: { project: $projectId }
          first: $first
          orderBy: versionIndex
          orderDirection: asc
        ) {
          id versionIndex readmeHash versionTag createdAt
          pushedBy { id }
          agentAddress { id }
        }
      }
    `, { projectId: projectId.toString(), first: limit })

    return data.versions
  }

  /** Get projects owned by a wallet address. */
  async getProjectsByOwner(address: string, limit = 50): Promise<GraphProject[]> {
    const data = await this.query<{ projects: GraphProject[] }>(`
      query GetProjectsByOwner($owner: String!, $first: Int!) {
        projects(where: { owner: $owner }, first: $first, orderBy: createdAt, orderDirection: desc) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
        }
      }
    `, { owner: address.toLowerCase(), first: limit })

    return data.projects
  }

  /** Get protocol stats. */
  async getStats(): Promise<GraphStats | null> {
    const data = await this.query<{ protocolStats: GraphStats | null }>(`
      query GetStats {
        protocolStats(id: "global") {
          totalProjects totalVersions totalAgents totalSettled
        }
      }
    `)

    return data.protocolStats
  }

  /** Count total projects (from stats entity). */
  async getProjectCount(): Promise<number> {
    const stats = await this.getStats()
    return stats?.totalProjects ?? 0
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _graphClient: GraphClient | null = null

export function getGraphClient(): GraphClient | null {
  return _graphClient
}

export function initGraphClient(endpoint: string): GraphClient {
  _graphClient = new GraphClient(endpoint)
  return _graphClient
}
