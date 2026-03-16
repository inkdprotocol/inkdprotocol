/**
 * Inkd API — /v1/upload
 *
 * POST /v1/upload
 *   Upload content to Arweave via Irys. Returns ar:// hash.
 *   Free endpoint — cost is covered by the $2 USDC paid in pushVersion.
 *
 * Supports:
 *   - multipart/form-data   { file: <binary>, contentType?: string }
 *   - application/json      { data: "<base64>", contentType: string, filename?: string }
 *   - application/octet-stream  (raw bytes in body)
 *
 * Response: { hash: "ar://TxId", txId: "TxId", bytes: N, url: "https://arweave.net/TxId" }
 */

import { Router }    from 'express'
import type { ApiConfig } from '../config.js'
import { sendError, BadRequestError, ServiceUnavailableError } from '../errors.js'
import { getArweaveCostUsdc } from '../arweave.js'

// ─── Irys upload helper ───────────────────────────────────────────────────────

const IRYS_NODE    = 'https://node2.irys.xyz'
const ARWEAVE_GW   = 'https://arweave.net'
const MAX_BYTES    = 50 * 1024 * 1024  // 50 MB

async function uploadToIrys(
  data:        Buffer,
  contentType: string,
  serverKey:   string,
  tags?:       Record<string, string>,
): Promise<{ txId: string; url: string }> {
  // @ts-ignore — @irys/sdk types vary by version
  const { default: Irys } = await import('@irys/sdk')
  const irys = new Irys({ url: IRYS_NODE, token: 'ethereum', key: serverKey })
  await irys.ready()

  const tagList = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name',     value: 'inkd-protocol' },
    ...(tags ? Object.entries(tags).map(([n, v]) => ({ name: n, value: v })) : []),
  ]

  const receipt = await irys.upload(data, { tags: tagList })
  return {
    txId: receipt.id,
    url:  `${ARWEAVE_GW}/${receipt.id}`,
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function buildUploadRouter(cfg: ApiConfig): Router {
  const router = Router()

  /**
   * POST /v1/upload
   * Upload content to Arweave via Irys.
   */
  router.post('/', async (req, res) => {
    try {
      if (!cfg.serverWalletKey) {
        throw new ServiceUnavailableError('Server wallet not configured — uploads unavailable.')
      }

      let data:        Buffer
      let contentType: string
      const extraTags: Record<string, string> = {}

      const ct = req.headers['content-type'] ?? ''

      if (ct.includes('application/json')) {
        // JSON mode: { data: "<base64>", contentType: string, filename?: string }
        const { data: b64, contentType: ct2, filename } = req.body as {
          data: string; contentType: string; filename?: string
        }
        if (!b64 || !ct2) throw new BadRequestError('body must have: data (base64), contentType')
        data        = Buffer.from(b64, 'base64')
        contentType = ct2
        if (filename) extraTags['File-Name'] = filename

      } else if (ct.includes('multipart/form-data')) {
        // Multipart not natively supported without multer — return helpful error
        throw new BadRequestError(
          'multipart/form-data not supported. Use application/json: ' +
          '{ data: base64, contentType: "..." }'
        )

      } else {
        // Raw binary body
        contentType = ct.split(';')[0]?.trim() || 'application/octet-stream'
        data = req.body instanceof Buffer ? req.body
          : Buffer.isBuffer(req.body)     ? req.body
          : Buffer.from(req.body as string | Uint8Array)
      }

      if (!data || data.length === 0) throw new BadRequestError('Empty upload')
      if (data.length > MAX_BYTES) throw new BadRequestError(`Max upload size is ${MAX_BYTES / 1024 / 1024}MB`)

      // Estimate cost for informational purposes
      let costUsdc = '0'
      try {
        const cost = await getArweaveCostUsdc(data.length)
        costUsdc   = cost.toString()
      } catch { /* non-fatal */ }

      const { txId, url } = await uploadToIrys(
        data,
        contentType,
        cfg.serverWalletKey,
        extraTags,
      )

      // IPFS dual-storage (optional, requires IPFS_GATEWAY_URL + IPFS_TOKEN env vars)
      let ipfsHash: string | undefined
      const ipfsGateway = process.env['IPFS_GATEWAY_URL']
      const ipfsToken   = process.env['IPFS_TOKEN']
      if (ipfsGateway && ipfsToken) {
        try {
          const ipfsRes = await fetch('https://api.web3.storage/upload', {
            method:  'POST',
            headers: {
              Authorization:  `Bearer ${ipfsToken}`,
              'Content-Type': contentType,
            },
            body: new Uint8Array(data),
            signal: AbortSignal.timeout(30000),
          })
          if (ipfsRes.ok) {
            const ipfsJson = await ipfsRes.json() as { cid?: string }
            if (ipfsJson.cid) ipfsHash = `ipfs://${ipfsJson.cid}`
          } else {
            console.warn('[upload] IPFS pin failed:', ipfsRes.status, await ipfsRes.text().catch(() => ''))
          }
        } catch (ipfsErr) {
          console.warn('[upload] IPFS pin error:', ipfsErr instanceof Error ? ipfsErr.message : String(ipfsErr))
        }
      }

      res.status(201).json({
        hash:  `ar://${txId}`,
        txId,
        url,
        bytes: data.length,
        ...(ipfsHash ? { ipfsHash } : {}),
        cost:  {
          usdc: costUsdc,
          usd:  `$${(Number(costUsdc) / 1e6).toFixed(4)}`,
        },
      })

    } catch (err) {
      sendError(res, err)
    }
  })

  /**
   * GET /v1/upload/price?bytes=N
   * Estimate Arweave upload cost in USDC for a given number of bytes.
   */
  router.get('/price', async (req, res) => {
    try {
      const bytes = parseInt(req.query['bytes'] as string ?? '0', 10)
      if (!bytes || bytes <= 0) throw new BadRequestError('bytes must be a positive integer')
      if (bytes > MAX_BYTES)   throw new BadRequestError(`Max ${MAX_BYTES / 1024 / 1024}MB`)

      const costUsdc = await getArweaveCostUsdc(bytes)
      res.json({
        bytes,
        costUsdc:  costUsdc.toString(),
        costUsd:   `$${(Number(costUsdc) / 1e6).toFixed(4)}`,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  return router
}
