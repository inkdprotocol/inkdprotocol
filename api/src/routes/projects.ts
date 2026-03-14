/**
 * Inkd API — /v1/projects routes
 *
 * GET  /v1/projects                     List all projects (paginated)
 * GET  /v1/projects/estimate?bytes=N    Estimate USDC cost for a content upload
 * GET  /v1/projects/:id                 Get a single project by id (with V2 metadata)
 * POST /v1/projects                     Create a new project (createProjectV2, fee via x402)
 * GET  /v1/projects/:id/versions        List versions for a project
 * POST /v1/projects/:id/versions        Push a new version (pushVersionV2, fee via x402)
 */

import { Router } from 'express'
import { z }      from 'zod'
import type { Address } from 'viem'
import { type ApiConfig, ADDRESSES } from '../config.js'
import { buildPublicClient, buildWalletClient, normalizePrivateKey } from '../clients.js'
import { getPayerAddress, getPaymentAmount, getPaymentAuthorizationData } from '../middleware/x402.js'
import { REGISTRY_ABI, TREASURY_ABI, USDC_ABI } from '../abis.js'
import { getArweaveCostUsdc, calculateCharge } from '../arweave.js'
import { sendError, NotFoundError, BadRequestError, ServiceUnavailableError } from '../errors.js'
// Note: IndexerClient types are inlined to avoid importing better-sqlite3 at bundle time
interface IndexerProject {
  id: number; name: string; description: string; license: string; readme_hash: string;
  owner: string; is_public: number; is_agent: number; agent_endpoint: string;
  metadata_uri: string; fork_of: number; access_manifest: string; tags_hash: string;
  version_count: number; created_at: number; updated_at: number;
}
interface IndexerVersion {
  project_id: number; version_index: number; arweave_hash: string; version_tag: string;
  changelog: string; pushed_by: string; agent_address: string | null; meta_hash: string; pushed_at: number;
}

// ─── Safe indexer loader (avoids native module crash on Vercel) ───────────────
// Uses dynamic import path to prevent esbuild from bundling better-sqlite3

function buildIndexerClientSafe(dbPath: string) {
  try {
    // Dynamic path prevents static analysis bundling
    const modulePath = '../indexer/client' + '.js'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modulePath)
    return mod.buildIndexerClient(dbPath)
  } catch {
    return null
  }
}
import { getGraphClient, type GraphProject, type GraphVersion } from '../graph.js'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CreateProjectBody = z.object({
  name:               z.string().min(1).max(64),
  description:        z.string().max(256).default(''),
  license:            z.string().max(32).default('MIT'),
  isPublic:           z.boolean().default(true),
  readmeHash:         z.string().max(128).default(''),
  isAgent:            z.boolean().default(false),
  agentEndpoint:      z.string().url().or(z.literal('')).default(''),
  // V2 fields (optional)
  metadataUri:        z.string().max(256).default(''),
  forkOf:             z.number().int().min(0).default(0),
  accessManifestHash: z.string().max(128).default(''),
  tagsHash:           z.string().regex(/^0x[0-9a-fA-F]{64}$/).or(z.literal('')).default(''),
})

const PushVersionBody = z.object({
  arweaveHash:                  z.string().min(1).max(128),
  versionTag:                   z.string().min(1).max(64),
  changelog:                    z.string().max(512).default(''),
  contentSize:                  z.number().int().min(0).optional(),
  // V2 fields (optional)
  versionMetadataArweaveHash:   z.string().max(128).default(''),
})

const PaginationQuery = z.object({
  offset:  z.coerce.number().int().min(0).default(0),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
  owner:   z.string().optional(),
  isAgent: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

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
  projectId:   bigint
  arweaveHash: string
  versionTag:  string
  changelog:   string
  pushedBy:    Address
  pushedAt:    bigint
}

function serializeProject(p: RawProject, v2?: {
  metadataUri?: string
  forkOf?: bigint
  accessManifest?: string
}) {
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
    // V2 fields (may be empty string/zero for V1-created projects)
    metadataUri:   v2?.metadataUri ?? '',
    forkOf:        v2?.forkOf?.toString() ?? '0',
    accessManifest: v2?.accessManifest ?? '',
  }
}

function serializeIndexedProject(p: IndexerProject) {
  return {
    id:            p.id.toString(),
    name:          p.name,
    description:   p.description,
    license:       p.license,
    readmeHash:    p.readme_hash,
    owner:         p.owner as Address,
    isPublic:      !!p.is_public,
    isAgent:       !!p.is_agent,
    agentEndpoint: p.agent_endpoint,
    createdAt:     p.created_at.toString(),
    versionCount:  p.version_count.toString(),
    metadataUri:   p.metadata_uri ?? '',
    forkOf:        p.fork_of?.toString() ?? '0',
    accessManifest: p.access_manifest ?? '',
  }
}

function serializeVersion(v: RawVersion, index: number, agentAddress?: Address, metaHash?: string) {
  return {
    versionIndex: index.toString(),
    projectId:    v.projectId.toString(),
    arweaveHash:  v.arweaveHash,
    versionTag:   v.versionTag,
    changelog:    v.changelog,
    pushedBy:     v.pushedBy,
    pushedAt:     v.pushedAt.toString(),
    agentAddress: agentAddress ?? null,
    metaHash:     metaHash ?? '',
  }
}

function serializeGraphProject(p: GraphProject) {
  return {
    id:            p.id,
    name:          p.name,
    description:   p.description,
    license:       '',
    readmeHash:    p.arweaveHash,
    owner:         p.owner.id,
    isPublic:      true,
    isAgent:       p.isAgent,
    agentEndpoint: '',
    createdAt:     p.createdAt,
    versionCount:  p.versionCount,
    metadataUri:   p.metadataUri ?? '',
    forkOf:        p.forkOf?.id ?? '0',
    accessManifest: '',
  }
}

function serializeGraphVersion(v: GraphVersion, projectId: number) {
  return {
    versionIndex: v.versionIndex,
    projectId:    projectId.toString(),
    arweaveHash:  v.arweaveHash,
    versionTag:   v.versionTag,
    changelog:    '',
    pushedBy:     v.pushedBy.id,
    pushedAt:     v.createdAt,
    agentAddress: v.agentAddress?.id ?? null,
    metaHash:     '',
  }
}

function serializeIndexedVersion(v: IndexerVersion) {
  return {
    versionIndex: v.version_index.toString(),
    projectId:    v.project_id.toString(),
    arweaveHash:  v.arweave_hash,
    versionTag:   v.version_tag,
    changelog:    v.changelog,
    pushedBy:     v.pushed_by as Address,
    pushedAt:     v.pushed_at.toString(),
    agentAddress: v.agent_address,
    metaHash:     v.meta_hash ?? '',
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
  const indexer      = cfg.indexerDbPath ? buildIndexerClientSafe(cfg.indexerDbPath) : null

  // ── GET /v1/projects ────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const { offset, limit, owner, isAgent } = PaginationQuery.parse(req.query)

      // 1. Graph-first
      const graph = getGraphClient()
      if (graph) {
        try {
          const rows = await graph.getProjects({ offset, limit, isAgent, owner })
          const total = await graph.getProjectCount().catch(() => rows.length)
          res.setHeader('Cache-Control', 'public, max-age=10')
          return res.json({ data: rows.map(serializeGraphProject), total: total.toString(), offset, limit, source: 'graph' })
        } catch { /* fall through */ }
      }

      // 2. Indexer fallback
      if (indexer) {
        const totalIndexed = indexer.countProjects()
        let rows = indexer.listProjects(offset, limit).map(serializeIndexedProject)
        if (owner) rows = rows.filter((p: any) => p.owner.toLowerCase() === owner.toLowerCase())
        if (isAgent !== undefined) rows = rows.filter((p: any) => p.isAgent === isAgent)
        res.setHeader('Cache-Control', 'public, max-age=10')
        return res.json({ data: rows, total: totalIndexed.toString(), offset, limit, source: 'indexer' })
      }

      // 3. RPC fallback
      const total = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'projectCount',
      }) as bigint

      const results: ReturnType<typeof serializeProject>[] = []
      for (let i = offset + 1; i <= Math.min(Number(total), offset + limit); i++) {
        const p = await publicClient.readContract({
          address:      registryAddress,
          abi:          REGISTRY_ABI,
          functionName: 'getProject',
          args:         [BigInt(i)],
        }) as unknown as RawProject
        if (!p.exists) continue
        if (owner && p.owner.toLowerCase() !== owner.toLowerCase()) continue
        if (isAgent !== undefined && p.isAgent !== isAgent) continue
        results.push(serializeProject(p))
      }

      res.setHeader('Cache-Control', 'public, max-age=10')
      res.json({ data: results, total: total.toString(), offset, limit, source: 'rpc' })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── GET /v1/projects/estimate?bytes=N ──────────────────────────────────────
  router.get('/estimate', async (req, res) => {
    try {
      const bytes = parseInt(req.query['bytes'] as string ?? '0', 10)
      if (!bytes || bytes <= 0) throw new BadRequestError('bytes must be a positive integer')
      if (bytes > 500 * 1024 * 1024) throw new BadRequestError('Max 500MB per upload')

      const arweaveCost = await getArweaveCostUsdc(bytes)
      const { markup, total } = calculateCharge(arweaveCost)

      res.json({
        bytes,
        arweaveCost:    arweaveCost.toString(),
        markup:         markup.toString(),
        total:          total.toString(),
        markupPct:      '20%',
        arweaveCostUsd: `$${(Number(arweaveCost) / 1e6).toFixed(4)}`,
        totalUsd:       `$${(Number(total)       / 1e6).toFixed(4)}`,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  // ── GET /v1/projects/by-name/:name ─────────────────────────────────────────
  router.get('/by-name/:name', async (req, res) => {
    try {
      const registryAddress = requireRegistry()
      const name = req.params['name'] ?? ''
      if (!name) throw new BadRequestError('name is required')

      // 1. Graph-first
      const graph = getGraphClient()
      if (graph) {
        try {
          const p = await graph.getProjectByName(name)
          if (p) {
            res.setHeader('Cache-Control', 'public, max-age=30')
            return res.json({ data: serializeGraphProject(p), source: 'graph' })
          }
        } catch { /* fall through */ }
      }

      // 2. Indexer fallback
      if (indexer) {
        const total = indexer.countProjects()
        for (let i = 1; i <= total; i++) {
          const row = indexer.getProject(i)
          if (row && row.name === name) {
            res.setHeader('Cache-Control', 'public, max-age=30')
            return res.json({ data: serializeIndexedProject(row), source: 'indexer' })
          }
        }
        throw new NotFoundError(`Project "${name}"`)
      }

      // 3. RPC fallback — linear scan
      const total = await publicClient.readContract({
        address: registryAddress, abi: REGISTRY_ABI, functionName: 'projectCount',
      }) as bigint

      for (let i = 1; i <= Number(total); i++) {
        const p = await publicClient.readContract({
          address: registryAddress, abi: REGISTRY_ABI,
          functionName: 'getProject', args: [BigInt(i)],
        }) as unknown as RawProject
        if (p.exists && p.name === name) {
          res.setHeader('Cache-Control', 'public, max-age=30')
          return res.json({ data: serializeProject(p), source: 'rpc' })
        }
      }

      throw new NotFoundError(`Project "${name}"`)
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

      // 1. Graph-first
      const graph = getGraphClient()
      if (graph) {
        try {
          const p = await graph.getProject(id)
          if (p) {
            res.setHeader('Cache-Control', 'public, max-age=30')
            return res.json({ data: serializeGraphProject(p), source: 'graph' })
          }
        } catch { /* fall through */ }
      }

      // 2. Indexer fallback
      if (indexer) {
        const row = indexer.getProject(id)
        if (!row) throw new NotFoundError(`Project #${id}`)
        res.setHeader('Cache-Control', 'public, max-age=30')
        return res.json({ data: serializeIndexedProject(row), source: 'indexer' })
      }

      // 3. RPC fallback
      const p = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'getProject',
        args:         [BigInt(id)],
      }) as unknown as RawProject

      if (!p.exists) throw new NotFoundError(`Project #${id}`)

      const [metadataUri, forkOf, accessManifest] = await Promise.all([
        publicClient.readContract({
          address: registryAddress, abi: REGISTRY_ABI,
          functionName: 'projectMetadataUri', args: [BigInt(id)],
        }) as Promise<string>,
        publicClient.readContract({
          address: registryAddress, abi: REGISTRY_ABI,
          functionName: 'projectForkOf', args: [BigInt(id)],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: registryAddress, abi: REGISTRY_ABI,
          functionName: 'projectAccessManifest', args: [BigInt(id)],
        }) as Promise<string>,
      ])

      res.setHeader('Cache-Control', 'public, max-age=30')
      res.json({ data: serializeProject(p, { metadataUri, forkOf, accessManifest }), source: 'rpc' })
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
        metadataUri, forkOf, accessManifestHash, tagsHash,
      } = body.data

      if (!cfg.serverWalletKey) throw new ServiceUnavailableError(
        'SERVER_WALLET_KEY not configured. Cannot sign transactions.'
      )

      const payerAddress  = getPayerAddress(req)
      const paymentAmount = getPaymentAmount(req)
      const { client: walletClient, address: walletAddress } =
        buildWalletClient(cfg, normalizePrivateKey(cfg.serverWalletKey))

      // Settle X402 USDC payment: transferWithAuthorization → Treasury.settle()
      if (cfg.treasuryAddress && paymentAmount) {
        const authData = getPaymentAuthorizationData(req)
        if (authData) {
          // 1. Execute EIP-3009 signed USDC transfer: payer → Treasury
          const usdcAddress = (process.env.USDC_ADDRESS ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as Address
          await walletClient.writeContract({
            address:      usdcAddress,
            abi:          USDC_ABI,
            functionName: 'transferWithAuthorization',
            args: [
              authData.from, authData.to,
              authData.value, authData.validAfter, authData.validBefore,
              authData.nonce, authData.v, authData.r, authData.s,
            ],
          })
        }
        // 2. Split settled USDC (Buyback + Treasury)
        await walletClient.writeContract({
          address:      cfg.treasuryAddress,
          abi:          TREASURY_ABI,
          functionName: 'settle',
          args:         [paymentAmount, 0n],
        })
      }

      // Encode tagsHash: empty string → zero bytes32, otherwise parse hex
      const tagsHashBytes: `0x${string}` = (tagsHash && tagsHash.startsWith('0x'))
        ? tagsHash as `0x${string}`
        : `0x${'00'.repeat(32)}`

      // Call createProjectV2 (settler-only, fee-free — x402 already settled above)
      const hash = await walletClient.writeContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'createProjectV2',
        args: [
          (payerAddress ?? walletAddress) as `0x${string}`,
          name, description, license, isPublic, readmeHash,
          isAgent, agentEndpoint,
          metadataUri, BigInt(forkOf), accessManifestHash, tagsHashBytes,
        ],
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
        owner:     payerAddress ?? walletAddress,
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

      // 1. Graph-first
      const graph = getGraphClient()
      if (graph) {
        try {
          const versions = await graph.getProjectVersions(id, limit)
          const sliced = versions.slice(offset, offset + limit)
          res.setHeader('Cache-Control', 'public, max-age=30')
          return res.json({
            data:      sliced.map(v => serializeGraphVersion(v, id)),
            total:     versions.length.toString(),
            projectId: id.toString(),
            offset,
            limit,
            source:    'graph',
          })
        } catch { /* fall through */ }
      }

      // 2. Indexer fallback
      if (indexer) {
        const projectRow = indexer.getProject(id)
        if (!projectRow) throw new NotFoundError(`Project #${id}`)
        const totalIndexed = indexer.countVersions(id)
        const versions = indexer.listVersions(id, offset, limit).map(serializeIndexedVersion)
        res.setHeader('Cache-Control', 'public, max-age=30')
        return res.json({
          data:      versions,
          total:     totalIndexed.toString(),
          projectId: id.toString(),
          offset,
          limit,
          source:    'indexer',
        })
      }

      // 3. RPC fallback
      const p = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'getProject',
        args:         [BigInt(id)],
      }) as unknown as RawProject
      if (!p.exists) throw new NotFoundError(`Project #${id}`)

      const totalVersions = await publicClient.readContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'getVersionCount',
        args:         [BigInt(id)],
      }) as bigint

      const count = Number(totalVersions)
      const start = Math.min(offset, count)
      const end   = Math.min(start + limit, count)

      const versions = await Promise.all(
        Array.from({ length: end - start }, async (_, i) => {
          const idx = start + i
          const [v, agentAddress, metaHash] = await Promise.all([
            publicClient.readContract({
              address: registryAddress, abi: REGISTRY_ABI,
              functionName: 'getVersion', args: [BigInt(id), BigInt(idx)],
            }) as Promise<RawVersion>,
            publicClient.readContract({
              address: registryAddress, abi: REGISTRY_ABI,
              functionName: 'getVersionAgent', args: [BigInt(id), BigInt(idx)],
            }) as Promise<Address>,
            publicClient.readContract({
              address: registryAddress, abi: REGISTRY_ABI,
              functionName: 'versionMetaHash', args: [BigInt(id), BigInt(idx)],
            }) as Promise<string>,
          ])
          return serializeVersion(v, idx, agentAddress, metaHash)
        })
      )

      res.setHeader('Cache-Control', 'public, max-age=30')
      res.json({
        data:      versions,
        total:     totalVersions.toString(),
        projectId: id.toString(),
        offset,
        limit,
        source:    'rpc',
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

      const { arweaveHash, versionTag, changelog, contentSize, versionMetadataArweaveHash } = body.data

      if (!cfg.serverWalletKey) throw new ServiceUnavailableError(
        'SERVER_WALLET_KEY not configured. Cannot sign transactions.'
      )

      const payerAddress  = getPayerAddress(req)
      const paymentAmount = getPaymentAmount(req)
      const { client: walletClient, address: walletAddress } =
        buildWalletClient(cfg, normalizePrivateKey(cfg.serverWalletKey))

      // Settle X402 USDC payment: transferWithAuthorization → Treasury.settle()
      if (cfg.treasuryAddress && paymentAmount) {
        const authData = getPaymentAuthorizationData(req)
        if (authData) {
          // 1. Execute EIP-3009 signed USDC transfer: payer → Treasury
          const usdcAddress = (process.env.USDC_ADDRESS ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as Address
          await walletClient.writeContract({
            address:      usdcAddress,
            abi:          USDC_ABI,
            functionName: 'transferWithAuthorization',
            args: [
              authData.from, authData.to,
              authData.value, authData.validAfter, authData.validBefore,
              authData.nonce, authData.v, authData.r, authData.s,
            ],
          })
        }
        // 2. Split settled USDC (Arweave cost + Buyback + Treasury)
        let arweaveCost = 0n
        if (contentSize && contentSize > 0) {
          try { arweaveCost = await getArweaveCostUsdc(contentSize) } catch { /* use 0 */ }
        }
        await walletClient.writeContract({
          address:      cfg.treasuryAddress,
          abi:          TREASURY_ABI,
          functionName: 'settle',
          args:         [paymentAmount, arweaveCost],
        })
      }

      // Use payer address (the agent who paid) as the on-chain agent address for attribution
      const agentAddress: Address = (payerAddress ?? '0x0000000000000000000000000000000000000000') as Address

      // Call pushVersionV2 (settler-only, fee-free — x402 already settled above)
      const hash = await walletClient.writeContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'pushVersionV2',
        args:         [BigInt(id), arweaveHash, versionTag, changelog, agentAddress, versionMetadataArweaveHash],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      res.status(201).json({
        txHash:      hash,
        projectId:   id.toString(),
        versionTag,
        arweaveHash,
        agentAddress,
        pusher:      walletAddress,
        status:      receipt.status,
        blockNumber: receipt.blockNumber.toString(),
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  if (indexer) {
    router.get('/health/indexer', (req, res) => {
      res.json({ data: indexer.health() })
    })
  }

  return router
}
