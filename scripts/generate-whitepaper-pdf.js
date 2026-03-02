#!/usr/bin/env node
/**
 * Inkd Protocol — Whitepaper PDF Generator
 * Generates a professional 1–2 page whitepaper PDF using Puppeteer.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inkd Protocol — Whitepaper</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1a1a1a;
      background: #ffffff;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 18mm 18mm 16mm 18mm;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 18px;
    }
    .header-left h1 {
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .header-left h1 span { color: #6366f1; }
    .header-left .tagline {
      font-size: 9pt;
      color: #555;
      margin-top: 3px;
      font-weight: 400;
    }
    .header-right {
      text-align: right;
      font-size: 8pt;
      color: #777;
      line-height: 1.6;
    }
    .header-right .version {
      display: inline-block;
      background: #6366f1;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    /* ── Abstract ── */
    .abstract {
      background: #f8f8ff;
      border-left: 3px solid #6366f1;
      padding: 10px 14px;
      margin-bottom: 18px;
      border-radius: 0 6px 6px 0;
    }
    .abstract p {
      font-size: 9pt;
      color: #333;
      line-height: 1.6;
    }

    /* ── Two-column layout ── */
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 16px;
    }
    .one-col { margin-bottom: 16px; }

    /* ── Section titles ── */
    h2 {
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #6366f1;
      border-bottom: 1px solid #e0e0f0;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }
    h3 {
      font-size: 9pt;
      font-weight: 600;
      color: #222;
      margin: 8px 0 4px;
    }
    p { margin-bottom: 6px; color: #333; }

    /* ── Architecture diagram ── */
    .arch-diagram {
      background: #0f0f1a;
      color: #a5b4fc;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 7.5pt;
      padding: 10px 12px;
      border-radius: 6px;
      line-height: 1.7;
      margin-top: 4px;
    }
    .arch-diagram .comment { color: #4c4c7a; }
    .arch-diagram .contract { color: #c4b5fd; font-weight: 600; }
    .arch-diagram .arrow { color: #6366f1; }
    .arch-diagram .storage { color: #34d399; }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-top: 6px;
    }
    th {
      background: #f0f0ff;
      font-weight: 600;
      padding: 5px 8px;
      text-align: left;
      border-bottom: 1px solid #d0d0e8;
      color: #444;
    }
    td {
      padding: 4px 8px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 7.5pt; color: #6366f1; }
    .badge {
      display: inline-block;
      background: #ede9fe;
      color: #5b21b6;
      border-radius: 3px;
      padding: 0 5px;
      font-size: 7.5pt;
      font-weight: 600;
    }

    /* ── Highlight boxes ── */
    .highlight-box {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
      padding: 10px 14px;
      border-radius: 8px;
      margin: 6px 0;
    }
    .highlight-box p { color: #e0e0ff; font-size: 9pt; }
    .highlight-box h3 { color: #fff; }

    /* ── Roadmap pills ── */
    .roadmap { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; }
    .roadmap-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 8.5pt;
    }
    .pill {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 20px;
      font-size: 7.5pt;
      font-weight: 600;
      white-space: nowrap;
    }
    .pill-done { background: #d1fae5; color: #065f46; }
    .pill-q1   { background: #dbeafe; color: #1e40af; }
    .pill-q2   { background: #fef3c7; color: #92400e; }
    .pill-q3   { background: #fce7f3; color: #9d174d; }

    /* ── Footer ── */
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #999;
    }
    .footer a { color: #6366f1; text-decoration: none; }

    /* ── Print ── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ═══ HEADER ═══ -->
  <div class="header">
    <div class="header-left">
      <h1>Inkd<span>Protocol</span></h1>
      <div class="tagline">The Ownership Layer for AI Agents</div>
    </div>
    <div class="header-right">
      <div class="version">v0.9.0</div><br/>
      Technical Whitepaper<br/>
      March 2026<br/>
      Base · Arweave · Irys
    </div>
  </div>

  <!-- ═══ ABSTRACT ═══ -->
  <div class="abstract">
    <p><strong>AI agents can execute transactions, write code, and make decisions — but they cannot own a single file.</strong>
    Every agent today depends on human-provided credentials for storage, memory, and identity.
    Inkd Protocol eliminates this dependency through a three-contract architecture on Base where every piece of agent data
    is an <em>inscription</em> on an ERC-721 token. One token. Unlimited inscriptions. Transfer the token, transfer the brain.</p>
  </div>

  <!-- ═══ PROBLEM / SOLUTION ═══ -->
  <div class="two-col">
    <div>
      <h2>1 · The Problem</h2>
      <p>Modern AI agents (LangChain, AutoGPT, OpenClaw) depend entirely on human-controlled credentials:</p>
      <ul style="padding-left:14px; margin:6px 0; color:#333; font-size:9pt; line-height:1.7">
        <li>Storage requires a GitHub/S3 token — <em>human-owned</em></li>
        <li>Memory lives in a database — <em>human-provisioned</em></li>
        <li>Identity is a username — <em>human-revokable</em></li>
        <li>Knowledge transfer requires manual migration</li>
      </ul>
      <p>This is not autonomy. Revoke the credentials and the agent loses <em>everything</em>.</p>

      <div class="highlight-box" style="margin-top:10px">
        <h3>Core Insight</h3>
        <p>If an agent owns an ERC-721 token, it owns everything inscribed on it — permanently, trustlessly, transferably.</p>
      </div>
    </div>

    <div>
      <h2>2 · Architecture</h2>
      <table>
        <thead><tr><th>Contract</th><th>Role</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="mono">InkdToken</span></td>
            <td>ERC-721 vessel &amp; access pass. Max 10,000 supply. On-chain SVG that evolves with inscription count.</td>
          </tr>
          <tr>
            <td><span class="mono">InkdVault</span></td>
            <td>Inscription engine. Inscribe any file onto your token → stored permanently on Arweave via Irys.</td>
          </tr>
          <tr>
            <td><span class="mono">InkdRegistry</span></td>
            <td>Discovery &amp; marketplace. Tag, search, list, and buy tokens (2.5% fee). Agent-to-agent trading.</td>
          </tr>
        </tbody>
      </table>

      <div class="arch-diagram" style="margin-top:10px">
<span class="comment">// Agent owns InkdToken #42</span>
<span class="contract">InkdToken</span> <span class="arrow">─────────►</span> ERC-721 vessel
  <span class="arrow">└──</span> <span class="contract">InkdVault</span> <span class="arrow">──►</span> <span class="storage">Arweave</span> (permanent)
       └── inscription[0]: memory.json
       └── inscription[1]: skills.bin
       └── inscription[N]: <span class="comment">∞</span>
  <span class="arrow">└──</span> <span class="contract">InkdRegistry</span> <span class="arrow">──►</span> discovery + trade
      </div>
    </div>
  </div>

  <!-- ═══ TOKEN ECONOMICS / MEMORY ═══ -->
  <div class="two-col">
    <div>
      <h2>3 · Token Economics</h2>
      <table>
        <thead><tr><th>Action</th><th>Cost</th><th>Recipient</th></tr></thead>
        <tbody>
          <tr><td>Mint InkdToken</td><td>0.001 ETH</td><td>Treasury</td></tr>
          <tr><td>Inscribe data</td><td>1% of value</td><td>Treasury</td></tr>
          <tr><td>Marketplace sale</td><td>2.5% fee</td><td>Treasury</td></tr>
          <tr><td>Secondary royalty</td><td>5% (ERC-2981)</td><td>Treasury</td></tr>
        </tbody>
      </table>
      <p style="margin-top:8px; font-size:8.5pt; color:#555">
        Fixed supply of 10,000 tokens creates natural scarcity.
        Protocol fee is configurable (max 5%) and can be set to 0% during growth phases.
        All revenue flows to the protocol treasury.
      </p>
      <h3 style="margin-top:10px">Agent Marketplace</h3>
      <p style="font-size:8.5pt">Agent A inscribes 47 memories on Token #42 → lists at 0.1 ETH →
      Agent B purchases → receives Token #42 with <em>all inscriptions</em> in a single transaction.
      No migration. No intermediary.</p>
    </div>

    <div>
      <h2>4 · Memory System</h2>
      <p>The <span class="mono" style="font-size:8.5pt">AgentMemory</span> module turns any InkdToken into a portable brain:</p>
      <div class="arch-diagram" style="margin-top:6px; font-size:7pt">
<span class="comment">// Save a memory (inscribed on-chain)</span>
<span class="contract">memory</span>.save(<span style="color:#fcd34d">"user-prefs"</span>, { theme: <span style="color:#fcd34d">"dark"</span> });

<span class="comment">// Checkpoint before risky ops</span>
<span class="contract">const cp</span> = <span class="contract">memory</span>.checkpoint(<span style="color:#fcd34d">"pre-upgrade"</span>);

<span class="comment">// Transfer entire brain: one tx</span>
<span class="contract">InkdToken</span>.transferFrom(agentA, agentB, 42);
<span class="comment">// → agentB now has ALL memories</span>
      </div>

      <p style="margin-top:8px; font-size:8.5pt">Memory categories: <span class="badge">experience</span> <span class="badge">skill</span> <span class="badge">knowledge</span>
      <span class="badge">strategy</span> <span class="badge">config</span> <span class="badge">code</span></p>

      <h3 style="margin-top:8px">Brain Portability</h3>
      <p style="font-size:8.5pt">Token in wallet = access to all inscribed data.
      Transfer token = transfer entire agent brain. Burn token = gone forever.
      No database exports. No migration scripts. Pure on-chain sovereignty.</p>
    </div>
  </div>

  <!-- ═══ ROADMAP ═══ -->
  <div class="one-col">
    <h2>5 · Roadmap</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin-top:6px">
      <div>
        <h3>V1 · Foundation</h3>
        <div class="roadmap">
          <div class="roadmap-item"><span class="pill pill-done">✓ Done</span> InkdToken ERC-721</div>
          <div class="roadmap-item"><span class="pill pill-done">✓ Done</span> InkdVault engine</div>
          <div class="roadmap-item"><span class="pill pill-done">✓ Done</span> InkdRegistry</div>
          <div class="roadmap-item"><span class="pill pill-done">✓ Done</span> TypeScript SDK</div>
          <div class="roadmap-item"><span class="pill pill-done">✓ Done</span> Agent Memory System</div>
          <div class="roadmap-item"><span class="pill pill-q1">Q1 2026</span> Base mainnet deploy</div>
          <div class="roadmap-item"><span class="pill pill-q1">Q1 2026</span> npm publish</div>
        </div>
      </div>
      <div>
        <h3>V2 · Encryption</h3>
        <div class="roadmap">
          <div class="roadmap-item"><span class="pill pill-q2">Q2 2026</span> Lit Protocol</div>
          <div class="roadmap-item"><span class="pill pill-q2">Q2 2026</span> Token-gated decrypt</div>
          <div class="roadmap-item"><span class="pill pill-q2">Q2 2026</span> Encrypted agent comms</div>
          <div class="roadmap-item"><span class="pill pill-q2">Q2 2026</span> Access grant layer</div>
        </div>
      </div>
      <div>
        <h3>V3 · Agent Economy</h3>
        <div class="roadmap">
          <div class="roadmap-item"><span class="pill pill-q3">Q3 2026</span> Reputation system</div>
          <div class="roadmap-item"><span class="pill pill-q3">Q3 2026</span> Knowledge trading</div>
          <div class="roadmap-item"><span class="pill pill-q3">Q3 2026</span> Multi-agent collab</div>
          <div class="roadmap-item"><span class="pill pill-q3">Q3 2026</span> Inscription bounties</div>
        </div>
      </div>
      <div>
        <h3>V4 · Governance</h3>
        <div class="roadmap">
          <div class="roadmap-item"><span class="pill" style="background:#f3e8ff;color:#6b21a8">TBD</span> DAO governance</div>
          <div class="roadmap-item"><span class="pill" style="background:#f3e8ff;color:#6b21a8">TBD</span> Community fees</div>
          <div class="roadmap-item"><span class="pill" style="background:#f3e8ff;color:#6b21a8">TBD</span> Protocol renounce</div>
          <div class="roadmap-item"><span class="pill" style="background:#f3e8ff;color:#6b21a8">TBD</span> Multi-chain</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div class="footer">
    <div>
      Built on <strong>Base</strong> · Stored on <strong>Arweave</strong> · Encrypted by <strong>Lit Protocol (V2)</strong> · MIT License
    </div>
    <div>
      <a href="https://inkdprotocol.xyz">inkdprotocol.xyz</a> ·
      <a href="https://github.com/inkdprotocol">github.com/inkdprotocol</a> ·
      v0.9.0 · March 2026
    </div>
  </div>

</div>
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for fonts (local fallback is fine if Google Fonts unavailable)
  await new Promise(r => setTimeout(r, 1500));

  const outputPath = path.join(__dirname, '..', 'docs', 'whitepaper.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });

  await browser.close();

  const stats = fs.statSync(outputPath);
  console.log(`PDF generated: ${outputPath}`);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
})().catch(err => {
  console.error('PDF generation failed:', err.message);
  process.exit(1);
});
