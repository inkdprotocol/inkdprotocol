/**
 * Inkd API client — replaces direct indexer/registry calls
 */

const API_URL = process.env.INKD_API_URL ?? 'https://api.inkdprotocol.com'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiProject {
  id: string
  name: string
  description: string
  license: string
  readmeHash: string
  owner: string
  isPublic: boolean
  isAgent: boolean
  agentEndpoint: string
  createdAt: string
  versionCount: string
  metadataUri: string
  forkOf: string
  accessManifest: string
}

export interface ApiVersion {
  versionIndex: string
  projectId: string
  arweaveHash: string
  versionTag: string
  changelog: string
  pushedBy: string
  pushedAt: string
  agentAddress: string | null
  metaHash: string
}

export interface PriceEstimate {
  bytes: number
  arweaveCost: string
  markup: string
  total: string
  markupPct: string
  arweaveCostUsd: string
  totalUsd: string
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Get projects by owner address
 */
export async function listProjectsByOwner(owner: string, limit = 10): Promise<ApiProject[]> {
  const url = `${API_URL}/v1/projects?owner=${owner}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  const json = await res.json() as { data: ApiProject[] }
  return json.data ?? []
}

/**
 * Get a single project by ID
 */
export async function getProjectById(id: number): Promise<ApiProject | null> {
  const url = `${API_URL}/v1/projects/${id}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  const json = await res.json() as { data: ApiProject }
  return json.data
}

/**
 * List versions for a project
 */
export async function listVersions(projectId: number, limit = 10): Promise<ApiVersion[]> {
  const url = `${API_URL}/v1/projects/${projectId}/versions?limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  const json = await res.json() as { data: ApiVersion[] }
  return json.data
}

/**
 * Get a specific version by index
 */
export async function getVersion(projectId: number, versionIndex: number): Promise<ApiVersion | null> {
  const versions = await listVersions(projectId, 100)
  return versions.find(v => v.versionIndex === String(versionIndex)) ?? null
}

/**
 * Get upload price estimate
 */
export async function getUploadPriceEstimate(bytes: number): Promise<PriceEstimate> {
  const url = `${API_URL}/v1/projects/estimate?bytes=${bytes}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<PriceEstimate>
}

/**
 * Find a project by owner and name (case-insensitive)
 */
export async function findProjectByOwnerAndName(owner: string, name: string): Promise<ApiProject | null> {
  const projects = await listProjectsByOwner(owner, 50)
  return projects.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null
}

/**
 * Search projects by name
 */
export async function searchProjects(query: string, limit = 5): Promise<ApiProject[]> {
  // Try search endpoint first
  const url = `${API_URL}/v1/search/projects?q=${encodeURIComponent(query)}&limit=${limit}`
  const res = await fetch(url)
  
  if (res.status === 404 || !res.ok) {
    // Fallback: try by-name lookup
    const byName = await fetch(`${API_URL}/v1/search/by-name/${encodeURIComponent(query)}`)
    if (byName.ok) {
      const d = await byName.json() as { data: ApiProject }
      return d.data ? [d.data] : []
    }
    return []
  }
  
  const json = await res.json() as { data: ApiProject[] }
  return json.data ?? []
}
