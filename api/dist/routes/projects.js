"use strict";
/**
 * Inkd API — /v1/projects routes
 *
 * GET  /v1/projects            List all projects (paginated)
 * GET  /v1/projects/:id        Get a single project by id
 * POST /v1/projects            Create a new project
 * GET  /v1/projects/:id/versions       List versions for a project
 * POST /v1/projects/:id/versions       Push a new version
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsRouter = projectsRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const config_js_1 = require("../config.js");
const clients_js_1 = require("../clients.js");
const x402_js_1 = require("../middleware/x402.js");
const abis_js_1 = require("../abis.js");
const errors_js_1 = require("../errors.js");
// ─── Zod schemas ──────────────────────────────────────────────────────────────
const CreateProjectBody = zod_1.z.object({
    name: zod_1.z.string().min(1).max(64),
    description: zod_1.z.string().max(256).default(''),
    license: zod_1.z.string().max(32).default('MIT'),
    isPublic: zod_1.z.boolean().default(true),
    readmeHash: zod_1.z.string().max(128).default(''),
    isAgent: zod_1.z.boolean().default(false),
    agentEndpoint: zod_1.z.string().url().or(zod_1.z.literal('')).default(''),
    // privateKey removed — server wallet signs, payer address comes from x402 payment
});
const PushVersionBody = zod_1.z.object({
    tag: zod_1.z.string().min(1).max(64),
    contentHash: zod_1.z.string().min(1).max(128),
    metadataHash: zod_1.z.string().max(128).default(''),
    // privateKey removed — server wallet signs, payer address comes from x402 payment
});
const PaginationQuery = zod_1.z.object({
    offset: zod_1.z.coerce.number().int().min(0).default(0),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
function serializeProject(p) {
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
    };
}
function serializeVersion(v) {
    return {
        versionId: v.versionId.toString(),
        projectId: v.projectId.toString(),
        tag: v.tag,
        contentHash: v.contentHash,
        metadataHash: v.metadataHash,
        pushedAt: v.pushedAt.toString(),
        pusher: v.pusher,
    };
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
    // ── GET /v1/projects ────────────────────────────────────────────────────────
    router.get('/', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const { offset, limit } = PaginationQuery.parse(req.query);
            const total = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'projectCount',
            });
            const results = [];
            // Fetch each project — sequential is fine for <100 items
            for (let i = offset + 1; i <= Math.min(Number(total), offset + limit); i++) {
                const p = await publicClient.readContract({
                    address: registryAddress,
                    abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'getProject',
                    args: [BigInt(i)],
                });
                if (p.exists)
                    results.push(serializeProject(p));
            }
            res.json({
                data: results,
                total: total.toString(),
                offset,
                limit,
            });
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
            const p = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProject',
                args: [BigInt(id)],
            });
            if (!p.exists)
                throw new errors_js_1.NotFoundError(`Project #${id}`);
            res.json({ data: serializeProject(p) });
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
            const { name, description, license, isPublic, readmeHash, isAgent, agentEndpoint, } = body.data;
            // Use server wallet to sign transactions (payer already paid via x402)
            if (!cfg.serverWalletKey)
                throw new errors_js_1.ServiceUnavailableError('SERVER_WALLET_KEY not configured. Cannot sign transactions.');
            const payerAddress = (0, x402_js_1.getPayerAddress)(req);
            const { client: walletClient, address: walletAddress } = (0, clients_js_1.buildWalletClient)(cfg, (0, clients_js_1.normalizePrivateKey)(cfg.serverWalletKey));
            const hash = await walletClient.writeContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'createProject',
                args: [name, description, license, isPublic, readmeHash, isAgent, agentEndpoint],
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
                owner: payerAddress ?? walletAddress, // payer = owner via x402
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
            // Verify project exists
            const p = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProject',
                args: [BigInt(id)],
            });
            if (!p.exists)
                throw new errors_js_1.NotFoundError(`Project #${id}`);
            const versions = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProjectVersions',
                args: [BigInt(id), BigInt(offset), BigInt(limit)],
            });
            res.json({
                data: versions.map(serializeVersion),
                total: p.versionCount.toString(),
                projectId: id.toString(),
                offset,
                limit,
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
            const { tag, contentHash, metadataHash } = body.data;
            if (!cfg.serverWalletKey)
                throw new errors_js_1.ServiceUnavailableError('SERVER_WALLET_KEY not configured. Cannot sign transactions.');
            const payerAddress = (0, x402_js_1.getPayerAddress)(req);
            const { client: walletClient, address: walletAddress } = (0, clients_js_1.buildWalletClient)(cfg, (0, clients_js_1.normalizePrivateKey)(cfg.serverWalletKey));
            const hash = await walletClient.writeContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'pushVersion',
                args: [BigInt(id), tag, contentHash, metadataHash],
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            res.status(201).json({
                txHash: hash,
                projectId: id.toString(),
                tag,
                contentHash,
                pusher: payerAddress ?? walletAddress,
                signer: walletAddress,
                status: receipt.status,
                blockNumber: receipt.blockNumber.toString(),
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    return router;
}
//# sourceMappingURL=projects.js.map