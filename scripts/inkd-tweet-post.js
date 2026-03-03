#!/usr/bin/env node
/**
 * inkd-tweet-post.js
 * Posts next unposted tweet from twitter-queue.md
 * Tracks state in memory/inkd-twitter-state.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const QUEUE_FILE = path.join(process.env.HOME, '.openclaw/workspace/builds/inkd-protocol/docs/twitter-queue.md');
const STATE_FILE = path.join(process.env.HOME, '.openclaw/workspace/memory/inkd-twitter-state.json');

const API_KEY = process.env.INKD_TWITTER_API_KEY;
const API_SECRET = process.env.INKD_TWITTER_API_SECRET;
const ACCESS_TOKEN = process.env.INKD_TWITTER_ACCESS_TOKEN;
const ACCESS_TOKEN_SECRET = process.env.INKD_TWITTER_ACCESS_TOKEN_SECRET;

if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
  console.error('Missing Twitter credentials in env');
  process.exit(1);
}

// Parse twitter queue
function parseTweets(content) {
  const tweets = [];
  const blocks = content.split(/\n---\n/);
  for (const block of blocks) {
    const headerMatch = block.match(/\*\*#(\d+)\*\*\s*\|\s*type:\s*(\w[\w-]*)/);
    const textMatch = block.match(/^>\s*(.+)$/m);
    if (headerMatch && textMatch) {
      tweets.push({
        num: parseInt(headerMatch[1]),
        type: headerMatch[2],
        text: textMatch[1].trim()
      });
    }
  }
  return tweets.sort((a, b) => a.num - b.num);
}

// Load state
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { posted: [], lastPostedAt: null };
  }
}

// Save state
function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// OAuth 1.0a signature
function oauthSign(method, url, params, consumerSecret, tokenSecret) {
  const sorted = Object.keys(params).sort().map(k =>
    `${percentEncode(k)}=${percentEncode(params[k])}`
  ).join('&');
  const base = `${method}&${percentEncode(url)}&${percentEncode(sorted)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(base).digest('base64');
}

function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildAuthHeader(method, url, extraParams = {}) {
  const oauthParams = {
    oauth_consumer_key: API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0'
  };
  const allParams = { ...oauthParams, ...extraParams };
  oauthParams.oauth_signature = oauthSign(method, url, allParams, API_SECRET, ACCESS_TOKEN_SECRET);
  
  const header = 'OAuth ' + Object.keys(oauthParams).sort().map(k =>
    `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`
  ).join(', ');
  return header;
}

// Post tweet via Twitter API v2
function postTweet(text) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.twitter.com/2/tweets';
    const body = JSON.stringify({ text });
    const auth = buildAuthHeader('POST', url);
    
    const options = {
      hostname: 'api.twitter.com',
      path: '/2/tweets',
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const content = fs.readFileSync(QUEUE_FILE, 'utf8');
  const tweets = parseTweets(content);
  const state = loadState();
  
  const postedNums = new Set(state.posted.map(p => p.num));
  const pending = tweets.filter(t => !postedNums.has(t.num));
  
  if (pending.length === 0) {
    console.log('All tweets posted!');
    return;
  }

  const next = pending[0];
  console.log(`Posting #${next.num} [${next.type}]: ${next.text.substring(0, 80)}...`);
  
  const result = await postTweet(next.text);
  const tweetId = result.data?.id;
  
  state.posted.push({
    num: next.num,
    type: next.type,
    tweetId,
    postedAt: new Date().toISOString(),
    text: next.text
  });
  state.lastPostedAt = new Date().toISOString();
  state.remaining = pending.length - 1;
  saveState(state);

  console.log(`✅ Posted! Tweet ID: ${tweetId}`);
  console.log(`Remaining: ${pending.length - 1}/${tweets.length}`);
  console.log(`URL: https://twitter.com/i/web/status/${tweetId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
