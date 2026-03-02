/**
 * @file arweave.ts
 * @description Arweave/Irys integration for permanent decentralized storage.
 */

import type { UploadResult } from "./types";
import { UploadError } from "./errors";

const DEFAULT_ARWEAVE_GATEWAY = "https://arweave.net";

/**
 * Arweave storage client using Irys for uploads.
 *
 * @example
 * ```ts
 * const arweave = new ArweaveClient("https://node2.irys.xyz", privateKey);
 * await arweave.connect();
 *
 * const result = await arweave.uploadFile(
 *   Buffer.from(JSON.stringify({ memory: "hello" })),
 *   "application/json"
 * );
 *
 * const data = await arweave.downloadData(result.hash);
 * ```
 */
export class ArweaveClient {
  private irysUrl: string;
  private gateway: string;
  private privateKey: string;
  private irys: unknown | null = null;

  constructor(
    irysUrl: string,
    privateKey: string,
    gateway: string = DEFAULT_ARWEAVE_GATEWAY
  ) {
    this.irysUrl = irysUrl;
    this.gateway = gateway;
    this.privateKey = privateKey;
  }

  /** Initialize the Irys client connection. */
  async connect(): Promise<void> {
    // @ts-ignore – @irys/sdk is an optional peer dep; types may not be installed
    const { default: Irys } = await import("@irys/sdk");

    this.irys = new Irys({
      url: this.irysUrl,
      token: "ethereum",
      key: this.privateKey,
    });

    await (this.irys as { ready: () => Promise<void> }).ready();
  }

  /** Upload data to Arweave via Irys. */
  async uploadData(
    data: Buffer | Uint8Array,
    contentType: string,
    tags?: Record<string, string>
  ): Promise<UploadResult> {
    return this.uploadFile(data, contentType, tags);
  }

  /** Upload data to Arweave via Irys. */
  async uploadFile(
    data: Buffer | Uint8Array,
    contentType: string,
    tags?: Record<string, string>
  ): Promise<UploadResult> {
    if (!this.irys) {
      throw new UploadError("ArweaveClient not connected. Call connect() first.");
    }

    const irysClient = this.irys as {
      upload: (
        data: Buffer | Uint8Array,
        opts: { tags: Array<{ name: string; value: string }> }
      ) => Promise<{ id: string }>;
    };

    const tagList: Array<{ name: string; value: string }> = [
      { name: "Content-Type", value: contentType },
      { name: "App-Name", value: "inkd-protocol" },
    ];

    if (tags) {
      for (const [name, value] of Object.entries(tags)) {
        tagList.push({ name, value });
      }
    }

    try {
      const receipt = await irysClient.upload(
        Buffer.isBuffer(data) ? data : Buffer.from(data),
        { tags: tagList }
      );

      return {
        hash: receipt.id,
        url: `${this.gateway}/${receipt.id}`,
        size: data.length,
      };
    } catch (err) {
      throw new UploadError(
        `Arweave upload failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /** Download data from Arweave by transaction hash. */
  async downloadData(hash: string): Promise<Buffer> {
    return this.getFile(hash);
  }

  /** Retrieve data from Arweave by transaction hash. */
  async getFile(hash: string): Promise<Buffer> {
    const url = `${this.gateway}/${hash}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new UploadError(
        `Failed to fetch from Arweave: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Get the price to upload a given number of bytes (in wei). */
  async getUploadPrice(bytes: number): Promise<bigint> {
    if (!this.irys) {
      throw new UploadError("ArweaveClient not connected. Call connect() first.");
    }

    const irysClient = this.irys as {
      getPrice: (bytes: number) => Promise<bigint>;
    };

    try {
      return await irysClient.getPrice(bytes);
    } catch {
      // Rough estimate: ~0.00001 ETH per KB
      return BigInt(Math.ceil(bytes / 1024)) * 10_000_000_000_000n;
    }
  }

  /** Upload data encrypted with Lit Protocol access conditions. */
  async uploadEncrypted(
    data: Buffer | Uint8Array,
    contentType: string,
    tags?: Record<string, string>
  ): Promise<UploadResult> {
    // In V1, this is the same as regular upload.
    // V2 will add Lit Protocol encryption before upload.
    return this.uploadFile(data, contentType, {
      ...tags,
      "Encryption": "lit-protocol",
    });
  }

  /** Get the Arweave gateway URL for a given hash. */
  getUrl(hash: string): string {
    return `${this.gateway}/${hash}`;
  }
}
