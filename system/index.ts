/**
 * @file index.ts
 * @description Inkd Protocol self-learning X system.
 *              Brain -> ContentEngine -> TrendMonitor -> LearningLoop
 */

export { InkdBrain } from "./InkdBrain";
export type { BrainConfig, BrainState, CycleResult } from "./InkdBrain";

export { ContentEngine } from "./ContentEngine";
export type {
  ContentCategory,
  GeneratedTweet,
  GeneratedThread,
  TweetScoreResult,
  VoiceProfile,
} from "./ContentEngine";

export { TrendMonitor } from "./TrendMonitor";
export type {
  TrendResult,
  AccountActivity,
  AccountPost,
  EmergingNarrative,
  CompetitorInsight,
  ScanResult,
} from "./TrendMonitor";

export { LearningLoop } from "./LearningLoop";
export type {
  CycleData,
  PostRecord,
  Lesson,
  StrategyUpdate,
  PatternAnalysis,
  StrategyReview,
} from "./LearningLoop";
