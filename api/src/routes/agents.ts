/**
 * Inkd API — /v1/agents routes
 *
 * Agent-specific endpoints for AI agent discovery and interaction.
 *
 * GET  /v1/agents               List all registered AI agents (paginated)
 * GET  /v1/agents/by-name/:name Get an agent by its project name
 * GET  /v1/agents/:id           Get an agent project by numeric id
 */

import { Router } from 'express'
import { z }      from 'zod'
import type { Address } from 'viem'
import { type ApiConfig, ADDRESSES } from '../config.js'
import { buildPublicClient } from '../clients.js'
import { REGISTRY_ABI } from '../abis.js'
import { sendError, NotFoundError, BadRequestError, ServiceUnavailableError } from '../errors.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type RawAgent = {
  id:            bigint
  name:          string
  description:   string
  owner:         Address
  agentEndpoint: string
  isPublic:      boolean
  versionCount:  bigint
  createdAt:     bigint
}

type RawProject = {
  id:            bigint
  name:          string
  description:   string
  license:       string
  readmeHash:    string
  owner:         Address
  isPublic:      boolean
  isAgent:       boolean
  agentEndpoint: string
  createdAt:     bigint
  versionCount:  bigint
  exists:        boolean
}

function serializeAgent(a: RawAgent | RawProject) {
  return {
    id:            ('id' in a ? a.id : BigInt(0)).toString(),
    name:          a.name,
    description:   a.description,
    owner:         a.owner,
    agentEndpoint: a.agentEndpoint,
    isPublic:      a.isPublic,
    versionCount:  a.versionCount.toString(),
    createdAt:     a.createdAt.toString(),
  }
}

const PaginationQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export function agentsRouter(cfg: ApiConfig): Router {
  const router = Router()
  const addrs  = ADDRESSES[cfg.network]

  function requireRegistry(): Address {
    if (!addrs.registry) throw new ServiceUnavailableError(
      'Registry contract not deployed yet. Set INKD_REGISTRY_ADDRESS env var.'
    )
    return addrs.registry as Address
  }

  const publicClient = buildPublicClient(cfg)

  // ── GET /v1/agents ──────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const { offset, limit } = PaginationQuery.parse(req.query)

      const [agents, total] = await Promise.all([
        publicClient.readContract({
          address:      registryAddress,
          abi:          REGISTRY_ABI,
          functionName: 'getAgentProjects',
          args:         [BigInt(offset), BigInt(limit)],
        }) as unknown as Promise<RawAgent[]>,
        publicClient.readContract({
          address:      registryAddress,
          abi:          REGISTRY_ABI,
          functionName: 'agentProjectCount',
        }) as unknown as Promise<bigint>,
      ])

      res.json({
        data:   agents.map(serializeAgent),
        total:  total.toString(),
        offset,
        limit,
        count:  agents.length,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── GET /v1/agents/by-name/:name ────────────────────────────────────────────
  router.get('/by-name/:name', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const { name } = req.params
      if (!name) throw new BadRequestError('Agent name is required')

      // Linear scan by name (no nameToId mapping yet — fine until The Graph)
      const total = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'projectCount',
      }) as bigint

      const normalizedSearch = name.toLowerCase()
      let found: RawProject | null = null

      for (let i = 1; i <= Number(total); i++) {
        const p = await publicClient.readContract({
          address:      registryAddress,
          abi:          REGISTRY_ABI,
          functionName: 'getProject',
          args:         [BigInt(i)],
        }) as unknown as RawProject

        if (p.exists && p.isAgent && p.name.toLowerCase() === normalizedSearch) {
          found = p
          break
        }
      }

      if (!found) throw new NotFoundError(`Agent "${name}"`)

      res.json({ data: serializeAgent(found) })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── GET /v1/agents/:id ──────────────────────────────────────────────────────
  router.get('/:id', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const id = parseInt(req.params['id'] ?? '', 10)
      if (isNaN(id) || id < 1) throw new BadRequestError('Agent id must be a positive integer')

      const p = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'getProject',
        args:         [BigInt(id)],
      }) as unknown as RawProject

      if (!p.exists)   throw new NotFoundError(`Project #${id}`)
      if (!p.isAgent)  throw new NotFoundError(`Agent #${id} (project exists but is not an agent)`)

      res.json({ data: serializeAgent(p) })
    } catch (err) {
      sendError(res, err)
    }
  })

  return router
}
