/**
 * @file ContentEngine.ts
 * @description Tweet generation engine for Inkd Protocol.
 *              Generates, scores, and improves content for X (Twitter).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContentCategory = "build-update" | "education" | "milestone" | "ecosystem" | "thread" | "reply";

export interface GeneratedTweet {
  text: string;
  category: ContentCategory;
  score: number;
  reasoning: string;
  tags: string[];
  suggestedTime?: string;
  createdAt: string;
}

export interface GeneratedThread {
  tweets: string[];
  topic: string;
  depth: number;
  category: ContentCategory;
  score: number;
}

export interface TweetScoreResult {
  score: number;
  reasoning: string;
  suggestions: string[];
}

export interface VoiceProfile {
  tone: string;
  vocabulary: string[];
  avoidWords: string[];
  maxLength: number;
  emojiUsage: "none" | "minimal" | "moderate";
  hashtagStrategy: "none" | "minimal" | "aggressive";
}

// ─── Templates ──────────────────────────────────────────────────────────────

const BUILD_UPDATE_TEMPLATES = [
  "shipped: {change}\n\ninkd is the ownership layer for AI agents. every file is a token. every wallet is a brain.",
  "new commit just dropped:\n\n{change}\n\nbuilding the infrastructure AI agents actually need.",
  "{change}\n\none step closer to agent autonomy.\n\ninkd protocol.",
  "agents need to own their data. we're building that.\n\nlatest: {change}",
  "today we built: {change}\n\nwhy? because AI agents deserve wallets, not API keys.",
];

const EDUCATION_TEMPLATES = [
  "how {topic} works in inkd:\n\n1. own an InkdToken (ERC-721)\n2. inscribe data on it (stored on Arweave)\n3. transfer token = transfer everything\n4. burn token = data gone forever\n\nno servers. no admins. just wallets.",
  "thread on {topic}:\n\nmost AI agents store their data on someone else's server.\n\nthat's not ownership. that's renting.\n\ninkd changes this.",
  "the problem with AI agent {topic}:\n\n- centralized storage = single point of failure\n- API keys = dependency on humans\n- no portability = vendor lock-in\n\ninkd: own your data on-chain. period.",
];

const MILESTONE_TEMPLATES = [
  "{milestone}\n\ninkd protocol keeps building.\n\nthe ownership layer for AI agents on Base.",
  "milestone unlocked: {milestone}\n\nwhat's next? {next}",
  "{milestone}\n\nwe're not here to talk. we're here to ship.",
];

const ECOSYSTEM_TEMPLATES = [
  "interesting take from @{account}.\n\n{response}\n\ninkd is building the ownership layer for exactly this.",
  ".@{account} is right about {topic}.\n\nbut the missing piece? on-chain ownership.\n\nthat's what inkd does.",
  "re: @{account} on {topic}\n\n{response}",
];

// ─── Engine ─────────────────────────────────────────────────────────────────

export class ContentEngine {
  private voice: VoiceProfile;
  private performanceData: Map<string, number[]> = new Map();

  constructor(voice?: Partial<VoiceProfile>) {
    this.voice = {
      tone: "confident, technical, builder-first",
      vocabulary: [
        "ship", "build", "own", "inscribe", "on-chain",
        "agent", "autonomy", "wallet", "brain", "protocol",
      ],
      avoidWords: [
        "excited", "thrilled", "game-changing", "revolutionary",
        "disrupting", "synergy", "leverage", "paradigm",
      ],
      maxLength: 280,
      emojiUsage: "none",
      hashtagStrategy: "none",
      ...voice,
    };
  }

  /** Generate a build update tweet from a commit message. */
  generateBuildUpdate(commitMessage: string, changes?: string[]): GeneratedTweet {
    const template = this.pickRandom(BUILD_UPDATE_TEMPLATES);
    let text = template.replace("{change}", commitMessage);

    if (changes && changes.length > 0) {
      const changeList = changes.slice(0, 3).map((c) => `- ${c}`).join("\n");
      text += `\n\n${changeList}`;
    }

    text = this.enforceVoice(text);
    const scoreResult = this.scoreTweet(text);

    return {
      text,
      category: "build-update",
      score: scoreResult.score,
      reasoning: scoreResult.reasoning,
      tags: ["build", "update"],
      createdAt: new Date().toISOString(),
    };
  }

  /** Generate an educational thread on a topic. */
  generateThread(topic: string, depth: number = 5): GeneratedThread {
    const tweets: string[] = [];

    // Opening tweet
    const opener = this.pickRandom(EDUCATION_TEMPLATES).replace(/{topic}/g, topic);
    tweets.push(this.enforceVoice(opener));

    // Middle tweets — deep dive
    const middleTopics = [
      `the technical architecture behind ${topic}`,
      `why existing solutions for ${topic} fail`,
      `how inkd solves ${topic} differently`,
      `what ${topic} means for AI agent autonomy`,
      `real-world use case: ${topic} in production`,
    ];

    for (let i = 1; i < Math.min(depth - 1, middleTopics.length + 1); i++) {
      const idx = Math.min(i - 1, middleTopics.length - 1);
      tweets.push(this.enforceVoice(
        `${i + 1}/ ${middleTopics[idx]}\n\nthe key insight: agents need sovereign data. not rented infrastructure.`
      ));
    }

    // Closing tweet
    tweets.push(this.enforceVoice(
      `${tweets.length + 1}/ that's ${topic} on inkd.\n\nwe're building the ownership layer for AI agents on Base.\n\nfollow along as we ship.`
    ));

    const score = this.scoreTweet(tweets[0]);

    return {
      tweets,
      topic,
      depth: tweets.length,
      category: "education",
      score: score.score,
    };
  }

  /** Generate a response to a relevant ecosystem tweet. */
  generateEcosystemResponse(account: string, topic: string, context?: string): GeneratedTweet {
    const template = this.pickRandom(ECOSYSTEM_TEMPLATES);
    const response = context ?? `agents owning their data on-chain is the future. that's what we're building.`;

    let text = template
      .replace("{account}", account)
      .replace(/{topic}/g, topic)
      .replace("{response}", response);

    text = this.enforceVoice(text);
    const scoreResult = this.scoreTweet(text);

    return {
      text,
      category: "ecosystem",
      score: scoreResult.score,
      reasoning: scoreResult.reasoning,
      tags: ["ecosystem", account],
      createdAt: new Date().toISOString(),
    };
  }

  /** Generate a milestone announcement. */
  generateMilestonePost(milestone: string, next?: string): GeneratedTweet {
    const template = this.pickRandom(MILESTONE_TEMPLATES);
    let text = template
      .replace("{milestone}", milestone)
      .replace("{next}", next ?? "more building.");

    text = this.enforceVoice(text);
    const scoreResult = this.scoreTweet(text);

    return {
      text,
      category: "milestone",
      score: scoreResult.score,
      reasoning: scoreResult.reasoning,
      tags: ["milestone"],
      createdAt: new Date().toISOString(),
    };
  }

  /** Score a tweet 0-100 with detailed reasoning. */
  scoreTweet(text: string): TweetScoreResult {
    let score = 50;
    const suggestions: string[] = [];
    const reasons: string[] = [];

    // Length scoring
    const len = text.length;
    if (len >= 100 && len <= 240) {
      score += 10;
      reasons.push("good length (100-240 chars)");
    } else if (len < 50) {
      score -= 10;
      suggestions.push("too short — add more substance");
    } else if (len > 280) {
      score -= 20;
      suggestions.push("over 280 chars — needs trimming");
    }

    // Voice compliance
    const hasAvoidWords = this.voice.avoidWords.some((w) =>
      text.toLowerCase().includes(w.toLowerCase())
    );
    if (hasAvoidWords) {
      score -= 15;
      suggestions.push("contains corporate buzzwords — remove them");
    }

    const vocabHits = this.voice.vocabulary.filter((w) =>
      text.toLowerCase().includes(w.toLowerCase())
    ).length;
    score += Math.min(vocabHits * 3, 15);
    if (vocabHits >= 3) reasons.push(`uses ${vocabHits} brand keywords`);

    // Structure scoring
    if (text.includes("\n\n")) {
      score += 5;
      reasons.push("good use of whitespace");
    }

    // No emojis per voice profile
    if (this.voice.emojiUsage === "none") {
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      if (emojiRegex.test(text)) {
        score -= 10;
        suggestions.push("remove emojis — not part of voice");
      }
    }

    // Call to action
    if (text.toLowerCase().includes("follow") || text.toLowerCase().includes("building")) {
      score += 5;
      reasons.push("has implicit CTA");
    }

    // Hashtags
    if (this.voice.hashtagStrategy === "none" && text.includes("#")) {
      score -= 5;
      suggestions.push("remove hashtags — not part of voice");
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reasoning: reasons.join("; ") || "baseline score",
      suggestions,
    };
  }

  /** Iteratively improve a tweet until it reaches the target score. */
  improveUntilScore(text: string, targetScore: number = 70, maxIterations: number = 5): string {
    let current = text;
    let iteration = 0;

    while (iteration < maxIterations) {
      const result = this.scoreTweet(current);
      if (result.score >= targetScore) break;

      // Apply suggestions
      for (const suggestion of result.suggestions) {
        if (suggestion.includes("corporate buzzwords")) {
          for (const word of this.voice.avoidWords) {
            const regex = new RegExp(word, "gi");
            current = current.replace(regex, "");
          }
        }
        if (suggestion.includes("emojis")) {
          current = current.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");
        }
        if (suggestion.includes("hashtags")) {
          current = current.replace(/#\w+/g, "");
        }
        if (suggestion.includes("trimming")) {
          current = current.substring(0, 277) + "...";
        }
      }

      // Clean up whitespace
      current = current.replace(/\n{3,}/g, "\n\n").trim();
      iteration++;
    }

    return current;
  }

  /** Update voice profile based on learned patterns. */
  updateVoice(updates: Partial<VoiceProfile>): void {
    this.voice = { ...this.voice, ...updates };
  }

  /** Get the current voice profile. */
  getVoice(): VoiceProfile {
    return { ...this.voice };
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private enforceVoice(text: string): string {
    let result = text;

    // Remove avoided words
    for (const word of this.voice.avoidWords) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      result = result.replace(regex, "");
    }

    // Clean up extra whitespace
    result = result.replace(/  +/g, " ").replace(/\n /g, "\n").trim();

    // Enforce max length
    if (result.length > this.voice.maxLength) {
      result = result.substring(0, this.voice.maxLength - 3) + "...";
    }

    return result;
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
