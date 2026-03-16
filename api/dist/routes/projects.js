"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsRouter = projectsRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const config_js_1 = require("../config.js");
const clients_js_1 = require("../clients.js");
const x402_js_1 = require("../middleware/x402.js");
const abis_js_1 = require("../abis.js");
const arweave_js_1 = require("../arweave.js");
const errors_js_1 = require("../errors.js");
// ─── Indexer disabled on Vercel (better-sqlite3 native module incompatible) ──
// For local use, install better-sqlite3 separately and use indexer/client.ts directly
function buildIndexerClientSafe(_dbPath) {
    // Disabled to prevent Vercel Turbo Build crash
    // The indexer feature requires a local SQLite database which isn't available on serverless
    return null;
}
const graph_js_1 = require("../graph.js");
// ─── Zod schemas ──────────────────────────────────────────────────────────────
const CreateProjectBody = zod_1.z.object({
    name: zod_1.z.string().min(1).max(64),
    description: zod_1.z.string().max(256).default(''),
    license: zod_1.z.string().max(32).default('MIT'),
    isPublic: zod_1.z.boolean().default(true),
    readmeHash: zod_1.z.string().max(128).default(''),
    isAgent: zod_1.z.boolean().default(false),
    agentEndpoint: zod_1.z.string().url().or(zod_1.z.literal('')).default(''),
    // V2 fields (optional)
    metadataUri: zod_1.z.string().max(256).default(''),
    forkOf: zod_1.z.number().int().min(0).default(0),
    accessManifestHash: zod_1.z.string().max(128).default(''),
    tagsHash: zod_1.z.string().regex(/^0x[0-9a-fA-F]{64}$/).or(zod_1.z.literal('')).default(''),
});
const PushVersionBody = zod_1.z.object({
    arweaveHash: zod_1.z.string().min(1).max(128),
    versionTag: zod_1.z.string().min(1).max(64),
    changelog: zod_1.z.string().max(512).default(''),
    contentSize: zod_1.z.number().int().min(0).optional(),
    // V2 fields (optional)
    versionMetadataArweaveHash: zod_1.z.string().max(128).default(''),
});
const PaginationQuery = zod_1.z.object({
    offset: zod_1.z.coerce.number().int().min(0).default(0),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    owner: zod_1.z.string().optional(),
    isAgent: zod_1.z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});
function serializeProject(p, v2) {
    return {
        id: p.id.toString(),
        name: p.name,
        description: p.description,
        license: p.license,
        readmeHash: p.readmeHash,
        owner: p.owner,
        isPublic: p.isPublic,
        isAgent: p.isAgent,
        agentEndpoint: p.agentEndpoint,
        createdAt: p.createdAt.toString(),
        versionCount: p.versionCount.toString(),
        // V2 fields (may be empty string/zero for V1-created projects)
        metadataUri: v2?.metadataUri ?? '',
        forkOf: v2?.forkOf?.toString() ?? '0',
        accessManifest: v2?.accessManifest ?? '',
    };
}
function serializeIndexedProject(p) {
    return {
        id: p.id.toString(),
        name: p.name,
        description: p.description,
        license: p.license,
        readmeHash: p.readme_hash,
        owner: p.owner,
        isPublic: !!p.is_public,
        isAgent: !!p.is_agent,
        agentEndpoint: p.agent_endpoint,
        createdAt: p.created_at.toString(),
        versionCount: p.version_count.toString(),
        metadataUri: p.metadata_uri ?? '',
        forkOf: p.fork_of?.toString() ?? '0',
        accessManifest: p.access_manifest ?? '',
    };
}
function serializeVersion(v, index, agentAddress, metaHash) {
    return {
        versionIndex: index.toString(),
        projectId: v.projectId.toString(),
        arweaveHash: v.arweaveHash,
        versionTag: v.versionTag,
        changelog: v.changelog,
        pushedBy: v.pushedBy,
        pushedAt: v.pushedAt.toString(),
        agentAddress: agentAddress ?? null,
        metaHash: metaHash ?? '',
    };
}
function serializeGraphProject(p) {
    return {
        id: p.id,
        name: p.name,
        description: p.description,
        license: '',
        readmeHash: p.arweaveHash,
        owner: p.owner?.id ?? '',
        isPublic: true,
        isAgent: p.isAgent,
        agentEndpoint: '',
        createdAt: p.createdAt,
        versionCount: p.versionCount,
        metadataUri: p.metadataUri ?? '',
        forkOf: p.forkOf?.id ?? '0',
        accessManifest: '',
    };
}
function serializeGraphVersion(v, projectId) {
    return {
        versionIndex: v.versionIndex,
        projectId: projectId.toString(),
        arweaveHash: v.arweaveHash,
        versionTag: v.versionTag,
        changelog: '',
        pushedBy: v.pushedBy.id,
        pushedAt: v.createdAt,
        agentAddress: v.agentAddress?.id ?? null,
        metaHash: '',
    };
}
function serializeIndexedVersion(v) {
    return {
        versionIndex: v.version_index.toString(),
        projectId: v.project_id.toString(),
        arweaveHash: v.arweave_hash,
        versionTag: v.version_tag,
        changelog: v.changelog,
        pushedBy: v.pushed_by,
        pushedAt: v.pushed_at.toString(),
        agentAddress: v.agent_address,
        metaHash: v.meta_hash ?? '',
    };
}
// ─── Nonce-retry helper ───────────────────────────────────────────────────────
/**
 * Execute a block of contract writes, retrying once with a fresh nonce on nonce-too-low errors.
 * Handles the Vercel serverless race where two instances read the same nonce simultaneously.
 */
async function withNonceRetry(getNonce, fn, maxRetries = 3) {
    let attempt = 0;
    while (true) {
        const nonce = await getNonce();
        try {
            return await fn(nonce);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const isNonceTooLow = msg.includes('nonce too low') || msg.includes('Nonce provided') || msg.includes('nonce') && msg.includes('lower than');
            if (isNonceTooLow && attempt < maxRetries) {
                attempt++;
                // Small delay before retry to let the competing TX land
                await new Promise(r => setTimeout(r, 200 * attempt));
                continue;
            }
            throw err;
        }
    }
}
// ─── Router factory ───────────────────────────────────────────────────────────
function projectsRouter(cfg) {
    const router = (0, express_1.Router)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    function requireRegistry() {
        if (!addrs.registry)
            throw new errors_js_1.ServiceUnavailableError('Registry contract not deployed yet. Set INKD_REGISTRY_ADDRESS env var.');
        return addrs.registry;
    }
    const publicClient = (0, clients_js_1.buildPublicClient)(cfg);
    // IndexerClient is disabled on Vercel (better-sqlite3 native module crash)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const indexer = null;
    // ── GET /v1/projects ────────────────────────────────────────────────────────
    router.get('/', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const { offset, limit, owner, isAgent } = PaginationQuery.parse(req.query);
            // 1. Graph-first (mandatory when owner filter is used — RPC doesn't support efficient owner queries)
            const graph = (0, graph_js_1.getGraphClient)();
            if (graph) {
                try {
                    const rows = await graph.getProjects({ offset, limit, isAgent, owner });
                    const total = await graph.getProjectCount().catch(() => rows.length);
                    res.setHeader('Cache-Control', 'public, max-age=10');
                    return res.json({ data: rows.map(serializeGraphProject), total: total.toString(), offset, limit, source: 'graph' });
                }
                catch (graphErr) {
                    const errMsg = graphErr instanceof Error ? graphErr.message : String(graphErr);
                    console.error('[graph] getProjects failed:', errMsg);
                    // If owner filter was requested and graph failed, return error — don't do inefficient RPC scan
                    if (owner) {
                        res.status(503).json({ error: { code: 'GRAPH_ERROR', message: `Graph query failed: ${errMsg}` } });
                        return;
                    }
                    /* fall through to RPC for unfiltered queries */
                }
            }
            else if (owner) {
                // No graph client — owner filter not supported without graph
                res.status(503).json({ error: { code: 'GRAPH_UNAVAILABLE', message: 'Owner filter requires Graph indexer' } });
                return;
            }
            // 2. Indexer fallback
            if (indexer) {
                const totalIndexed = indexer.countProjects();
                let rows = indexer.listProjects(offset, limit).map(serializeIndexedProject);
                if (owner)
                    rows = rows.filter((p) => p.owner.toLowerCase() === owner.toLowerCase());
                if (isAgent !== undefined)
                    rows = rows.filter((p) => p.isAgent === isAgent);
                res.setHeader('Cache-Control', 'public, max-age=10');
                return res.json({ data: rows, total: totalIndexed.toString(), offset, limit, source: 'indexer' });
            }
            // 3. RPC fallback
            const total = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'projectCount',
            });
            const results = [];
            for (let i = offset + 1; i <= Math.min(Number(total), offset + limit); i++) {
                const p = await publicClient.readContract({
                    address: registryAddress,
                    abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'getProject',
                    args: [BigInt(i)],
                });
                if (!p.exists)
                    continue;
                if (owner && p.owner.toLowerCase() !== owner.toLowerCase())
                    continue;
                if (isAgent !== undefined && p.isAgent !== isAgent)
                    continue;
                results.push(serializeProject(p));
            }
            res.setHeader('Cache-Control', 'public, max-age=10');
            res.json({ data: results, total: total.toString(), offset, limit, source: 'rpc' });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── GET /v1/projects/estimate?bytes=N ──────────────────────────────────────
    router.get('/estimate', async (req, res) => {
        try {
            const bytes = parseInt(req.query['bytes'] ?? '0', 10);
            if (!bytes || bytes <= 0)
                throw new errors_js_1.BadRequestError('bytes must be a positive integer');
            if (bytes > 500 * 1024 * 1024)
                throw new errors_js_1.BadRequestError('Max 500MB per upload');
            const arweaveCost = await (0, arweave_js_1.getArweaveCostUsdc)(bytes);
            const { markup, total } = (0, arweave_js_1.calculateCharge)(arweaveCost);
            res.json({
                bytes,
                arweaveCost: arweaveCost.toString(),
                markup: markup.toString(),
                total: total.toString(),
                markupPct: '20%',
                arweaveCostUsd: `$${(Number(arweaveCost) / 1e6).toFixed(4)}`,
                totalUsd: `$${(Number(total) / 1e6).toFixed(4)}`,
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── GET /v1/projects/by-name/:name ─────────────────────────────────────────
    router.get('/by-name/:name', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const name = req.params['name'] ?? '';
            if (!name)
                throw new errors_js_1.BadRequestError('name is required');
            // 1. Graph-first
            const graph = (0, graph_js_1.getGraphClient)();
            if (graph) {
                try {
                    const p = await graph.getProjectByName(name);
                    if (p) {
                        res.setHeader('Cache-Control', 'public, max-age=30');
                        return res.json({ data: serializeGraphProject(p), source: 'graph' });
                    }
                }
                catch { /* fall through */ }
            }
            // 2. Indexer fallback
            if (indexer) {
                const total = indexer.countProjects();
                for (let i = 1; i <= total; i++) {
                    const row = indexer.getProject(i);
                    if (row && row.name === name) {
                        res.setHeader('Cache-Control', 'public, max-age=30');
                        return res.json({ data: serializeIndexedProject(row), source: 'indexer' });
                    }
                }
                throw new errors_js_1.NotFoundError(`Project "${name}"`);
            }
            // 3. RPC fallback — linear scan
            const total = await publicClient.readContract({
                address: registryAddress, abi: abis_js_1.REGISTRY_ABI, functionName: 'projectCount',
            });
            for (let i = 1; i <= Number(total); i++) {
                const p = await publicClient.readContract({
                    address: registryAddress, abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'getProject', args: [BigInt(i)],
                });
                if (p.exists && p.name === name) {
                    res.setHeader('Cache-Control', 'public, max-age=30');
                    return res.json({ data: serializeProject(p), source: 'rpc' });
                }
            }
            throw new errors_js_1.NotFoundError(`Project "${name}"`);
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── GET /v1/projects/:id ────────────────────────────────────────────────────
    router.get('/:id', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const id = parseInt(req.params['id'] ?? '', 10);
            if (isNaN(id) || id < 1)
                throw new errors_js_1.BadRequestError('Project id must be a positive integer');
            // 1. Graph-first
            const graph = (0, graph_js_1.getGraphClient)();
            if (graph) {
                try {
                    const p = await graph.getProject(id);
                    if (p) {
                        res.setHeader('Cache-Control', 'public, max-age=30');
                        return res.json({ data: serializeGraphProject(p), source: 'graph' });
                    }
                }
                catch { /* fall through */ }
            }
            // 2. Indexer fallback
            if (indexer) {
                const row = indexer.getProject(id);
                if (!row)
                    throw new errors_js_1.NotFoundError(`Project #${id}`);
                res.setHeader('Cache-Control', 'public, max-age=30');
                return res.json({ data: serializeIndexedProject(row), source: 'indexer' });
            }
            // 3. RPC fallback
            const p = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProject',
                args: [BigInt(id)],
            });
            if (!p.exists)
                throw new errors_js_1.NotFoundError(`Project #${id}`);
            const [metadataUri, forkOf, accessManifest] = await Promise.all([
                publicClient.readContract({
                    address: registryAddress, abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'projectMetadataUri', args: [BigInt(id)],
                }),
                publicClient.readContract({
                    address: registryAddress, abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'projectForkOf', args: [BigInt(id)],
                }),
                publicClient.readContract({
                    address: registryAddress, abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'projectAccessManifest', args: [BigInt(id)],
                }),
            ]);
            res.setHeader('Cache-Control', 'public, max-age=30');
            res.json({ data: serializeProject(p, { metadataUri, forkOf, accessManifest }), source: 'rpc' });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── POST /v1/projects ───────────────────────────────────────────────────────
    router.post('/', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const body = CreateProjectBody.safeParse(req.body);
            if (!body.success)
                throw new errors_js_1.BadRequestError(body.error.issues.map(i => i.message).join('; '));
            const { name, description, license, isPublic, readmeHash, isAgent, agentEndpoint, metadataUri, forkOf, accessManifestHash, tagsHash, } = body.data;
            if (!cfg.serverWalletKey)
                throw new errors_js_1.ServiceUnavailableError('SERVER_WALLET_KEY not configured. Cannot sign transactions.');
            const payerAddress = (0, x402_js_1.getPayerAddress)(req);
            const paymentAmount = (0, x402_js_1.getPaymentAmount)(req);
            const { client: walletClient, address: walletAddress } = (0, clients_js_1.buildWalletClient)(cfg, (0, clients_js_1.normalizePrivateKey)(cfg.serverWalletKey));
            // Settle X402 USDC payment: transferWithAuthorization → Treasury.settle()
            const publicClient = (0, clients_js_1.buildPublicClient)(cfg);
            // Encode tagsHash upfront
            const tagsHashBytes = (tagsHash && tagsHash.startsWith('0x'))
                ? tagsHash
                : `0x${'00'.repeat(32)}`;
            const { hash } = await withNonceRetry(() => publicClient.getTransactionCount({ address: walletAddress, blockTag: 'pending' }), async (startNonce) => {
                let nonce = startNonce;
                if (cfg.treasuryAddress && paymentAmount) {
                    const authData = (0, x402_js_1.getPaymentAuthorizationData)(req);
                    if (authData) {
                        // 1. Execute EIP-3009 signed USDC transfer: payer → Treasury
                        const usdcAddress = (process.env.USDC_ADDRESS ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
                        await walletClient.writeContract({
                            address: usdcAddress,
                            abi: abis_js_1.USDC_ABI,
                            functionName: 'transferWithAuthorization',
                            args: [
                                authData.from, authData.to,
                                authData.value, authData.validAfter, authData.validBefore,
                                authData.nonce, authData.v, authData.r, authData.s,
                            ],
                            nonce: nonce++,
                        });
                    }
                    // 2. Split settled USDC (Buyback + Treasury)
                    await walletClient.writeContract({
                        address: cfg.treasuryAddress,
                        abi: abis_js_1.TREASURY_ABI,
                        functionName: 'settle',
                        args: [paymentAmount, 0n],
                        nonce: nonce++,
                    });
                }
                // Call createProjectV2 (settler-only, fee-free — x402 already settled above)
                const txHash = await walletClient.writeContract({
                    address: registryAddress,
                    abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'createProjectV2',
                    args: [
                        (payerAddress ?? walletAddress),
                        name, description, license, isPublic, readmeHash,
                        isAgent, agentEndpoint,
                        metadataUri, BigInt(forkOf), accessManifestHash, tagsHashBytes,
                    ],
                    nonce: nonce++,
                });
                return { hash: txHash };
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            const total = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'projectCount',
            });
            res.status(201).json({
                txHash: hash,
                projectId: total.toString(),
                owner: payerAddress ?? walletAddress,
                signer: walletAddress,
                status: receipt.status,
                blockNumber: receipt.blockNumber.toString(),
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── GET /v1/projects/:id/versions ───────────────────────────────────────────
    router.get('/:id/versions', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const id = parseInt(req.params['id'] ?? '', 10);
            if (isNaN(id) || id < 1)
                throw new errors_js_1.BadRequestError('Project id must be a positive integer');
            const { offset, limit } = PaginationQuery.parse(req.query);
            // 1. Graph-first
            const graph = (0, graph_js_1.getGraphClient)();
            if (graph) {
                try {
                    const versions = await graph.getProjectVersions(id, limit);
                    const sliced = versions.slice(offset, offset + limit);
                    res.setHeader('Cache-Control', 'public, max-age=30');
                    return res.json({
                        data: sliced.map(v => serializeGraphVersion(v, id)),
                        total: versions.length.toString(),
                        projectId: id.toString(),
                        offset,
                        limit,
                        source: 'graph',
                    });
                }
                catch { /* fall through */ }
            }
            // 2. Indexer fallback
            if (indexer) {
                const projectRow = indexer.getProject(id);
                if (!projectRow)
                    throw new errors_js_1.NotFoundError(`Project #${id}`);
                const totalIndexed = indexer.countVersions(id);
                const versions = indexer.listVersions(id, offset, limit).map(serializeIndexedVersion);
                res.setHeader('Cache-Control', 'public, max-age=30');
                return res.json({
                    data: versions,
                    total: totalIndexed.toString(),
                    projectId: id.toString(),
                    offset,
                    limit,
                    source: 'indexer',
                });
            }
            // 3. RPC fallback
            const p = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProject',
                args: [BigInt(id)],
            });
            if (!p.exists)
                throw new errors_js_1.NotFoundError(`Project #${id}`);
            const totalVersions = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getVersionCount',
                args: [BigInt(id)],
            });
            const count = Number(totalVersions);
            const start = Math.min(offset, count);
            const end = Math.min(start + limit, count);
            const versions = await Promise.all(Array.from({ length: end - start }, async (_, i) => {
                const idx = start + i;
                const [v, agentAddress, metaHash] = await Promise.all([
                    publicClient.readContract({
                        address: registryAddress, abi: abis_js_1.REGISTRY_ABI,
                        functionName: 'getVersion', args: [BigInt(id), BigInt(idx)],
                    }),
                    publicClient.readContract({
                        address: registryAddress, abi: abis_js_1.REGISTRY_ABI,
                        functionName: 'getVersionAgent', args: [BigInt(id), BigInt(idx)],
                    }),
                    publicClient.readContract({
                        address: registryAddress, abi: abis_js_1.REGISTRY_ABI,
                        functionName: 'versionMetaHash', args: [BigInt(id), BigInt(idx)],
                    }),
                ]);
                return serializeVersion(v, idx, agentAddress, metaHash);
            }));
            res.setHeader('Cache-Control', 'public, max-age=30');
            res.json({
                data: versions,
                total: totalVersions.toString(),
                projectId: id.toString(),
                offset,
                limit,
                source: 'rpc',
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── POST /v1/projects/:id/versions ──────────────────────────────────────────
    router.post('/:id/versions', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const id = parseInt(req.params['id'] ?? '', 10);
            if (isNaN(id) || id < 1)
                throw new errors_js_1.BadRequestError('Project id must be a positive integer');
            const body = PushVersionBody.safeParse(req.body);
            if (!body.success)
                throw new errors_js_1.BadRequestError(body.error.issues.map(i => i.message).join('; '));
            const { arweaveHash, versionTag, changelog, contentSize, versionMetadataArweaveHash } = body.data;
            if (!cfg.serverWalletKey)
                throw new errors_js_1.ServiceUnavailableError('SERVER_WALLET_KEY not configured. Cannot sign transactions.');
            const payerAddress = (0, x402_js_1.getPayerAddress)(req);
            const paymentAmount = (0, x402_js_1.getPaymentAmount)(req);
            const { client: walletClient, address: walletAddress } = (0, clients_js_1.buildWalletClient)(cfg, (0, clients_js_1.normalizePrivateKey)(cfg.serverWalletKey));
            // Use payer address (the agent who paid) as the on-chain agent address for attribution
            const agentAddress = (payerAddress ?? '0x0000000000000000000000000000000000000000');
            const { hash } = await withNonceRetry(() => publicClient.getTransactionCount({ address: walletAddress, blockTag: 'pending' }), async (startNonce) => {
                let versionNonce = startNonce;
                if (cfg.treasuryAddress && paymentAmount) {
                    const authData = (0, x402_js_1.getPaymentAuthorizationData)(req);
                    if (authData) {
                        // 1. Execute EIP-3009 signed USDC transfer: payer → Treasury
                        const usdcAddress = (process.env.USDC_ADDRESS ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
                        await walletClient.writeContract({
                            address: usdcAddress,
                            abi: abis_js_1.USDC_ABI,
                            functionName: 'transferWithAuthorization',
                            args: [
                                authData.from, authData.to,
                                authData.value, authData.validAfter, authData.validBefore,
                                authData.nonce, authData.v, authData.r, authData.s,
                            ],
                            nonce: versionNonce++,
                        });
                    }
                    // 2. Split settled USDC (Arweave cost + Buyback + Treasury)
                    let arweaveCost = 0n;
                    if (contentSize && contentSize > 0) {
                        try {
                            arweaveCost = await (0, arweave_js_1.getArweaveCostUsdc)(contentSize);
                        }
                        catch { /* use 0 */ }
                    }
                    await walletClient.writeContract({
                        address: cfg.treasuryAddress,
                        abi: abis_js_1.TREASURY_ABI,
                        functionName: 'settle',
                        args: [paymentAmount, arweaveCost],
                        nonce: versionNonce++,
                    });
                }
                // Call pushVersionV2 (settler-only, fee-free — x402 already settled above)
                const txHash = await walletClient.writeContract({
                    address: registryAddress,
                    abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'pushVersionV2',
                    args: [BigInt(id), arweaveHash, versionTag, changelog, agentAddress, versionMetadataArweaveHash],
                    nonce: versionNonce++,
                });
                return { hash: txHash };
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            res.status(201).json({
                txHash: hash,
                projectId: id.toString(),
                versionTag,
                arweaveHash,
                agentAddress,
                pusher: walletAddress,
                status: receipt.status,
                blockNumber: receipt.blockNumber.toString(),
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    if (indexer) {
        router.get('/health/indexer', (req, res) => {
            res.json({ data: indexer.health() });
        });
    }
    return router;
}
//# sourceMappingURL=projects.js.map