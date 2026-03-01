/**
 * @file learning-engine.ts
 * @description Self-learning engine that analyzes post history, extracts patterns,
 *              and continuously improves content strategy. Updates X-STRATEGY.md
 *              with data-driven insights.
 */

import * as fs from "fs";
import * as path from "path";
import { PerformanceTracker, type XPost, type PerformancePattern } from "./performance-tracker";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A learned lesson from historical data. */
export interface Lesson {
  id: string;
  category: string;
  lesson: string;
  evidence: string;
  confidence: number; // 0-100
  learnedAt: string;
  appliedCount: number;
}

/** Strategy update recommendation. */
export interface StrategyUpdate {
  section: string;
  currentState: string;
  recommendation: string;
  basedOn: string[];
  priority: "high" | "medium" | "low";
}

/** Tweet score breakdown. */
export interface TweetScore {
  total: number; // 0-100
  breakdown: {
    length: number;
    format: number;
    timing: number;
    topicRelevance: number;
    callToAction: number;
  };
  suggestions: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "data");
const LESSONS_FILE = path.join(DATA_DIR, "lessons.json");
const STRATEGY_FILE = path.join(__dirname, "..", "X-STRATEGY.md");

// ─── Learning Engine ────────────────────────────────────────────────────────

export class LearningEngine {
  private tracker: PerformanceTracker;
  private lessons: Lesson[] = [];

  constructor(tracker?: PerformanceTracker) {
    this.tracker = tracker ?? new PerformanceTracker();
    this.ensureDataDir();
    this.loadLessons();
  }

  /**
   * Load full post history from the performance tracker.
   */
  loadHistory(): XPost[] {
    return this.tracker.getAllPosts();
  }

  /**
   * Extract lessons from historical performance data.
   * Identifies what works, what doesn't, and why.
   */
  extractLessons(): Lesson[] {
    const patterns = this.tracker.analyzePatterns();
    const topPosts = this.tracker.getTopPerforming(5);
    const allPosts = this.tracker.getAllPosts();
    const newLessons: Lesson[] = [];

    // Convert patterns to lessons
    for (const pattern of patterns) {
      if (pattern.confidence < 30) continue;

      const lessonId = `pattern-${pattern.category}-${Date.now()}`;
      const existing = this.lessons.find(
        (l) => l.category === pattern.category && l.lesson === pattern.insight
      );

      if (!existing) {
        newLessons.push({
          id: lessonId,
          category: pattern.category,
          lesson: pattern.insight,
          evidence: `Based on ${pattern.sampleSize} posts`,
          confidence: pattern.confidence,
          learnedAt: new Date().toISOString(),
          appliedCount: 0,
        });
      }
    }

    // Learn from top performers
    if (topPosts.length >= 3) {
      const avgLength = topPosts.reduce((s, p) => s + p.text.length, 0) / topPosts.length;
      const dominantType = this.mode(topPosts.map((p) => p.type));
      const dominantFormat = this.mode(topPosts.map((p) => p.format));

      const topInsight: Lesson = {
        id: `top-performers-${Date.now()}`,
        category: "top-performers",
        lesson: `Top posts average ${Math.round(avgLength)} chars, mostly "${dominantType}" type in "${dominantFormat}" format`,
        evidence: `Analyzed top ${topPosts.length} posts by engagement rate`,
        confidence: Math.min(topPosts.length * 15, 90),
        learnedAt: new Date().toISOString(),
        appliedCount: 0,
      };

      if (!this.lessons.find((l) => l.category === "top-performers")) {
        newLessons.push(topInsight);
      }
    }

    // Hashtag/tag analysis
    if (allPosts.length >= 5) {
      const tagPerformance: Record<string, number[]> = {};
      for (const post of allPosts) {
        const rate = this.engagementRate(post);
        for (const tag of post.tags) {
          if (!tagPerformance[tag]) tagPerformance[tag] = [];
          tagPerformance[tag].push(rate);
        }
      }

      const bestTag = Object.entries(tagPerformance)
        .filter(([, rates]) => rates.length >= 2)
        .sort(([, a], [, b]) => {
          const avgA = a.reduce((s, r) => s + r, 0) / a.length;
          const avgB = b.reduce((s, r) => s + r, 0) / b.length;
          return avgB - avgA;
        })[0];

      if (bestTag) {
        const avgRate = bestTag[1].reduce((s, r) => s + r, 0) / bestTag[1].length;
        newLessons.push({
          id: `tag-${bestTag[0]}-${Date.now()}`,
          category: "tags",
          lesson: `Posts tagged "${bestTag[0]}" average ${avgRate.toFixed(1)}% engagement`,
          evidence: `Based on ${bestTag[1].length} posts with this tag`,
          confidence: Math.min(bestTag[1].length * 20, 85),
          learnedAt: new Date().toISOString(),
          appliedCount: 0,
        });
      }
    }

    // Store new lessons
    this.lessons.push(...newLessons);
    this.saveLessons();

    return newLessons;
  }

  /**
   * Update X-STRATEGY.md with learned insights.
   */
  updateStrategy(lessons: Lesson[]): StrategyUpdate[] {
    const updates: StrategyUpdate[] = [];

    const highConfidence = lessons.filter((l) => l.confidence >= 60);

    if (highConfidence.length === 0) {
      return updates;
    }

    // Build strategy additions
    const strategyAdditions: string[] = [
      "",
      "---",
      "",
      "## Data-Driven Insights (Auto-Updated)",
      "",
      `*Last updated: ${new Date().toISOString().split("T")[0]}*`,
      "",
    ];

    for (const lesson of highConfidence) {
      strategyAdditions.push(`### ${lesson.category}`);
      strategyAdditions.push(`- **Insight**: ${lesson.lesson}`);
      strategyAdditions.push(`- **Confidence**: ${lesson.confidence}%`);
      strategyAdditions.push(`- **Evidence**: ${lesson.evidence}`);
      strategyAdditions.push("");

      updates.push({
        section: lesson.category,
        currentState: "No data-driven insight",
        recommendation: lesson.lesson,
        basedOn: [lesson.evidence],
        priority: lesson.confidence >= 80 ? "high" : lesson.confidence >= 50 ? "medium" : "low",
      });
    }

    // Append to strategy file
    if (fs.existsSync(STRATEGY_FILE)) {
      let content = fs.readFileSync(STRATEGY_FILE, "utf-8");

      // Remove old auto-generated section if exists
      const marker = "## Data-Driven Insights (Auto-Updated)";
      const markerIndex = content.indexOf(marker);
      if (markerIndex >= 0) {
        // Find the separator before it
        const sepBefore = content.lastIndexOf("---", markerIndex);
        if (sepBefore >= 0) {
          content = content.substring(0, sepBefore).trimEnd();
        }
      }

      content += "\n" + strategyAdditions.join("\n");
      fs.writeFileSync(STRATEGY_FILE, content);
    }

    return updates;
  }

  /**
   * Score a tweet draft before posting. Predicts engagement based on learned patterns.
   *
   * @param text  Tweet text to score.
   * @returns     Score 0-100 with breakdown and improvement suggestions.
   */
  scoreTweet(text: string): TweetScore {
    const suggestions: string[] = [];
    let lengthScore = 0;
    let formatScore = 0;
    let timingScore = 50; // Default, no timing info for a draft
    let topicScore = 0;
    let ctaScore = 0;

    // Length scoring (based on learned optimal lengths or defaults)
    const len = text.length;
    if (len >= 80 && len <= 200) {
      lengthScore = 90;
    } else if (len >= 40 && len <= 280) {
      lengthScore = 70;
    } else if (len < 40) {
      lengthScore = 40;
      suggestions.push("Tweet is very short. Add more substance.");
    } else {
      lengthScore = 60;
    }

    // Format scoring
    const hasEmoji = /[\p{Emoji}]/u.test(text);
    const hasThread = text.includes("🧵") || text.toLowerCase().includes("thread");
    const hasNewlines = text.includes("\n");
    const hasBullets = text.includes("→") || text.includes("•") || text.includes("-");

    if (hasNewlines && hasBullets) {
      formatScore = 85;
    } else if (hasNewlines) {
      formatScore = 75;
    } else if (hasBullets) {
      formatScore = 70;
    } else {
      formatScore = 50;
      suggestions.push("Use line breaks and bullet points (→) for better readability.");
    }

    if (hasThread) formatScore = Math.min(formatScore + 10, 100);
    if (hasEmoji) formatScore = Math.min(formatScore + 5, 100);

    // Topic relevance scoring (keywords that our audience cares about)
    const relevantKeywords = [
      "agent", "wallet", "token", "mint", "burn", "ownership",
      "storage", "arweave", "base", "autonomous", "ai", "memory",
      "decentralized", "protocol", "data", "on-chain",
    ];
    const lowercaseText = text.toLowerCase();
    const matches = relevantKeywords.filter((k) => lowercaseText.includes(k));
    topicScore = Math.min(matches.length * 15, 100);

    if (matches.length === 0) {
      suggestions.push("Include relevant keywords (agent, wallet, token, ownership, etc.).");
    }

    // Call to action scoring
    const ctaPatterns = [
      "try it", "check it", "link in", "what do you think",
      "thread", "🧵", "here's how", "here's why", "let me explain",
    ];
    const hasCTA = ctaPatterns.some((p) => lowercaseText.includes(p));
    ctaScore = hasCTA ? 80 : 30;
    if (!hasCTA) {
      suggestions.push("Add a call to action (e.g., 'Here\\'s why 🧵' or 'Try it:').");
    }

    // Avoid anti-patterns
    const antiPatterns = ["gm", "wagmi", "lfg", "🚀🚀🚀", "big things coming"];
    const hasAntiPattern = antiPatterns.some((p) => lowercaseText.includes(p));
    if (hasAntiPattern) {
      suggestions.push("Avoid 2021 crypto speak (gm, wagmi, LFG). Be concrete.");
      formatScore = Math.max(formatScore - 20, 0);
    }

    const total = Math.round(
      lengthScore * 0.15 +
        formatScore * 0.25 +
        timingScore * 0.1 +
        topicScore * 0.3 +
        ctaScore * 0.2
    );

    return {
      total,
      breakdown: {
        length: lengthScore,
        format: formatScore,
        timing: timingScore,
        topicRelevance: topicScore,
        callToAction: ctaScore,
      },
      suggestions,
    };
  }

  /**
   * Get all stored lessons.
   */
  getLessons(): Lesson[] {
    return [...this.lessons];
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private engagementRate(post: XPost): number {
    if (post.metrics.impressions === 0) return 0;
    const engagements =
      post.metrics.likes + post.metrics.retweets + post.metrics.replies + post.metrics.quotes;
    return (engagements / post.metrics.impressions) * 100;
  }

  private mode(arr: string[]): string {
    const counts: Record<string, number> = {};
    for (const item of arr) {
      counts[item] = (counts[item] ?? 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadLessons(): void {
    if (fs.existsSync(LESSONS_FILE)) {
      const raw = fs.readFileSync(LESSONS_FILE, "utf-8");
      this.lessons = JSON.parse(raw);
    }
  }

  private saveLessons(): void {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(this.lessons, null, 2));
  }
}
