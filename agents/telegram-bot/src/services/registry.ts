import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import { REGISTRY_ABI } from '../abi/registry'

const registryAddress = process.env.INKD_REGISTRY_ADDRESS
const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
const privateKey = process.env.BOT_SERVER_WALLET_KEY

if (!registryAddress || !privateKey) {
  throw new Error('Registry address or wallet key missing')
}

const provider = new JsonRpcProvider(rpcUrl)
const wallet = new Wallet(privateKey, provider)
const registry = new Contract(registryAddress, REGISTRY_ABI, wallet)

export async function createProject(owner: string, name: string, readmeHash: string) {
  const tagsHash = `0x${'00'.repeat(32)}`
  const tx = await registry.createProjectV2(
    owner,
    name,
    '',
    'MIT',
    true,
    readmeHash,
    false,
    '',
    '',
    0,
    '',
    tagsHash,
  )
  const receipt = await tx.wait()
  return receipt
}
