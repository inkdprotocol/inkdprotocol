"use strict";
/**
 * Inkd API — /v1/agents routes
 *
 * Agent-specific endpoints for AI agent discovery and interaction.
 *
 * GET  /v1/agents               List all registered AI agents (paginated)
 * GET  /v1/agents/by-name/:name Get an agent by its project name
 * GET  /v1/agents/:id           Get an agent project by numeric id
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentsRouter = agentsRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const config_js_1 = require("../config.js");
const clients_js_1 = require("../clients.js");
const abis_js_1 = require("../abis.js");
const errors_js_1 = require("../errors.js");
function serializeAgent(a) {
    return {
        id: ('id' in a ? a.id : BigInt(0)).toString(),
        name: a.name,
        description: a.description,
        owner: a.owner,
        agentEndpoint: a.agentEndpoint,
        isPublic: a.isPublic,
        versionCount: a.versionCount.toString(),
        createdAt: a.createdAt.toString(),
    };
}
const PaginationQuery = zod_1.z.object({
    offset: zod_1.z.coerce.number().int().min(0).default(0),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
// ─── Router ───────────────────────────────────────────────────────────────────
function agentsRouter(cfg) {
    const router = (0, express_1.Router)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    function requireRegistry() {
        if (!addrs.registry)
            throw new errors_js_1.ServiceUnavailableError('Registry contract not deployed yet. Set INKD_REGISTRY_ADDRESS env var.');
        return addrs.registry;
    }
    const publicClient = (0, clients_js_1.buildPublicClient)(cfg);
    // ── GET /v1/agents ──────────────────────────────────────────────────────────
    router.get('/', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const { offset, limit } = PaginationQuery.parse(req.query);
            const agents = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getAgentProjects',
                args: [BigInt(offset), BigInt(limit)],
            });
            res.json({
                data: agents.map(serializeAgent),
                offset,
                limit,
                count: agents.length,
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── GET /v1/agents/by-name/:name ────────────────────────────────────────────
    router.get('/by-name/:name', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const { name } = req.params;
            if (!name)
                throw new errors_js_1.BadRequestError('Agent name is required');
            // Lookup project id by name, then fetch full project
            const projectId = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProjectByName',
                args: [name],
            });
            if (projectId === 0n)
                throw new errors_js_1.NotFoundError(`Agent "${name}"`);
            const p = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProject',
                args: [projectId],
            });
            if (!p.exists || !p.isAgent)
                throw new errors_js_1.NotFoundError(`Agent "${name}"`);
            res.json({ data: serializeAgent(p) });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    // ── GET /v1/agents/:id ──────────────────────────────────────────────────────
    router.get('/:id', async (req, res) => {
        try {
            const registryAddress = requireRegistry();
            const id = parseInt(req.params['id'] ?? '', 10);
            if (isNaN(id) || id < 1)
                throw new errors_js_1.BadRequestError('Agent id must be a positive integer');
            const p = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getProject',
                args: [BigInt(id)],
            });
            if (!p.exists)
                throw new errors_js_1.NotFoundError(`Project #${id}`);
            if (!p.isAgent)
                throw new errors_js_1.NotFoundError(`Agent #${id} (project exists but is not an agent)`);
            res.json({ data: serializeAgent(p) });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    return router;
}
//# sourceMappingURL=agents.js.map