/**
 * @file trend-monitor.ts
 * @description Monitors trends in the AI agent and Web3 space.
 *              Identifies relevant topics, posts worth engaging with,
 *              and inspiration from top-performing accounts.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A trending topic or news item. */
export interface Trend {
  topic: string;
  source: string;
  relevanceScore: number; // 0-100
  timestamp: string;
  url?: string;
  summary: string;
}

/** A post worth engaging with. */
export interface EngagementTarget {
  author: string;
  text: string;
  url: string;
  relevanceScore: number;
  suggestedReply: string;
  tier: 1 | 2 | 3 | 4;
}

/** Inspiration post from a top account. */
export interface InspirationPost {
  author: string;
  text: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  format: string;
  whatMakesItGood: string;
  howToAdapt: string;
}

/** Scan results from a single monitoring run. */
export interface ScanResult {
  scanTime: string;
  trends: Trend[];
  engagementTargets: EngagementTarget[];
  inspiration: InspirationPost[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "data");
const SCANS_FILE = path.join(DATA_DIR, "trend-scans.json");

/** Keywords that indicate relevance to Inkd Protocol. */
const RELEVANCE_KEYWORDS = [
  "ai agent",
  "agent storage",
  "agent memory",
  "agent wallet",
  "agent autonomy",
  "autonomous agent",
  "decentralized storage",
  "on-chain data",
  "langchain",
  "autogpt",
  "crew ai",
  "ai x web3",
  "agent framework",
  "agent infrastructure",
  "base chain",
  "arweave",
  "lit protocol",
  "token gated",
  "data ownership",
  "ai ownership",
];

/** Search queries for trend monitoring. */
const SEARCH_QUERIES = [
  "AI agents web3 storage",
  "AI agent autonomy problem",
  "Base ecosystem news",
  "AI agent infrastructure",
  "decentralized AI storage",
  "LangChain AutoGPT news",
  "agent memory persistent",
  "AI agent wallet",
];

/** Accounts to monitor for engagement (by tier). */
const MONITORED_ACCOUNTS: Record<number, string[]> = {
  1: ["base", "ArweaveEco", "LitProtocol"],
  2: ["LangChainAI", "CrewAIInc", "AutoGPT"],
  3: ["jessepollak", "pmarca", "naval"],
  4: ["aixbt_agent", "truth_terminal", "0xzerebro", "clanker"],
};

/** Accounts to analyze for inspiration. */
const INSPIRATION_ACCOUNTS = [
  "Uniswap",
  "aikinetwork",
  "base",
  "aixbt_agent",
  "truth_terminal",
  "ArweaveEco",
  "LitProtocol",
];

// ─── Trend Monitor ──────────────────────────────────────────────────────────

export class TrendMonitor {
  private scans: ScanResult[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadScans();
  }

  /**
   * Get the latest trending topics in the AI agent / Web3 space.
   * In production, this queries web search APIs. Returns cached data
   * and search queries for manual/automated execution.
   *
   * @returns Array of relevant trends with scores.
   */
  getLatestTrends(): { trends: Trend[]; searchQueries: string[] } {
    const lastScan = this.scans[this.scans.length - 1];

    return {
      trends: lastScan?.trends ?? [],
      searchQueries: SEARCH_QUERIES,
    };
  }

  /**
   * Ingest raw search results and extract relevant trends.
   * Call this after running the SEARCH_QUERIES through a search API.
   *
   * @param results Raw search results (title, snippet, url).
   * @returns       Filtered and scored trends.
   */
  processTrends(
    results: Array<{ title: string; snippet: string; url: string; source: string }>
  ): Trend[] {
    const trends: Trend[] = [];

    for (const result of results) {
      const relevance = this.scoreRelevance(result.title + " " + result.snippet);
      if (relevance >= 30) {
        trends.push({
          topic: result.title,
          source: result.source,
          relevanceScore: relevance,
          timestamp: new Date().toISOString(),
          url: result.url,
          summary: result.snippet,
        });
      }
    }

    // Sort by relevance
    trends.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return trends;
  }

  /**
   * Find posts worth engaging with from monitored accounts.
   * Returns engagement targets with suggested reply angles.
   *
   * @returns Array of posts to engage with, sorted by priority.
   */
  findRelevantPosts(): {
    targets: EngagementTarget[];
    accountsToMonitor: Record<number, string[]>;
  } {
    const lastScan = this.scans[this.scans.length - 1];

    return {
      targets: lastScan?.engagementTargets ?? [],
      accountsToMonitor: MONITORED_ACCOUNTS,
    };
  }

  /**
   * Process posts from monitored accounts and generate engagement suggestions.
   *
   * @param posts Array of posts from monitored accounts.
   * @returns     Filtered engagement targets with suggested replies.
   */
  processEngagementTargets(
    posts: Array<{
      author: string;
      text: string;
      url: string;
    }>
  ): EngagementTarget[] {
    const targets: EngagementTarget[] = [];

    for (const post of posts) {
      const relevance = this.scoreRelevance(post.text);
      if (relevance < 20) continue;

      // Determine tier
      let tier: 1 | 2 | 3 | 4 = 4;
      for (const [t, accounts] of Object.entries(MONITORED_ACCOUNTS)) {
        if (accounts.includes(post.author)) {
          tier = parseInt(t) as 1 | 2 | 3 | 4;
          break;
        }
      }

      // Generate reply angle based on content
      const suggestedReply = this.generateReplyAngle(post.text);

      targets.push({
        author: post.author,
        text: post.text,
        url: post.url,
        relevanceScore: relevance,
        suggestedReply,
        tier,
      });
    }

    // Sort by tier (lower = higher priority), then relevance
    targets.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.relevanceScore - a.relevanceScore;
    });

    return targets;
  }

  /**
   * Analyze top-performing posts from inspiration accounts.
   * Extracts what makes them work and how to adapt for Inkd.
   *
   * @returns Inspiration data and accounts to analyze.
   */
  getInspirationFromTop(): {
    inspiration: InspirationPost[];
    accountsToAnalyze: string[];
  } {
    const lastScan = this.scans[this.scans.length - 1];

    return {
      inspiration: lastScan?.inspiration ?? [],
      accountsToAnalyze: INSPIRATION_ACCOUNTS,
    };
  }

  /**
   * Process top posts from inspiration accounts.
   *
   * @param posts Posts with their metrics and author info.
   * @returns     Analyzed inspiration posts.
   */
  processInspiration(
    posts: Array<{
      author: string;
      text: string;
      likes: number;
      retweets: number;
      replies: number;
    }>
  ): InspirationPost[] {
    return posts
      .filter((p) => p.likes > 50) // Only analyze posts with real engagement
      .map((p) => ({
        author: p.author,
        text: p.text,
        metrics: { likes: p.likes, retweets: p.retweets, replies: p.replies },
        format: this.detectFormat(p.text),
        whatMakesItGood: this.analyzeQuality(p.text, p.likes),
        howToAdapt: this.suggestAdaptation(p.text),
      }))
      .sort((a, b) => b.metrics.likes - a.metrics.likes);
  }

  /**
   * Save a complete scan result for historical tracking.
   */
  saveScan(result: ScanResult): void {
    this.scans.push(result);
    // Keep last 100 scans
    if (this.scans.length > 100) {
      this.scans = this.scans.slice(-100);
    }
    this.saveScans();
  }

  /**
   * Get scan history.
   */
  getScanHistory(): ScanResult[] {
    return [...this.scans];
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private scoreRelevance(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;
    let matches = 0;

    for (const keyword of RELEVANCE_KEYWORDS) {
      if (lower.includes(keyword)) {
        score += 15;
        matches++;
      }
    }

    // Bonus for multiple keyword matches
    if (matches >= 3) score += 20;
    if (matches >= 5) score += 15;

    return Math.min(score, 100);
  }

  private generateReplyAngle(postText: string): string {
    const lower = postText.toLowerCase();

    if (lower.includes("storage") || lower.includes("memory")) {
      return "Connect to Inkd's storage solution — wallet = brain. Mention specific feature.";
    }
    if (lower.includes("agent") && lower.includes("autonomous")) {
      return "Frame Inkd as the missing piece for true autonomy — agents need to own their data.";
    }
    if (lower.includes("base") || lower.includes("onchain")) {
      return "Position Inkd as building on Base. Reference specific contract features.";
    }
    if (lower.includes("ownership") || lower.includes("data")) {
      return "Highlight ERC-1155 ownership model — own the token, own the data.";
    }

    return "Engage with genuine insight about the intersection of AI agents and data ownership.";
  }

  private detectFormat(text: string): string {
    if (text.includes("🧵") || text.includes("thread")) return "thread";
    if (text.length < 100) return "short-punchy";
    if (text.includes("\n") && text.includes("→")) return "bullet-list";
    if (text.includes("\n")) return "multi-paragraph";
    return "single-paragraph";
  }

  private analyzeQuality(text: string, likes: number): string {
    const reasons: string[] = [];

    if (text.length < 150) reasons.push("Concise and punchy");
    if (text.includes("\n")) reasons.push("Good visual structure");
    if (text.includes("→") || text.includes("•")) reasons.push("Uses bullet points");
    if (likes > 500) reasons.push("Strong hook/opening line");
    if (/\d+/.test(text)) reasons.push("Includes specific numbers/data");

    return reasons.length > 0
      ? reasons.join(". ") + "."
      : "Strong topic relevance and timing.";
  }

  private suggestAdaptation(text: string): string {
    const lower = text.toLowerCase();

    if (lower.includes("shipped") || lower.includes("deployed") || lower.includes("launched")) {
      return "Mirror this build-in-public format for Inkd deploys and milestones.";
    }
    if (lower.includes("thread") || lower.includes("🧵")) {
      return "Create a similar educational thread explaining Inkd's approach.";
    }
    if (lower.includes("data") || lower.includes("stat")) {
      return "Share comparable testnet stats and metrics in the same format.";
    }

    return "Adapt the tone and structure for an Inkd-relevant topic.";
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadScans(): void {
    if (fs.existsSync(SCANS_FILE)) {
      const raw = fs.readFileSync(SCANS_FILE, "utf-8");
      this.scans = JSON.parse(raw);
    }
  }

  private saveScans(): void {
    fs.writeFileSync(SCANS_FILE, JSON.stringify(this.scans, null, 2));
  }
}
