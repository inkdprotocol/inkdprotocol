/**
 * @file arweave.ts
 * @description Arweave upload and retrieval via Irys (formerly Bundlr).
 *              Handles permanent, decentralized storage for Inkd Protocol data tokens.
 */

import type { UploadResult } from "./types";

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
 * console.log(result.hash); // "abc123..."
 *
 * const data = await arweave.getFile(result.hash);
 * ```
 */
export class ArweaveClient {
  private irysUrl: string;
  private gateway: string;
  private privateKey: string;
  private irys: unknown | null = null;

  /**
   * Create a new ArweaveClient.
   * @param irysUrl    Irys node URL (e.g., "https://node2.irys.xyz").
   * @param privateKey Private key for signing Irys uploads.
   * @param gateway    Arweave gateway URL for retrieving data.
   */
  constructor(
    irysUrl: string,
    privateKey: string,
    gateway: string = DEFAULT_ARWEAVE_GATEWAY
  ) {
    this.irysUrl = irysUrl;
    this.gateway = gateway;
    this.privateKey = privateKey;
  }

  /**
   * Initialize the Irys client connection.
   * Must be called before uploading.
   */
  async connect(): Promise<void> {
    // Dynamic import to avoid bundling issues
    const { default: Irys } = await import("@irys/sdk");

    this.irys = new Irys({
      url: this.irysUrl,
      token: "ethereum",
      key: this.privateKey,
    });

    // Fund node if needed (will be a no-op if already funded)
    // @ts-expect-error — Irys SDK types may vary between versions
    await (this.irys as { ready: () => Promise<void> }).ready();
  }

  /**
   * Upload data to Arweave via Irys.
   *
   * @param data        Raw data to upload (Buffer or Uint8Array).
   * @param contentType MIME type of the data.
   * @param tags        Optional key-value tags for the Arweave transaction.
   * @returns           Upload result containing hash, URL, and size.
   */
  async uploadFile(
    data: Buffer | Uint8Array,
    contentType: string,
    tags?: Record<string, string>
  ): Promise<UploadResult> {
    if (!this.irys) {
      throw new Error("ArweaveClient not connected. Call connect() first.");
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

    const receipt = await irysClient.upload(
      data instanceof Uint8Array ? Buffer.from(data) : data,
      { tags: tagList }
    );

    return {
      hash: receipt.id,
      url: `${this.gateway}/${receipt.id}`,
      size: data.length,
    };
  }

  /**
   * Retrieve data from Arweave by transaction hash.
   *
   * @param hash Arweave transaction ID.
   * @returns    Raw data as a Buffer.
   */
  async getFile(hash: string): Promise<Buffer> {
    const url = `${this.gateway}/${hash}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from Arweave: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get the Arweave gateway URL for a given hash.
   *
   * @param hash Arweave transaction ID.
   * @returns    Full gateway URL.
   */
  getUrl(hash: string): string {
    return `${this.gateway}/${hash}`;
  }
}
