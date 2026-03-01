/**
 * @file AgentMemory.ts
 * @description Complete agent brain management for the Inkd Protocol.
 *
 *              Every memory is inscribed on an InkdToken via InkdVault.
 *              Save, load, update, search, checkpoint, restore, export, import.
 *              Your wallet IS your brain.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Memory {
  tokenId: bigint | null;
  inscriptionIndex: number | null;
  key: string;
  data: unknown;
  tags: string[];
  category: MemoryCategory;
  importance: number;
  createdAt: string;
  updatedAt: string;
  arweaveHash: string | null;
  accessCount: number;
  version: number;
}

export type MemoryCategory =
  | "experience"
  | "skill"
  | "knowledge"
  | "preference"
  | "conversation"
  | "code"
  | "config"
  | "relationship"
  | "strategy"
  | "reflection";

export interface MemoryQuery {
  text?: string;
  tags?: string[];
  category?: MemoryCategory;
  minImportance?: number;
  limit?: number;
}

export interface BrainExport {
  agentId: string;
  exportedAt: string;
  memoryCount: number;
  categories: Record<string, number>;
  memories: Memory[];
  metadata: {
    totalAccessCount: number;
    oldestMemory: string;
    newestMemory: string;
    topTags: string[];
  };
}

export interface Checkpoint {
  id: string;
  label: string;
  createdAt: string;
  memoryCount: number;
  memories: Memory[];
  tokenId: bigint | null;
  inscriptionIndex: number | null;
}

export interface SaveOptions {
  category?: MemoryCategory;
  importance?: number;
}

// ─── SDK Interface ──────────────────────────────────────────────────────────

interface IInkdClient {
  inscribe(
    tokenId: bigint,
    data: Buffer | Uint8Array | string,
    options?: { contentType?: string; name?: string; value?: bigint }
  ): Promise<{ hash: `0x${string}`; inscriptionIndex: bigint; upload: { hash: string } }>;

  updateInscription(
    tokenId: bigint,
    index: number,
    newData: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<{ hash: `0x${string}` }>;

  getInscriptions(
    tokenId: bigint
  ): Promise<Array<{
    arweaveHash: string;
    contentType: string;
    size: bigint;
    name: string;
    createdAt: bigint;
    isRemoved: boolean;
    version: bigint;
  }>>;

  getToken(tokenId: bigint): Promise<{ tokenId: bigint; owner: `0x${string}` }>;
  getTokensByOwner(address: `0x${string}`): Promise<Array<{ tokenId: bigint }>>;
  hasInkdToken(address: `0x${string}`): Promise<boolean>;
}

interface IArweaveClient {
  downloadData(hash: string): Promise<Buffer>;
}

// ─── Agent Memory ───────────────────────────────────────────────────────────

export class AgentMemory {
  private agentId: string;
  private memories: Map<string, Memory> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();
  private client: IInkdClient | null = null;
  private arweave: IArweaveClient | null = null;
  private defaultTokenId: bigint | null = null;
  private dataDir: string;

  constructor(
    agentId: string,
    options?: {
      client?: IInkdClient;
      arweave?: IArweaveClient;
      defaultTokenId?: bigint;
      dataDir?: string;
    }
  ) {
    this.agentId = agentId;
    this.client = options?.client ?? null;
    this.arweave = options?.arweave ?? null;
    this.defaultTokenId = options?.defaultTokenId ?? null;
    this.dataDir = options?.dataDir ?? path.join(__dirname, "data");

    this.ensureDataDir();
    this.loadIndex();
  }

  /** Save a memory. Inscribes to InkdToken if client is connected. */
  async save(
    key: string,
    data: unknown,
    metadata?: { tags?: string[]; category?: MemoryCategory; importance?: number }
  ): Promise<{ tokenId: bigint | null; inscriptionIndex: number | null }> {
    const now = new Date().toISOString();
    const tags = metadata?.tags ?? [];
    const category = metadata?.category ?? "knowledge";
    const importance = metadata?.importance ?? 50;

    // Check if memory already exists (update instead)
    const existing = this.memories.get(key);
    if (existing) {
      return this.updateMemory(key, data);
    }

    const memory: Memory = {
      tokenId: this.defaultTokenId,
      inscriptionIndex: null,
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

    // Inscribe on-chain if client is connected
    if (this.client && this.defaultTokenId !== null) {
      const payload = JSON.stringify({
        agentId: this.agentId,
        key,
        data,
        tags,
        category,
        importance,
        version: 1,
        createdAt: now,
      });

      const result = await this.client.inscribe(this.defaultTokenId, payload, {
        contentType: "application/json",
        name: `memory:${key}`,
      });

      memory.inscriptionIndex = Number(result.inscriptionIndex);
      memory.arweaveHash = result.upload.hash;
    }

    this.memories.set(key, memory);
    this.saveIndex();

    return {
      tokenId: memory.tokenId,
      inscriptionIndex: memory.inscriptionIndex,
    };
  }

  /** Load a memory by tokenId and inscription index. */
  async load(tokenId: bigint, index: number): Promise<unknown | null> {
    // Check local first
    for (const memory of this.memories.values()) {
      if (
        memory.tokenId !== null &&
        memory.tokenId === tokenId &&
        memory.inscriptionIndex === index
      ) {
        memory.accessCount++;
        this.saveIndex();
        return memory.data;
      }
    }

    // Fetch from Arweave if available
    if (this.client && this.arweave) {
      const inscriptions = await this.client.getInscriptions(tokenId);
      if (index < inscriptions.length && !inscriptions[index].isRemoved) {
        const rawData = await this.arweave.downloadData(inscriptions[index].arweaveHash);
        const parsed = JSON.parse(rawData.toString());
        return parsed.data ?? parsed;
      }
    }

    return null;
  }

  /** Load a memory by key. */
  loadByKey(key: string): unknown | null {
    const memory = this.memories.get(key);
    if (memory) {
      memory.accessCount++;
      this.saveIndex();
      return memory.data;
    }
    return null;
  }

  /** Update an existing memory. Creates a new version on-chain. */
  async update(tokenId: bigint, index: number, newData: unknown): Promise<void> {
    // Find memory by tokenId + index
    for (const [key, memory] of this.memories) {
      if (memory.tokenId === tokenId && memory.inscriptionIndex === index) {
        await this.updateMemory(key, newData);
        return;
      }
    }
    throw new Error(`No memory found for tokenId ${tokenId} at index ${index}`);
  }

  /** Search memories by text, tags, category, or importance. */
  search(query: string | MemoryQuery, tags?: string[]): Memory[] {
    let q: MemoryQuery;
    if (typeof query === "string") {
      q = { text: query, tags };
    } else {
      q = query;
    }

    let results = Array.from(this.memories.values());

    if (q.category) {
      results = results.filter((m) => m.category === q.category);
    }

    if (q.tags && q.tags.length > 0) {
      results = results.filter((m) =>
        q.tags!.some((t) => m.tags.includes(t))
      );
    }

    if (q.minImportance !== undefined) {
      results = results.filter((m) => m.importance >= q.minImportance!);
    }

    if (q.text) {
      const lower = q.text.toLowerCase();
      results = results.filter((m) => {
        const keyMatch = m.key.toLowerCase().includes(lower);
        const dataMatch = JSON.stringify(m.data).toLowerCase().includes(lower);
        const tagMatch = m.tags.some((t) => t.toLowerCase().includes(lower));
        return keyMatch || dataMatch || tagMatch;
      });
    }

    results.sort((a, b) => {
      const scoreA = a.importance + a.accessCount * 2;
      const scoreB = b.importance + b.accessCount * 2;
      return scoreB - scoreA;
    });

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  /** Export the agent's entire brain. */
  exportBrain(tokenId?: bigint): BrainExport {
    let allMemories = Array.from(this.memories.values());

    if (tokenId !== undefined) {
      allMemories = allMemories.filter((m) => m.tokenId === tokenId);
    }

    const categories: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    let totalAccess = 0;

    for (const m of allMemories) {
      categories[m.category] = (categories[m.category] ?? 0) + 1;
      totalAccess += m.accessCount;
      for (const t of m.tags) {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
    }

    const sorted = [...allMemories].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

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
        totalAccessCount: totalAccess,
        oldestMemory: sorted[0]?.createdAt ?? "",
        newestMemory: sorted[sorted.length - 1]?.createdAt ?? "",
        topTags,
      },
    };
  }

  /** Import another agent's brain from their wallet. */
  async importBrain(tokenId: bigint, fromAddress: `0x${string}`): Promise<number> {
    if (!this.client || !this.arweave) {
      throw new Error("InkdClient and ArweaveClient required for importing.");
    }

    const inscriptions = await this.client.getInscriptions(tokenId);
    let imported = 0;

    for (let i = 0; i < inscriptions.length; i++) {
      const insc = inscriptions[i];
      if (insc.isRemoved) continue;

      try {
        const rawData = await this.arweave.downloadData(insc.arweaveHash);
        const parsed = JSON.parse(rawData.toString());

        const key = parsed.key ?? `imported-${tokenId}-${i}`;
        if (this.memories.has(key)) continue;

        const memory: Memory = {
          tokenId,
          inscriptionIndex: i,
          key,
          data: parsed.data ?? parsed,
          tags: parsed.tags ?? ["imported"],
          category: parsed.category ?? "knowledge",
          importance: parsed.importance ?? 30,
          createdAt: parsed.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          arweaveHash: insc.arweaveHash,
          accessCount: 0,
          version: parsed.version ?? 1,
        };

        this.memories.set(key, memory);
        imported++;
      } catch {
        continue;
      }
    }

    if (imported > 0) this.saveIndex();
    return imported;
  }

  /** Save a checkpoint of the current brain state. */
  async checkpoint(label: string): Promise<Checkpoint> {
    const allMemories = Array.from(this.memories.values());
    const now = new Date().toISOString();
    const id = `checkpoint-${Date.now()}`;

    const cp: Checkpoint = {
      id,
      label,
      createdAt: now,
      memoryCount: allMemories.length,
      memories: JSON.parse(JSON.stringify(allMemories, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      )),
      tokenId: null,
      inscriptionIndex: null,
    };

    // Optionally inscribe checkpoint on-chain
    if (this.client && this.defaultTokenId !== null) {
      const payload = JSON.stringify({
        type: "checkpoint",
        agentId: this.agentId,
        label,
        memoryCount: allMemories.length,
        createdAt: now,
        memoryKeys: allMemories.map((m) => m.key),
      });

      const result = await this.client.inscribe(this.defaultTokenId, payload, {
        contentType: "application/json",
        name: `checkpoint:${label}`,
      });

      cp.tokenId = this.defaultTokenId;
      cp.inscriptionIndex = Number(result.inscriptionIndex);
    }

    this.checkpoints.set(id, cp);
    this.saveCheckpoints();

    return cp;
  }

  /** Restore the brain to a previous checkpoint. */
  restore(checkpointId: string): void {
    const cp = this.checkpoints.get(checkpointId);
    if (!cp) {
      throw new Error(`Checkpoint "${checkpointId}" not found`);
    }

    // Clear current memories
    this.memories.clear();

    // Restore from checkpoint
    for (const memory of cp.memories) {
      // Restore bigints
      if (memory.tokenId !== null) {
        memory.tokenId = BigInt(memory.tokenId as unknown as string);
      }
      this.memories.set(memory.key, memory);
    }

    this.saveIndex();
  }

  /** Get all checkpoints. */
  getCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /** Get memory count. */
  count(): number {
    return this.memories.size;
  }

  /** Get all memory keys. */
  keys(): string[] {
    return Array.from(this.memories.keys());
  }

  /** Delete a memory by key. */
  delete(key: string): void {
    this.memories.delete(key);
    this.saveIndex();
  }

  /** Set the default token ID for inscriptions. */
  setDefaultTokenId(tokenId: bigint): void {
    this.defaultTokenId = tokenId;
  }

  /** Get agent summary. */
  summary(): {
    agentId: string;
    memoryCount: number;
    categories: Record<string, number>;
    topTags: string[];
    checkpointCount: number;
  } {
    const allMemories = Array.from(this.memories.values());
    const categories: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    for (const m of allMemories) {
      categories[m.category] = (categories[m.category] ?? 0) + 1;
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
      checkpointCount: this.checkpoints.size,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async updateMemory(
    key: string,
    newData: unknown
  ): Promise<{ tokenId: bigint | null; inscriptionIndex: number | null }> {
    const memory = this.memories.get(key);
    if (!memory) throw new Error(`Memory "${key}" not found`);

    memory.data = newData;
    memory.updatedAt = new Date().toISOString();
    memory.version++;

    if (this.client && memory.tokenId !== null && memory.inscriptionIndex !== null) {
      const payload = JSON.stringify({
        agentId: this.agentId,
        key,
        data: newData,
        tags: memory.tags,
        category: memory.category,
        importance: memory.importance,
        version: memory.version,
        updatedAt: memory.updatedAt,
      });

      await this.client.updateInscription(
        memory.tokenId,
        memory.inscriptionIndex,
        payload,
        "application/json"
      );
    }

    this.saveIndex();
    return { tokenId: memory.tokenId, inscriptionIndex: memory.inscriptionIndex };
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadIndex(): void {
    const indexPath = path.join(this.dataDir, "memory-index.json");
    if (!fs.existsSync(indexPath)) return;

    try {
      const raw = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      if (raw.memories) {
        for (const [key, value] of Object.entries(raw.memories)) {
          const m = value as Memory;
          if (m.tokenId !== null) {
            m.tokenId = BigInt(m.tokenId as unknown as string);
          }
          this.memories.set(key, m);
        }
      }
    } catch {
      // Start fresh
    }
  }

  private saveIndex(): void {
    const indexPath = path.join(this.dataDir, "memory-index.json");
    const memoriesObj: Record<string, unknown> = {};

    for (const [key, memory] of this.memories) {
      memoriesObj[key] = {
        ...memory,
        tokenId: memory.tokenId !== null ? memory.tokenId.toString() : null,
      };
    }

    fs.writeFileSync(indexPath, JSON.stringify({
      agentId: this.agentId,
      lastSaved: new Date().toISOString(),
      memories: memoriesObj,
    }, null, 2));
  }

  private saveCheckpoints(): void {
    const cpPath = path.join(this.dataDir, "checkpoints.json");
    const cpObj: Record<string, unknown> = {};

    for (const [id, cp] of this.checkpoints) {
      cpObj[id] = {
        ...cp,
        tokenId: cp.tokenId !== null ? cp.tokenId.toString() : null,
      };
    }

    fs.writeFileSync(cpPath, JSON.stringify(cpObj, null, 2));
  }
}
