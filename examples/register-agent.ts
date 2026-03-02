/**
 * examples/register-agent.ts
 *
 * Demonstrates how to register an AI agent project on Inkd Protocol using
 * the TypeScript SDK. Runs against Base Sepolia testnet by default.
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   npx ts-node examples/register-agent.ts
 */

import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env['PRIVATE_KEY'] as `0x${string}`
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY env var required')

// Replace with deployed contract addresses after running: forge script DryRun
const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`
const TOKEN_ADDRESS    = '0x0000000000000000000000000000000000000000' as `0x${string}`

// ─── ABIs (minimal) ──────────────────────────────────────────────────────────

const TOKEN_ABI = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

const REGISTRY_ABI = [
  { name: 'createProject', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'description', type: 'string' }, { name: 'license', type: 'string' }, { name: 'isPublic', type: 'bool' }, { name: 'readmeHash', type: 'string' }, { name: 'isAgent', type: 'bool' }, { name: 'agentEndpoint', type: 'string' }], outputs: [] },
  { name: 'getProject', type: 'function', stateMutability: 'view', inputs: [{ name: 'projectId', type: 'uint256' }], outputs: [{ name: '', type: 'tuple', components: [{ name: 'id', type: 'uint256' }, { name: 'name', type: 'string' }, { name: 'description', type: 'string' }, { name: 'license', type: 'string' }, { name: 'readmeHash', type: 'string' }, { name: 'owner', type: 'address' }, { name: 'isPublic', type: 'bool' }, { name: 'isAgent', type: 'bool' }, { name: 'agentEndpoint', type: 'string' }, { name: 'createdAt', type: 'uint256' }, { name: 'versionCount', type: 'uint256' }, { name: 'exists', type: 'bool' }] }] },
  { name: 'projectCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'event', name: 'ProjectCreated',
    inputs: [{ name: 'projectId', type: 'uint256', indexed: true }, { name: 'owner', type: 'address', indexed: true }, { name: 'name', type: 'string', indexed: false }, { name: 'isAgent', type: 'bool', indexed: false }],
  },
] as const

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY)
  console.log(`\n🤖 Inkd Agent Registration Example`)
  console.log(`   Wallet: ${account.address}`)
  console.log(`   Network: Base Sepolia\n`)

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() })

  // 1. Check token balance
  const balance = await publicClient.readContract({
    address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: 'balanceOf', args: [account.address],
  })
  console.log(`💰 $INKD balance: ${Number(balance) / 1e18} INKD`)

  if (balance < parseEther('1')) {
    throw new Error('Insufficient $INKD balance. Need at least 1 INKD to register a project.')
  }

  // 2. Approve registry to spend 1 INKD
  const allowance = await publicClient.readContract({
    address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: 'allowance',
    args: [account.address, REGISTRY_ADDRESS],
  })

  if (allowance < parseEther('1')) {
    console.log('⏳ Approving 1 $INKD for registry...')
    const approveTx = await walletClient.writeContract({
      address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: 'approve',
      args: [REGISTRY_ADDRESS, parseEther('1')],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log(`✅ Approved: ${approveTx}`)
  } else {
    console.log('✅ Already approved')
  }

  // 3. Register the agent project
  const agentConfig = {
    name: 'my-trading-agent',
    description: 'Autonomous trading agent that monitors Base DeFi protocols',
    license: 'MIT',
    isPublic: true,
    readmeHash: '', // set to Arweave hash of your README
    isAgent: true,
    agentEndpoint: 'https://api.myagent.xyz/v1',
  }

  console.log(`\n📝 Registering agent: ${agentConfig.name}`)
  console.log(`   Endpoint: ${agentConfig.agentEndpoint}`)

  const createTx = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'createProject',
    args: [
      agentConfig.name,
      agentConfig.description,
      agentConfig.license,
      agentConfig.isPublic,
      agentConfig.readmeHash,
      agentConfig.isAgent,
      agentConfig.agentEndpoint,
    ],
  })

  console.log(`⏳ Tx: ${createTx}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createTx })

  if (receipt.status !== 'success') {
    throw new Error('Transaction reverted. Check name uniqueness and token balance.')
  }

  // 4. Fetch the new project ID from event logs
  const totalProjects = await publicClient.readContract({
    address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: 'projectCount',
  })

  const projectId = totalProjects // last created = highest ID
  const project = await publicClient.readContract({
    address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: 'getProject', args: [projectId],
  }) as { id: bigint; name: string; owner: string; isAgent: boolean; versionCount: bigint }

  console.log(`\n🎉 Agent registered successfully!`)
  console.log(`   Project ID: #${project.id}`)
  console.log(`   Name:       ${project.name}`)
  console.log(`   Owner:      ${project.owner}`)
  console.log(`   Block:      ${receipt.blockNumber}`)
  console.log(`\n📖 Next steps:`)
  console.log(`   inkd version push --id ${project.id} --hash <arweave-hash> --tag v0.1.0`)
  console.log(`   inkd watch agents`)
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`)
  process.exit(1)
})
