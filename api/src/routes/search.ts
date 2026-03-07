/**
 * @file search.ts
 * @description Graph-powered search and discovery routes.
 *
 * GET /v1/search?q=<query>           — full-text search projects + agents
 * GET /v1/search/projects?q=<query>  — search projects only
 * GET /v1/search/agents?q=<query>    — search agents only
 * GET /v1/search/stats               — protocol stats
 * GET /v1/search/by-owner/:address   — projects owned by address
 */

import { Router } from 'express'
import { z } from 'zod'
import { getGraphClient } from '../graph.js'
import { NotFoundError, ServiceUnavailableError } from '../errors.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SearchQuery = z.object({
  q:      z.string().min(1).max(200).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

function requireGraph() {
  const graph = getGraphClient()
  if (!graph) throw new ServiceUnavailableError('Graph indexer not available')
  return graph
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function buildSearchRouter(): Router {
  const router = Router()

  /** GET /v1/search?q=<query> — search all projects + agents */
  router.get('/', async (req, res, next) => {
    try {
      const { q, limit } = SearchQuery.parse(req.query)
      const graph = requireGraph()

      if (!q) {
        // No query — return latest projects
        const projects = await graph.getProjects({ limit })
        return res.json({ data: projects, count: projects.length })
      }

      const results = await graph.searchProjects(q, limit)
      res.json({ data: results, count: results.length, query: q })
    } catch (err) { next(err) }
  })

  /** GET /v1/search/projects?q=<query> — search projects only */
  router.get('/projects', async (req, res, next) => {
    try {
      const { q, limit, offset } = SearchQuery.parse(req.query)
      const graph = requireGraph()

      const projects = q
        ? await graph.searchProjects(q, limit)
        : await graph.getProjects({ limit, offset, isAgent: false })

      res.json({ data: projects, count: projects.length, query: q })
    } catch (err) { next(err) }
  })

  /** GET /v1/search/agents?q=<query> — search agents only */
  router.get('/agents', async (req, res, next) => {
    try {
      const { q, limit, offset } = SearchQuery.parse(req.query)
      const graph = requireGraph()

      let agents
      if (q) {
        const all = await graph.searchProjects(q, limit * 2)
        agents = all.filter((p) => p.isAgent).slice(0, limit)
      } else {
        agents = await graph.getProjects({ limit, offset, isAgent: true })
      }

      res.json({ data: agents, count: agents.length, query: q })
    } catch (err) { next(err) }
  })

  /** GET /v1/search/stats — protocol stats from The Graph */
  router.get('/stats', async (req, res, next) => {
    try {
      const graph = requireGraph()
      const stats = await graph.getStats()
      if (!stats) {
        // Subgraph might not have indexed any events yet
        return res.json({
          totalProjects: 0,
          totalVersions: 0,
          totalAgents: 0,
          totalSettled: '0',
          note: 'Subgraph is still indexing. Check back soon.',
        })
      }
      res.json(stats)
    } catch (err) { next(err) }
  })

  /** GET /v1/search/by-owner/:address — projects by wallet address */
  router.get('/by-owner/:address', async (req, res, next) => {
    try {
      const { address } = req.params
      const { limit } = SearchQuery.parse(req.query)

      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ error: { code: 'INVALID_ADDRESS', message: 'Invalid wallet address' } })
      }

      const graph = requireGraph()
      const projects = await graph.getProjectsByOwner(address, limit)
      res.json({ data: projects, count: projects.length, owner: address.toLowerCase() })
    } catch (err) { next(err) }
  })

  return router
}
