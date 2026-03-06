"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUploadRouter = buildUploadRouter;
const express_1 = require("express");
const errors_js_1 = require("../errors.js");
const arweave_js_1 = require("../arweave.js");
// ─── Irys upload helper ───────────────────────────────────────────────────────
const IRYS_NODE = 'https://node2.irys.xyz';
const ARWEAVE_GW = 'https://arweave.net';
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
async function uploadToIrys(data, contentType, serverKey, tags) {
    // @ts-ignore — @irys/sdk types vary by version
    const { default: Irys } = await Promise.resolve().then(() => __importStar(require('@irys/sdk')));
    const irys = new Irys({ url: IRYS_NODE, token: 'ethereum', key: serverKey });
    await irys.ready();
    const tagList = [
        { name: 'Content-Type', value: contentType },
        { name: 'App-Name', value: 'inkd-protocol' },
        ...(tags ? Object.entries(tags).map(([n, v]) => ({ name: n, value: v })) : []),
    ];
    const receipt = await irys.upload(data, { tags: tagList });
    return {
        txId: receipt.id,
        url: `${ARWEAVE_GW}/${receipt.id}`,
    };
}
// ─── Router ───────────────────────────────────────────────────────────────────
function buildUploadRouter(cfg) {
    const router = (0, express_1.Router)();
    /**
     * POST /v1/upload
     * Upload content to Arweave via Irys.
     */
    router.post('/', async (req, res) => {
        try {
            if (!cfg.serverWalletKey) {
                throw new errors_js_1.ServiceUnavailableError('Server wallet not configured — uploads unavailable.');
            }
            let data;
            let contentType;
            const extraTags = {};
            const ct = req.headers['content-type'] ?? '';
            if (ct.includes('application/json')) {
                // JSON mode: { data: "<base64>", contentType: string, filename?: string }
                const { data: b64, contentType: ct2, filename } = req.body;
                if (!b64 || !ct2)
                    throw new errors_js_1.BadRequestError('body must have: data (base64), contentType');
                data = Buffer.from(b64, 'base64');
                contentType = ct2;
                if (filename)
                    extraTags['File-Name'] = filename;
            }
            else if (ct.includes('multipart/form-data')) {
                // Multipart not natively supported without multer — return helpful error
                throw new errors_js_1.BadRequestError('multipart/form-data not supported. Use application/json: ' +
                    '{ data: base64, contentType: "..." }');
            }
            else {
                // Raw binary body
                contentType = ct.split(';')[0]?.trim() || 'application/octet-stream';
                data = req.body instanceof Buffer ? req.body
                    : Buffer.isBuffer(req.body) ? req.body
                        : Buffer.from(req.body);
            }
            if (!data || data.length === 0)
                throw new errors_js_1.BadRequestError('Empty upload');
            if (data.length > MAX_BYTES)
                throw new errors_js_1.BadRequestError(`Max upload size is ${MAX_BYTES / 1024 / 1024}MB`);
            // Estimate cost for informational purposes
            let costUsdc = '0';
            try {
                const cost = await (0, arweave_js_1.getArweaveCostUsdc)(data.length);
                costUsdc = cost.toString();
            }
            catch { /* non-fatal */ }
            const { txId, url } = await uploadToIrys(data, contentType, cfg.serverWalletKey, extraTags);
            res.status(201).json({
                hash: `ar://${txId}`,
                txId,
                url,
                bytes: data.length,
                cost: {
                    usdc: costUsdc,
                    usd: `$${(Number(costUsdc) / 1e6).toFixed(4)}`,
                },
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    /**
     * GET /v1/upload/price?bytes=N
     * Estimate Arweave upload cost in USDC for a given number of bytes.
     */
    router.get('/price', async (req, res) => {
        try {
            const bytes = parseInt(req.query['bytes'] ?? '0', 10);
            if (!bytes || bytes <= 0)
                throw new errors_js_1.BadRequestError('bytes must be a positive integer');
            if (bytes > MAX_BYTES)
                throw new errors_js_1.BadRequestError(`Max ${MAX_BYTES / 1024 / 1024}MB`);
            const costUsdc = await (0, arweave_js_1.getArweaveCostUsdc)(bytes);
            res.json({
                bytes,
                costUsdc: costUsdc.toString(),
                costUsd: `$${(Number(costUsdc) / 1e6).toFixed(4)}`,
            });
        }
        catch (err) {
            (0, errors_js_1.sendError)(res, err);
        }
    });
    return router;
}
//# sourceMappingURL=upload.js.map