/**
 * GET /v1/health
 * GET /v1/status
 *
 * Returns server health + protocol status (project count, network).
 * These endpoints are NOT gated by auth — safe for uptime monitors.
 */

import { Router } from 'express'
import type { Address } from 'viem'
import { getGraphClient } from '../graph.js'
import { type ApiConfig, ADDRESSES } from '../config.js'
import { buildPublicClient } from '../clients.js'
import { REGISTRY_ABI, TOKEN_ABI } from '../abis.js'
import { sendError } from '../errors.js'

const START_TIME = Date.now()

export function healthRouter(cfg: ApiConfig): Router {
  const router = Router()
  const publicClient = buildPublicClient(cfg)
  const addrs = ADDRESSES[cfg.network]

  /**
   * GET /v1/health
   * Lightweight liveness probe — no RPC call.
   */
  router.get('/health', (_req, res) => {
    res.json({
      ok:      true,
      service: '@inkd/api',
      version: '0.1.0',
      uptimeMs: Date.now() - START_TIME,
    })
  })

  /**
   * GET /v1/status
   * Protocol status — hits the RPC once to read project count + total supply.
   */
  router.get('/status', async (_req, res) => {
    try {
      const contractsDeployed =
        Boolean(addrs.registry) && Boolean(addrs.token)

      let projectCount:  bigint | null = null
      let totalSupply:   bigint | null = null
      let rpcReachable = false

      if (contractsDeployed) {
        try {
          ;[projectCount, totalSupply] = await Promise.all([
            publicClient.readContract({
              address:      addrs.registry as Address,
              abi:          REGISTRY_ABI,
              functionName: 'projectCount',
            }) as Promise<bigint>,
            publicClient.readContract({
              address:      addrs.token as Address,
              abi:          TOKEN_ABI,
              functionName: 'totalSupply',
            }) as Promise<bigint>,
          ])
          rpcReachable = true
        } catch (rpcErr) {
          console.warn('[inkd-api] RPC unreachable during /status:', rpcErr)
        }
      }

      res.json({
        ok:       true,
        network:  cfg.network,
        rpcUrl:   cfg.rpcUrl,
        rpcReachable,
        contracts: {
          token:    addrs.token    || null,
          registry: addrs.registry || null,
          treasury: addrs.treasury || null,
          deployed: contractsDeployed,
        },
        protocol: {
          projectCount: projectCount !== null ? projectCount.toString() : null,
          totalSupply:  totalSupply  !== null ? (Number(totalSupply) / 1e18).toFixed(4) + ' INKD' : null,
        },
        server: {
          uptimeMs: Date.now() - START_TIME,
          version:  '0.1.0',
        },
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  /**
   * GET /v1/stats
   * Aggregated protocol stats — cached 60s, safe for public use.
   */
  router.get('/stats', async (_req, res) => {
    try {
      let projectCount: bigint | null = null
      let totalSupply:  bigint | null = null
      try {
        ;[projectCount, totalSupply] = await Promise.all([
          Promise.race([
            publicClient.readContract({ address: addrs.registry as Address, abi: REGISTRY_ABI, functionName: 'projectCount' }) as Promise<bigint>,
            new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
          ]),
          Promise.race([
            publicClient.readContract({ address: addrs.token as Address, abi: TOKEN_ABI, functionName: 'totalSupply' }) as Promise<bigint>,
            new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
          ]),
        ])
      } catch { /* RPC down — return nulls gracefully */ }

      // Graph stats (totalUsdcVolume, totalVersions)
      const graph = getGraphClient()
      let graphStats = null
      if (graph) {
        graphStats = await graph.getStats().catch(() => null)
      }

      res.setHeader('Cache-Control', 'public, max-age=60')
      res.json({
        projects:         projectCount !== null ? Number(projectCount) : null,
        tokenSupply:      totalSupply  !== null ? (Number(totalSupply) / 1e18).toFixed(0) : null,
        totalVersions:    graphStats?.totalVersions ?? null,
        totalUsdcVolume:  graphStats?.totalUsdcVolume ?? null,
        totalUsdcVolumeUsd: graphStats?.totalUsdcVolume
          ? `$${(Number(graphStats.totalUsdcVolume) / 1e6).toFixed(2)}`
          : null,
        network:          cfg.network,
        contracts: {
          registry: addrs.registry || null,
          treasury: addrs.treasury || null,
          token:    addrs.token    || null,
        },
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  return router
}
