/**
 * @file openai-agent.ts
 * @description OpenAI Assistants integration with Inkd Protocol.
 *              Shows how an OpenAI Assistant can use Inkd as its permanent
 *              memory and identity layer — registering projects, pushing
 *              memory versions, and discovering other AI agents on-chain.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... PRIVATE_KEY=0x... REGISTRY_ADDRESS=0x... TOKEN_ADDRESS=0x... \
 *   npx ts-node examples/ai-agents/openai-agent.ts
 *
 * Install deps:
 *   npm install openai viem
 */

import OpenAI from "openai";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Address,
  type Hash,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ─── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  privateKey: (process.env.PRIVATE_KEY ?? "") as `0x${string}`,
  registryAddress: (process.env.REGISTRY_ADDRESS ?? "") as Address,
  tokenAddress: (process.env.TOKEN_ADDRESS ?? "") as Address,
  rpcUrl: process.env.RPC_URL ?? "https://mainnet.base.org",
  network: (process.env.NETWORK ?? "testnet") as "mainnet" | "testnet",
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
          { name: "isPublic", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "versionCount", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
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
] as const;

// ─── Inkd Tool Implementations ────────────────────────────────────────────────

class InkdTools {
  private wallet: ReturnType<typeof createWalletClient>;
  private publicClient: ReturnType<typeof createPublicClient>;
  private account: ReturnType<typeof privateKeyToAccount>;

  constructor() {
    const chain = CONFIG.network === "mainnet" ? base : baseSepolia;
    this.account = privateKeyToAccount(CONFIG.privateKey);
    this.wallet = createWalletClient({
      account: this.account,
      chain,
      transport: http(CONFIG.rpcUrl),
    });
    this.publicClient = createPublicClient({
      chain,
      transport: http(CONFIG.rpcUrl),
    });
  }

  get address(): Address {
    return this.account.address;
  }

  async getBalance(): Promise<string> {
    const balance = (await this.publicClient.readContract({
      address: CONFIG.tokenAddress,
      abi: TOKEN_ABI,
      functionName: "balanceOf",
      args: [this.account.address],
    })) as bigint;
    return `${formatEther(balance)} $INKD`;
  }

  async registerAgent(params: {
    name: string;
    description: string;
    endpoint?: string;
  }): Promise<{ txHash: Hash; projectId: string }> {
    // Approve token
    await this.wallet.writeContract({
      address: CONFIG.tokenAddress,
      abi: TOKEN_ABI,
      functionName: "approve",
      args: [CONFIG.registryAddress, parseEther("1")],
    });

    const tx = await this.wallet.writeContract({
      address: CONFIG.registryAddress,
      abi: REGISTRY_ABI,
      functionName: "createProject",
      args: [
        params.name,
        params.description,
        "MIT",
        "", // readmeHash
        params.endpoint ?? "",
        true, // isAgent
        true, // isPublic
      ],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
    // Note: in production, parse ProjectCreated event for accurate projectId
    const projectId = `${Date.now() % 100000}`;
    return { txHash: receipt.transactionHash, projectId };
  }

  async pushMemory(params: {
    projectId: string;
    content: string;
    versionTag: string;
    changelog: string;
  }): Promise<{ txHash: Hash; arweaveHash: string }> {
    const fee = (await this.publicClient.readContract({
      address: CONFIG.registryAddress,
      abi: REGISTRY_ABI,
      functionName: "versionFee",
    })) as bigint;

    // Simulate Arweave hash (in production, upload via @inkd/sdk ArweaveClient)
    const arweaveHash = Buffer.from(params.content)
      .toString("base64url")
      .slice(0, 43);

    const tx = await this.wallet.writeContract({
      address: CONFIG.registryAddress,
      abi: REGISTRY_ABI,
      functionName: "pushVersion",
      args: [
        BigInt(params.projectId),
        arweaveHash,
        params.versionTag,
        params.changelog,
      ],
      value: fee,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
    return { txHash: receipt.transactionHash, arweaveHash };
  }

  async discoverAgents(limit = 10): Promise<string> {
    const ids = (await this.publicClient.readContract({
      address: CONFIG.registryAddress,
      abi: REGISTRY_ABI,
      functionName: "getAgentProjects",
      args: [0n, BigInt(limit)],
    })) as readonly bigint[];

    const results: string[] = [];
    for (const id of ids) {
      const p = (await this.publicClient.readContract({
        address: CONFIG.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "getProject",
        args: [id],
      })) as {
        name: string;
        owner: Address;
        agentEndpoint: string;
        exists: boolean;
      };
      if (p.exists) {
        results.push(
          `#${id}: ${p.name} | Owner: ${p.owner}${p.agentEndpoint ? ` | Endpoint: ${p.agentEndpoint}` : ""}`
        );
      }
    }

    return results.length > 0
      ? `Found ${results.length} agents:\n${results.join("\n")}`
      : "No agents found on-chain yet.";
  }
}

// ─── OpenAI Tool Definitions ─────────────────────────────────────────────────

const INKD_TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "inkd_get_balance",
    description:
      "Check the agent's $INKD token balance. Required to register on-chain (costs 1 $INKD).",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "inkd_register_agent",
    description:
      "Register this AI agent on the Inkd Protocol, creating a permanent on-chain identity. Costs 1 $INKD (locked, not spent).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Unique agent name (alphanumeric, hyphens OK). Max 64 chars.",
        },
        description: {
          type: "string",
          description: "What this agent does. Will be stored on-chain.",
        },
        endpoint: {
          type: "string",
          description: "Optional HTTPS endpoint where this agent can be reached.",
        },
      },
      required: ["name", "description"],
    },
  },
  {
    type: "function",
    name: "inkd_push_memory",
    description:
      "Push a memory snapshot to Arweave and record a new version on-chain. Use this to persist important information permanently.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "The project ID returned by inkd_register_agent.",
        },
        content: {
          type: "string",
          description: "The memory/state to persist (JSON or text).",
        },
        version_tag: {
          type: "string",
          description: "Version identifier, e.g. 'v1.0.1' or 'memory-2024-01-15'.",
        },
        changelog: {
          type: "string",
          description: "Description of what changed in this memory version.",
        },
      },
      required: ["project_id", "content", "version_tag", "changelog"],
    },
  },
  {
    type: "function",
    name: "inkd_discover_agents",
    description:
      "Discover other AI agents registered on the Inkd Protocol. Returns a list of agent names, owners, and endpoints.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max number of agents to return (default: 10).",
        },
      },
      required: [],
    },
  },
];

// ─── Tool Executor ────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  inkd: InkdTools
): Promise<string> {
  console.log(`\n⚡ Executing tool: ${toolName}`);
  console.log(`   Args: ${JSON.stringify(toolArgs)}`);

  switch (toolName) {
    case "inkd_get_balance":
      return await inkd.getBalance();

    case "inkd_register_agent":
      const reg = await inkd.registerAgent({
        name: toolArgs.name as string,
        description: toolArgs.description as string,
        endpoint: toolArgs.endpoint as string | undefined,
      });
      return JSON.stringify(reg);

    case "inkd_push_memory":
      const push = await inkd.pushMemory({
        projectId: toolArgs.project_id as string,
        content: toolArgs.content as string,
        versionTag: toolArgs.version_tag as string,
        changelog: toolArgs.changelog as string,
      });
      return JSON.stringify(push);

    case "inkd_discover_agents":
      return await inkd.discoverAgents((toolArgs.limit as number) ?? 10);

    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!CONFIG.openaiApiKey) throw new Error("OPENAI_API_KEY is required");
  if (!CONFIG.privateKey) throw new Error("PRIVATE_KEY is required");
  if (!CONFIG.registryAddress) throw new Error("REGISTRY_ADDRESS is required");
  if (!CONFIG.tokenAddress) throw new Error("TOKEN_ADDRESS is required");

  const openai = new OpenAI({ apiKey: CONFIG.openaiApiKey });
  const inkd = new InkdTools();

  console.log(`\n🤖 Inkd x OpenAI Agent`);
  console.log(`   Wallet: ${inkd.address}\n`);

  const userMessage = `
    You are an autonomous AI agent with your own crypto wallet.
    Your wallet address is ${inkd.address}.
    
    Your task:
    1. Check your $INKD balance
    2. Register yourself on the Inkd Protocol with a creative name and description
    3. Push a memory snapshot with your current knowledge
    4. Discover other agents on the network
    5. Report what you found
    
    Use the available tools to complete these tasks.
  `.trim();

  console.log(`📨 User: ${userMessage}\n`);

  // Agentic loop
  const messages: OpenAI.Responses.EasyInputMessage[] = [
    { role: "user", content: userMessage },
  ];

  let continueLoop = true;
  while (continueLoop) {
    const response = await openai.responses.create({
      model: "gpt-4o",
      input: messages,
      tools: INKD_TOOLS,
    });

    // Collect assistant outputs
    const assistantOutputs: OpenAI.Responses.ResponseOutputItem[] = [];

    for (const output of response.output) {
      assistantOutputs.push(output);

      if (output.type === "message") {
        for (const block of output.content) {
          if (block.type === "output_text") {
            console.log(`\n🤖 Assistant: ${block.text}`);
          }
        }
      }

      if (output.type === "function_call") {
        const result = await executeTool(
          output.name,
          JSON.parse(output.arguments),
          inkd
        );
        console.log(`   Result: ${result}`);

        // Add tool result for next iteration
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: output.call_id,
              content: result,
            } as OpenAI.Responses.ToolResultContentBlock,
          ],
        });
      }
    }

    // Add assistant's response to history
    messages.push({ role: "assistant", content: assistantOutputs } as OpenAI.Responses.EasyInputMessage);

    // Stop if no tool calls (model is done)
    const hasToolCalls = assistantOutputs.some((o) => o.type === "function_call");
    if (!hasToolCalls || response.status === "completed") {
      continueLoop = false;
    }
  }

  console.log("\n✅ Agent run complete.\n");
}

main().catch(console.error);
