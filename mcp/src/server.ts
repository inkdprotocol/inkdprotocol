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
    const payFetch = wrapFetchWithPayment(account, chain)

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
    description: 'Register a new project on inkd Protocol on-chain. The wallet address becomes the on-chain owner. Locks 1 $INKD permanently. Returns projectId and transaction hash.',
    inputSchema: {
      type: 'object',
      properties: {
        name:          { type: 'string', description: 'Unique project name (1-64 chars)' },
        description:   { type: 'string', description: 'Short description (max 256 chars)' },
        license:       { type: 'string', description: 'License: MIT, Apache-2.0, GPL-3.0, Proprietary', default: 'MIT' },
        isPublic:      { type: 'boolean', description: 'Public visibility', default: true },
        isAgent:       { type: 'boolean', description: 'Mark as AI agent for discovery', default: false },
        agentEndpoint: { type: 'string', description: 'Agent API endpoint URL (if isAgent=true)' },
      },
      required: ['name'],
    },
  },
  {
    name:        'inkd_push_version',
    description: 'Push a new version to an inkd project. Content referenced by Arweave hash. Costs 0.001 ETH. Returns transaction hash.',
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
