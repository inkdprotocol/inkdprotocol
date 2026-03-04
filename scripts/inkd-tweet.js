#!/usr/bin/env node
// inkd-tweet.js — Post to @inkdprotocol
// Usage: node inkd-tweet.js "tweet text"
//        node inkd-tweet.js --queue   (post next from queue)

const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

const client = new TwitterApi({
  appKey: process.env.INKD_TWITTER_API_KEY,
  appSecret: process.env.INKD_TWITTER_API_SECRET,
  accessToken: process.env.INKD_TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.INKD_TWITTER_ACCESS_TOKEN_SECRET,
});

const rwClient = client.readWrite;

async function tweet(text) {
  try {
    const result = await rwClient.v2.tweet(text);
    console.log('✅ Posted:', result.data.id);
    console.log('🔗 https://twitter.com/inkdprotocol/status/' + result.data.id);
    return result.data.id;
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    if (err.data) console.error(JSON.stringify(err.data, null, 2));
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node inkd-tweet.js "text" | --test');
    process.exit(1);
  }

  if (args[0] === '--test') {
    // Verify credentials only
    try {
      const me = await client.v2.me();
      console.log('✅ Auth OK — logged in as @' + me.data.username);
    } catch (err) {
      console.error('❌ Auth failed:', err.message);
      if (err.data) console.error(JSON.stringify(err.data, null, 2));
      process.exit(1);
    }
    return;
  }

  let text = args.join(' ');
  // Always capitalize first word
  text = text.charAt(0).toUpperCase() + text.slice(1);
  await tweet(text);
}

main();
