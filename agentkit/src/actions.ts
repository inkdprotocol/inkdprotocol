import { z } from 'zod'

/**
 * Action schemas for inkd AgentKit provider.
 * These define what the LLM can call and with what parameters.
 */

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(64).describe(
    'Unique project name (1-64 chars). Once registered on-chain, this name is permanent.'
  ),
  description: z.string().max(256).optional().describe(
    'Short description of the project (max 256 chars).'
  ),
  license: z.enum(['MIT', 'Apache-2.0', 'GPL-3.0', 'Proprietary', 'UNLICENSED']).optional().describe(
    'Open source license. Defaults to MIT.'
  ),
  isPublic: z.boolean().optional().describe(
    'REQUIRED DECISION — set this explicitly. true = code stored publicly on Arweave, anyone can read it. false = code encrypted client-side with AES-256-GCM, only authorized wallets can decrypt. Default: true. Cannot be changed after project creation.'
  ),
  isAgent: z.boolean().optional().describe(
    'Mark this project as an AI agent. Enables discovery via inkd_list_agents.'
  ),
  agentEndpoint: z.string().url().optional().describe(
    'If isAgent=true, the HTTP endpoint where this agent can be called.'
  ),
})

export const PushVersionSchema = z.object({
  projectId: z.string().describe(
    'The numeric ID of the project to push a version to.'
  ),
  tag: z.string().min(1).max(64).describe(
    'Version tag, e.g. "v1.0.0", "alpha", "2025-03-04".'
  ),
  contentHash: z.string().min(1).describe(
    'Arweave hash (ar://...) or IPFS hash (ipfs://...) of the content to register.'
  ),
  metadataHash: z.string().optional().describe(
    'Optional Arweave or IPFS hash of additional metadata.'
  ),
})

export const GetProjectSchema = z.object({
  projectId: z.string().describe('The numeric project ID to look up.'),
})

export const ListAgentsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe(
    'Maximum number of agents to return. Default: 20.'
  ),
  offset: z.number().int().min(0).optional().describe(
    'Pagination offset. Default: 0.'
  ),
})

export const INKD_ACTIONS = {
  CREATE_PROJECT: 'inkd_create_project',
  PUSH_VERSION:   'inkd_push_version',
  GET_PROJECT:    'inkd_get_project',
  LIST_AGENTS:    'inkd_list_agents',
} as const
