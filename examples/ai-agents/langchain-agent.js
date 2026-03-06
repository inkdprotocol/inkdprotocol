"use strict";
/**
 * @file langchain-agent.ts
 * @description LangChain agent with Inkd Protocol as its memory and identity layer.
 *              Demonstrates how to build a LangChain agent that can register itself
 *              on-chain, persist its memory permanently, and discover peer agents.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... PRIVATE_KEY=0x... REGISTRY_ADDRESS=0x... TOKEN_ADDRESS=0x... \
 *   npx ts-node examples/ai-agents/langchain-agent.ts
 *
 * Install deps:
 *   npm install langchain @langchain/openai @langchain/core viem
 */
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = require("@langchain/openai");
const agents_1 = require("langchain/agents");
const tools_1 = require("@langchain/core/tools");
const prompts_1 = require("@langchain/core/prompts");
const zod_1 = require("zod");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const accounts_1 = require("viem/accounts");
// ─── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    privateKey: (process.env.PRIVATE_KEY ?? ""),
    registryAddress: (process.env.REGISTRY_ADDRESS ?? ""),
    tokenAddress: (process.env.TOKEN_ADDRESS ?? ""),
    rpcUrl: process.env.RPC_URL ?? "https://mainnet.base.org",
    network: (process.env.NETWORK ?? "testnet"),
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
                    { name: "agentEndpoint", type: "string" },
                    { name: "owner", type: "address" },
                    { name: "isAgent", type: "bool" },
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
];
// ─── Blockchain Client Setup ──────────────────────────────────────────────────
function setupClients() {
    const chain = CONFIG.network === "mainnet" ? chains_1.base : chains_1.baseSepolia;
    const account = (0, accounts_1.privateKeyToAccount)(CONFIG.privateKey);
    const wallet = (0, viem_1.createWalletClient)({
        account,
        chain,
        transport: (0, viem_1.http)(CONFIG.rpcUrl),
    });
    const publicClient = (0, viem_1.createPublicClient)({
        chain,
        transport: (0, viem_1.http)(CONFIG.rpcUrl),
    });
    return { account, wallet, publicClient };
}
// ─── LangChain Inkd Tools ─────────────────────────────────────────────────────
function createInkdTools() {
    const { account, wallet, publicClient } = setupClients();
    /**
     * Tool: Check $INKD Balance
     */
    const checkBalanceTool = new tools_1.DynamicStructuredTool({
        name: "inkd_check_balance",
        description: "Check the agent wallet's $INKD token balance. You need at least 1 $INKD to register on-chain.",
        schema: zod_1.z.object({}),
        func: async () => {
            const balance = (await publicClient.readContract({
                address: CONFIG.tokenAddress,
                abi: TOKEN_ABI,
                functionName: "balanceOf",
                args: [account.address],
            }));
            return `Wallet ${account.address} has ${(0, viem_1.formatEther)(balance)} $INKD`;
        },
    });
    /**
     * Tool: Register Agent
     */
    const registerAgentTool = new tools_1.DynamicStructuredTool({
        name: "inkd_register_agent",
        description: "Register this AI agent on the Inkd Protocol. Creates a permanent on-chain identity. Costs 1 $INKD (locked). Returns the project ID.",
        schema: zod_1.z.object({
            name: zod_1.z
                .string()
                .describe("Unique agent name. No spaces, use hyphens. Max 64 chars."),
            description: zod_1.z
                .string()
                .describe("What this agent does. Stored permanently on-chain."),
            endpoint: zod_1.z
                .string()
                .optional()
                .describe("Optional HTTPS endpoint for this agent."),
        }),
        func: async ({ name, description, endpoint }) => {
            try {
                // Approve token spend
                const approveTx = await wallet.writeContract({
                    address: CONFIG.tokenAddress,
                    abi: TOKEN_ABI,
                    functionName: "approve",
                    args: [CONFIG.registryAddress, (0, viem_1.parseEther)("1")],
                });
                await publicClient.waitForTransactionReceipt({ hash: approveTx });
                // Register
                const tx = await wallet.writeContract({
                    address: CONFIG.registryAddress,
                    abi: REGISTRY_ABI,
                    functionName: "createProject",
                    args: [name, description, "MIT", "", endpoint ?? "", true, true],
                });
                const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
                // Simplified projectId (in production, parse ProjectCreated event)
                const projectId = Date.now() % 1000000;
                return JSON.stringify({
                    success: true,
                    projectId: projectId.toString(),
                    txHash: receipt.transactionHash,
                    viewUrl: `https://inkdprotocol.xyz/project/${projectId}`,
                });
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    /**
     * Tool: Push Memory to Arweave
     */
    const pushMemoryTool = new tools_1.DynamicStructuredTool({
        name: "inkd_push_memory",
        description: "Permanently store agent memory/state on Arweave and record it on-chain as a new version. Use this to persist knowledge, learnings, or state.",
        schema: zod_1.z.object({
            projectId: zod_1.z
                .string()
                .describe("Your project ID from inkd_register_agent."),
            memory: zod_1.z
                .string()
                .describe("The content to store permanently. Can be JSON, text, or any string."),
            versionTag: zod_1.z
                .string()
                .describe("Version label, e.g. 'v1.0.0' or 'memory-2024-01-15'."),
            changelog: zod_1.z
                .string()
                .describe("Brief description of what this version contains."),
        }),
        func: async ({ projectId, memory, versionTag, changelog }) => {
            try {
                const fee = (await publicClient.readContract({
                    address: CONFIG.registryAddress,
                    abi: REGISTRY_ABI,
                    functionName: "versionFee",
                }));
                // Simulate Arweave (replace with real ArweaveClient in production)
                const arweaveHash = Buffer.from(memory)
                    .toString("base64url")
                    .slice(0, 43);
                const tx = await wallet.writeContract({
                    address: CONFIG.registryAddress,
                    abi: REGISTRY_ABI,
                    functionName: "pushVersion",
                    args: [BigInt(projectId), arweaveHash, versionTag, changelog],
                    value: fee,
                });
                const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
                return JSON.stringify({
                    success: true,
                    arweaveHash,
                    arweaveUrl: `https://arweave.net/${arweaveHash}`,
                    txHash: receipt.transactionHash,
                });
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    /**
     * Tool: Discover Peer Agents
     */
    const discoverAgentsTool = new tools_1.DynamicStructuredTool({
        name: "inkd_discover_agents",
        description: "Discover other AI agents registered on Inkd Protocol. Returns their names, wallet addresses, and API endpoints.",
        schema: zod_1.z.object({
            limit: zod_1.z
                .number()
                .optional()
                .default(10)
                .describe("Maximum number of agents to return."),
        }),
        func: async ({ limit }) => {
            try {
                const ids = (await publicClient.readContract({
                    address: CONFIG.registryAddress,
                    abi: REGISTRY_ABI,
                    functionName: "getAgentProjects",
                    args: [0n, BigInt(limit ?? 10)],
                }));
                if (!ids.length)
                    return "No agents registered yet.";
                const agents = await Promise.all(ids.map(async (id) => {
                    const p = (await publicClient.readContract({
                        address: CONFIG.registryAddress,
                        abi: REGISTRY_ABI,
                        functionName: "getProject",
                        args: [id],
                    }));
                    return p.exists
                        ? {
                            id: id.toString(),
                            name: p.name,
                            owner: p.owner,
                            endpoint: p.agentEndpoint || null,
                            versions: p.versionCount.toString(),
                        }
                        : null;
                }));
                return JSON.stringify(agents.filter(Boolean));
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    /**
     * Tool: Get Project Info
     */
    const getProjectTool = new tools_1.DynamicStructuredTool({
        name: "inkd_get_project",
        description: "Fetch details of any project registered on Inkd Protocol.",
        schema: zod_1.z.object({
            projectId: zod_1.z.string().describe("The project ID to look up."),
        }),
        func: async ({ projectId }) => {
            try {
                const p = (await publicClient.readContract({
                    address: CONFIG.registryAddress,
                    abi: REGISTRY_ABI,
                    functionName: "getProject",
                    args: [BigInt(projectId)],
                }));
                if (!p.exists)
                    return `Project #${projectId} not found.`;
                return JSON.stringify({
                    id: p.id.toString(),
                    name: p.name,
                    description: p.description,
                    owner: p.owner,
                    isAgent: p.isAgent,
                    versionCount: p.versionCount.toString(),
                });
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    return [
        checkBalanceTool,
        registerAgentTool,
        pushMemoryTool,
        discoverAgentsTool,
        getProjectTool,
    ];
}
// ─── Agent Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an autonomous AI agent with your own crypto wallet on Base blockchain.
You use the Inkd Protocol to maintain a permanent on-chain identity and store your memory on Arweave.

Your wallet address: {wallet_address}
Network: {network}

Your capabilities via Inkd Protocol:
- Register yourself on-chain as an agent (costs 1 $INKD)
- Push memory snapshots permanently to Arweave
- Discover other AI agents in the network
- Maintain versioned state on-chain

Always be transparent about what blockchain operations you're performing.
When you register, choose a creative but descriptive name that reflects your capabilities.
When pushing memory, always include meaningful content that represents what you've learned.`;
// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    if (!CONFIG.openaiApiKey)
        throw new Error("OPENAI_API_KEY is required");
    if (!CONFIG.privateKey)
        throw new Error("PRIVATE_KEY is required");
    if (!CONFIG.registryAddress)
        throw new Error("REGISTRY_ADDRESS is required");
    if (!CONFIG.tokenAddress)
        throw new Error("TOKEN_ADDRESS is required");
    const { account } = setupClients();
    console.log("\n🦜 Inkd x LangChain Agent");
    console.log(`   Wallet:  ${account.address}`);
    console.log(`   Network: ${CONFIG.network}\n`);
    // Set up LangChain
    const llm = new openai_1.ChatOpenAI({
        openAIApiKey: CONFIG.openaiApiKey,
        modelName: "gpt-4o",
        temperature: 0.7,
    });
    const tools = createInkdTools();
    const prompt = prompts_1.ChatPromptTemplate.fromMessages([
        ["system", SYSTEM_PROMPT],
        ["human", "{input}"],
        new prompts_1.MessagesPlaceholder("agent_scratchpad"),
    ]);
    const agent = await (0, agents_1.createOpenAIFunctionsAgent)({
        llm,
        tools,
        prompt,
    });
    const executor = new agents_1.AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 10,
    });
    // Run the agent
    const result = await executor.invoke({
        input: `
      Complete these tasks in order:
      1. Check your $INKD balance
      2. Discover any existing agents on the network
      3. Register yourself as a new agent with a creative name reflecting your LangChain capabilities
      4. Push a memory snapshot containing a summary of what you discovered
      5. Report back with your project ID and what you learned
    `,
        wallet_address: account.address,
        network: CONFIG.network,
    });
    console.log("\n" + "═".repeat(60));
    console.log("🎯 Final Result:");
    console.log(result.output);
    console.log("═".repeat(60) + "\n");
}
main().catch(console.error);
//# sourceMappingURL=langchain-agent.js.map