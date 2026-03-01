/**
 * @file index.ts
 * @description Inkd Protocol self-learning system — tracks X performance,
 *              extracts lessons, generates content, and monitors trends.
 */

export { PerformanceTracker } from "./performance-tracker";
export type {
  XPost,
  PostType,
  PostFormat,
  PostMetrics,
  PerformancePattern,
  WeeklyReport,
} from "./performance-tracker";

export { LearningEngine } from "./learning-engine";
export type { Lesson, StrategyUpdate, TweetScore } from "./learning-engine";

export { ContentGenerator } from "./content-generator";
export type {
  ContentType,
  GeneratedTweet,
  GeneratedThread,
} from "./content-generator";

export { TrendMonitor } from "./trend-monitor";
export type {
  Trend,
  EngagementTarget,
  InspirationPost,
  ScanResult,
} from "./trend-monitor";
