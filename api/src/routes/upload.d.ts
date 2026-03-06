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
import { Router } from 'express';
import type { ApiConfig } from '../config.js';
export declare function buildUploadRouter(cfg: ApiConfig): Router;
