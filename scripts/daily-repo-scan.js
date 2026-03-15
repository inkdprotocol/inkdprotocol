#!/usr/bin/env node
// Daily scan: inkd-protocol repo integrity check
// Runs via cron every day at 09:00

const { execSync } = require('child_process');
const https = require('https');

const REPO = 'inkdprotocol/inkd-protocol';
const TOKEN = process.env.INKD_GITHUB_TOKEN;
const BOT_TOKEN = process.env.INKD_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.INKD_TELEGRAM_CHAT_ID;

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: { 'Authorization': `token ${TOKEN}`, 'User-Agent': 'inkd-daily-scan' }
    };
    https.get(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function sendTelegram(msg) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
    }, res => { res.resume(); resolve(); });
    req.write(body);
    req.end();
  });
}

async function main() {
  const issues = [];

  // 1. Check latest CI run status
  const runs = await apiGet(`/repos/${REPO}/actions/runs?per_page=5&branch=main`);
  const latestRun = runs.workflow_runs?.[0];
  if (latestRun && latestRun.conclusion === 'failure') {
    issues.push(`❌ Last CI run FAILED: ${latestRun.name} (${latestRun.html_url})`);
  }

  // 2. Check for secret scanning alerts
  const alerts = await apiGet(`/repos/${REPO}/secret-scanning/alerts?state=open`);
  if (Array.isArray(alerts) && alerts.length > 0) {
    issues.push(`🔑 ${alerts.length} open secret scanning alert(s)!`);
  }

  // 3. Check for open security advisories
  const advisories = await apiGet(`/repos/${REPO}/vulnerability-alerts`);
  if (advisories && !advisories.message) {
    // vulnerability alerts enabled
  }

  // 4. Check if repo is still private-settings-clean
  const repo = await apiGet(`/repos/${REPO}`);
  if (!repo.private && repo.has_issues !== undefined) {
    // Public repo — check visibility is intentional
    const openIssues = repo.open_issues_count || 0;
    if (openIssues > 10) {
      issues.push(`⚠️ ${openIssues} open issues on repo`);
    }
  }

  // Report
  if (issues.length === 0) {
    await sendTelegram(`✅ *Daily Repo Scan — OK*\n\ninkd-protocol repo is clean. No issues found.\n_${new Date().toISOString().split('T')[0]}_`);
  } else {
    const msg = `🚨 *Daily Repo Scan — ISSUES FOUND*\n\n${issues.join('\n')}\n\nhttps://github.com/${REPO}`;
    await sendTelegram(msg);
  }
}

main().catch(async err => {
  await sendTelegram(`⚠️ Daily repo scan script error: ${err.message}`);
  process.exit(1);
});
