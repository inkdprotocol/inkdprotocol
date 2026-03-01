/**
 * @file InkdBrain.ts
 * @description Master controller for the Inkd Protocol self-learning X system.
 *              Orchestrates 12-hour cycles: scan trends -> analyze -> generate content -> post.
 *              Learns from what works, kills what doesn't.
 */

import * as fs from "fs";
import * as path from "path";
import { ContentEngine, type GeneratedTweet, type GeneratedThread } from "./ContentEngine";
import { TrendMonitor, type ScanResult } from "./TrendMonitor";
import { LearningLoop, type CycleData, type PostRecord, type Lesson, type StrategyUpdate } from "./LearningLoop";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BrainConfig {
  cycleIntervalMs: number; // Default: 12 hours
  minPostScore: number;    // Only post if score > this (default: 70)
  maxPostsPerCycle: number;
  dataDir: string;
  competitorAccounts: string[];
  autoPost: boolean;       // Whether to auto-post or just generate
}

export interface BrainState {
  totalCycles: number;
  totalPostsGenerated: number;
  totalPostsPublished: number;
  averageScore: number;
  lastCycleAt: string | null;
  nextCycleAt: string | null;
  topPerformingCategory: string | null;
  isRunning: boolean;
}

export interface CycleResult {
  cycleNumber: number;
  scanResult: ScanResult;
  generatedPosts: GeneratedTweet[];
  approvedPosts: GeneratedTweet[];
  rejectedPosts: GeneratedTweet[];
  lessons: Lesson[];
  strategyUpdates: StrategyUpdate[];
  duration: number;
  timestamp: string;
}

// ─── Brain ──────────────────────────────────────────────────────────────────

export class InkdBrain {
  private config: BrainConfig;
  private contentEngine: ContentEngine;
  private trendMonitor: TrendMonitor;
  private learningLoop: LearningLoop;
  private state: BrainState;
  private cycleTimer: NodeJS.Timeout | null = null;
  private memory: Map<string, unknown> = new Map();

  constructor(config?: Partial<BrainConfig>) {
    this.config = {
      cycleIntervalMs: 12 * 60 * 60 * 1000, // 12 hours
      minPostScore: 70,
      maxPostsPerCycle: 3,
      dataDir: path.join(__dirname, "data"),
      competitorAccounts: ["base", "Uniswap", "aixbt_agent", "LitProtocol"],
      autoPost: false,
      ...config,
    };

    this.contentEngine = new ContentEngine();
    this.trendMonitor = new TrendMonitor({
      dataDir: path.join(this.config.dataDir, "trends"),
    });
    this.learningLoop = new LearningLoop(
      path.join(this.config.dataDir, "cycles")
    );

    this.state = {
      totalCycles: this.learningLoop.getCycleCount(),
      totalPostsGenerated: 0,
      totalPostsPublished: 0,
      averageScore: 0,
      lastCycleAt: null,
      nextCycleAt: null,
      topPerformingCategory: null,
      isRunning: false,
    };

    this.ensureDataDir();
    this.loadMemory();
  }

  /** Start the 12-hour cycle loop. */
  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.nextCycleAt = new Date(
      Date.now() + this.config.cycleIntervalMs
    ).toISOString();

    // Run first cycle immediately
    this.runCycle().catch(console.error);

    // Schedule recurring cycles
    this.cycleTimer = setInterval(() => {
      this.runCycle().catch(console.error);
    }, this.config.cycleIntervalMs);
  }

  /** Stop the cycle loop. */
  stop(): void {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    this.state.isRunning = false;
    this.state.nextCycleAt = null;
    this.saveMemory();
  }

  /** Run a single cycle manually. */
  async runCycle(): Promise<CycleResult> {
    const startTime = Date.now();
    const cycleNumber = this.state.totalCycles + 1;

    // ─── Phase 1: SCAN ─────────────────────────────────────────────────

    const scanResult = await this.trendMonitor.fullScan();

    // ─── Phase 2: ANALYZE ──────────────────────────────────────────────

    const patterns = this.learningLoop.extractPatterns(10);
    const narratives = scanResult.narratives
      .filter((n) => n.relevanceToInkd >= 70)
      .slice(0, 3);

    // ─── Phase 3: GENERATE ─────────────────────────────────────────────

    const generatedPosts: GeneratedTweet[] = [];

    // Generate build updates
    const buildUpdate = this.contentEngine.generateBuildUpdate(
      "Inkd Protocol: building the ownership layer for AI agents",
      ["InkdToken ERC-721", "InkdVault inscription engine", "Full TypeScript SDK"]
    );
    generatedPosts.push(buildUpdate);

    // Generate ecosystem responses based on trends
    for (const narrative of narratives) {
      const response = this.contentEngine.generateEcosystemResponse(
        scanResult.competitorInsights[0]?.account ?? "base",
        narrative.topic
      );
      generatedPosts.push(response);
    }

    // Generate educational content
    if (patterns.topPerformingCategories.some((c) => c.category === "education")) {
      const thread = this.contentEngine.generateThread(
        narratives[0]?.topic ?? "agent data ownership"
      );
      generatedPosts.push({
        text: thread.tweets[0],
        category: "education",
        score: thread.score,
        reasoning: "educational thread opener",
        tags: ["education", "thread"],
        createdAt: new Date().toISOString(),
      });
    }

    // ─── Phase 4: SCORE & FILTER ───────────────────────────────────────

    // Improve all posts
    for (const post of generatedPosts) {
      post.text = this.contentEngine.improveUntilScore(
        post.text,
        this.config.minPostScore
      );
      const rescore = this.contentEngine.scoreTweet(post.text);
      post.score = rescore.score;
      post.reasoning = rescore.reasoning;
    }

    // Split into approved (>= minPostScore) and rejected
    const approvedPosts = generatedPosts
      .filter((p) => p.score >= this.config.minPostScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxPostsPerCycle);

    const rejectedPosts = generatedPosts.filter(
      (p) => p.score < this.config.minPostScore
    );

    // ─── Phase 5: LEARN ────────────────────────────────────────────────

    const lessons: Lesson[] = [];

    // Learn from this cycle
    if (approvedPosts.length > 0) {
      const topPost = approvedPosts[0];
      lessons.push({
        id: `lesson-${cycleNumber}-1`,
        category: topPost.category,
        insight: `"${topPost.category}" content scoring ${topPost.score} — format and keywords work`,
        confidence: Math.min(topPost.score, 85),
        evidence: [topPost.text.substring(0, 100)],
        learnedAt: new Date().toISOString(),
        applied: false,
      });
    }

    if (rejectedPosts.length > 0) {
      lessons.push({
        id: `lesson-${cycleNumber}-2`,
        category: "quality",
        insight: `${rejectedPosts.length} posts rejected (below score ${this.config.minPostScore}) — need better ${rejectedPosts.map((p) => p.category).join(", ")} templates`,
        confidence: 70,
        evidence: rejectedPosts.map((p) => `${p.category}: score ${p.score}`),
        learnedAt: new Date().toISOString(),
        applied: false,
      });
    }

    // Apply lessons to strategy
    const strategyUpdates = this.learningLoop.updateVoice(lessons);

    // ─── Phase 6: RECORD ───────────────────────────────────────────────

    const postRecords: PostRecord[] = generatedPosts.map((p) => ({
      text: p.text,
      category: p.category,
      score: p.score,
      posted: approvedPosts.includes(p),
    }));

    this.learningLoop.saveCycle({
      timestamp: new Date().toISOString(),
      postsGenerated: postRecords,
      trendsDetected: scanResult.narratives.map((n) => n.topic),
      lessonsLearned: lessons,
      strategyUpdates,
      duration: Date.now() - startTime,
    });

    // Check for strategy review (every 30 cycles)
    this.learningLoop.fullStrategyReview();

    // ─── Update State ──────────────────────────────────────────────────

    this.state.totalCycles = cycleNumber;
    this.state.totalPostsGenerated += generatedPosts.length;
    this.state.totalPostsPublished += approvedPosts.length;
    this.state.lastCycleAt = new Date().toISOString();
    this.state.nextCycleAt = new Date(
      Date.now() + this.config.cycleIntervalMs
    ).toISOString();

    // Update average score
    const allScores = generatedPosts.map((p) => p.score);
    if (allScores.length > 0) {
      this.state.averageScore =
        allScores.reduce((a, b) => a + b, 0) / allScores.length;
    }

    // Update top performing category
    const patterns2 = this.learningLoop.extractPatterns();
    if (patterns2.topPerformingCategories.length > 0) {
      this.state.topPerformingCategory = patterns2.topPerformingCategories[0].category;
    }

    this.saveMemory();

    const result: CycleResult = {
      cycleNumber,
      scanResult,
      generatedPosts,
      approvedPosts,
      rejectedPosts,
      lessons,
      strategyUpdates,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    return result;
  }

  /** Get current brain state. */
  getState(): BrainState {
    return { ...this.state };
  }

  /** Get the content engine for direct manipulation. */
  getContentEngine(): ContentEngine {
    return this.contentEngine;
  }

  /** Get the trend monitor. */
  getTrendMonitor(): TrendMonitor {
    return this.trendMonitor;
  }

  /** Get the learning loop. */
  getLearningLoop(): LearningLoop {
    return this.learningLoop;
  }

  /** Generate a one-off tweet without running a full cycle. */
  generateTweet(type: "build-update" | "education" | "milestone" | "ecosystem", context: string): GeneratedTweet {
    switch (type) {
      case "build-update":
        return this.contentEngine.generateBuildUpdate(context);
      case "milestone":
        return this.contentEngine.generateMilestonePost(context);
      case "ecosystem":
        return this.contentEngine.generateEcosystemResponse("base", context);
      case "education":
      default: {
        const thread = this.contentEngine.generateThread(context, 1);
        return {
          text: thread.tweets[0],
          category: "education",
          score: thread.score,
          reasoning: "single education post",
          tags: ["education"],
          createdAt: new Date().toISOString(),
        };
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private ensureDataDir(): void {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }
  }

  private saveMemory(): void {
    const memoryPath = path.join(this.config.dataDir, "brain-state.json");
    const memoryData = {
      state: this.state,
      memory: Object.fromEntries(this.memory),
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(memoryPath, JSON.stringify(memoryData, null, 2));
  }

  private loadMemory(): void {
    const memoryPath = path.join(this.config.dataDir, "brain-state.json");
    if (!fs.existsSync(memoryPath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(memoryPath, "utf-8"));
      if (data.state) {
        this.state = { ...this.state, ...data.state, isRunning: false };
      }
      if (data.memory) {
        this.memory = new Map(Object.entries(data.memory));
      }
    } catch {
      // Start fresh if corrupt
    }
  }
}
