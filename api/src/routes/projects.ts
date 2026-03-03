/**
 * Inkd API — /v1/projects routes
 *
 * GET  /v1/projects            List all projects (paginated)
 * GET  /v1/projects/:id        Get a single project by id
 * POST /v1/projects            Create a new project
 * GET  /v1/projects/:id/versions       List versions for a project
 * POST /v1/projects/:id/versions       Push a new version
 */

import { Router } from 'express'
import { z }      from 'zod'
import type { Address } from 'viem'
import { type ApiConfig, ADDRESSES } from '../config.js'
import { buildPublicClient, buildWalletClient, normalizePrivateKey } from '../clients.js'
import { getPayerAddress } from '../middleware/x402.js'
import { REGISTRY_ABI } from '../abis.js'
import { sendError, NotFoundError, BadRequestError, ServiceUnavailableError } from '../errors.js'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CreateProjectBody = z.object({
  name:          z.string().min(1).max(64),
  description:   z.string().max(256).default(''),
  license:       z.string().max(32).default('MIT'),
  isPublic:      z.boolean().default(true),
  readmeHash:    z.string().max(128).default(''),
  isAgent:       z.boolean().default(false),
  agentEndpoint: z.string().url().or(z.literal('')).default(''),
  // privateKey removed — server wallet signs, payer address comes from x402 payment
})

const PushVersionBody = z.object({
  tag:          z.string().min(1).max(64),
  contentHash:  z.string().min(1).max(128),
  metadataHash: z.string().max(128).default(''),
  // privateKey removed — server wallet signs, payer address comes from x402 payment
})

const PaginationQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

type RawVersion = {
  versionId:    bigint
  projectId:    bigint
  tag:          string
  contentHash:  string
  metadataHash: string
  pushedAt:     bigint
  pusher:       Address
}

function serializeProject(p: RawProject) {
  return {
    id:            p.id.toString(),
    name:          p.name,
    description:   p.description,
    license:       p.license,
    readmeHash:    p.readmeHash,
    owner:         p.owner,
    isPublic:      p.isPublic,
    isAgent:       p.isAgent,
    agentEndpoint: p.agentEndpoint,
    createdAt:     p.createdAt.toString(),
    versionCount:  p.versionCount.toString(),
  }
}

function serializeVersion(v: RawVersion) {
  return {
    versionId:    v.versionId.toString(),
    projectId:    v.projectId.toString(),
    tag:          v.tag,
    contentHash:  v.contentHash,
    metadataHash: v.metadataHash,
    pushedAt:     v.pushedAt.toString(),
    pusher:       v.pusher,
  }
}

// ─── Router factory ───────────────────────────────────────────────────────────

export function projectsRouter(cfg: ApiConfig): Router {
  const router = Router()
  const addrs  = ADDRESSES[cfg.network]

  function requireRegistry(): Address {
    if (!addrs.registry) throw new ServiceUnavailableError(
      'Registry contract not deployed yet. Set INKD_REGISTRY_ADDRESS env var.'
    )
    return addrs.registry as Address
  }

  const publicClient = buildPublicClient(cfg)

  // ── GET /v1/projects ────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const { offset, limit } = PaginationQuery.parse(req.query)

      const total = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'projectCount',
      }) as bigint

      const results: ReturnType<typeof serializeProject>[] = []

      // Fetch each project — sequential is fine for <100 items
      for (let i = offset + 1; i <= Math.min(Number(total), offset + limit); i++) {
        const p = await publicClient.readContract({
          address:      registryAddress,
          abi:          REGISTRY_ABI,
          functionName: 'getProject',
          args:         [BigInt(i)],
        }) as unknown as RawProject

        if (p.exists) results.push(serializeProject(p))
      }

      res.json({
        data:   results,
        total:  total.toString(),
        offset,
        limit,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── GET /v1/projects/:id ────────────────────────────────────────────────────
  router.get('/:id', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const id = parseInt(req.params['id'] ?? '', 10)
      if (isNaN(id) || id < 1) throw new BadRequestError('Project id must be a positive integer')

      const p = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'getProject',
        args:         [BigInt(id)],
      }) as unknown as RawProject

      if (!p.exists) throw new NotFoundError(`Project #${id}`)

      res.json({ data: serializeProject(p) })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── POST /v1/projects ───────────────────────────────────────────────────────
  router.post('/', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const body = CreateProjectBody.safeParse(req.body)
      if (!body.success) throw new BadRequestError(body.error.issues.map(i => i.message).join('; '))

      const {
        name, description, license, isPublic, readmeHash,
        isAgent, agentEndpoint,
      } = body.data

      // Use server wallet to sign transactions (payer already paid via x402)
      if (!cfg.serverWalletKey) throw new ServiceUnavailableError(
        'SERVER_WALLET_KEY not configured. Cannot sign transactions.'
      )

      const payerAddress = getPayerAddress(req)
      const { client: walletClient, address: walletAddress } =
        buildWalletClient(cfg, normalizePrivateKey(cfg.serverWalletKey))

      const hash = await walletClient.writeContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'createProject',
        args:         [name, description, license, isPublic, readmeHash, isAgent, agentEndpoint],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      const total = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'projectCount',
      }) as bigint

      res.status(201).json({
        txHash:    hash,
        projectId: total.toString(),
        owner:     payerAddress ?? walletAddress,  // payer = owner via x402
        signer:    walletAddress,
        status:    receipt.status,
        blockNumber: receipt.blockNumber.toString(),
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── GET /v1/projects/:id/versions ───────────────────────────────────────────
  router.get('/:id/versions', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const id = parseInt(req.params['id'] ?? '', 10)
      if (isNaN(id) || id < 1) throw new BadRequestError('Project id must be a positive integer')

      const { offset, limit } = PaginationQuery.parse(req.query)

      // Verify project exists
      const p = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'getProject',
        args:         [BigInt(id)],
      }) as unknown as RawProject
      if (!p.exists) throw new NotFoundError(`Project #${id}`)

      const versions = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'getProjectVersions',
        args:         [BigInt(id), BigInt(offset), BigInt(limit)],
      }) as unknown as RawVersion[]

      res.json({
        data:        versions.map(serializeVersion),
        total:       p.versionCount.toString(),
        projectId:   id.toString(),
        offset,
        limit,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── POST /v1/projects/:id/versions ──────────────────────────────────────────
  router.post('/:id/versions', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const id = parseInt(req.params['id'] ?? '', 10)
      if (isNaN(id) || id < 1) throw new BadRequestError('Project id must be a positive integer')

      const body = PushVersionBody.safeParse(req.body)
      if (!body.success) throw new BadRequestError(body.error.issues.map(i => i.message).join('; '))

      const { tag, contentHash, metadataHash } = body.data

      if (!cfg.serverWalletKey) throw new ServiceUnavailableError(
        'SERVER_WALLET_KEY not configured. Cannot sign transactions.'
      )

      const payerAddress = getPayerAddress(req)
      const { client: walletClient, address: walletAddress } =
        buildWalletClient(cfg, normalizePrivateKey(cfg.serverWalletKey))

      const hash = await walletClient.writeContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'pushVersion',
        args:         [BigInt(id), tag, contentHash, metadataHash],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      res.status(201).json({
        txHash:    hash,
        projectId: id.toString(),
        tag,
        contentHash,
        pusher:    payerAddress ?? walletAddress,
        signer:    walletAddress,
        status:    receipt.status,
        blockNumber: receipt.blockNumber.toString(),
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  return router
}
