/**
 * @file TrendMonitor.ts
 * @description Intelligence gathering system for Inkd Protocol X strategy.
 *              Monitors keywords, competitor accounts, and emerging narratives.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrendResult {
  keyword: string;
  mentions: number;
  sentiment: "positive" | "neutral" | "negative";
  samplePosts: string[];
  detectedAt: string;
}

export interface AccountActivity {
  account: string;
  recentPosts: AccountPost[];
  engagementRate: number;
  topTopics: string[];
  lastChecked: string;
}

export interface AccountPost {
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  timestamp: string;
  url?: string;
}

export interface EmergingNarrative {
  topic: string;
  momentum: number; // 0-100
  relatedKeywords: string[];
  topPosts: string[];
  relevanceToInkd: number; // 0-100
  detectedAt: string;
}

export interface CompetitorInsight {
  account: string;
  strategy: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  analyzedAt: string;
}

export interface ScanResult {
  trends: TrendResult[];
  accountActivity: AccountActivity[];
  narratives: EmergingNarrative[];
  competitorInsights: CompetitorInsight[];
  scanDuration: number;
  timestamp: string;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_KEYWORDS = [
  "AI agent storage",
  "agent wallet",
  "Base ecosystem",
  "decentralized storage agent",
  "LangChain memory",
  "agent autonomy",
  "on-chain AI",
  "agent-to-agent",
  "AI ownership",
  "autonomous agent",
];

const DEFAULT_ACCOUNTS = [
  "base",
  "Uniswap",
  "aixbt_agent",
  "LitProtocol",
  "ArweaveEco",
  "iraboraofficial",
  "coinaborations",
];

// ─── Monitor ────────────────────────────────────────────────────────────────

export class TrendMonitor {
  private keywords: string[];
  private accounts: string[];
  private dataDir: string;
  private scanHistory: ScanResult[] = [];

  constructor(options?: {
    keywords?: string[];
    accounts?: string[];
    dataDir?: string;
  }) {
    this.keywords = options?.keywords ?? DEFAULT_KEYWORDS;
    this.accounts = options?.accounts ?? DEFAULT_ACCOUNTS;
    this.dataDir = options?.dataDir ?? path.join(__dirname, "data", "trends");

    this.ensureDataDir();
    this.loadHistory();
  }

  /** Scan all monitored keywords for trends. */
  async scanKeywords(keywords?: string[]): Promise<TrendResult[]> {
    const scanTargets = keywords ?? this.keywords;
    const results: TrendResult[] = [];

    for (const keyword of scanTargets) {
      const result: TrendResult = {
        keyword,
        mentions: 0,
        sentiment: "neutral",
        samplePosts: [],
        detectedAt: new Date().toISOString(),
      };

      // In production, this would call the X API.
      // For now, we track what we'd search for.
      result.mentions = this.estimateMentions(keyword);
      result.sentiment = this.estimateSentiment(keyword);

      results.push(result);
    }

    return results;
  }

  /** Get recent posts from monitored accounts. */
  async getTopAccountPosts(accounts?: string[]): Promise<AccountActivity[]> {
    const targets = accounts ?? this.accounts;
    const activities: AccountActivity[] = [];

    for (const account of targets) {
      const activity: AccountActivity = {
        account,
        recentPosts: [],
        engagementRate: 0,
        topTopics: this.inferTopics(account),
        lastChecked: new Date().toISOString(),
      };

      // In production: call X API for recent posts
      // activity.recentPosts = await this.fetchAccountPosts(account);

      activities.push(activity);
    }

    return activities;
  }

  /** Detect emerging narratives in the AI/Web3 space. */
  async detectEmergingNarrative(): Promise<EmergingNarrative[]> {
    const narratives: EmergingNarrative[] = [];

    // Narrative detection based on keyword co-occurrence and momentum
    const potentialNarratives = [
      {
        topic: "AI agents need sovereign data",
        relatedKeywords: ["agent autonomy", "on-chain AI", "agent wallet"],
        relevance: 95,
      },
      {
        topic: "Decentralized agent memory",
        relatedKeywords: ["LangChain memory", "agent storage", "persistent agents"],
        relevance: 90,
      },
      {
        topic: "Agent-to-agent economy",
        relatedKeywords: ["agent marketplace", "AI trading", "autonomous agents"],
        relevance: 85,
      },
      {
        topic: "Base ecosystem growth",
        relatedKeywords: ["Base chain", "L2 adoption", "Base dApps"],
        relevance: 75,
      },
    ];

    for (const narrative of potentialNarratives) {
      const momentum = this.calculateMomentum(narrative.relatedKeywords);

      narratives.push({
        topic: narrative.topic,
        momentum,
        relatedKeywords: narrative.relatedKeywords,
        topPosts: [],
        relevanceToInkd: narrative.relevance,
        detectedAt: new Date().toISOString(),
      });
    }

    // Sort by momentum * relevance
    narratives.sort((a, b) =>
      (b.momentum * b.relevanceToInkd) - (a.momentum * a.relevanceToInkd)
    );

    return narratives;
  }

  /** Analyze competitor accounts for strategy insights. */
  async competitorAnalysis(): Promise<CompetitorInsight[]> {
    const insights: CompetitorInsight[] = [];

    const competitors: Record<string, { strengths: string[]; weaknesses: string[]; opportunities: string[] }> = {
      "base": {
        strengths: ["massive ecosystem", "Coinbase backing", "developer tools"],
        weaknesses: ["too broad focus", "corporate feel"],
        opportunities: ["position inkd as THE agent infra on Base"],
      },
      "LitProtocol": {
        strengths: ["encryption expertise", "access control"],
        weaknesses: ["complex integration", "not agent-focused"],
        opportunities: ["integrate Lit for V2 encryption, credit them"],
      },
      "ArweaveEco": {
        strengths: ["permanent storage", "established ecosystem"],
        weaknesses: ["not agent-specific", "developer friction"],
        opportunities: ["use Arweave as storage layer, build agent UX on top"],
      },
      "aixbt_agent": {
        strengths: ["strong community", "AI narrative", "high engagement"],
        weaknesses: ["speculation-focused", "no real infrastructure"],
        opportunities: ["engage their community, show real infra vs hype"],
      },
    };

    for (const [account, analysis] of Object.entries(competitors)) {
      insights.push({
        account,
        strategy: `${account} focuses on ${analysis.strengths[0]}`,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        opportunities: analysis.opportunities,
        analyzedAt: new Date().toISOString(),
      });
    }

    return insights;
  }

  /** Run a full scan cycle. */
  async fullScan(): Promise<ScanResult> {
    const startTime = Date.now();

    const [trends, accountActivity, narratives, competitorInsights] = await Promise.all([
      this.scanKeywords(),
      this.getTopAccountPosts(),
      this.detectEmergingNarrative(),
      this.competitorAnalysis(),
    ]);

    const result: ScanResult = {
      trends,
      accountActivity,
      narratives,
      competitorInsights,
      scanDuration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    this.scanHistory.push(result);
    this.saveScanResult(result);

    return result;
  }

  /** Get the last N scan results. */
  getRecentScans(n: number = 5): ScanResult[] {
    return this.scanHistory.slice(-n);
  }

  /** Add keywords to monitor. */
  addKeywords(keywords: string[]): void {
    for (const kw of keywords) {
      if (!this.keywords.includes(kw)) {
        this.keywords.push(kw);
      }
    }
  }

  /** Add accounts to monitor. */
  addAccounts(accounts: string[]): void {
    for (const acct of accounts) {
      if (!this.accounts.includes(acct)) {
        this.accounts.push(acct);
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private estimateMentions(keyword: string): number {
    // Rough heuristic based on keyword popularity
    const highVolume = ["AI", "agent", "Base", "Web3"];
    const medVolume = ["decentralized", "autonomous", "wallet"];
    const words = keyword.toLowerCase().split(" ");

    let base = 10;
    for (const w of words) {
      if (highVolume.some((h) => h.toLowerCase() === w)) base += 50;
      if (medVolume.some((m) => m.toLowerCase() === w)) base += 20;
    }

    return base + Math.floor(Math.random() * 30);
  }

  private estimateSentiment(keyword: string): "positive" | "neutral" | "negative" {
    const positiveWords = ["autonomy", "ownership", "decentralized", "innovation"];
    const lower = keyword.toLowerCase();
    if (positiveWords.some((w) => lower.includes(w))) return "positive";
    return "neutral";
  }

  private inferTopics(account: string): string[] {
    const topicMap: Record<string, string[]> = {
      base: ["L2", "ecosystem", "developer tools", "DeFi"],
      Uniswap: ["DEX", "DeFi", "liquidity", "governance"],
      aixbt_agent: ["AI agents", "trading", "alpha", "speculation"],
      LitProtocol: ["encryption", "access control", "privacy", "threshold cryptography"],
      ArweaveEco: ["permanent storage", "data ownership", "SPoRA"],
    };

    return topicMap[account] ?? ["Web3", "crypto"];
  }

  private calculateMomentum(keywords: string[]): number {
    // Simplified momentum calculation
    let momentum = 50;
    for (const kw of keywords) {
      const mentions = this.estimateMentions(kw);
      if (mentions > 50) momentum += 10;
      if (mentions > 100) momentum += 10;
    }
    return Math.min(100, momentum);
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private saveScanResult(result: ScanResult): void {
    const filename = `scan-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const filepath = path.join(this.dataDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  }

  private loadHistory(): void {
    if (!fs.existsSync(this.dataDir)) return;

    const files = fs.readdirSync(this.dataDir)
      .filter((f) => f.startsWith("scan-") && f.endsWith(".json"))
      .sort()
      .slice(-10); // Keep last 10

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), "utf-8"));
        this.scanHistory.push(data as ScanResult);
      } catch {
        // Skip corrupt files
      }
    }
  }
}
