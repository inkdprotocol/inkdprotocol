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
import { getPayerAddress, getPaymentAmount, PRICE_CREATE_PROJECT, PRICE_PUSH_VERSION_MIN } from '../middleware/x402.js'
import { decodePaymentSignatureHeader } from '@x402/core/http'
import { REGISTRY_ABI, TREASURY_ABI, USDC_ABI } from '../abis.js'
import { getArweaveCostUsdc, calculateCharge } from '../arweave.js'
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
  contentSize:  z.number().int().min(0).optional(), // bytes — used for dynamic Arweave pricing
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

  // ─── USDC transferWithAuthorization helper ─────────────────────────────────
  // Executes the EIP-3009 signed transfer from the X-PAYMENT header.
  // Must be called BEFORE Treasury.settle() so the USDC is in Treasury first.
  /**
   * Executes the EIP-3009 USDC transfer from X-PAYMENT header.
   * Returns the next nonce to use for subsequent txns (avoids stale-nonce RPC issues).
   */
  async function executeUsdcTransfer(
    req:               import('express').Request,
    walletClientWrap:  ReturnType<typeof buildWalletClient>['client'],
    publicClientInst:  ReturnType<typeof buildPublicClient>,
    usdcAddress:       Address,
    serverAddress:     Address,
  ): Promise<number | undefined> {
    const header = req.header('x-payment') ?? req.header('payment-signature')
    if (!header) return undefined
    const paymentPayload = decodePaymentSignatureHeader(header)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth = (paymentPayload?.payload as any)?.authorization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig  = (paymentPayload?.payload as any)?.signature
    if (!auth || !sig) throw new Error('x402: missing EIP-3009 authorization or signature in X-PAYMENT header')

    // Get current nonce ONCE — track manually to avoid stale RPC responses
    const nonce = await publicClientInst.getTransactionCount({ address: serverAddress, blockTag: 'pending' })

    const hash = await walletClientWrap.writeContract({
      address:      usdcAddress,
      abi:          USDC_ABI,
      functionName: 'transferWithAuthorization',
      nonce,
      args: [
        auth.from        as Address,
        auth.to          as Address,
        BigInt(auth.value),
        BigInt(auth.validAfter),
        BigInt(auth.validBefore),
        auth.nonce       as `0x${string}`,
        sig              as `0x${string}`,
      ],
    })

    // Wait for confirmation — USDC must be in Treasury before settle() is called
    await publicClientInst.waitForTransactionReceipt({ hash, pollingInterval: 500 })

    // Return next nonce (confirmed, safe to use immediately)
    return nonce + 1
  }

  // ── GET /v1/projects/estimate?bytes=N ──────────────────────────────────────
  // NOTE: must be registered BEFORE /:id to avoid Express matching 'estimate' as an id param.
  // Returns the USDC charge (arweave cost + 20% markup) for a given content size.
  // Agents call this BEFORE uploading to know how much to approve for X402.
  router.get('/estimate', async (req, res) => {
    try {
      const bytes = parseInt(req.query['bytes'] as string ?? '0', 10)
      if (!bytes || bytes <= 0) throw new BadRequestError('bytes must be a positive integer')
      if (bytes > 500 * 1024 * 1024) throw new BadRequestError('Max 500MB per upload')

      const arweaveCost = await getArweaveCostUsdc(bytes)
      const { markup, total } = calculateCharge(arweaveCost)

      res.json({
        bytes,
        arweaveCost: arweaveCost.toString(),
        markup:      markup.toString(),
        total:       total.toString(),
        markupPct:   '20%',
        // Human readable
        arweaveCostUsd: `$${(Number(arweaveCost) / 1e6).toFixed(4)}`,
        totalUsd:       `$${(Number(total)       / 1e6).toFixed(4)}`,
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

      const payerAddress   = getPayerAddress(req)
      const paymentAmount  = getPaymentAmount(req)
      const { client: walletClient, address: walletAddress } =
        buildWalletClient(cfg, normalizePrivateKey(cfg.serverWalletKey))

      // Step 1: Execute EIP-3009 USDC transfer → moves funds into Treasury (wait for confirm)
      let nextNonce: number | undefined
      if (cfg.usdcAddress && cfg.treasuryAddress) {
        nextNonce = await executeUsdcTransfer(req, walletClient, publicClient, cfg.usdcAddress, walletAddress)
      }

      // Step 2: Settle X402 USDC payment → splits revenue (arweaveCost = 0 for createProject)
      const settleAmountCreate = paymentAmount ?? PRICE_CREATE_PROJECT
      if (cfg.treasuryAddress) {
        const settleHash = await walletClient.writeContract({
          address:      cfg.treasuryAddress,
          abi:          TREASURY_ABI,
          functionName: 'settle',
          nonce:        nextNonce,
          args:         [settleAmountCreate, 0n],
        })
        // Wait for settle to confirm before using next nonce — prevents "replacement tx underpriced"
        await publicClient.waitForTransactionReceipt({ hash: settleHash, pollingInterval: 500 })
        if (nextNonce !== undefined) nextNonce++
      }

      const hash = await walletClient.writeContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'createProject',
        nonce:        nextNonce,
        args:         [name, description, license, isPublic, readmeHash, isAgent, agentEndpoint],
      })

      // Base Mainnet: ~2s block time — poll every 500ms to minimise latency on Vercel
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 })

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

      const { tag, contentHash, metadataHash, contentSize } = body.data

      if (!cfg.serverWalletKey) throw new ServiceUnavailableError(
        'SERVER_WALLET_KEY not configured. Cannot sign transactions.'
      )

      const payerAddress  = getPayerAddress(req)
      const paymentAmount = getPaymentAmount(req)
      const { client: walletClient, address: walletAddress } =
        buildWalletClient(cfg, normalizePrivateKey(cfg.serverWalletKey))

      // Step 1: Execute EIP-3009 USDC transfer → moves funds into Treasury (wait for confirm)
      let nextNonceV: number | undefined
      if (cfg.usdcAddress && cfg.treasuryAddress) {
        nextNonceV = await executeUsdcTransfer(req, walletClient, publicClient, cfg.usdcAddress, walletAddress)
      }

      // Step 2: Settle X402 USDC payment → Treasury splits: arweaveCost + 20% markup
      // Dynamic: use what the agent actually paid (from x402), floor at $0.10
      const settleAmountVersion = paymentAmount ?? PRICE_PUSH_VERSION_MIN
      if (cfg.treasuryAddress) {
        // Calculate arweave cost portion from content size (best-effort)
        let arweaveCost = 0n
        if (contentSize && contentSize > 0) {
          try {
            arweaveCost = await getArweaveCostUsdc(contentSize)
          } catch { /* use 0 if price fetch fails */ }
        }
        const settleHashV = await walletClient.writeContract({
          address:      cfg.treasuryAddress,
          abi:          TREASURY_ABI,
          functionName: 'settle',
          nonce:        nextNonceV,
          args:         [settleAmountVersion, arweaveCost],
        })
        // Wait for settle to confirm before using next nonce — prevents "replacement tx underpriced"
        await publicClient.waitForTransactionReceipt({ hash: settleHashV, pollingInterval: 500 })
        if (nextNonceV !== undefined) nextNonceV++
      }

      const hash = await walletClient.writeContract({
        address:      registryAddress,
        abi:          REGISTRY_ABI,
        functionName: 'pushVersion',
        nonce:        nextNonceV,
        args:         [BigInt(id), tag, contentHash, metadataHash],
      })

      // Base Mainnet: ~2s block time — poll every 500ms to minimise latency on Vercel
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 })

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
