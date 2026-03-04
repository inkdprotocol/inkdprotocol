"use strict";
/**
 * GET /v1/health
 * GET /v1/status
 *
 * Returns server health + protocol status (project count, network).
 * These endpoints are NOT gated by auth — safe for uptime monitors.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = healthRouter;
const express_1 = require("express");
const config_js_1 = require("../config.js");
const clients_js_1 = require("../clients.js");
const abis_js_1 = require("../abis.js");
const errors_js_1 = require("../errors.js");
const START_TIME = Date.now();
function healthRouter(cfg) {
    const router = (0, express_1.Router)();
    const publicClient = (0, clients_js_1.buildPublicClient)(cfg);
    const addrs = config_js_1.ADDRESSES[cfg.network];
    /**
     * GET /v1/health
     * Lightweight liveness probe — no RPC call.
     */
    router.get('/health', (_req, res) => {
        res.json({
            ok: true,
            service: '@inkd/api',
            version: '0.1.0',
            uptimeMs: Date.now() - START_TIME,
        });
    });
    /**
     * GET /v1/status
     * Protocol status — hits the RPC once to read project count + total supply.
     */
    router.get('/status', async (_req, res) => {
        try {
            const contractsDeployed = Boolean(addrs.registry) && Boolean(addrs.token);
            let projectCount = null;
            let totalSupply = null;
            let rpcReachable = false;
            if (contractsDeployed) {
                try {
                    ;
                    [projectCount, totalSupply] = await Promise.all([
                        publicClient.readContract({
                            address: addrs.registry,
                            abi: abis_js_1.REGISTRY_ABI,
                            functionName: 'projectCount',
                        }),
                        publicClient.readContract({
                            address: addrs.token,
                            abi: abis_js_1.TOKEN_ABI,
                            functionName: 'totalSupply',
                        }),
                    ]);
                    rpcReachable = true;
                }
                catch (rpcErr) {
                    console.warn('[inkd-api] RPC unreachable during /status:', rpcErr);
                }
            }
            res.json({
                ok: true,
                network: cfg.network,
                rpcUrl: cfg.rpcUrl,
                rpcReachable,
                contracts: {
                    token: addrs.token || null,
                    registry: addrs.registry || null,
                    treasury: addrs.treasury || null,
                    deployed: contractsDeployed,
                },
                protocol: {
                    projectCount: projectCount !== null ? projectCount.toString() : null,
                    totalSupply: totalSupply !== null ? (Number(totalSupply) / 1e18).toFixed(4) + ' INKD' : null,
                },
                server: {
                    uptimeMs: Date.now() - START_TIME,
                    version: '0.1.0',
                },
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    return router;
}
//# sourceMappingURL=health.js.map