/**
 * E2E Mainnet Test — Full x402 USDC Payment Flow
 * Run: AGENT_PRIVATE_KEY=0x... npx tsx examples/e2e-mainnet.ts
 */

import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme }                    from '@x402/evm'
import { privateKeyToAccount }               from 'viem/accounts'
import { createWalletClient, publicActions, http } from 'viem'
import { base }                              from 'viem/chains'

const AGENT_PRIVATE_KEY = (process.env['AGENT_PRIVATE_KEY'] ?? '') as `0x${string}`
const API_URL           = process.env['API_URL'] ?? 'https://api.inkdprotocol.com'

if (!AGENT_PRIVATE_KEY) { console.error('AGENT_PRIVATE_KEY required'); process.exit(1) }

const account = privateKeyToAccount(AGENT_PRIVATE_KEY)

// Extend wallet client with publicActions — required by ExactEvmScheme (needs readContract)
const walletClient = createWalletClient({ account, chain: base, transport: http() }).extend(publicActions)

// Build x402 client — EIP-3009 on Base Mainnet (eip155:8453)
const client = new x402Client().register('eip155:8453', new ExactEvmScheme(walletClient as any))
const fetchPay = wrapFetchWithPayment(fetch, client)

console.log(`\n══════════════════════════════════════════════`)
console.log(`  inkd E2E — Base Mainnet`)
console.log(`  wallet: ${account.address}`)
console.log(`  api:    ${API_URL}\n`)

async function testCreateProject(): Promise<string | null> {
  console.log('TEST 1 — createProject ($5 USDC)')
  const name = `e2e-${Date.now()}`
  console.log(`  POST /v1/projects  name=${name}`)
  let res: Response
  try {
    res = await fetchPay(`${API_URL}/v1/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: 'E2E test', license: 'MIT', isPublic: true, isAgent: true, agentEndpoint: 'https://agent.example.com' }),
    })
  } catch (e) { console.error('  ❌ FETCH ERROR:', e); return null }

  const body = await res.json()
  if (!res.ok) { console.error(`  ❌ [${res.status}]`, body); return null }
  console.log(`  ✅ [${res.status}] projectId=${body.projectId} tx=${body.txHash}`)
  console.log(`     https://basescan.org/tx/${body.txHash}\n`)
  return body.projectId
}

async function testPushVersion(projectId: string): Promise<boolean> {
  console.log('TEST 2 — pushVersion ($2 USDC)')
  console.log(`  POST /v1/projects/${projectId}/versions`)
  let res: Response
  try {
    res = await fetchPay(`${API_URL}/v1/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'v1.0.0', contentHash: 'ar://QmE2ETestHash1234', metadataHash: '' }),
    })
  } catch (e) { console.error('  ❌ FETCH ERROR:', e); return false }

  const body = await res.json()
  if (!res.ok) { console.error(`  ❌ [${res.status}]`, body); return false }
  console.log(`  ✅ [${res.status}] tag=${body.tag} tx=${body.txHash}`)
  console.log(`     https://basescan.org/tx/${body.txHash}\n`)
  return true
}

async function testRead(projectId: string) {
  console.log('TEST 3 — readProject (free)')
  const res  = await fetch(`${API_URL}/v1/projects/${projectId}`)
  const body = await res.json()
  if (!res.ok) { console.error(`  ❌ [${res.status}]`, body); return }
  console.log(`  ✅ [${res.status}]`, JSON.stringify(body.data ?? body, null, 2))
}

async function main() {
  const projectId = await testCreateProject()
  if (!projectId) { console.log('RESULT: ❌ aborted'); process.exit(1) }
  const ok = await testPushVersion(projectId)
  await testRead(projectId)
  console.log('══════════════════════════════════════════════')
  console.log(`RESULT: createProject ✅  pushVersion ${ok ? '✅' : '❌'}  readProject ✅`)
  console.log('══════════════════════════════════════════════\n')
  if (!ok) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
