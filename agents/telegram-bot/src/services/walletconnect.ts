import SignClient from '@walletconnect/sign-client'
import type { SessionTypes } from '@walletconnect/types'

const REQUIRED_NAMESPACES = {
  eip155: {
    chains: ['eip155:8453'],
    methods: ['personal_sign', 'eth_sign', 'eth_signTypedData'],
    events: [],
  },
}

let clientPromise: Promise<SignClient> | null = null

async function getClient() {
  if (!clientPromise) {
    const projectId = process.env.WALLETCONNECT_PROJECT_ID
    if (!projectId) throw new Error('WALLETCONNECT_PROJECT_ID missing')
    clientPromise = SignClient.init({
      projectId,
      metadata: {
        name: 'inkd Telegram Bot',
        description: 'Wallet-gated uploads to inkd',
        url: 'https://inkdprotocol.com',
        icons: ['https://inkdprotocol.com/logo.jpg'],
      },
    })
  }
  return clientPromise
}

export async function createWalletConnectSession() {
  const client = await getClient()
  const { uri, approval } = await client.connect({
    requiredNamespaces: REQUIRED_NAMESPACES,
  })
  return { uri, approval }
}

export function extractAddress(session: SessionTypes.Struct) {
  const accounts = session.namespaces['eip155']?.accounts ?? []
  if (!accounts.length) throw new Error('No account returned from WalletConnect session')
  // format: eip155:8453:0xabc...
  const account = accounts[0]
  const parts = account.split(':')
  return parts[2]
}
