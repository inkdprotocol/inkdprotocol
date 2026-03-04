#!/usr/bin/env node
// inkd-tweet-queue.js — Persistent tweet queue for @inkdprotocol
// Survives session restarts via cron. Run every minute via crontab.
//
// Usage:
//   node inkd-tweet-queue.js add "Tweet text" [--at "2026-03-04T18:23:00+04:00"]
//   node inkd-tweet-queue.js list
//   node inkd-tweet-queue.js run    (called by cron every minute)
//   node inkd-tweet-queue.js cancel <id>

const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '../data/tweet-queue.json');
const LOG_FILE   = path.join(__dirname, '../data/tweet-log.json');

// Ensure data dir exists
fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}

function saveQueue(q) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
}

function appendLog(entry) {
  const log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
  log.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

const client = new TwitterApi({
  appKey: process.env.INKD_TWITTER_API_KEY,
  appSecret: process.env.INKD_TWITTER_API_SECRET,
  accessToken: process.env.INKD_TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.INKD_TWITTER_ACCESS_TOKEN_SECRET,
});

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'add') {
    const atIdx = args.indexOf('--at');
    const atTime = atIdx !== -1 ? new Date(args[atIdx + 1]).getTime() : Date.now();
    const text = args.filter((a, i) => a !== '--at' && i !== atIdx + 1 && i !== 0).join(' ');

    // Auto-capitalize first letter
    const tweet = text.charAt(0).toUpperCase() + text.slice(1);

    const q = loadQueue();
    const id = Date.now();
    q.push({ id, text: tweet, scheduledAt: atTime, status: 'pending' });
    saveQueue(q);
    console.log(`✅ Queued [${id}]: "${tweet.substring(0, 60)}..."`);
    console.log(`   Scheduled: ${new Date(atTime).toISOString()}`);
    return;
  }

  if (cmd === 'list') {
    const q = loadQueue();
    if (!q.length) { console.log('Queue is empty.'); return; }
    q.forEach(t => {
      const when = new Date(t.scheduledAt).toLocaleString('de-DE', { timeZone: 'Asia/Dubai' });
      console.log(`[${t.id}] ${t.status.toUpperCase()} @ ${when}`);
      console.log(`  "${t.text.substring(0, 80)}"`);
    });
    return;
  }

  if (cmd === 'cancel') {
    const id = parseInt(args[1]);
    const q = loadQueue().filter(t => t.id !== id);
    saveQueue(q);
    console.log(`🗑️  Cancelled tweet ${id}`);
    return;
  }

  if (cmd === 'run') {
    const q = loadQueue();
    const now = Date.now();
    const due = q.filter(t => t.status === 'pending' && t.scheduledAt <= now);

    for (const tweet of due) {
      try {
        const result = await client.readWrite.v2.tweet(tweet.text);
        tweet.status = 'posted';
        tweet.tweetId = result.data.id;
        tweet.postedAt = now;
        console.log(`✅ Posted [${tweet.id}]: ${tweet.tweetId}`);
        appendLog({ ...tweet, postedAt: new Date(now).toISOString() });
      } catch (err) {
        tweet.status = 'failed';
        tweet.error = err.message;
        console.error(`❌ Failed [${tweet.id}]: ${err.message}`);
        appendLog({ ...tweet, error: err.message });
      }
    }

    // Keep only pending tweets in queue (remove posted/failed)
    saveQueue(q.filter(t => t.status === 'pending'));
    return;
  }

  console.log(`Usage:
  node inkd-tweet-queue.js add "text" [--at "ISO datetime"]
  node inkd-tweet-queue.js list
  node inkd-tweet-queue.js cancel <id>
  node inkd-tweet-queue.js run     (cron)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
