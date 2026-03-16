#!/usr/bin/env node
/**
 * @inkd/mcp — Model Context Protocol Server for inkd Protocol
 *
 * Gives Claude, Cursor, and any MCP-compatible LLM native inkd tools:
 *   - inkd_create_project
 *   - inkd_push_version
 *   - inkd_get_project
 *   - inkd_list_agents
 *   - inkd_get_versions
 *
 * Run as stdio MCP server:
 *   INKD_PRIVATE_KEY=0x... npx @inkd/mcp
 *
 * Add to Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "inkd": {
 *       "command": "npx",
 *       "args": ["@inkd/mcp"],
 *       "env": { "INKD_PRIVATE_KEY": "0x..." }
 *     }
 *   }
 * }
 */

import { Server }              from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// ─── Config ───────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env['INKD_PRIVATE_KEY'] as `0x${string}` | undefined
const API_URL     = process.env['INKD_API_URL'] ?? 'https://api.inkdprotocol.com'
const NETWORK     = process.env['INKD_NETWORK'] ?? 'mainnet'

// ─── Build x402-enabled fetch ─────────────────────────────────────────────────

async function buildFetch() {
  if (!PRIVATE_KEY) {
    // No private key — read-only mode
    return { fetch: globalThis.fetch, address: undefined }
  }

  try {
    const { wrapFetchWithPayment } = await import('@x402/fetch')
    const { privateKeyToAccount }  = await import('viem/accounts')
    const { base, baseSepolia }    = await import('viem/chains')

    const account = privateKeyToAccount(PRIVATE_KEY)
    const chain   = NETWORK === 'mainnet' ? base : baseSepolia
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payFetch = (wrapFetchWithPayment as any)(account, chain)

    return {
      fetch:   payFetch as typeof globalThis.fetch,
      address: account.address,
    }
  } catch {
    console.error('[inkd-mcp] Warning: @x402/fetch not available — write operations will fail')
    return { fetch: globalThis.fetch, address: undefined }
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name:        'inkd_create_project',
    description: 'Register a new project on inkd Protocol on-chain. The wallet address becomes the permanent on-chain owner. Pay $0.10 USDC via x402. IMPORTANT: You MUST decide upfront if the project is public or private — this cannot be changed after creation. Public projects: code visible to everyone on Arweave. Private projects: code encrypted client-side with AES-256-GCM, only authorized wallets can decrypt.',
    inputSchema: {
      type: 'object',
      properties: {
        name:          { type: 'string', description: 'Unique project name (1-64 chars, lowercase, no spaces)' },
        description:   { type: 'string', description: 'Short description (max 256 chars)' },
        license:       { type: 'string', description: 'License: MIT, Apache-2.0, GPL-3.0, Proprietary', default: 'MIT' },
        isPublic:      { type: 'boolean', description: 'REQUIRED DECISION: true = anyone can read code on Arweave. false = code encrypted, only authorized wallets can decrypt. Default: true. Cannot be changed after creation.' },
        isAgent:       { type: 'boolean', description: 'Mark as AI agent project for discovery in the agent registry', default: false },
        agentEndpoint: { type: 'string', description: 'Agent API endpoint URL (required if isAgent=true)' },
      },
      required: ['name'],
    },
  },
  {
    name:        'inkd_push_version',
    description: 'Push a new version to an inkd project. Upload content to Arweave first via inkd_upload, then pass the returned hash. For PRIVATE projects: encrypt content before uploading using inkd_encrypt_content. Costs dynamic USDC (Arweave cost + 20% markup, min $0.10).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId:    { type: 'string', description: 'Numeric project ID' },
        tag:          { type: 'string', description: 'Version tag, e.g. v1.0.0' },
        contentHash:  { type: 'string', description: 'Arweave hash (ar://...) of the content' },
        metadataHash: { type: 'string', description: 'Optional Arweave hash of metadata' },
      },
      required: ['projectId', 'tag', 'contentHash'],
    },
  },
  {
    name:        'inkd_get_project',
    description: 'Get details about an inkd project by ID. Returns owner, name, description, version count, license. Free.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Numeric project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name:        'inkd_get_versions',
    description: 'Get all versions of an inkd project. Returns list of versions with tags, content hashes, and timestamps. Free.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Numeric project ID' },
        limit:     { type: 'number', description: 'Max results (default 20)' },
        offset:    { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: ['projectId'],
    },
  },
  {
    name:        'inkd_list_agents',
    description: 'Discover AI agents registered on inkd Protocol. Returns agents with endpoints, owners, and project IDs. Free.',
    inputSchema: {
      type: 'object',
      properties: {
        limit:  { type: 'number', description: 'Max results (default 20)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
  },
  {
    name:        'inkd_get_latest_version',
    description: 'Get the latest version of an inkd project. Returns arweaveHash, versionTag, and direct Arweave URL. Use this to check if a tool or library has been updated. Free.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Numeric project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name:        'inkd_search_projects',
    description: 'Search public inkd projects by name. Use to discover tools, libraries, or agents. Free.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or keyword to search for' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name:        'inkd_get_buybacks',
    description: 'Get recent $INKD buyback events (USDC→$INKD swaps). Returns list with amounts in USD, formatted $INKD, and Basescan links.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of events (1-100, default 20)' },
        skip:  { type: 'number', description: 'Offset for pagination (default 0)' },
      },
      required: [],
    },
  },
  {
    name:        'inkd_get_stats',
    description: 'Get protocol-wide stats: total projects, versions pushed, USDC volume processed, $INKD token supply.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'inkd_upload',
    description: 'Upload content to Arweave via Inkd. Returns an ar:// hash. Use this BEFORE inkd_push_version.',
    inputSchema: {
      type: 'object',
      properties: {
        content:     { type: 'string', description: 'Content to upload (text, JSON, code, etc.)' },
        contentType: { type: 'string', description: 'MIME type (default: text/plain)', default: 'text/plain' },
        filename:    { type: 'string', description: 'Optional filename for the upload' },
      },
      required: ['content'],
    },
  },
  {
    name:        'inkd_add_collaborator',
    description: 'Add a collaborator wallet to a PRIVATE project. The collaborator can then decrypt the project content. Requires the access manifest hash from project creation and the collaborator\'s compressed secp256k1 public key.',
    inputSchema: {
      type: 'object',
      properties: {
        manifestHash:      { type: 'string', description: 'ar:// hash of the current access manifest (returned by inkd_create_project for private projects)' },
        collaboratorAddress: { type: 'string', description: 'Ethereum address of the collaborator (0x...)' },
        collaboratorPublicKey: { type: 'string', description: 'Compressed secp256k1 public key of collaborator (66 hex chars, starts with 02 or 03)' },
      },
      required: ['manifestHash', 'collaboratorAddress', 'collaboratorPublicKey'],
    },
  },
]

// ─── Server ───────────────────────────────────────────────────────────────────

async function main() {
  const { fetch: inkdFetch, address } = await buildFetch()

  const server = new Server(
    { name: 'inkd', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }))

  // Call tools
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params

    try {
      switch (name) {

        case 'inkd_create_project': {
          const body = {
            name:          (args as any).name,
            description:   (args as any).description ?? '',
            license:       (args as any).license ?? 'MIT',
            isPublic:      (args as any).isPublic ?? true,
            isAgent:       (args as any).isAgent ?? false,
            agentEndpoint: (args as any).agentEndpoint ?? '',
          }

          const res = await inkdFetch(`${API_URL}/v1/projects`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            return {
              content: [{ type: 'text', text: `Error: ${JSON.stringify(err)}` }],
              isError: true,
            }
          }

          const result = await res.json()
          return {
            content: [{
              type: 'text',
              text: `✅ Project "${body.name}" registered!\n\nProject ID: ${result.projectId}\nOwner: ${result.owner}\nTX: ${result.txHash}\nBasescan: https://basescan.org/tx/${result.txHash}`,
            }],
          }
        }

        case 'inkd_push_version': {
          const { projectId, tag, contentHash, metadataHash } = args as any

          const res = await inkdFetch(`${API_URL}/v1/projects/${projectId}/versions`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ tag, contentHash, metadataHash: metadataHash ?? '' }),
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            return {
              content: [{ type: 'text', text: `Error: ${JSON.stringify(err)}` }],
              isError: true,
            }
          }

          const result = await res.json()
          return {
            content: [{
              type: 'text',
              text: `✅ Version "${tag}" pushed to project #${projectId}!\n\nTX: ${result.txHash}\nContent: ${contentHash}`,
            }],
          }
        }

        case 'inkd_get_project': {
          const { projectId } = args as any
          const res = await globalThis.fetch(`${API_URL}/v1/projects/${projectId}`)
          if (res.status === 404) {
            return { content: [{ type: 'text', text: `Project #${projectId} not found.` }] }
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

        case 'inkd_get_versions': {
          const { projectId, limit = 20, offset = 0 } = args as any
          const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
          const res = await globalThis.fetch(`${API_URL}/v1/projects/${projectId}/versions?${qs}`)
          const { data, total } = await res.json()

          const lines = [`Versions for project #${projectId} (total: ${total}):\n`]
          for (const v of data) {
            lines.push(`• ${v.tag} — ${v.contentHash} (${new Date(Number(v.pushedAt) * 1000).toISOString().slice(0, 10)})`)
          }

          return { content: [{ type: 'text', text: lines.join('\n') }] }
        }

        case 'inkd_list_agents': {
          const { limit = 20, offset = 0 } = (args ?? {}) as any
          const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
          const res = await globalThis.fetch(`${API_URL}/v1/agents?${qs}`)
          const { data, total } = await res.json()

          const lines = [`Registered AI agents on inkd (total: ${total}):\n`]
          for (const a of data) {
            lines.push(`• #${a.id} ${a.name} — owner: ${a.owner}${a.agentEndpoint ? ` — endpoint: ${a.agentEndpoint}` : ''}`)
          }

          return { content: [{ type: 'text', text: lines.join('\n') }] }
        }

        case 'inkd_get_latest_version': {
          const { projectId } = args as any
          const res = await globalThis.fetch(`${API_URL}/v1/projects/${projectId}/versions?limit=1`)
          if (!res.ok) throw new Error(`getLatestVersion failed: ${res.statusText}`)
          const { data } = await res.json() as any
          if (!data?.length) return { content: [{ type: 'text', text: `No versions found for project #${projectId}.` }] }
          const v = data[0]
          return { content: [{ type: 'text', text: `Latest version of #${projectId}:\nTag: ${v.versionTag}\nArweave: https://arweave.net/${v.arweaveHash}\nPushed: ${v.pushedAt}` }] }
        }

        case 'inkd_search_projects': {
          const { query, limit = 10 } = args as any
          const qs = new URLSearchParams({ q: query, limit: String(limit) })
          const res = await globalThis.fetch(`${API_URL}/v1/search/projects?${qs}`)
          if (!res.ok) throw new Error(`searchProjects failed: ${res.statusText}`)
          const { data, total } = await res.json() as any
          const lines = [`Projects matching "${query}" (${total} total):\n`]
          for (const p of data) lines.push(`• #${p.id} ${p.name} — ${p.versionCount} versions${p.isAgent ? ' [agent]' : ''}`)
          return { content: [{ type: 'text', text: lines.join('\n') }] }
        }

        case 'inkd_upload': {
          const { content, contentType = 'text/plain', filename } = args as any
          const buf = Buffer.from(content)
          const body: Record<string, unknown> = {
            data:        buf.toString('base64'),
            contentType,
          }
          if (filename) body['filename'] = filename

          const res = await inkdFetch(`${API_URL}/v1/upload`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            return { content: [{ type: 'text', text: `Upload error: ${JSON.stringify(err)}` }], isError: true }
          }

          const result = await res.json()
          return {
            content: [{
              type: 'text',
              text: `✅ Uploaded to Arweave\n\nHash: ${result.hash}\nURL: ${result.url}\nSize: ${result.bytes} bytes\n\nUse this hash in inkd_push_version as contentHash.`,
            }],
          }
        }

        case 'inkd_add_collaborator': {
          if (!PRIVATE_KEY) {
            return { content: [{ type: 'text', text: 'INKD_PRIVATE_KEY required to add collaborators.' }], isError: true }
          }

          const { manifestHash, collaboratorAddress, collaboratorPublicKey } = args as any

          // Fetch current manifest from Arweave
          const txId      = manifestHash.replace('ar://', '')
          const manifestRes = await globalThis.fetch(`https://arweave.net/${txId}`)
          const manifest  = await manifestRes.json()

          // Re-encrypt for new collaborator
          const { addRecipientToManifest } = await import('@inkd/sdk' as any)
          const newManifest = addRecipientToManifest(manifest, PRIVATE_KEY.replace('0x', ''), {
            address: collaboratorAddress,
            compressedPublicKey: collaboratorPublicKey,
          })

          // Upload new manifest
          const uploadRes = await inkdFetch(`${API_URL}/v1/upload`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              data:        Buffer.from(JSON.stringify(newManifest)).toString('base64'),
              contentType: 'application/inkd-access-manifest',
            }),
          })
          const uploadResult = await uploadRes.json()

          return {
            content: [{
              type: 'text',
              text: `✅ Collaborator added!\n\nNew manifest hash: ${uploadResult.hash}\n\nUpdate your on-chain access manifest with setAccessManifest(projectId, "${uploadResult.hash}").`,
            }],
          }
        }

        case 'inkd_get_buybacks': {
          const limit = (args as any).limit ?? 20
          const skip  = (args as any).skip  ?? 0
          const res   = await inkdFetch(`${API_URL}/v1/buybacks?limit=${limit}&skip=${skip}`)
          const data  = await res.json()
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
        }

        case 'inkd_get_stats': {
          const res  = await inkdFetch(`${API_URL}/v1/stats`)
          const data = await res.json()
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          }
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      }
    }
  })

  // Start stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error(`[inkd-mcp] Server running`)
  if (address) console.error(`[inkd-mcp] Wallet: ${address}`)
  else         console.error(`[inkd-mcp] Read-only mode (no INKD_PRIVATE_KEY)`)
}

main().catch(err => {
  console.error('[inkd-mcp] Fatal:', err)
  process.exit(1)
})
