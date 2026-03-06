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
const http_1 = require("@x402/core/http");
const abis_js_1 = require("../abis.js");
const arweave_js_1 = require("../arweave.js");
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
    contentSize: zod_1.z.number().int().min(0).optional(), // bytes — used for dynamic Arweave pricing
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
    // ─── USDC transferWithAuthorization helper ─────────────────────────────────
    // Executes the EIP-3009 signed transfer from the X-PAYMENT header.
    // Must be called BEFORE Treasury.settle() so the USDC is in Treasury first.
    async function executeUsdcTransfer(req, walletClientWrap, publicClientInst, usdcAddress) {
        const header = req.header('x-payment') ?? req.header('payment-signature');
        if (!header)
            return;
        const paymentPayload = (0, http_1.decodePaymentSignatureHeader)(header);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const auth = paymentPayload?.payload?.authorization;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sig = paymentPayload?.payload?.signature;
        if (!auth || !sig)
            throw new Error('x402: missing EIP-3009 authorization or signature in X-PAYMENT header');
        const hash = await walletClientWrap.writeContract({
            address: usdcAddress,
            abi: abis_js_1.USDC_ABI,
            functionName: 'transferWithAuthorization',
            args: [
                auth.from,
                auth.to,
                BigInt(auth.value),
                BigInt(auth.validAfter),
                BigInt(auth.validBefore),
                auth.nonce,
                sig,
            ],
        });
        // Wait for confirmation — USDC must be in Treasury before settle() is called
        await publicClientInst.waitForTransactionReceipt({ hash, pollingInterval: 500 });
    }
    // ── GET /v1/projects/estimate?bytes=N ──────────────────────────────────────
    // NOTE: must be registered BEFORE /:id to avoid Express matching 'estimate' as an id param.
    // Returns the USDC charge (arweave cost + 20% markup) for a given content size.
    // Agents call this BEFORE uploading to know how much to approve for X402.
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
                // Human readable
                arweaveCostUsd: `$${(Number(arweaveCost) / 1e6).toFixed(4)}`,
                totalUsd: `$${(Number(total) / 1e6).toFixed(4)}`,
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
            const paymentAmount = (0, x402_js_1.getPaymentAmount)(req);
            const { client: walletClient, address: walletAddress } = (0, clients_js_1.buildWalletClient)(cfg, (0, clients_js_1.normalizePrivateKey)(cfg.serverWalletKey));
            // Step 1: Execute EIP-3009 USDC transfer → moves funds into Treasury (wait for confirm)
            if (cfg.usdcAddress && cfg.treasuryAddress) {
                await executeUsdcTransfer(req, walletClient, publicClient, cfg.usdcAddress);
            }
            // Step 2: Settle X402 USDC payment → splits revenue (arweaveCost = 0 for createProject)
            const settleAmountCreate = paymentAmount ?? x402_js_1.PRICE_CREATE_PROJECT;
            if (cfg.treasuryAddress) {
                await walletClient.writeContract({
                    address: cfg.treasuryAddress,
                    abi: abis_js_1.TREASURY_ABI,
                    functionName: 'settle',
                    args: [settleAmountCreate, 0n],
                });
            }
            const hash = await walletClient.writeContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'createProject',
                args: [name, description, license, isPublic, readmeHash, isAgent, agentEndpoint],
            });
            // Base Mainnet: ~2s block time — poll every 500ms to minimise latency on Vercel
            const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 });
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
            const { tag, contentHash, metadataHash, contentSize } = body.data;
            if (!cfg.serverWalletKey)
                throw new errors_js_1.ServiceUnavailableError('SERVER_WALLET_KEY not configured. Cannot sign transactions.');
            const payerAddress = (0, x402_js_1.getPayerAddress)(req);
            const paymentAmount = (0, x402_js_1.getPaymentAmount)(req);
            const { client: walletClient, address: walletAddress } = (0, clients_js_1.buildWalletClient)(cfg, (0, clients_js_1.normalizePrivateKey)(cfg.serverWalletKey));
            // Step 1: Execute EIP-3009 USDC transfer → moves funds into Treasury (wait for confirm)
            if (cfg.usdcAddress && cfg.treasuryAddress) {
                await executeUsdcTransfer(req, walletClient, publicClient, cfg.usdcAddress);
            }
            // Step 2: Settle X402 USDC payment → Treasury splits: arweaveCost + 20% markup
            const settleAmountVersion = paymentAmount ?? x402_js_1.PRICE_PUSH_VERSION;
            if (cfg.treasuryAddress) {
                // Calculate arweave cost portion from content size (best-effort)
                let arweaveCost = 0n;
                if (contentSize && contentSize > 0) {
                    try {
                        arweaveCost = await (0, arweave_js_1.getArweaveCostUsdc)(contentSize);
                    }
                    catch { /* use 0 if price fetch fails */ }
                }
                await walletClient.writeContract({
                    address: cfg.treasuryAddress,
                    abi: abis_js_1.TREASURY_ABI,
                    functionName: 'settle',
                    args: [settleAmountVersion, arweaveCost],
                });
            }
            const hash = await walletClient.writeContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'pushVersion',
                args: [BigInt(id), tag, contentHash, metadataHash],
            });
            // Base Mainnet: ~2s block time — poll every 500ms to minimise latency on Vercel
            const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 });
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