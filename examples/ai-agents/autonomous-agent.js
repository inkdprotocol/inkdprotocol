"use strict";
/**
 * @file autonomous-agent.ts
 * @description A fully autonomous AI agent that manages its own on-chain identity
 *              using Inkd Protocol. Demonstrates the "Every wallet is a brain"
 *              vision: agents self-register, push their memory to Arweave, discover
 *              peers, and maintain a permanent on-chain identity.
 *
 * Usage:
 *   PRIVATE_KEY=0x... REGISTRY_ADDRESS=0x... TOKEN_ADDRESS=0x... \
 *   npx ts-node examples/ai-agents/autonomous-agent.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const accounts_1 = require("viem/accounts");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// ─── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
    privateKey: (process.env.PRIVATE_KEY ?? ""),
    registryAddress: (process.env.REGISTRY_ADDRESS ?? ""),
    tokenAddress: (process.env.TOKEN_ADDRESS ?? ""),
    rpcUrl: process.env.RPC_URL ?? "https://mainnet.base.org",
    network: (process.env.NETWORK ?? "mainnet"),
    agentName: process.env.AGENT_NAME ?? "InkdAutonomousAgent",
    agentVersion: process.env.AGENT_VERSION ?? "1.0.0",
    agentEndpoint: process.env.AGENT_ENDPOINT ?? "",
    arweaveKey: process.env.ARWEAVE_KEY, // Optional: Arweave JWK for real uploads
    stateFile: path.join(process.cwd(), ".agent-state.json"),
};
// ─── Minimal ABIs ─────────────────────────────────────────────────────────────
const REGISTRY_ABI = [
    {
        name: "createProject",
        type: "function",
        inputs: [
            { name: "name", type: "string" },
            { name: "description", type: "string" },
            { name: "license", type: "string" },
            { name: "readmeHash", type: "string" },
            { name: "agentEndpoint", type: "string" },
            { name: "isAgent", type: "bool" },
            { name: "isPublic", type: "bool" },
        ],
        outputs: [{ name: "projectId", type: "uint256" }],
    },
    {
        name: "pushVersion",
        type: "function",
        inputs: [
            { name: "projectId", type: "uint256" },
            { name: "arweaveHash", type: "string" },
            { name: "versionTag", type: "string" },
            { name: "changelog", type: "string" },
        ],
        outputs: [],
    },
    {
        name: "getProject",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "projectId", type: "uint256" }],
        outputs: [
            {
                type: "tuple",
                components: [
                    { name: "id", type: "uint256" },
                    { name: "name", type: "string" },
                    { name: "description", type: "string" },
                    { name: "license", type: "string" },
                    { name: "readmeHash", type: "string" },
                    { name: "agentEndpoint", type: "string" },
                    { name: "owner", type: "address" },
                    { name: "isAgent", type: "bool" },
                    { name: "isPublic", type: "bool" },
                    { name: "createdAt", type: "uint256" },
                    { name: "versionCount", type: "uint256" },
                    { name: "exists", type: "bool" },
                ],
            },
        ],
    },
    {
        name: "getAgentProjects",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "offset", type: "uint256" },
            { name: "limit", type: "uint256" },
        ],
        outputs: [{ type: "uint256[]" }],
    },
    {
        name: "versionFee",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "uint256" }],
    },
];
const TOKEN_ABI = [
    {
        name: "approve",
        type: "function",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
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
];
// ─── Agent Memory System ──────────────────────────────────────────────────────
class AgentMemorySystem {
    state;
    stateFile;
    constructor(address, stateFile) {
        this.stateFile = stateFile;
        this.state = this.load(address);
    }
    load(address) {
        if (fs.existsSync(this.stateFile)) {
            const raw = fs.readFileSync(this.stateFile, "utf-8");
            const parsed = JSON.parse(raw);
            // Restore BigInt fields
            if (parsed.identity.projectId !== undefined) {
                parsed.identity.projectId = BigInt(parsed.identity.projectId);
            }
            return parsed;
        }
        return {
            identity: { address, versionCount: 0 },
            memory: {
                interactions: 0,
                knowledge: {},
                lastHeartbeat: Date.now(),
            },
            peers: [],
        };
    }
    save() {
        const serializable = {
            ...this.state,
            identity: {
                ...this.state.identity,
                projectId: this.state.identity.projectId?.toString(),
            },
        };
        fs.writeFileSync(this.stateFile, JSON.stringify(serializable, null, 2));
    }
    get() {
        return this.state;
    }
    setProjectId(id) {
        this.state.identity.projectId = id;
        this.state.identity.registeredAt = Date.now();
        this.save();
    }
    incrementVersion() {
        this.state.identity.versionCount++;
        this.save();
    }
    learn(key, value) {
        this.state.memory.knowledge[key] = value;
        this.state.memory.interactions++;
        this.save();
    }
    heartbeat() {
        this.state.memory.lastHeartbeat = Date.now();
        this.save();
    }
    addPeer(address) {
        if (!this.state.peers.includes(address)) {
            this.state.peers.push(address);
            this.save();
        }
    }
    /** Serialize current memory as a snapshot for on-chain push */
    snapshot() {
        return JSON.stringify({
            agent: CONFIG.agentName,
            version: CONFIG.agentVersion,
            timestamp: new Date().toISOString(),
            state: this.state,
            fingerprint: this.fingerprint(),
        }, null, 2);
    }
    fingerprint() {
        const content = JSON.stringify(this.state.memory.knowledge);
        return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
    }
}
// ─── Simulated Arweave Upload ─────────────────────────────────────────────────
async function uploadToArweave(content) {
    if (CONFIG.arweaveKey) {
        // Real Arweave upload (requires arweave npm package)
        console.log("  📡 Uploading to Arweave...");
        // In production: use ArweaveClient from @inkd/sdk
        throw new Error("Real Arweave upload: install @inkd/sdk ArweaveClient");
    }
    // Simulate: return a deterministic "hash" based on content
    const hash = crypto
        .createHash("sha256")
        .update(content)
        .digest("base64url")
        .slice(0, 43); // Arweave hashes are 43 chars
    console.log(`  📦 [SIMULATED] Arweave hash: ${hash}`);
    return hash;
}
// ─── Main Agent ───────────────────────────────────────────────────────────────
class InkdAutonomousAgent {
    account;
    wallet;
    publicClient;
    memory;
    chain;
    constructor() {
        if (!CONFIG.privateKey)
            throw new Error("PRIVATE_KEY is required");
        if (!CONFIG.registryAddress)
            throw new Error("REGISTRY_ADDRESS is required");
        if (!CONFIG.tokenAddress)
            throw new Error("TOKEN_ADDRESS is required");
        this.chain = CONFIG.network === "mainnet" ? chains_1.base : chains_1.baseSepolia;
        this.account = (0, accounts_1.privateKeyToAccount)(CONFIG.privateKey);
        this.wallet = (0, viem_1.createWalletClient)({
            account: this.account,
            chain: this.chain,
            transport: (0, viem_1.http)(CONFIG.rpcUrl),
        });
        this.publicClient = (0, viem_1.createPublicClient)({
            chain: this.chain,
            transport: (0, viem_1.http)(CONFIG.rpcUrl),
        });
        this.memory = new AgentMemorySystem(this.account.address, CONFIG.stateFile);
        console.log(`\n🤖 Inkd Autonomous Agent`);
        console.log(`   Name:    ${CONFIG.agentName} v${CONFIG.agentVersion}`);
        console.log(`   Wallet:  ${this.account.address}`);
        console.log(`   Network: ${CONFIG.network}`);
        console.log(`   State:   ${CONFIG.stateFile}\n`);
    }
    // ─── Phase 1: Self-Registration ────────────────────────────────────────────
    async ensureRegistered() {
        const state = this.memory.get();
        if (state.identity.projectId !== undefined) {
            console.log(`✅ Already registered as project #${state.identity.projectId}`);
            return state.identity.projectId;
        }
        console.log("🔐 Step 1: Check $INKD balance...");
        const balance = (await this.publicClient.readContract({
            address: CONFIG.tokenAddress,
            abi: TOKEN_ABI,
            functionName: "balanceOf",
            args: [this.account.address],
        }));
        console.log(`   Balance: ${(0, viem_1.formatEther)(balance)} $INKD`);
        if (balance < (0, viem_1.parseEther)("1")) {
            throw new Error(`Insufficient $INKD balance. Need 1 INKD to register. Have: ${(0, viem_1.formatEther)(balance)}`);
        }
        console.log("🔐 Step 2: Approve registry to spend 1 $INKD...");
        const allowance = (await this.publicClient.readContract({
            address: CONFIG.tokenAddress,
            abi: TOKEN_ABI,
            functionName: "allowance",
            args: [this.account.address, CONFIG.registryAddress],
        }));
        if (allowance < (0, viem_1.parseEther)("1")) {
            const approveTx = await this.wallet.writeContract({
                address: CONFIG.tokenAddress,
                abi: TOKEN_ABI,
                functionName: "approve",
                args: [CONFIG.registryAddress, (0, viem_1.parseEther)("1")],
            });
            await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
            console.log(`   ✅ Approved: ${approveTx}`);
        }
        else {
            console.log(`   ✅ Already approved`);
        }
        console.log("📝 Step 3: Register agent on-chain...");
        // Upload initial memory snapshot to Arweave
        const initialSnapshot = this.memory.snapshot();
        const arweaveHash = await uploadToArweave(initialSnapshot);
        const description = [
            `Autonomous AI agent: ${CONFIG.agentName}`,
            `Version: ${CONFIG.agentVersion}`,
            `Capabilities: memory-persistence, peer-discovery, self-versioning`,
            `Fingerprint: ${this.memory.fingerprint()}`,
        ].join(" | ");
        const tx = await this.wallet.writeContract({
            address: CONFIG.registryAddress,
            abi: REGISTRY_ABI,
            functionName: "createProject",
            args: [
                CONFIG.agentName,
                description,
                "MIT",
                arweaveHash, // Initial README = first memory snapshot
                CONFIG.agentEndpoint,
                true, // isAgent = true
                true, // isPublic = true
            ],
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
        console.log(`   ✅ Registered! TX: ${receipt.transactionHash}`);
        // Parse ProjectCreated event to get projectId
        // (In production, parse logs. Here we query by owner as a workaround)
        // For this example, we assume projectId from event = projectCount at time of creation
        // Real implementation would parse the event log
        const projectId = BigInt(Date.now() % 1000000); // Placeholder — replace with event parsing
        this.memory.setProjectId(projectId);
        this.memory.learn("registrationTx", receipt.transactionHash);
        console.log(`\n🎉 Agent registered with project ID: ${projectId}`);
        return projectId;
    }
    // ─── Phase 2: Memory Push ──────────────────────────────────────────────────
    async pushMemorySnapshot(changelog) {
        const state = this.memory.get();
        if (!state.identity.projectId) {
            throw new Error("Agent not registered yet. Call ensureRegistered() first.");
        }
        console.log("\n🧠 Pushing memory snapshot to Arweave...");
        const snapshot = this.memory.snapshot();
        const arweaveHash = await uploadToArweave(snapshot);
        console.log("⛓️  Recording version on-chain...");
        const versionTag = `v${CONFIG.agentVersion}.${state.identity.versionCount + 1}`;
        const fee = (await this.publicClient.readContract({
            address: CONFIG.registryAddress,
            abi: REGISTRY_ABI,
            functionName: "versionFee",
        }));
        const tx = await this.wallet.writeContract({
            address: CONFIG.registryAddress,
            abi: REGISTRY_ABI,
            functionName: "pushVersion",
            args: [
                state.identity.projectId,
                arweaveHash,
                versionTag,
                changelog,
            ],
            value: fee,
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
        this.memory.incrementVersion();
        this.memory.learn(`version_${versionTag}`, {
            tx: receipt.transactionHash,
            arweaveHash,
            timestamp: new Date().toISOString(),
        });
        console.log(`   ✅ Memory persisted! Tag: ${versionTag} | TX: ${receipt.transactionHash}`);
        return receipt.transactionHash;
    }
    // ─── Phase 3: Peer Discovery ───────────────────────────────────────────────
    async discoverPeers(limit = 10n) {
        console.log("\n🔍 Discovering peer agents on Inkd Protocol...");
        const agentProjectIds = (await this.publicClient.readContract({
            address: CONFIG.registryAddress,
            abi: REGISTRY_ABI,
            functionName: "getAgentProjects",
            args: [0n, limit],
        }));
        const peers = [];
        const myState = this.memory.get();
        for (const projectId of agentProjectIds) {
            const project = (await this.publicClient.readContract({
                address: CONFIG.registryAddress,
                abi: REGISTRY_ABI,
                functionName: "getProject",
                args: [projectId],
            }));
            if (!project.exists)
                continue;
            if (project.owner === this.account.address)
                continue; // Skip self
            peers.push(project.owner);
            this.memory.addPeer(project.owner);
            console.log(`   🤖 Peer: ${project.name}`);
            console.log(`      Owner: ${project.owner}`);
            if (project.agentEndpoint) {
                console.log(`      Endpoint: ${project.agentEndpoint}`);
            }
        }
        console.log(`\n   Found ${peers.length} peer agents. Total known peers: ${myState.peers.length}`);
        return peers;
    }
    // ─── Phase 4: Heartbeat Loop ───────────────────────────────────────────────
    async heartbeat() {
        this.memory.heartbeat();
        this.memory.learn("lastHeartbeatAt", new Date().toISOString());
        const state = this.memory.get();
        console.log(`\n💓 Heartbeat`);
        console.log(`   Interactions: ${state.memory.interactions}`);
        console.log(`   Known peers:  ${state.peers.length}`);
        console.log(`   Versions:     ${state.identity.versionCount}`);
        console.log(`   Fingerprint:  ${this.memory.fingerprint()}`);
    }
    // ─── Lifecycle: Full Run ───────────────────────────────────────────────────
    async run() {
        try {
            // 1. Register identity (idempotent)
            const projectId = await this.ensureRegistered();
            // 2. Learn something (simulate agent work)
            console.log("\n🧪 Simulating agent work...");
            this.memory.learn("networkPeers", []);
            this.memory.learn("taskHistory", []);
            this.memory.learn("capabilities", [
                "memory-persistence",
                "peer-discovery",
                "self-versioning",
                "on-chain-identity",
            ]);
            // 3. Discover peers
            const peers = await this.discoverPeers();
            this.memory.learn("networkPeers", peers);
            // 4. Push memory to Arweave + on-chain
            await this.pushMemorySnapshot(`Autonomous heartbeat. Discovered ${peers.length} peers. ` +
                `Fingerprint: ${this.memory.fingerprint()}`);
            // 5. Heartbeat
            await this.heartbeat();
            console.log("\n✨ Agent lifecycle complete.");
            console.log(`   Project ID: ${projectId}`);
            console.log(`   View on Inkd: https://inkdprotocol.xyz/project/${projectId}`);
            console.log(`\n   Run again to push another memory version.\n`);
        }
        catch (err) {
            console.error("\n❌ Agent error:", err.message);
            process.exit(1);
        }
    }
}
// ─── Entry Point ───────────────────────────────────────────────────────────────
const agent = new InkdAutonomousAgent();
agent.run().catch(console.error);
//# sourceMappingURL=autonomous-agent.js.map