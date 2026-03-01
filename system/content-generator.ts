/**
 * @file content-generator.ts
 * @description Generates X (Twitter) content for Inkd Protocol based on
 *              templates, learned patterns, and current context.
 */

import { LearningEngine } from "./learning-engine";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Content generation categories. */
export type ContentType = "build-update" | "education" | "milestone" | "ecosystem";

/** Generated tweet with metadata. */
export interface GeneratedTweet {
  text: string;
  type: ContentType;
  score: number;
  tags: string[];
  suggestedTime?: string;
}

/** Generated thread (array of tweets). */
export interface GeneratedThread {
  topic: string;
  tweets: string[];
  type: ContentType;
  score: number;
  tags: string[];
}

// ─── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES: Record<ContentType, string[]> = {
  "build-update": [
    `Just deployed {feature} to Base Sepolia.

What it does:
→ {point1}
→ {point2}
→ {point3}

{technical_detail}`,

    `Committed {lines} lines of Solidity today.

InkdVault now supports:
→ {feature1}
→ {feature2}

Every feature gets an agent closer to true autonomy.`,

    `New in Inkd Protocol:

{feature}

Why it matters: {reason}

Your agent's wallet isn't just for ETH anymore.`,
  ],

  education: [
    `Your AI agent stores its memory in {current_solution}.

That means:
→ You can delete it
→ The company can delete it
→ It's not the agent's data — it's yours

Inkd fixes this. 🧵`,

    `Why does your AI agent still depend on humans for storage?

It can write code. It can make decisions.
But it can't own a file without YOUR permission.

That's not autonomy. That's dependency.

Here's what we're building: 🧵`,

    `Token = Data. Wallet = Brain.

In Inkd Protocol:
→ mint() = store a file
→ burn() = delete forever
→ transfer() = hand it over
→ balanceOf() = what do I know?

No servers. No APIs. Just Solidity.`,
  ],

  milestone: [
    `{number} tokens minted on Inkd testnet.

Each one is a file, code snippet, or agent memory.
Owned by a wallet. Not a server.

Mainnet soon.`,

    `Week {week}: {highlight}

Stats:
→ {stat1}
→ {stat2}
→ {stat3}

Building every day. Shipping every week.`,
  ],

  ecosystem: [
    `{news_summary}

This is exactly the problem Inkd solves.

When {situation} → agents need {solution}.

We're building it on @base with @ArweaveEco.`,

    `Interesting: {observation}

This is why we built grantAccess() in InkdVault.

Agents need to share data without giving up ownership.
→ Temporary access
→ Expiry-based
→ Fully on-chain

No API keys. No OAuth. Just tokens.`,
  ],
};

// ─── Content Generator ──────────────────────────────────────────────────────

export class ContentGenerator {
  private engine: LearningEngine;

  constructor(engine?: LearningEngine) {
    this.engine = engine ?? new LearningEngine();
  }

  /**
   * Generate a tweet for a given content type.
   * Uses templates and fills in context-appropriate content.
   *
   * @param type    Content type category.
   * @param context Key-value pairs to fill template variables.
   * @returns       Generated tweet with score and metadata.
   */
  generateTweet(
    type: ContentType,
    context: Record<string, string> = {}
  ): GeneratedTweet {
    const templates = TEMPLATES[type];
    const template = templates[Math.floor(Math.random() * templates.length)];

    let text = template;
    for (const [key, value] of Object.entries(context)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    // Remove unfilled placeholders
    text = text.replace(/\{[^}]+\}/g, "[...]");

    const score = this.engine.scoreTweet(text);
    const tags = this.extractTags(text);

    return {
      text,
      type,
      score: score.total,
      tags,
    };
  }

  /**
   * Generate a full thread on a topic.
   *
   * @param topic   Thread topic.
   * @param points  Key points to cover (3-7 recommended).
   * @returns       Generated thread with all tweets.
   */
  generateThread(
    topic: string,
    points: string[] = []
  ): GeneratedThread {
    const tweets: string[] = [];

    // Hook tweet
    tweets.push(`${topic}\n\nA thread 🧵`);

    // Content tweets
    if (points.length > 0) {
      for (let i = 0; i < points.length; i++) {
        tweets.push(`${i + 1}/ ${points[i]}`);
      }
    } else {
      // Default thread structure
      tweets.push("1/ The problem:\nAI agents today can't own anything. Not files. Not code. Not even their own memory.");
      tweets.push("2/ The current setup:\n→ Agent needs YOUR GitHub token\n→ Agent needs YOUR API keys\n→ Agent needs YOUR permission to save a file\n\nThat's not an agent. That's a tool.");
      tweets.push("3/ The Inkd solution:\n→ Every file = a token (ERC-1155)\n→ Every wallet = a brain\n→ mint() = store\n→ burn() = delete\n→ transfer() = hand over");
      tweets.push("4/ Built on @base for speed and low cost.\nStored on @ArweaveEco permanently.\nEncrypted via @LitProtocol (V2).\n\nFully on-chain. Fully autonomous.");
    }

    // Closing tweet
    tweets.push(`Follow @InkdProtocol for updates.\n\nWe're building the ownership layer for AI agents.\nOne commit at a time.`);

    const fullText = tweets.join("\n\n");
    const score = this.engine.scoreTweet(fullText);

    return {
      topic,
      tweets,
      type: "education",
      score: score.total,
      tags: this.extractTags(fullText),
    };
  }

  /**
   * Improve existing text based on learned patterns and scoring.
   *
   * @param text Original text to improve.
   * @returns    Improved text with applied suggestions.
   */
  improveText(text: string): { improved: string; changes: string[] } {
    const score = this.engine.scoreTweet(text);
    let improved = text;
    const changes: string[] = [];

    // Apply improvements based on score suggestions
    if (score.breakdown.format < 60 && !improved.includes("\n")) {
      // Add line breaks for readability
      const sentences = improved.split(". ");
      if (sentences.length >= 3) {
        improved = sentences.join(".\n\n");
        changes.push("Added line breaks between sentences for readability.");
      }
    }

    // Replace anti-patterns
    const replacements: Record<string, string> = {
      "gm ": "",
      "wagmi": "we're building",
      "LFG": "shipping now",
      "🚀🚀🚀": "",
      "big things coming soon": "here's what we just shipped",
    };

    for (const [pattern, replacement] of Object.entries(replacements)) {
      if (improved.toLowerCase().includes(pattern.toLowerCase())) {
        improved = improved.replace(new RegExp(pattern, "gi"), replacement);
        changes.push(`Replaced "${pattern}" with "${replacement}".`);
      }
    }

    // Trim excessive whitespace
    improved = improved.replace(/\n{3,}/g, "\n\n").trim();

    return { improved, changes };
  }

  /**
   * Generate multiple tweet options for a given type and pick the best one.
   *
   * @param type    Content type.
   * @param context Template context.
   * @param count   Number of options to generate.
   * @returns       Best scoring tweet.
   */
  generateBest(
    type: ContentType,
    context: Record<string, string> = {},
    count: number = 3
  ): GeneratedTweet {
    const options: GeneratedTweet[] = [];
    for (let i = 0; i < count; i++) {
      options.push(this.generateTweet(type, context));
    }
    return options.sort((a, b) => b.score - a.score)[0];
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private extractTags(text: string): string[] {
    const keywords = [
      "agent", "wallet", "token", "mint", "burn", "arweave",
      "base", "autonomy", "storage", "protocol", "data", "ai",
      "ownership", "memory", "solidity", "erc1155",
    ];
    const lower = text.toLowerCase();
    return keywords.filter((k) => lower.includes(k));
  }
}
