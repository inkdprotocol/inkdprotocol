/**
 * GET /v1/health
 * GET /v1/status
 *
 * Returns server health + protocol status (project count, network).
 * These endpoints are NOT gated by auth — safe for uptime monitors.
 */

import { Router } from 'express'
import type { Address } from 'viem'
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

  return router
}
