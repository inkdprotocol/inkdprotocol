/**
 * inkd MCP Tool Handlers — pure, testable functions
 *
 * Extracted from server.ts so they can be unit-tested without
 * starting the MCP server or requiring stdio transport.
 */

export interface FetchFn {
  (url: string, init?: RequestInit): Promise<Response>
}

export interface HandlerContext {
  apiUrl:    string
  fetch:     FetchFn
  readFetch: FetchFn  // always plain fetch for read endpoints
}

// ─── inkd_create_project ──────────────────────────────────────────────────────

export interface CreateProjectArgs {
  name:           string
  description?:   string
  license?:       string
  isPublic?:      boolean
  isAgent?:       boolean
  agentEndpoint?: string
}

export async function handleCreateProject(
  args: CreateProjectArgs,
  ctx:  HandlerContext,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const body = {
    name:          args.name,
    description:   args.description   ?? '',
    license:       args.license       ?? 'MIT',
    isPublic:      args.isPublic      ?? true,
    isAgent:       args.isAgent       ?? false,
    agentEndpoint: args.agentEndpoint ?? '',
  }

  const res = await ctx.fetch(`${ctx.apiUrl}/v1/projects`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { content: [{ type: 'text', text: `Error: ${JSON.stringify(err)}` }], isError: true }
  }

  const result = await res.json()
  return {
    content: [{
      type: 'text',
      text: `✅ Project "${body.name}" registered!\n\nProject ID: ${result.projectId}\nOwner: ${result.owner}\nTX: ${result.txHash}\nBasescan: https://basescan.org/tx/${result.txHash}`,
    }],
  }
}

// ─── inkd_push_version ────────────────────────────────────────────────────────

export interface PushVersionArgs {
  projectId:     string
  tag:           string
  contentHash:   string
  metadataHash?: string
}

export async function handlePushVersion(
  args: PushVersionArgs,
  ctx:  HandlerContext,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const res = await ctx.fetch(`${ctx.apiUrl}/v1/projects/${args.projectId}/versions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      tag:          args.tag,
      contentHash:  args.contentHash,
      metadataHash: args.metadataHash ?? '',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { content: [{ type: 'text', text: `Error: ${JSON.stringify(err)}` }], isError: true }
  }

  const result = await res.json()
  return {
    content: [{
      type: 'text',
      text: `✅ Version "${args.tag}" pushed to project #${args.projectId}!\n\nTX: ${result.txHash}\nContent: ${args.contentHash}`,
    }],
  }
}

// ─── inkd_get_project ─────────────────────────────────────────────────────────

export async function handleGetProject(
  args: { projectId: string },
  ctx:  HandlerContext,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const res = await ctx.readFetch(`${ctx.apiUrl}/v1/projects/${args.projectId}`)

  if (res.status === 404) {
    return { content: [{ type: 'text', text: `Project #${args.projectId} not found.` }] }
  }

  if (!res.ok) {
    return { content: [{ type: 'text', text: `Error: ${res.statusText}` }], isError: true }
  }

  const { data } = await res.json()
  return {
    content: [{
      type: 'text',
      text: [
        `Project #${data.id}: ${data.name}`,
        `Owner: ${data.owner}`,
        `Description: ${data.description || '(none)'}`,
        `License: ${data.license}`,
        `Versions: ${data.versionCount}`,
        `Public: ${data.isPublic}`,
        `Agent: ${data.isAgent}`,
        data.isAgent ? `Endpoint: ${data.agentEndpoint}` : '',
      ].filter(Boolean).join('\n'),
    }],
  }
}

// ─── inkd_get_versions ────────────────────────────────────────────────────────

export async function handleGetVersions(
  args: { projectId: string; limit?: number; offset?: number },
  ctx:  HandlerContext,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const qs  = new URLSearchParams({
    limit:  String(args.limit  ?? 20),
    offset: String(args.offset ?? 0),
  })
  const res = await ctx.readFetch(`${ctx.apiUrl}/v1/projects/${args.projectId}/versions?${qs}`)

  if (!res.ok) {
    return { content: [{ type: 'text', text: `Error: ${res.statusText}` }], isError: true }
  }

  const { data, total } = await res.json()
  const lines = [`Versions for project #${args.projectId} (total: ${total}):\n`]
  for (const v of data) {
    lines.push(
      `• ${v.tag} — ${v.contentHash} (${new Date(Number(v.pushedAt) * 1000).toISOString().slice(0, 10)})`
    )
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] }
}

// ─── inkd_list_agents ─────────────────────────────────────────────────────────

export async function handleListAgents(
  args: { limit?: number; offset?: number },
  ctx:  HandlerContext,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const qs  = new URLSearchParams({
    limit:  String(args.limit  ?? 20),
    offset: String(args.offset ?? 0),
  })
  const res = await ctx.readFetch(`${ctx.apiUrl}/v1/agents?${qs}`)

  if (!res.ok) {
    return { content: [{ type: 'text', text: `Error: ${res.statusText}` }], isError: true }
  }

  const { data, total } = await res.json()
  const lines = [`Registered AI agents on inkd (total: ${total}):\n`]
  for (const a of data) {
    lines.push(
      `• #${a.id} ${a.name} — owner: ${a.owner}` +
      (a.agentEndpoint ? ` — endpoint: ${a.agentEndpoint}` : '')
    )
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] }
}
