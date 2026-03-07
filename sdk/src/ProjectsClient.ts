/**
 * @file ProjectsClient.ts
 * @description x402 payment-based client for the Inkd Protocol API.
 *
 * Agents use this to create projects and push versions by paying USDC
 * via EIP-3009. No API keys needed — wallet = identity.
 *
 * @example
 * ```ts
 * import { ProjectsClient } from "@inkd/sdk";
 * import { createWalletClient, createPublicClient, http } from "viem";
 * import { base } from "viem/chains";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const account = privateKeyToAccount("0x...");
 * const wallet  = createWalletClient({ account, chain: base, transport: http() });
 * const reader  = createPublicClient({ chain: base, transport: http() });
 *
 * const client = new ProjectsClient({ wallet, publicClient: reader });
 *
 * const { projectId } = await client.createProject({
 *   name: "my-agent",
 *   description: "An autonomous AI agent",
 *   license: "MIT",
 * });
 *
 * const { txHash } = await client.pushVersion(projectId, {
 *   tag: "v1.0.0",
 *   contentHash: "ar://TxId",
 * });
 * ```
 */

import type { WalletClient, PublicClient, Account, Transport, Chain } from "viem";
import {
  generateContentKey,
  encryptContent,
  decryptContent,
  privateKeyToCompressedPublicKey,
  buildAccessManifest,
  addRecipientToManifest,
  type AccessManifest,
} from "./crypto.js";
const { wrapFetchWithPayment, x402Client } = require("@x402/fetch") as {
  wrapFetchWithPayment: (f: typeof fetch, c: unknown) => typeof fetch;
  x402Client:          new () => { register: (network: string, scheme: unknown) => unknown };
};
const { ExactEvmScheme } = require("@x402/evm") as {
  ExactEvmScheme: new (signer: unknown) => unknown;
};

// ─── API base URL ─────────────────────────────────────────────────────────────

const DEFAULT_API_URL = "https://api.inkdprotocol.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectsClientConfig {
  /** Viem WalletClient with account attached. */
  wallet: WalletClient<Transport, Chain, Account>;
  /** Viem PublicClient for reading contract state. */
  publicClient: PublicClient;
  /** Override the API base URL (default: https://api.inkdprotocol.com). */
  apiUrl?: string;
  /**
   * Private key (hex) for encrypting private projects.
   * Required for createPrivateProject() and decryptVersion().
   */
  privateKey?: `0x${string}`;
}

export interface CreateProjectParams {
  name:           string;
  description?:   string;
  license?:       string;
  isPublic?:      boolean;
  readmeHash?:    string;
  isAgent?:       boolean;
  agentEndpoint?: string;
}

export interface CreateProjectResult {
  projectId: number;
  txHash:    string;
  owner:     string;
  blockNumber: number;
}

export interface PushVersionParams {
  tag:          string;
  contentHash:  string;           // ar://TxId
  metadataHash?: string;
  contentSize?:  number;          // bytes, used for dynamic pricing
}

export interface PushVersionResult {
  tag:         string;
  contentHash: string;
  txHash:      string;
  blockNumber: number;
}

export interface Project {
  id:            number;
  name:          string;
  description:   string;
  license:       string;
  owner:         string;
  isPublic:      boolean;
  isAgent:       boolean;
  agentEndpoint: string;
  readmeHash:    string;
  createdAt:     number;
  versionCount:  number;
}

export interface UploadResult {
  hash:  string;   // ar://TxId
  txId:  string;
  url:   string;
  bytes: number;
}

export interface UploadOptions {
  contentType?: string;
  filename?:    string;
}

// ─── ProjectsClient ───────────────────────────────────────────────────────────

export class ProjectsClient {
  private readonly fetchPay:   typeof fetch;
  private readonly apiUrl:     string;
  private readonly privateKey: `0x${string}` | undefined;

  constructor(config: ProjectsClientConfig) {
    const { wallet, publicClient, apiUrl = DEFAULT_API_URL, privateKey } = config;
    this.privateKey = privateKey;
    this.apiUrl = apiUrl;

    // Build a ClientEvmSigner with .address at top level (required by @x402/evm)
    const signer = {
      address:       wallet.account.address,
      signTypedData: (msg: Parameters<typeof wallet.signTypedData>[0]) =>
        wallet.signTypedData({ ...msg, account: wallet.account } as Parameters<typeof wallet.signTypedData>[0]),
      readContract:  publicClient.readContract.bind(publicClient) as typeof publicClient.readContract,
    };

    // Detect network from chain id
    const chainId   = wallet.chain?.id ?? 8453;
    const networkId = `eip155:${chainId}` as `${string}:${string}`;

    const client = new x402Client().register(networkId, new ExactEvmScheme(signer));
    this.fetchPay = wrapFetchWithPayment(fetch, client);
  }

  // ─── Projects ───────────────────────────────────────────────────────────────

  /**
   * Create a new project. Pays $5 USDC via x402.
   */
  async createProject(params: CreateProjectParams): Promise<CreateProjectResult> {
    const res = await this.fetchPay(`${this.apiUrl}/v1/projects`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:          params.name,
        description:   params.description   ?? "",
        license:       params.license       ?? "MIT",
        isPublic:      params.isPublic      ?? true,
        readmeHash:    params.readmeHash    ?? "",
        isAgent:       params.isAgent       ?? false,
        agentEndpoint: params.agentEndpoint ?? "",
      }),
    });

    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(`createProject failed [${res.status}]: ${JSON.stringify(body)}`);

    return {
      projectId:   body["projectId"]   as number,
      txHash:      body["txHash"]      as string,
      owner:       body["owner"]       as string,
      blockNumber: body["blockNumber"] as number ?? 0,
    };
  }

  /**
   * Push a new version to a project. Pays $2 USDC via x402.
   * Tip: upload content via `upload()` first, then pass the returned hash.
   */
  async pushVersion(projectId: number, params: PushVersionParams): Promise<PushVersionResult> {
    const res = await this.fetchPay(`${this.apiUrl}/v1/projects/${projectId}/versions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        tag:          params.tag,
        contentHash:  params.contentHash,
        metadataHash: params.metadataHash ?? "",
        contentSize:  params.contentSize  ?? 0,
      }),
    });

    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(`pushVersion failed [${res.status}]: ${JSON.stringify(body)}`);

    return {
      tag:         body["tag"]         as string,
      contentHash: body["contentHash"] as string,
      txHash:      body["txHash"]      as string,
      blockNumber: body["blockNumber"] as number ?? 0,
    };
  }

  // ─── Read (free) ─────────────────────────────────────────────────────────────

  /** Get a project by ID (no payment required). */
  async getProject(projectId: number): Promise<Project> {
    const res  = await fetch(`${this.apiUrl}/v1/projects/${projectId}`);
    const body = await res.json() as { data?: Project } & Record<string, unknown>;
    if (!res.ok) throw new Error(`getProject failed [${res.status}]`);
    return (body["data"] ?? body) as Project;
  }

  /** List projects (no payment required). */
  async listProjects(opts: { offset?: number; limit?: number } = {}): Promise<Project[]> {
    const params = new URLSearchParams();
    if (opts.offset) params.set("offset", String(opts.offset));
    if (opts.limit)  params.set("limit",  String(opts.limit));
    const res  = await fetch(`${this.apiUrl}/v1/projects?${params}`);
    const body = await res.json() as { data?: Project[] } & Record<string, unknown>;
    if (!res.ok) throw new Error(`listProjects failed [${res.status}]`);
    return (body["data"] ?? body) as Project[];
  }

  /** Estimate Arweave upload cost in USDC for a given number of bytes. */
  async estimateUploadCost(bytes: number): Promise<{ total: string; arweaveCost: string; markup: string }> {
    const res  = await fetch(`${this.apiUrl}/v1/projects/estimate?bytes=${bytes}`);
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(`estimateUploadCost failed [${res.status}]`);
    return body as { total: string; arweaveCost: string; markup: string };
  }

  // ─── Upload ──────────────────────────────────────────────────────────────────

  // ─── Private Projects ────────────────────────────────────────────────────────

  /**
   * Create a private project. Encrypts content with AES-256-GCM + ECIES key wrapping.
   * Only the owner (and collaborators added later) can decrypt.
   * Requires `privateKey` in ProjectsClientConfig.
   */
  async createPrivateProject(
    params: CreateProjectParams & { content: Buffer | Uint8Array; contentType?: string }
  ): Promise<CreateProjectResult & { accessManifestHash: string }> {
    if (!this.privateKey) throw new Error("privateKey required for private projects")

    const privKeyHex  = this.privateKey.replace("0x", "")
    const ownerPubKey = privateKeyToCompressedPublicKey(privKeyHex)
    const _ownerAddress = params.name // will be overridden below — we get from wallet

    // 1. Generate AES key + encrypt content
    const aesKey   = generateContentKey()
    const content  = Buffer.from(params.content)
    const encrypted = encryptContent(content, aesKey)

    // 2. Upload encrypted blob to Arweave
    const encryptedBlob = JSON.stringify(encrypted)
    const _contentUpload = await this.upload(Buffer.from(encryptedBlob), {
      contentType: "application/inkd-encrypted",
      filename:    `${params.name}.enc`,
    })

    // 3. Build access manifest (owner only — collaborators added via addCollaborator)
    // We'll use a placeholder projectId until we get it from createProject
    const _tempManifest = buildAccessManifest(
      0, // placeholder — updated after project creation
      aesKey,
      [{ address: "0x0000000000000000000000000000000000000000" as `0x${string}`, compressedPublicKey: ownerPubKey }]
    )

    // 4. Create project on-chain via API (isPublic: false)
    const result = await this.createProject({ ...params, isPublic: false })

    // 5. Rebuild manifest with real projectId + real owner address
    const manifest = buildAccessManifest(
      result.projectId,
      aesKey,
      [{ address: result.owner as `0x${string}`, compressedPublicKey: ownerPubKey }]
    )

    // 6. Upload access manifest to Arweave
    const manifestUpload = await this.upload(Buffer.from(JSON.stringify(manifest)), {
      contentType: "application/inkd-access-manifest",
      filename:    `project-${result.projectId}-manifest.json`,
    })

    return {
      ...result,
      accessManifestHash: manifestUpload.hash,
    }
  }

  /**
   * Decrypt content from a private project version.
   * Requires `privateKey` in ProjectsClientConfig.
   */
  async decryptVersion(
    encryptedArweaveHash: string,
    manifestArweaveHash:  string
  ): Promise<Buffer> {
    if (!this.privateKey) throw new Error("privateKey required for decryption")

    const privKeyHex = this.privateKey.replace("0x", "")
    const ownerPubKey = privateKeyToCompressedPublicKey(privKeyHex)

    // Fetch encrypted content
    const txId           = encryptedArweaveHash.replace("ar://", "")
    const contentRes     = await fetch(`https://arweave.net/${txId}`)
    const encryptedBlob  = await contentRes.json() as Parameters<typeof decryptContent>[0]

    // Fetch access manifest
    const manifestTxId  = manifestArweaveHash.replace("ar://", "")
    const manifestRes   = await fetch(`https://arweave.net/${manifestTxId}`)
    const manifest      = await manifestRes.json() as AccessManifest

    // Find our entry in the manifest
    const entry = manifest.contentKey.recipients.find(r => r.publicKey === ownerPubKey)
    if (!entry) throw new Error("No access: wallet not in access manifest")

    // Unwrap AES key and decrypt
    const { unwrapKey } = await import("./crypto.js")
    const aesKey = unwrapKey(entry.wrappedKey, privKeyHex)
    return decryptContent(encryptedBlob, aesKey)
  }

  /**
   * Add a collaborator to a private project.
   * Owner fetches and re-encrypts the manifest with the new wallet's public key.
   */
  async addCollaborator(
    manifestArweaveHash: string,
    collaborator: { address: `0x${string}`; compressedPublicKey: string }
  ): Promise<{ newManifestHash: string }> {
    if (!this.privateKey) throw new Error("privateKey required")

    const privKeyHex = this.privateKey.replace("0x", "")

    // Fetch current manifest
    const txId = manifestArweaveHash.replace("ar://", "")
    const res  = await fetch(`https://arweave.net/${txId}`)
    const manifest = await res.json() as AccessManifest

    // Add new recipient
    const newManifest = addRecipientToManifest(manifest, privKeyHex, collaborator)

    // Upload updated manifest
    const upload = await this.upload(Buffer.from(JSON.stringify(newManifest)), {
      contentType: "application/inkd-access-manifest",
      filename:    `project-${manifest.projectId}-manifest.json`,
    })

    return { newManifestHash: upload.hash }
  }

  /**
   * Upload content to Arweave via the Inkd API.
   * Returns an `ar://` hash to use in pushVersion.
   * Free endpoint — cost is covered by the $2 USDC in pushVersion.
   */
  async upload(data: Uint8Array | Buffer | string, opts: UploadOptions = {}): Promise<UploadResult> {
    const buf         = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    const contentType = opts.contentType ?? "application/octet-stream";

    const body: Record<string, unknown> = {
      data:        buf.toString("base64"),
      contentType,
    };
    if (opts.filename) body["filename"] = opts.filename;

    const res  = await fetch(`${this.apiUrl}/v1/upload`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const result = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(`upload failed [${res.status}]: ${JSON.stringify(result)}`);

    return {
      hash:  result["hash"]  as string,
      txId:  result["txId"]  as string,
      url:   result["url"]   as string,
      bytes: result["bytes"] as number,
    };
  }
}
