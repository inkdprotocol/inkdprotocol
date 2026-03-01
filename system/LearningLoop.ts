/**
 * @file LearningLoop.ts
 * @description Self-improvement system that extracts patterns from past performance
 *              and continuously updates strategy, voice, and content approach.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CycleData {
  id: string;
  timestamp: string;
  postsGenerated: PostRecord[];
  trendsDetected: string[];
  lessonsLearned: Lesson[];
  strategyUpdates: StrategyUpdate[];
  cycleNumber: number;
  duration: number;
}

export interface PostRecord {
  text: string;
  category: string;
  score: number;
  posted: boolean;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
}

export interface Lesson {
  id: string;
  category: string;
  insight: string;
  confidence: number; // 0-100
  evidence: string[];
  learnedAt: string;
  applied: boolean;
}

export interface StrategyUpdate {
  type: "voice" | "timing" | "content" | "engagement" | "format";
  description: string;
  oldValue: string;
  newValue: string;
  reason: string;
  appliedAt: string;
}

export interface PatternAnalysis {
  topPerformingCategories: Array<{ category: string; avgScore: number }>;
  bestPostingTimes: string[];
  effectiveKeywords: string[];
  underperformingFormats: string[];
  audiencePreferences: string[];
}

export interface StrategyReview {
  reviewNumber: number;
  cyclesAnalyzed: number;
  keyFindings: string[];
  majorChanges: StrategyUpdate[];
  nextFocus: string[];
  reviewedAt: string;
}

// ─── Learning Loop ──────────────────────────────────────────────────────────

export class LearningLoop {
  private dataDir: string;
  private cycles: CycleData[] = [];
  private lessons: Lesson[] = [];
  private cycleCount: number = 0;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? path.join(__dirname, "data", "cycles");
    this.ensureDataDir();
    this.loadHistory();
  }

  /** Save a completed cycle's data. */
  saveCycle(cycle: Omit<CycleData, "id" | "cycleNumber">): CycleData {
    this.cycleCount++;

    const fullCycle: CycleData = {
      ...cycle,
      id: `cycle-${this.cycleCount}`,
      cycleNumber: this.cycleCount,
    };

    this.cycles.push(fullCycle);

    // Save to file
    const dateStr = new Date().toISOString().slice(0, 13).replace(/[T:]/g, "-");
    const filename = `${dateStr}.json`;
    const filepath = path.join(this.dataDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(fullCycle, null, 2));

    return fullCycle;
  }

  /** Extract patterns from the last N cycles. */
  extractPatterns(n?: number): PatternAnalysis {
    const recentCycles = this.cycles.slice(-(n ?? this.cycles.length));

    if (recentCycles.length === 0) {
      return {
        topPerformingCategories: [],
        bestPostingTimes: [],
        effectiveKeywords: [],
        underperformingFormats: [],
        audiencePreferences: [],
      };
    }

    // Analyze category performance
    const categoryScores: Record<string, number[]> = {};
    for (const cycle of recentCycles) {
      for (const post of cycle.postsGenerated) {
        if (!categoryScores[post.category]) {
          categoryScores[post.category] = [];
        }
        categoryScores[post.category].push(post.score);

        // Include engagement if available
        if (post.engagement) {
          const engagementScore =
            post.engagement.likes +
            post.engagement.retweets * 3 +
            post.engagement.replies * 2;
          categoryScores[post.category].push(engagementScore);
        }
      }
    }

    const topPerformingCategories = Object.entries(categoryScores)
      .map(([category, scores]) => ({
        category,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Analyze posting times
    const timePerformance: Record<string, number[]> = {};
    for (const cycle of recentCycles) {
      const hour = new Date(cycle.timestamp).getHours();
      const timeSlot = `${hour}:00`;
      if (!timePerformance[timeSlot]) {
        timePerformance[timeSlot] = [];
      }
      const avgScore = cycle.postsGenerated.reduce((a, p) => a + p.score, 0) /
        Math.max(cycle.postsGenerated.length, 1);
      timePerformance[timeSlot].push(avgScore);
    }

    const bestPostingTimes = Object.entries(timePerformance)
      .map(([time, scores]) => ({
        time,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map((t) => t.time);

    // Extract effective keywords from high-scoring posts
    const keywordFrequency: Record<string, number> = {};
    for (const cycle of recentCycles) {
      for (const post of cycle.postsGenerated) {
        if (post.score >= 70) {
          const words = post.text.toLowerCase().split(/\s+/);
          for (const word of words) {
            if (word.length > 4) {
              keywordFrequency[word] = (keywordFrequency[word] ?? 0) + 1;
            }
          }
        }
      }
    }

    const effectiveKeywords = Object.entries(keywordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Find underperforming formats
    const underperformingFormats = topPerformingCategories
      .filter((c) => c.avgScore < 50)
      .map((c) => c.category);

    return {
      topPerformingCategories,
      bestPostingTimes,
      effectiveKeywords,
      underperformingFormats,
      audiencePreferences: this.inferAudiencePreferences(recentCycles),
    };
  }

  /** Update voice/strategy based on lessons learned. */
  updateVoice(lessons: Lesson[]): StrategyUpdate[] {
    const updates: StrategyUpdate[] = [];

    for (const lesson of lessons) {
      if (lesson.confidence < 60) continue; // Only apply high-confidence lessons

      const update: StrategyUpdate = {
        type: this.categorizeLesson(lesson),
        description: lesson.insight,
        oldValue: "previous approach",
        newValue: lesson.insight,
        reason: `Confidence: ${lesson.confidence}%, Evidence: ${lesson.evidence.length} data points`,
        appliedAt: new Date().toISOString(),
      };

      updates.push(update);
      lesson.applied = true;
    }

    this.lessons.push(...lessons);
    return updates;
  }

  /** After 30 cycles: full strategy review + major update. */
  fullStrategyReview(): StrategyReview | null {
    if (this.cycleCount < 30 && this.cycleCount % 30 !== 0) {
      return null;
    }

    const patterns = this.extractPatterns();
    const keyFindings: string[] = [];
    const majorChanges: StrategyUpdate[] = [];
    const nextFocus: string[] = [];

    // Analyze what's working
    if (patterns.topPerformingCategories.length > 0) {
      const top = patterns.topPerformingCategories[0];
      keyFindings.push(`"${top.category}" content performs best (avg score: ${top.avgScore.toFixed(0)})`);
      nextFocus.push(`double down on ${top.category} content`);
    }

    // Analyze what's not working
    if (patterns.underperformingFormats.length > 0) {
      keyFindings.push(`underperforming formats: ${patterns.underperformingFormats.join(", ")}`);
      majorChanges.push({
        type: "content",
        description: `reduce ${patterns.underperformingFormats.join(", ")} content`,
        oldValue: "equal distribution",
        newValue: "weighted toward top performers",
        reason: "consistently low engagement",
        appliedAt: new Date().toISOString(),
      });
    }

    // Timing insights
    if (patterns.bestPostingTimes.length > 0) {
      keyFindings.push(`best posting times: ${patterns.bestPostingTimes.join(", ")}`);
    }

    // Keyword insights
    if (patterns.effectiveKeywords.length > 0) {
      keyFindings.push(`top keywords: ${patterns.effectiveKeywords.slice(0, 5).join(", ")}`);
    }

    const review: StrategyReview = {
      reviewNumber: Math.floor(this.cycleCount / 30),
      cyclesAnalyzed: this.cycles.length,
      keyFindings,
      majorChanges,
      nextFocus,
      reviewedAt: new Date().toISOString(),
    };

    // Save review
    const reviewPath = path.join(this.dataDir, `review-${review.reviewNumber}.json`);
    fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2));

    return review;
  }

  /** Get cycle count. */
  getCycleCount(): number {
    return this.cycleCount;
  }

  /** Get all learned lessons. */
  getLessons(): Lesson[] {
    return [...this.lessons];
  }

  /** Get recent cycle data. */
  getRecentCycles(n: number = 5): CycleData[] {
    return this.cycles.slice(-n);
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private inferAudiencePreferences(cycles: CycleData[]): string[] {
    const prefs: string[] = [];

    const allPosts = cycles.flatMap((c) => c.postsGenerated);
    const highScoring = allPosts.filter((p) => p.score >= 70);

    if (highScoring.length === 0) return ["insufficient data"];

    // Analyze length preferences
    const avgLength = highScoring.reduce((a, p) => a + p.text.length, 0) / highScoring.length;
    if (avgLength < 150) prefs.push("prefers concise posts");
    else if (avgLength > 220) prefs.push("prefers detailed posts");
    else prefs.push("prefers medium-length posts");

    // Analyze content preferences
    const categoryCounts: Record<string, number> = {};
    for (const post of highScoring) {
      categoryCounts[post.category] = (categoryCounts[post.category] ?? 0) + 1;
    }

    const topCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (topCategory) {
      prefs.push(`most engagement on ${topCategory[0]} content`);
    }

    return prefs;
  }

  private categorizeLesson(lesson: Lesson): StrategyUpdate["type"] {
    const lower = lesson.insight.toLowerCase();
    if (lower.includes("tone") || lower.includes("voice")) return "voice";
    if (lower.includes("time") || lower.includes("schedule")) return "timing";
    if (lower.includes("engage") || lower.includes("reply")) return "engagement";
    if (lower.includes("format") || lower.includes("thread")) return "format";
    return "content";
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadHistory(): void {
    if (!fs.existsSync(this.dataDir)) return;

    const files = fs.readdirSync(this.dataDir)
      .filter((f) => f.endsWith(".json") && !f.startsWith("review-"))
      .sort();

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), "utf-8"));
        if (data.cycleNumber) {
          this.cycles.push(data as CycleData);
          this.cycleCount = Math.max(this.cycleCount, data.cycleNumber);
        }
      } catch {
        // Skip corrupt files
      }
    }
  }
}
