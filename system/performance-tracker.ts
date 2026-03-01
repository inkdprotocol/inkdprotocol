/**
 * @file performance-tracker.ts
 * @description Tracks and analyzes X (Twitter) post performance for the Inkd Protocol.
 *              Logs every post, identifies top performers, and surfaces patterns
 *              that drive engagement.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Content categories for posts. */
export type PostType =
  | "build-update"
  | "education"
  | "milestone"
  | "ecosystem"
  | "thought-leadership"
  | "engagement"
  | "thread";

/** Format categories. */
export type PostFormat = "single" | "thread" | "quote-tweet" | "reply";

/** Raw post data as logged. */
export interface XPost {
  /** Unique post identifier (from X API). */
  id: string;
  /** Full post text. */
  text: string;
  /** Content category. */
  type: PostType;
  /** Post format. */
  format: PostFormat;
  /** ISO timestamp when posted. */
  postedAt: string;
  /** Day of week (0=Sunday). */
  dayOfWeek: number;
  /** Hour of day (0-23 UTC). */
  hourOfDay: number;
  /** Engagement metrics. */
  metrics: PostMetrics;
  /** Tags/topics covered. */
  tags: string[];
  /** Whether this was part of a thread. */
  threadId?: string;
}

/** Engagement metrics for a post. */
export interface PostMetrics {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  profileVisits: number;
  linkClicks: number;
}

/** Analyzed pattern from post history. */
export interface PerformancePattern {
  category: string;
  insight: string;
  confidence: number; // 0-100
  sampleSize: number;
  recommendation: string;
}

/** Weekly performance report. */
export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalPosts: number;
  totalImpressions: number;
  totalEngagements: number;
  avgEngagementRate: number;
  topPost: XPost | null;
  byType: Record<PostType, { count: number; avgEngagement: number }>;
  byFormat: Record<PostFormat, { count: number; avgEngagement: number }>;
  bestDay: string;
  bestHour: number;
  patterns: PerformancePattern[];
  growthVsLastWeek: number; // percentage
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "data");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

// ─── Performance Tracker ────────────────────────────────────────────────────

export class PerformanceTracker {
  private posts: XPost[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadPosts();
  }

  /**
   * Log a new X post with its metrics.
   * Call this after every post to build the performance dataset.
   */
  logPost(post: XPost): void {
    const existing = this.posts.findIndex((p) => p.id === post.id);
    if (existing >= 0) {
      // Update metrics for existing post
      this.posts[existing] = post;
    } else {
      this.posts.push(post);
    }
    this.savePosts();
  }

  /**
   * Update metrics for an existing post (e.g., after 24h check).
   */
  updateMetrics(postId: string, metrics: Partial<PostMetrics>): void {
    const post = this.posts.find((p) => p.id === postId);
    if (post) {
      post.metrics = { ...post.metrics, ...metrics };
      this.savePosts();
    }
  }

  /**
   * Get the top performing posts by engagement rate.
   * Engagement rate = (likes + retweets + replies + quotes) / impressions.
   */
  getTopPerforming(limit: number = 10): XPost[] {
    return [...this.posts]
      .filter((p) => p.metrics.impressions > 0)
      .sort((a, b) => this.engagementRate(b) - this.engagementRate(a))
      .slice(0, limit);
  }

  /**
   * Get posts by type, sorted by performance.
   */
  getByType(type: PostType): XPost[] {
    return this.posts
      .filter((p) => p.type === type)
      .sort((a, b) => this.engagementRate(b) - this.engagementRate(a));
  }

  /**
   * Analyze patterns across all posts.
   * Returns actionable insights about what works and what doesn't.
   */
  analyzePatterns(): PerformancePattern[] {
    const patterns: PerformancePattern[] = [];

    if (this.posts.length < 5) {
      return [
        {
          category: "data",
          insight: "Not enough data yet",
          confidence: 0,
          sampleSize: this.posts.length,
          recommendation: "Keep posting. Need at least 5 posts for analysis.",
        },
      ];
    }

    // Best content type
    const typePerformance = this.aggregateByType();
    const bestType = Object.entries(typePerformance).sort(
      ([, a], [, b]) => b.avgEngagement - a.avgEngagement
    )[0];
    if (bestType) {
      patterns.push({
        category: "content-type",
        insight: `"${bestType[0]}" posts perform best with ${bestType[1].avgEngagement.toFixed(1)}% avg engagement`,
        confidence: Math.min(bestType[1].count * 20, 100),
        sampleSize: bestType[1].count,
        recommendation: `Post more "${bestType[0]}" content.`,
      });
    }

    // Best format
    const formatPerformance = this.aggregateByFormat();
    const bestFormat = Object.entries(formatPerformance).sort(
      ([, a], [, b]) => b.avgEngagement - a.avgEngagement
    )[0];
    if (bestFormat) {
      patterns.push({
        category: "format",
        insight: `"${bestFormat[0]}" format gets ${bestFormat[1].avgEngagement.toFixed(1)}% avg engagement`,
        confidence: Math.min(bestFormat[1].count * 20, 100),
        sampleSize: bestFormat[1].count,
        recommendation: `Use "${bestFormat[0]}" format more often.`,
      });
    }

    // Best day of week
    const dayPerformance = this.aggregateByDay();
    const bestDay = Object.entries(dayPerformance).sort(
      ([, a], [, b]) => b - a
    )[0];
    if (bestDay) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      patterns.push({
        category: "timing-day",
        insight: `${dayNames[parseInt(bestDay[0])]} posts get highest engagement`,
        confidence: 60,
        sampleSize: this.posts.filter((p) => p.dayOfWeek === parseInt(bestDay[0])).length,
        recommendation: `Prioritize posting on ${dayNames[parseInt(bestDay[0])]}.`,
      });
    }

    // Best hour
    const hourPerformance = this.aggregateByHour();
    const bestHour = Object.entries(hourPerformance).sort(
      ([, a], [, b]) => b - a
    )[0];
    if (bestHour) {
      patterns.push({
        category: "timing-hour",
        insight: `Posts at ${bestHour[0]}:00 UTC perform best`,
        confidence: 50,
        sampleSize: this.posts.filter((p) => p.hourOfDay === parseInt(bestHour[0])).length,
        recommendation: `Schedule key posts around ${bestHour[0]}:00 UTC.`,
      });
    }

    // Text length analysis
    const shortPosts = this.posts.filter((p) => p.text.length < 140);
    const longPosts = this.posts.filter((p) => p.text.length >= 140);
    if (shortPosts.length > 0 && longPosts.length > 0) {
      const shortAvg = this.avgEngagement(shortPosts);
      const longAvg = this.avgEngagement(longPosts);
      const better = shortAvg > longAvg ? "shorter" : "longer";
      patterns.push({
        category: "length",
        insight: `${better === "shorter" ? "Short" : "Long"} posts (${better === "shorter" ? "<" : ">="}140 chars) perform ${Math.abs(shortAvg - longAvg).toFixed(1)}% better`,
        confidence: 55,
        sampleSize: this.posts.length,
        recommendation: `Write ${better} posts for higher engagement.`,
      });
    }

    return patterns;
  }

  /**
   * Generate a weekly performance report.
   */
  generateReport(): WeeklyReport {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const weekPosts = this.posts.filter(
      (p) => new Date(p.postedAt) >= weekStart && new Date(p.postedAt) <= now
    );

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    const prevWeekPosts = this.posts.filter(
      (p) => new Date(p.postedAt) >= prevWeekStart && new Date(p.postedAt) < weekStart
    );

    const totalImpressions = weekPosts.reduce((s, p) => s + p.metrics.impressions, 0);
    const totalEngagements = weekPosts.reduce(
      (s, p) =>
        s + p.metrics.likes + p.metrics.retweets + p.metrics.replies + p.metrics.quotes,
      0
    );

    const prevImpressions = prevWeekPosts.reduce((s, p) => s + p.metrics.impressions, 0);
    const growthVsLastWeek =
      prevImpressions > 0
        ? ((totalImpressions - prevImpressions) / prevImpressions) * 100
        : 0;

    const topPost =
      weekPosts.length > 0
        ? weekPosts.sort((a, b) => this.engagementRate(b) - this.engagementRate(a))[0]
        : null;

    // Aggregate by type
    const byType = {} as Record<PostType, { count: number; avgEngagement: number }>;
    const types: PostType[] = [
      "build-update", "education", "milestone", "ecosystem", "thought-leadership", "engagement", "thread",
    ];
    for (const t of types) {
      const typePosts = weekPosts.filter((p) => p.type === t);
      byType[t] = {
        count: typePosts.length,
        avgEngagement: typePosts.length > 0 ? this.avgEngagement(typePosts) : 0,
      };
    }

    // Aggregate by format
    const byFormat = {} as Record<PostFormat, { count: number; avgEngagement: number }>;
    const formats: PostFormat[] = ["single", "thread", "quote-tweet", "reply"];
    for (const f of formats) {
      const formatPosts = weekPosts.filter((p) => p.format === f);
      byFormat[f] = {
        count: formatPosts.length,
        avgEngagement: formatPosts.length > 0 ? this.avgEngagement(formatPosts) : 0,
      };
    }

    // Best day/hour
    const dayPerformance = this.aggregateByDay(weekPosts);
    const bestDayNum = Object.entries(dayPerformance).sort(([, a], [, b]) => b - a)[0];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const bestDay = bestDayNum ? dayNames[parseInt(bestDayNum[0])] : "N/A";

    const hourPerformance = this.aggregateByHour(weekPosts);
    const bestHourEntry = Object.entries(hourPerformance).sort(([, a], [, b]) => b - a)[0];
    const bestHour = bestHourEntry ? parseInt(bestHourEntry[0]) : 0;

    const report: WeeklyReport = {
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: now.toISOString().split("T")[0],
      totalPosts: weekPosts.length,
      totalImpressions,
      totalEngagements,
      avgEngagementRate:
        totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0,
      topPost,
      byType,
      byFormat,
      bestDay,
      bestHour,
      patterns: this.analyzePatterns(),
      growthVsLastWeek,
    };

    // Save report
    const reportFile = path.join(DATA_DIR, `report-${report.weekEnd}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Get all logged posts.
   */
  getAllPosts(): XPost[] {
    return [...this.posts];
  }

  /**
   * Get post count.
   */
  getPostCount(): number {
    return this.posts.length;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private engagementRate(post: XPost): number {
    if (post.metrics.impressions === 0) return 0;
    const engagements =
      post.metrics.likes +
      post.metrics.retweets +
      post.metrics.replies +
      post.metrics.quotes;
    return (engagements / post.metrics.impressions) * 100;
  }

  private avgEngagement(posts: XPost[]): number {
    if (posts.length === 0) return 0;
    return posts.reduce((s, p) => s + this.engagementRate(p), 0) / posts.length;
  }

  private aggregateByType(subset?: XPost[]): Record<string, { count: number; avgEngagement: number }> {
    const data = subset ?? this.posts;
    const grouped: Record<string, XPost[]> = {};
    for (const p of data) {
      if (!grouped[p.type]) grouped[p.type] = [];
      grouped[p.type].push(p);
    }
    const result: Record<string, { count: number; avgEngagement: number }> = {};
    for (const [type, posts] of Object.entries(grouped)) {
      result[type] = { count: posts.length, avgEngagement: this.avgEngagement(posts) };
    }
    return result;
  }

  private aggregateByFormat(subset?: XPost[]): Record<string, { count: number; avgEngagement: number }> {
    const data = subset ?? this.posts;
    const grouped: Record<string, XPost[]> = {};
    for (const p of data) {
      if (!grouped[p.format]) grouped[p.format] = [];
      grouped[p.format].push(p);
    }
    const result: Record<string, { count: number; avgEngagement: number }> = {};
    for (const [format, posts] of Object.entries(grouped)) {
      result[format] = { count: posts.length, avgEngagement: this.avgEngagement(posts) };
    }
    return result;
  }

  private aggregateByDay(subset?: XPost[]): Record<string, number> {
    const data = subset ?? this.posts;
    const result: Record<string, number[]> = {};
    for (const p of data) {
      const key = String(p.dayOfWeek);
      if (!result[key]) result[key] = [];
      result[key].push(this.engagementRate(p));
    }
    const avg: Record<string, number> = {};
    for (const [key, rates] of Object.entries(result)) {
      avg[key] = rates.reduce((s, r) => s + r, 0) / rates.length;
    }
    return avg;
  }

  private aggregateByHour(subset?: XPost[]): Record<string, number> {
    const data = subset ?? this.posts;
    const result: Record<string, number[]> = {};
    for (const p of data) {
      const key = String(p.hourOfDay);
      if (!result[key]) result[key] = [];
      result[key].push(this.engagementRate(p));
    }
    const avg: Record<string, number> = {};
    for (const [key, rates] of Object.entries(result)) {
      avg[key] = rates.reduce((s, r) => s + r, 0) / rates.length;
    }
    return avg;
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadPosts(): void {
    if (fs.existsSync(POSTS_FILE)) {
      const raw = fs.readFileSync(POSTS_FILE, "utf-8");
      this.posts = JSON.parse(raw);
    }
  }

  private savePosts(): void {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(this.posts, null, 2));
  }
}
