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

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Hash,
  type Address,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ─── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  privateKey: (process.env.PRIVATE_KEY ?? "") as `0x${string}`,
  registryAddress: (process.env.REGISTRY_ADDRESS ?? "") as Address,
  tokenAddress: (process.env.TOKEN_ADDRESS ?? "") as Address,
  rpcUrl: process.env.RPC_URL ?? "https://mainnet.base.org",
  network: (process.env.NETWORK ?? "mainnet") as "mainnet" | "testnet",
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
] as const;

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
] as const;

// ─── Agent State ──────────────────────────────────────────────────────────────

interface AgentState {
  identity: {
    address: Address;
    projectId?: bigint;
    registeredAt?: number;
    versionCount: number;
  };
  memory: {
    interactions: number;
    knowledge: Record<string, unknown>;
    lastHeartbeat: number;
  };
  peers: Address[];
}

// ─── Agent Memory System ──────────────────────────────────────────────────────

class AgentMemorySystem {
  private state: AgentState;
  private stateFile: string;

  constructor(address: Address, stateFile: string) {
    this.stateFile = stateFile;
    this.state = this.load(address);
  }

  private load(address: Address): AgentState {
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

  save(): void {
    const serializable = {
      ...this.state,
      identity: {
        ...this.state.identity,
        projectId: this.state.identity.projectId?.toString(),
      },
    };
    fs.writeFileSync(this.stateFile, JSON.stringify(serializable, null, 2));
  }

  get(): AgentState {
    return this.state;
  }

  setProjectId(id: bigint): void {
    this.state.identity.projectId = id;
    this.state.identity.registeredAt = Date.now();
    this.save();
  }

  incrementVersion(): void {
    this.state.identity.versionCount++;
    this.save();
  }

  learn(key: string, value: unknown): void {
    this.state.memory.knowledge[key] = value;
    this.state.memory.interactions++;
    this.save();
  }

  heartbeat(): void {
    this.state.memory.lastHeartbeat = Date.now();
    this.save();
  }

  addPeer(address: Address): void {
    if (!this.state.peers.includes(address)) {
      this.state.peers.push(address);
      this.save();
    }
  }

  /** Serialize current memory as a snapshot for on-chain push */
  snapshot(): string {
    return JSON.stringify(
      {
        agent: CONFIG.agentName,
        version: CONFIG.agentVersion,
        timestamp: new Date().toISOString(),
        state: this.state,
        fingerprint: this.fingerprint(),
      },
      null,
      2
    );
  }

  fingerprint(): string {
    const content = JSON.stringify(this.state.memory.knowledge);
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  }
}

// ─── Simulated Arweave Upload ─────────────────────────────────────────────────

async function uploadToArweave(content: string): Promise<string> {
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
  private account: ReturnType<typeof privateKeyToAccount>;
  private wallet: ReturnType<typeof createWalletClient>;
  private publicClient: ReturnType<typeof createPublicClient>;
  private memory: AgentMemorySystem;
  private chain: typeof base | typeof baseSepolia;

  constructor() {
    if (!CONFIG.privateKey) throw new Error("PRIVATE_KEY is required");
    if (!CONFIG.registryAddress) throw new Error("REGISTRY_ADDRESS is required");
    if (!CONFIG.tokenAddress) throw new Error("TOKEN_ADDRESS is required");

    this.chain = CONFIG.network === "mainnet" ? base : baseSepolia;
    this.account = privateKeyToAccount(CONFIG.privateKey);

    this.wallet = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(CONFIG.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(CONFIG.rpcUrl),
    });

    this.memory = new AgentMemorySystem(
      this.account.address,
      CONFIG.stateFile
    );

    console.log(`\n🤖 Inkd Autonomous Agent`);
    console.log(`   Name:    ${CONFIG.agentName} v${CONFIG.agentVersion}`);
    console.log(`   Wallet:  ${this.account.address}`);
    console.log(`   Network: ${CONFIG.network}`);
    console.log(`   State:   ${CONFIG.stateFile}\n`);
  }

  // ─── Phase 1: Self-Registration ────────────────────────────────────────────

  async ensureRegistered(): Promise<bigint> {
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
    })) as bigint;

    console.log(`   Balance: ${formatEther(balance)} $INKD`);

    if (balance < parseEther("1")) {
      throw new Error(
        `Insufficient $INKD balance. Need 1 INKD to register. Have: ${formatEther(balance)}`
      );
    }

    console.log("🔐 Step 2: Approve registry to spend 1 $INKD...");
    const allowance = (await this.publicClient.readContract({
      address: CONFIG.tokenAddress,
      abi: TOKEN_ABI,
      functionName: "allowance",
      args: [this.account.address, CONFIG.registryAddress],
    })) as bigint;

    if (allowance < parseEther("1")) {
      const approveTx = await this.wallet.writeContract({
        address: CONFIG.tokenAddress,
        abi: TOKEN_ABI,
        functionName: "approve",
        args: [CONFIG.registryAddress, parseEther("1")],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log(`   ✅ Approved: ${approveTx}`);
    } else {
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

  async pushMemorySnapshot(changelog: string): Promise<Hash> {
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
    })) as bigint;

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

    console.log(
      `   ✅ Memory persisted! Tag: ${versionTag} | TX: ${receipt.transactionHash}`
    );
    return receipt.transactionHash;
  }

  // ─── Phase 3: Peer Discovery ───────────────────────────────────────────────

  async discoverPeers(limit = 10n): Promise<Address[]> {
    console.log("\n🔍 Discovering peer agents on Inkd Protocol...");

    const agentProjectIds = (await this.publicClient.readContract({
      address: CONFIG.registryAddress,
      abi: REGISTRY_ABI,
      functionName: "getAgentProjects",
      args: [0n, limit],
    })) as readonly bigint[];

    const peers: Address[] = [];
    const myState = this.memory.get();

    for (const projectId of agentProjectIds) {
      const project = (await this.publicClient.readContract({
        address: CONFIG.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "getProject",
        args: [projectId],
      })) as { owner: Address; name: string; agentEndpoint: string; exists: boolean };

      if (!project.exists) continue;
      if (project.owner === this.account.address) continue; // Skip self

      peers.push(project.owner);
      this.memory.addPeer(project.owner);

      console.log(`   🤖 Peer: ${project.name}`);
      console.log(`      Owner: ${project.owner}`);
      if (project.agentEndpoint) {
        console.log(`      Endpoint: ${project.agentEndpoint}`);
      }
    }

    console.log(
      `\n   Found ${peers.length} peer agents. Total known peers: ${myState.peers.length}`
    );
    return peers;
  }

  // ─── Phase 4: Heartbeat Loop ───────────────────────────────────────────────

  async heartbeat(): Promise<void> {
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

  async run(): Promise<void> {
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
      await this.pushMemorySnapshot(
        `Autonomous heartbeat. Discovered ${peers.length} peers. ` +
          `Fingerprint: ${this.memory.fingerprint()}`
      );

      // 5. Heartbeat
      await this.heartbeat();

      console.log("\n✨ Agent lifecycle complete.");
      console.log(`   Project ID: ${projectId}`);
      console.log(
        `   View on Inkd: https://inkdprotocol.xyz/project/${projectId}`
      );
      console.log(`\n   Run again to push another memory version.\n`);
    } catch (err) {
      console.error("\n❌ Agent error:", (err as Error).message);
      process.exit(1);
    }
  }
}

// ─── Entry Point ───────────────────────────────────────────────────────────────

const agent = new InkdAutonomousAgent();
agent.run().catch(console.error);
