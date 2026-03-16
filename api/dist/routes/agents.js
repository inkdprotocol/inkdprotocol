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
const graph_js_1 = require("../graph.js");
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
    capability: zod_1.z.string().optional(), // filter by capability (searches name+description)
    q: zod_1.z.string().optional(), // general search query
    sortBy: zod_1.z.enum(['versionCount', 'createdAt']).default('createdAt'),
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
            const { offset, limit, capability, q } = PaginationQuery.parse(req.query);
            // Graph-first: supports capability/q filtering + versionCount sort
            const graph = (0, graph_js_1.getGraphClient)();
            if (graph) {
                try {
                    const searchQuery = capability ?? q ?? '';
                    let agents;
                    if (searchQuery) {
                        agents = await graph.searchProjects(searchQuery, limit);
                        agents = agents.filter(a => a.isAgent);
                    }
                    else {
                        agents = await graph.getProjects({ offset, limit, isAgent: true });
                    }
                    res.setHeader('Cache-Control', 'public, max-age=15');
                    return res.json({
                        data: agents.map(a => ({
                            id: a.id,
                            name: a.name,
                            description: a.description,
                            owner: a.owner?.id ?? '',
                            versionCount: a.versionCount,
                            createdAt: a.createdAt,
                            readmeHash: a.readmeHash,
                            // reputation proxy: versionCount as activity signal
                            reputation: {
                                versionCount: Number(a.versionCount),
                                activityScore: Math.min(100, Number(a.versionCount) * 10),
                            },
                        })),
                        total: agents.length.toString(),
                        offset,
                        limit,
                        source: 'graph',
                    });
                }
                catch { /* fall through to RPC */ }
            }
            const agents = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'getAgentProjects',
                args: [BigInt(offset), BigInt(limit)],
            });
            // agentProjectCount() has a storage-layout issue after V2 upgrade — returns garbage.
            // Use agents.length as count; total is approximate (actual count unknown until fixed on-chain).
            let serialized = agents.map(serializeAgent).filter(a => a.id !== '0');
            // Apply capability/q filter on RPC results
            if (capability ?? q) {
                const needle = (capability ?? q ?? '').toLowerCase();
                serialized = serialized.filter(a => a.name.toLowerCase().includes(needle) ||
                    a.description.toLowerCase().includes(needle));
            }
            res.json({
                data: serialized,
                total: serialized.length.toString(),
                offset,
                limit,
                count: serialized.length,
                source: 'rpc',
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
            // Try Graph first (O(1) lookup), fall back to linear RPC scan
            const graph = (0, graph_js_1.getGraphClient)();
            if (graph) {
                const graphAgent = await graph.getProjectByName(name).catch(() => null);
                if (graphAgent && graphAgent.isAgent) {
                    return res.json({ data: graphAgent, source: 'graph' });
                }
            }
            // Fallback: linear RPC scan
            const total = await publicClient.readContract({
                address: registryAddress,
                abi: abis_js_1.REGISTRY_ABI,
                functionName: 'projectCount',
            });
            const normalizedSearch = name.toLowerCase();
            let found = null;
            for (let i = 1; i <= Number(total); i++) {
                const p = await publicClient.readContract({
                    address: registryAddress,
                    abi: abis_js_1.REGISTRY_ABI,
                    functionName: 'getProject',
                    args: [BigInt(i)],
                });
                if (p.exists && p.isAgent && p.name.toLowerCase() === normalizedSearch) {
                    found = p;
                    break;
                }
            }
            if (!found)
                throw new errors_js_1.NotFoundError(`Agent "${name}"`);
            res.json({ data: serializeAgent(found), source: 'rpc' });
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