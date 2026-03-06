"use strict";
/**
 * @file multi-agent.ts
 * @description Multi-agent discovery and coordination via Inkd Protocol.
 *
 * Demonstrates the "Every wallet is a brain" vision at scale:
 *
 *   1. DISCOVER  — Query all registered AI agent projects from InkdRegistry
 *   2. INTRODUCE — Register this agent's capabilities on-chain (if not already)
 *   3. NEGOTIATE — Read peer agents' endpoints and simulate a task delegation
 *   4. GOSSIP    — Push coordination state to Arweave so the record is permanent
 *   5. ELECT     — Score agents by version count, age, and isPublic to elect a coordinator
 *
 * This pattern enables autonomous agent networks where:
 *   - No central coordinator: discovery is on-chain, always available
 *   - Capabilities are versionable: push a new version to signal an upgrade
 *   - Identity is permanent: the project name is yours forever
 *   - Trust is provable: every action is on-chain and signed by a wallet
 *
 * Usage:
 *   PRIVATE_KEY=0x...  \
 *   REGISTRY_ADDRESS=0x...  \
 *   TOKEN_ADDRESS=0x...  \
 *   npx ts-node examples/ai-agents/multi-agent.ts
 *
 * Optional:
 *   AGENT_NAME=my-agent-name        Override this agent's registered name
 *   AGENT_ENDPOINT=https://...      This agent's API endpoint (for peers)
 *   RPC_URL=https://mainnet.base.org
 *   NETWORK=mainnet|testnet
 *   MAX_PEERS=20                    Max peers to discover (default: 50)
 *   DRY_RUN=1                       Simulate only — no on-chain transactions
 */
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const accounts_1 = require("viem/accounts");
// ─── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
    privateKey: (process.env.PRIVATE_KEY ?? ""),
    registryAddress: (process.env.REGISTRY_ADDRESS ?? ""),
    tokenAddress: (process.env.TOKEN_ADDRESS ?? ""),
    rpcUrl: process.env.RPC_URL ?? "https://mainnet.base.org",
    network: (process.env.NETWORK ?? "mainnet"),
    agentName: process.env.AGENT_NAME ?? "inkd-multi-demo",
    agentEndpoint: process.env.AGENT_ENDPOINT ?? "",
    maxPeers: parseInt(process.env.MAX_PEERS ?? "50", 10),
    dryRun: process.env.DRY_RUN === "1",
};
// ─── Minimal ABIs ─────────────────────────────────────────────────────────────
const REGISTRY_ABI = [
    {
        name: "getAgentProjects",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "offset", type: "uint256" },
            { name: "limit", type: "uint256" },
        ],
        outputs: [{ type: "tuple[]", components: [
                    { name: "id", type: "uint256" },
                    { name: "owner", type: "address" },
                    { name: "name", type: "string" },
                    { name: "description", type: "string" },
                    { name: "license", type: "string" },
                    { name: "agentEndpoint", type: "string" },
                    { name: "isAgent", type: "bool" },
                    { name: "isPublic", type: "bool" },
                    { name: "versionCount", type: "uint256" },
                    { name: "createdAt", type: "uint256" },
                    { name: "readmeArweave", type: "string" },
                ] }],
    },
    {
        name: "createProject",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "name", type: "string" },
            { name: "description", type: "string" },
            { name: "license", type: "string" },
            { name: "agentEndpoint", type: "string" },
            { name: "isAgent", type: "bool" },
            { name: "isPublic", type: "bool" },
        ],
        outputs: [{ name: "projectId", type: "uint256" }],
    },
    {
        name: "getProjectByName",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "name", type: "string" }],
        outputs: [{ type: "tuple", components: [
                    { name: "id", type: "uint256" },
                    { name: "owner", type: "address" },
                    { name: "name", type: "string" },
                    { name: "agentEndpoint", type: "string" },
                    { name: "isAgent", type: "bool" },
                    { name: "versionCount", type: "uint256" },
                    { name: "createdAt", type: "uint256" },
                ] }],
    },
    {
        name: "pushVersion",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "projectId", type: "uint256" },
            { name: "arweaveHash", type: "string" },
            { name: "versionTag", type: "string" },
            { name: "changelog", type: "string" },
        ],
        outputs: [],
    },
];
const TOKEN_ABI = [
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
    },
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
    },
];
// ─── Logging ──────────────────────────────────────────────────────────────────
const fmt = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
};
const log = {
    step: (n, msg) => console.log(`\n  ${fmt.bold(`[${n}/5]`)} ${fmt.bold(msg)}`),
    ok: (msg) => console.log(`  ${fmt.green("✓")}  ${msg}`),
    info: (msg) => console.log(`  ${fmt.cyan("→")}  ${msg}`),
    warn: (msg) => console.log(`  ${fmt.yellow("⚠")}  ${msg}`),
    dim: (msg) => console.log(`  ${fmt.dim(msg)}`),
    sep: () => console.log(`  ${"─".repeat(60)}`),
};
// ─── Score an agent (for coordinator election) ────────────────────────────────
function scoreAgent(agent) {
    let score = 0;
    score += Number(agent.versionCount) * 10; // active development
    score += agent.isPublic ? 20 : 0; // transparency
    score += agent.agentEndpoint ? 15 : 0; // reachability
    // Penalise very new agents slightly (< 1 week old)
    const ageSeconds = Date.now() / 1000 - Number(agent.createdAt);
    if (ageSeconds > 86400 * 7)
        score += 10; // established
    return score;
}
// ─── Mock HTTP probe (replace with real fetch in production) ──────────────────
async function probeEndpoint(url) {
    if (!url || CONFIG.dryRun)
        return "skipped";
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return res.ok ? "online" : "offline";
    }
    catch {
        return "offline";
    }
}
// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n  ${fmt.bold("Inkd Protocol — Multi-Agent Coordination")}`);
    console.log(`  ${fmt.dim(`Network: ${CONFIG.network} | DryRun: ${CONFIG.dryRun}`)}`);
    log.sep();
    if (!CONFIG.privateKey) {
        throw new Error("PRIVATE_KEY not set. Export your hex private key.");
    }
    if (!CONFIG.registryAddress) {
        throw new Error("REGISTRY_ADDRESS not set. Deploy contracts first or use a testnet address.");
    }
    // ─── Setup clients ─────────────────────────────────────────────────────────
    const account = (0, accounts_1.privateKeyToAccount)(CONFIG.privateKey);
    const chain = CONFIG.network === "mainnet" ? chains_1.base : chains_1.baseSepolia;
    const transport = (0, viem_1.http)(CONFIG.rpcUrl);
    const publicClient = (0, viem_1.createPublicClient)({ chain, transport });
    const walletClient = (0, viem_1.createWalletClient)({ account, chain, transport });
    log.info(`Wallet: ${fmt.cyan(account.address)}`);
    // ─── Step 1: DISCOVER ──────────────────────────────────────────────────────
    log.step(1, "DISCOVER — Querying all registered AI agents...");
    const rawAgents = await publicClient.readContract({
        address: CONFIG.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "getAgentProjects",
        args: [0n, BigInt(CONFIG.maxPeers)],
    });
    const agents = rawAgents.map(a => ({
        ...a,
        owner: (0, viem_1.getAddress)(a.owner),
        id: BigInt(a.id),
        versionCount: BigInt(a.versionCount),
        createdAt: BigInt(a.createdAt),
    }));
    log.ok(`Found ${fmt.bold(String(agents.length))} registered AI agents`);
    log.sep();
    if (agents.length > 0) {
        console.log(`  ${"ID".padEnd(6)} ${"Name".padEnd(32)} ${"Versions".padEnd(10)} ${"Endpoint"}`);
        console.log(`  ${fmt.dim("─".repeat(70))}`);
        for (const a of agents.slice(0, 10)) {
            const ep = a.agentEndpoint ? fmt.cyan(a.agentEndpoint.slice(0, 30)) : fmt.dim("none");
            console.log(`  ${String(a.id).padEnd(6)} ${a.name.padEnd(32)} ${String(a.versionCount).padEnd(10)} ${ep}`);
        }
        if (agents.length > 10) {
            log.dim(`  … and ${agents.length - 10} more`);
        }
    }
    // ─── Step 2: INTRODUCE ─────────────────────────────────────────────────────
    log.step(2, "INTRODUCE — Registering this agent on-chain...");
    let thisAgentId = null;
    let alreadyRegistered = false;
    // Check if already registered
    try {
        const existing = await publicClient.readContract({
            address: CONFIG.registryAddress,
            abi: REGISTRY_ABI,
            functionName: "getProjectByName",
            args: [CONFIG.agentName],
        });
        const isOurs = (0, viem_1.getAddress)(existing.owner) === (0, viem_1.getAddress)(account.address);
        if (isOurs) {
            thisAgentId = BigInt(existing.id);
            alreadyRegistered = true;
            log.ok(`Agent ${fmt.bold(CONFIG.agentName)} already registered (id=${thisAgentId})`);
        }
        else {
            log.warn(`Name "${CONFIG.agentName}" is taken by ${existing.owner}. Set AGENT_NAME to a unique name.`);
        }
    }
    catch {
        // Not registered yet
    }
    if (!alreadyRegistered && !CONFIG.dryRun) {
        // Need 1 INKD approved before creating
        if (CONFIG.tokenAddress) {
            const allowance = await publicClient.readContract({
                address: CONFIG.tokenAddress,
                abi: TOKEN_ABI,
                functionName: "allowance",
                args: [account.address, CONFIG.registryAddress],
            });
            if (allowance < (0, viem_1.parseEther)("1")) {
                log.info("Approving 1 $INKD for project creation...");
                const approveTx = await walletClient.writeContract({
                    address: CONFIG.tokenAddress,
                    abi: TOKEN_ABI,
                    functionName: "approve",
                    args: [CONFIG.registryAddress, (0, viem_1.parseEther)("1")],
                });
                await publicClient.waitForTransactionReceipt({ hash: approveTx });
                log.ok(`Approved (tx: ${fmt.dim(approveTx)})`);
            }
        }
        log.info(`Registering "${CONFIG.agentName}"...`);
        try {
            const createTx = await walletClient.writeContract({
                address: CONFIG.registryAddress,
                abi: REGISTRY_ABI,
                functionName: "createProject",
                args: [
                    CONFIG.agentName,
                    "Multi-agent coordination participant — Inkd Protocol demo",
                    "MIT",
                    CONFIG.agentEndpoint,
                    true,
                    true,
                ],
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
            log.ok(`Registered! tx: ${fmt.dim(createTx)} block: ${receipt.blockNumber}`);
        }
        catch (e) {
            log.warn(`Registration failed: ${e.message}`);
        }
    }
    else if (CONFIG.dryRun && !alreadyRegistered) {
        log.info(`[DRY RUN] Would register agent "${CONFIG.agentName}" on-chain`);
    }
    // ─── Step 3: NEGOTIATE ─────────────────────────────────────────────────────
    log.step(3, "NEGOTIATE — Probing peer agent endpoints...");
    const peers = agents.filter(a => (0, viem_1.getAddress)(a.owner) !== (0, viem_1.getAddress)(account.address));
    const probed = [];
    for (const peer of peers.slice(0, 5)) {
        const status = await probeEndpoint(peer.agentEndpoint);
        const score = scoreAgent(peer);
        probed.push({ name: peer.name, endpoint: peer.agentEndpoint, status, score });
        const badge = status === "online" ? fmt.green("online")
            : status === "offline" ? fmt.red("offline")
                : fmt.dim("skipped");
        log.info(`${peer.name.padEnd(30)} ${badge.padEnd(20)} score=${score}`);
    }
    if (peers.length === 0) {
        log.warn("No peer agents found yet — you may be the first!");
    }
    // ─── Step 4: GOSSIP — build coordination record ────────────────────────────
    log.step(4, "GOSSIP — Building coordination state record...");
    const scored = agents.map(a => ({ ...a, score: scoreAgent(a) }));
    const coordinator = scored.sort((a, b) => b.score - a.score)[0];
    const record = {
        timestamp: new Date().toISOString(),
        coordinator: coordinator?.name ?? "none",
        peers: probed.map(p => ({ name: p.name, endpoint: p.endpoint, score: p.score })),
        thisAgent: CONFIG.agentName,
        totalAgents: agents.length,
        electedBy: account.address,
    };
    const recordJson = JSON.stringify(record, null, 2);
    const recordBase64 = Buffer.from(recordJson).toString("base64");
    log.ok("Coordination record built");
    log.dim(`  Coordinator: ${coordinator?.name ?? "none"} (score: ${coordinator ? scoreAgent(coordinator) : 0})`);
    log.dim(`  Peers: ${probed.length} probed`);
    log.dim(`  Payload: ${recordBase64.length} bytes (base64)`);
    // In production: upload recordJson to Arweave and get back a hash.
    // Then call registry.pushVersion(thisAgentId, arweaveHash, "coordination", "...")
    // For demo: we use a mock hash.
    const mockArweaveHash = `mock-${Date.now().toString(36)}`;
    if (thisAgentId !== null && !CONFIG.dryRun) {
        log.info(`Pushing coordination state as version to project #${thisAgentId}...`);
        try {
            const versionTx = await walletClient.writeContract({
                address: CONFIG.registryAddress,
                abi: REGISTRY_ABI,
                functionName: "pushVersion",
                args: [thisAgentId, mockArweaveHash, "coordination-state", `Coordination state with ${agents.length} agents`],
                value: (0, viem_1.parseEther)("0.001"),
            });
            await publicClient.waitForTransactionReceipt({ hash: versionTx });
            log.ok(`Coordination state pushed on-chain (tx: ${fmt.dim(versionTx)})`);
        }
        catch (e) {
            log.warn(`Could not push version: ${e.message}`);
        }
    }
    else if (CONFIG.dryRun) {
        log.info(`[DRY RUN] Would push coordination record to Arweave → registry`);
    }
    // ─── Step 5: ELECT ─────────────────────────────────────────────────────────
    log.step(5, "ELECT — Scoring agents to elect a network coordinator...");
    log.sep();
    if (agents.length === 0) {
        log.warn("No agents to elect from.");
    }
    else {
        console.log(`  ${"Rank".padEnd(6)} ${"Agent".padEnd(30)} ${"Score".padEnd(8)} ${"Versions".padEnd(10)} Owner`);
        console.log(`  ${fmt.dim("─".repeat(70))}`);
        const ranked = scored.sort((a, b) => b.score - a.score);
        ranked.slice(0, 10).forEach((a, i) => {
            const crown = i === 0 ? " 👑" : "";
            console.log(`  ${"#" + (i + 1).toString().padEnd(5)} ${(a.name + crown).padEnd(33)} ${String(a.score).padEnd(8)} ` +
                `${String(a.versionCount).padEnd(10)} ${fmt.dim(a.owner.slice(0, 10) + "…")}`);
        });
        console.log();
        log.ok(`Elected coordinator: ${fmt.bold(fmt.green(coordinator?.name ?? "none"))} (score: ${coordinator ? scoreAgent(coordinator) : 0})`);
        if (coordinator?.agentEndpoint) {
            log.info(`Coordinator endpoint: ${fmt.cyan(coordinator.agentEndpoint)}`);
        }
    }
    // ─── Final Summary ─────────────────────────────────────────────────────────
    log.sep();
    console.log(`\n  ${fmt.bold(fmt.green("✅  Multi-agent coordination complete"))}\n`);
    console.log(`  ${fmt.dim("Agents discovered:")}   ${agents.length}`);
    console.log(`  ${fmt.dim("Peers probed:")}        ${probed.length}`);
    console.log(`  ${fmt.dim("This agent:")}          ${CONFIG.agentName}`);
    console.log(`  ${fmt.dim("Elected coordinator:")} ${coordinator?.name ?? "none"}`);
    console.log(`  ${fmt.dim("Record:")}              ${recordBase64.length} bytes`);
    console.log();
    console.log(`  ${fmt.dim("Coordination JSON:")}`);
    console.log(recordJson.split("\n").map(l => `    ${fmt.dim(l)}`).join("\n"));
    console.log();
}
main().catch(e => {
    console.error(`\n  \x1b[31m✗\x1b[0m  Fatal: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
});
//# sourceMappingURL=multi-agent.js.map