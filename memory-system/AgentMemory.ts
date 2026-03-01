/**
 * @file AgentMemory.ts
 * @description The killer feature of Inkd Protocol — agents storing their memory as tokens.
 *
 *              Every memory, skill, experience, or learned behavior is minted as an
 *              Inkd token. The agent's wallet IS its brain. Transfer your wallet,
 *              transfer your entire knowledge. Burn a token, forget a memory.
 *
 *              This enables:
 *              - Persistent agent memory across sessions
 *              - Agent-to-agent knowledge transfer (purchase memories)
 *              - Full brain export/import (switch wallets, fork agents)
 *              - Versioned memories (update what you know)
 *              - Tagged, searchable knowledge graph
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A memory entry stored as an Inkd token. */
export interface Memory {
  /** On-chain token ID (set after minting). */
  tokenId: bigint | null;
  /** Human-readable key for quick lookups. */
  key: string;
  /** The actual memory data (any serializable structure). */
  data: unknown;
  /** Tags for categorization and search. */
  tags: string[];
  /** Memory category. */
  category: MemoryCategory;
  /** Importance score (0-100). Higher = more critical. */
  importance: number;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Arweave hash of the stored data. */
  arweaveHash: string | null;
  /** Number of times this memory has been accessed. */
  accessCount: number;
  /** Version number (increments on update). */
  version: number;
}

/** Memory categories for organization. */
export type MemoryCategory =
  | "experience"      // Learned behaviors, past interactions
  | "skill"           // Acquired capabilities
  | "knowledge"       // Facts, data, information
  | "preference"      // User/agent preferences
  | "conversation"    // Past conversation summaries
  | "code"            // Code snippets, scripts
  | "config"          // Configuration data
  | "relationship"    // Agent-to-agent or agent-to-user relationships
  | "strategy"        // Plans, strategies, goals
  | "reflection";     // Self-analysis, meta-cognition

/** Search query for memories. */
export interface MemoryQuery {
  /** Text to search in keys and data. */
  text?: string;
  /** Filter by tags (OR match). */
  tags?: string[];
  /** Filter by category. */
  category?: MemoryCategory;
  /** Minimum importance score. */
  minImportance?: number;
  /** Maximum number of results. */
  limit?: number;
}

/** Export format for full brain dump. */
export interface BrainExport {
  agentId: string;
  exportedAt: string;
  memoryCount: number;
  categories: Record<MemoryCategory, number>;
  memories: Memory[];
  metadata: {
    totalAccessCount: number;
    oldestMemory: string;
    newestMemory: string;
    topTags: string[];
  };
}

/** Options for saving a memory. */
export interface SaveOptions {
  /** Memory category. Default: "knowledge". */
  category?: MemoryCategory;
  /** Importance score 0-100. Default: 50. */
  importance?: number;
  /** Price in wei if memory should be purchasable. Default: 0 (not for sale). */
  price?: bigint;
}

// ─── Types for SDK integration ──────────────────────────────────────────────

/** Minimal interface for the Inkd SDK client. */
interface IInkdClient {
  mint(
    file: Buffer | Uint8Array,
    options: { contentType: string; price?: bigint; metadataURI?: string }
  ): Promise<{ hash: `0x${string}`; tokenId?: bigint }>;

  addVersion(
    tokenId: bigint,
    file: Buffer | Uint8Array,
    contentType: string
  ): Promise<{ hash: `0x${string}` }>;

  getData(tokenId: bigint): Promise<Buffer>;
  getToken(tokenId: bigint): Promise<{ tokenId: bigint; arweaveHash: string; versions: string[] }>;
  getTokensByOwner(address: `0x${string}`): Promise<Array<{ tokenId: bigint; arweaveHash: string; metadataURI: string }>>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "data");
const INDEX_FILE = path.join(DATA_DIR, "memory-index.json");

// ─── Agent Memory ───────────────────────────────────────────────────────────

export class AgentMemory {
  private agentId: string;
  private memories: Map<string, Memory> = new Map();
  private tokenIndex: Map<string, string> = new Map(); // tokenId -> key
  private client: IInkdClient | null = null;

  /**
   * Create a new AgentMemory instance.
   *
   * @param agentId   Unique identifier for this agent.
   * @param client    Optional InkdClient for on-chain minting. If null, operates in local-only mode.
   */
  constructor(agentId: string, client?: IInkdClient) {
    this.agentId = agentId;
    this.client = client ?? null;
    this.ensureDataDir();
    this.loadIndex();
  }

  /**
   * Save a memory. Optionally mints it as an Inkd token on-chain.
   *
   * @param key     Unique key for the memory.
   * @param data    Any serializable data to store.
   * @param tags    Tags for categorization and search.
   * @param options Save options (category, importance, price).
   * @returns       Token ID if minted on-chain, null if local-only.
   */
  async save(
    key: string,
    data: unknown,
    tags: string[] = [],
    options: SaveOptions = {}
  ): Promise<bigint | null> {
    const now = new Date().toISOString();
    const category = options.category ?? "knowledge";
    const importance = options.importance ?? 50;

    const memory: Memory = {
      tokenId: null,
      key,
      data,
      tags,
      category,
      importance,
      createdAt: now,
      updatedAt: now,
      arweaveHash: null,
      accessCount: 0,
      version: 1,
    };

    // Mint on-chain if client is connected
    if (this.client) {
      const payload = Buffer.from(JSON.stringify({
        agentId: this.agentId,
        key,
        data,
        tags,
        category,
        importance,
        version: 1,
        createdAt: now,
      }));

      const metadataURI = `inkd://memory/${this.agentId}/${encodeURIComponent(key)}`;

      const result = await this.client.mint(payload, {
        contentType: "application/json",
        price: options.price,
        metadataURI,
      });

      memory.tokenId = result.tokenId ?? null;
      if (memory.tokenId !== null) {
        this.tokenIndex.set(memory.tokenId.toString(), key);
      }
    }

    this.memories.set(key, memory);
    this.saveIndex();

    return memory.tokenId;
  }

  /**
   * Load a memory by its token ID.
   *
   * @param tokenId On-chain token ID.
   * @returns       The memory data, or null if not found.
   */
  async load(tokenId: bigint): Promise<unknown | null> {
    // Check local index first
    const key = this.tokenIndex.get(tokenId.toString());
    if (key) {
      const memory = this.memories.get(key);
      if (memory) {
        memory.accessCount++;
        this.saveIndex();
        return memory.data;
      }
    }

    // Fetch from on-chain if client available
    if (this.client) {
      const rawData = await this.client.getData(tokenId);
      const parsed = JSON.parse(rawData.toString());
      return parsed.data ?? parsed;
    }

    return null;
  }

  /**
   * Load a memory by its key.
   *
   * @param key Memory key.
   * @returns   The memory data, or null if not found.
   */
  loadByKey(key: string): unknown | null {
    const memory = this.memories.get(key);
    if (memory) {
      memory.accessCount++;
      this.saveIndex();
      return memory.data;
    }
    return null;
  }

  /**
   * Update an existing memory. Creates a new version on-chain.
   *
   * @param tokenId Token ID of the memory to update.
   * @param newData Updated data.
   * @returns       New token ID if a new version was minted.
   */
  async update(
    tokenId: bigint,
    newData: unknown
  ): Promise<bigint | null> {
    const key = this.tokenIndex.get(tokenId.toString());
    if (!key) {
      throw new Error(`No memory found for tokenId ${tokenId}`);
    }

    const memory = this.memories.get(key);
    if (!memory) {
      throw new Error(`Memory index corrupt: key ${key} not found`);
    }

    const now = new Date().toISOString();
    memory.data = newData;
    memory.updatedAt = now;
    memory.version++;

    // Push new version on-chain
    if (this.client && memory.tokenId !== null) {
      const payload = Buffer.from(JSON.stringify({
        agentId: this.agentId,
        key,
        data: newData,
        tags: memory.tags,
        category: memory.category,
        importance: memory.importance,
        version: memory.version,
        updatedAt: now,
      }));

      await this.client.addVersion(memory.tokenId, payload, "application/json");
    }

    this.saveIndex();
    return memory.tokenId;
  }

  /**
   * Update a memory by key.
   *
   * @param key     Memory key.
   * @param newData Updated data.
   */
  async updateByKey(key: string, newData: unknown): Promise<bigint | null> {
    const memory = this.memories.get(key);
    if (!memory) {
      throw new Error(`No memory found for key "${key}"`);
    }

    if (memory.tokenId !== null) {
      return this.update(memory.tokenId, newData);
    }

    // Local-only update
    memory.data = newData;
    memory.updatedAt = new Date().toISOString();
    memory.version++;
    this.saveIndex();
    return null;
  }

  /**
   * Search memories by text, tags, category, or importance.
   *
   * @param query Search query parameters.
   * @returns     Array of matching memories, sorted by relevance.
   */
  search(query: MemoryQuery): Memory[] {
    let results = Array.from(this.memories.values());

    // Filter by category
    if (query.category) {
      results = results.filter((m) => m.category === query.category);
    }

    // Filter by tags (OR match)
    if (query.tags && query.tags.length > 0) {
      results = results.filter((m) =>
        query.tags!.some((t) => m.tags.includes(t))
      );
    }

    // Filter by importance
    if (query.minImportance !== undefined) {
      results = results.filter((m) => m.importance >= query.minImportance!);
    }

    // Text search
    if (query.text) {
      const lower = query.text.toLowerCase();
      results = results.filter((m) => {
        const keyMatch = m.key.toLowerCase().includes(lower);
        const dataMatch = JSON.stringify(m.data).toLowerCase().includes(lower);
        const tagMatch = m.tags.some((t) => t.toLowerCase().includes(lower));
        return keyMatch || dataMatch || tagMatch;
      });
    }

    // Sort by relevance (importance * accessCount)
    results.sort((a, b) => {
      const scoreA = a.importance + a.accessCount * 2;
      const scoreB = b.importance + b.accessCount * 2;
      return scoreB - scoreA;
    });

    // Limit results
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Export the agent's entire brain (all memories).
   *
   * @returns Complete brain export with metadata.
   */
  export(): BrainExport {
    const allMemories = Array.from(this.memories.values());

    // Count categories
    const categories = {} as Record<MemoryCategory, number>;
    for (const m of allMemories) {
      categories[m.category] = (categories[m.category] ?? 0) + 1;
    }

    // Compute metadata
    const totalAccessCount = allMemories.reduce((s, m) => s + m.accessCount, 0);
    const sorted = [...allMemories].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Top tags
    const tagCounts: Record<string, number> = {};
    for (const m of allMemories) {
      for (const t of m.tags) {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    return {
      agentId: this.agentId,
      exportedAt: new Date().toISOString(),
      memoryCount: allMemories.length,
      categories,
      memories: allMemories,
      metadata: {
        totalAccessCount,
        oldestMemory: sorted[0]?.createdAt ?? "",
        newestMemory: sorted[sorted.length - 1]?.createdAt ?? "",
        topTags,
      },
    };
  }

  /**
   * Import another agent's brain (load memories from their wallet).
   * Reads all Inkd tokens owned by the given wallet and loads them as memories.
   *
   * @param walletAddress Address of the agent whose brain to import.
   * @returns             Number of memories imported.
   */
  async import(walletAddress: `0x${string}`): Promise<number> {
    if (!this.client) {
      throw new Error("InkdClient required for importing from on-chain.");
    }

    const tokens = await this.client.getTokensByOwner(walletAddress);
    let imported = 0;

    for (const token of tokens) {
      try {
        const rawData = await this.client.getData(token.tokenId);
        const parsed = JSON.parse(rawData.toString());

        const key = parsed.key ?? `imported-${token.tokenId}`;
        if (this.memories.has(key)) continue; // Skip duplicates

        const memory: Memory = {
          tokenId: token.tokenId,
          key,
          data: parsed.data ?? parsed,
          tags: parsed.tags ?? ["imported"],
          category: parsed.category ?? "knowledge",
          importance: parsed.importance ?? 30,
          createdAt: parsed.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          arweaveHash: token.arweaveHash,
          accessCount: 0,
          version: parsed.version ?? 1,
        };

        this.memories.set(key, memory);
        this.tokenIndex.set(token.tokenId.toString(), key);
        imported++;
      } catch {
        // Skip tokens that aren't valid memories
        continue;
      }
    }

    if (imported > 0) {
      this.saveIndex();
    }

    return imported;
  }

  /**
   * Import from a brain export JSON.
   *
   * @param brainExport Previously exported brain data.
   * @returns           Number of memories imported.
   */
  importFromExport(brainExport: BrainExport): number {
    let imported = 0;

    for (const memory of brainExport.memories) {
      if (this.memories.has(memory.key)) continue;

      this.memories.set(memory.key, {
        ...memory,
        tokenId: null, // Not minted in this agent's wallet
        accessCount: 0,
      });
      imported++;
    }

    if (imported > 0) {
      this.saveIndex();
    }

    return imported;
  }

  /**
   * Delete a memory by key (does not burn the on-chain token).
   *
   * @param key Memory key to delete.
   */
  delete(key: string): void {
    const memory = this.memories.get(key);
    if (memory?.tokenId !== null && memory?.tokenId !== undefined) {
      this.tokenIndex.delete(memory.tokenId.toString());
    }
    this.memories.delete(key);
    this.saveIndex();
  }

  /**
   * Get memory count.
   */
  count(): number {
    return this.memories.size;
  }

  /**
   * Get all memory keys.
   */
  keys(): string[] {
    return Array.from(this.memories.keys());
  }

  /**
   * Get a summary of the agent's memory state.
   */
  summary(): {
    agentId: string;
    memoryCount: number;
    categories: Record<string, number>;
    topTags: string[];
    onChainCount: number;
    localOnlyCount: number;
  } {
    const allMemories = Array.from(this.memories.values());
    const categories: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    let onChain = 0;

    for (const m of allMemories) {
      categories[m.category] = (categories[m.category] ?? 0) + 1;
      if (m.tokenId !== null) onChain++;
      for (const t of m.tags) {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);

    return {
      agentId: this.agentId,
      memoryCount: allMemories.length,
      categories,
      topTags,
      onChainCount: onChain,
      localOnlyCount: allMemories.length - onChain,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadIndex(): void {
    if (fs.existsSync(INDEX_FILE)) {
      const raw = fs.readFileSync(INDEX_FILE, "utf-8");
      const data = JSON.parse(raw);

      if (data.memories) {
        for (const [key, value] of Object.entries(data.memories)) {
          const m = value as Memory;
          // Restore bigint
          if (m.tokenId !== null) {
            m.tokenId = BigInt(m.tokenId as unknown as string);
          }
          this.memories.set(key, m);
        }
      }

      if (data.tokenIndex) {
        for (const [tokenId, key] of Object.entries(data.tokenIndex)) {
          this.tokenIndex.set(tokenId, key as string);
        }
      }
    }
  }

  private saveIndex(): void {
    const memoriesObj: Record<string, Memory & { tokenId: string | null }> = {};
    for (const [key, memory] of this.memories) {
      memoriesObj[key] = {
        ...memory,
        tokenId: memory.tokenId !== null ? memory.tokenId.toString() : null,
      } as Memory & { tokenId: string | null };
    }

    const data = {
      agentId: this.agentId,
      lastSaved: new Date().toISOString(),
      memories: memoriesObj,
      tokenIndex: Object.fromEntries(this.tokenIndex),
    };

    fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));
  }
}
