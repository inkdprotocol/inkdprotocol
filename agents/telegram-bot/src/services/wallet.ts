/**
 * Bot wallet management — generate, encrypt, decrypt wallets
 */
import crypto from 'node:crypto'
import { Wallet, JsonRpcProvider, formatEther, formatUnits, Contract } from 'ethers'
import { createWalletClient, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// Lazy-init encryption secret
let encryptSecret: Buffer | null = null
function getEncryptSecret(): Buffer {
  if (encryptSecret) return encryptSecret
  const secret = process.env.BOT_ENCRYPT_SECRET
  if (!secret) throw new Error('BOT_ENCRYPT_SECRET not set')
  // Derive 32-byte key from secret
  encryptSecret = crypto.createHash('sha256').update(secret).digest()
  return encryptSecret
}

// USDC on Base mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

/**
 * Generate a new random wallet
 */
export function generateWallet(): { address: string; privateKey: string } {
  const wallet = Wallet.createRandom()
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  }
}

/**
 * Encrypt a private key with AES-256-GCM
 * Returns: "iv:authTag:ciphertext" (all hex)
 */
export function encryptPrivateKey(privateKey: string): string {
  const key = getEncryptSecret()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt an encrypted private key
 */
export function decryptPrivateKey(encrypted: string): string {
  const key = getEncryptSecret()
  const [ivHex, tagHex, cipherHex] = encrypted.split(':')
  
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('Invalid encrypted key format')
  }
  
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(cipherHex, 'hex')
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  
  return decrypted.toString('utf8')
}

/**
 * Get wallet balance (ETH + USDC)
 */
export async function getWalletBalance(address: string): Promise<{
  eth: string
  ethRaw: bigint
  usdc: string
  usdcRaw: bigint
}> {
  const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
  const provider = new JsonRpcProvider(rpcUrl)
  
  const [ethBalance, usdcBalance] = await Promise.all([
    provider.getBalance(address),
    (async () => {
      const usdc = new Contract(USDC_ADDRESS, USDC_ABI, provider)
      return usdc.balanceOf(address) as Promise<bigint>
    })(),
  ])
  
  return {
    eth: formatEther(ethBalance),
    ethRaw: ethBalance,
    usdc: formatUnits(usdcBalance, 6),
    usdcRaw: usdcBalance,
  }
}

/**
 * Check if wallet has sufficient USDC balance for a payment
 */
export async function checkUsdcBalance(address: string, requiredUsdc: bigint): Promise<{
  ok: boolean
  balance: bigint
  required: bigint
  shortfall: bigint
}> {
  const { usdcRaw } = await getWalletBalance(address)
  const shortfall = requiredUsdc > usdcRaw ? requiredUsdc - usdcRaw : BigInt(0)
  return {
    ok: usdcRaw >= requiredUsdc,
    balance: usdcRaw,
    required: requiredUsdc,
    shortfall,
  }
}

/**
 * Send USDC to a recipient address.
 * Returns the transaction hash.
 */
export async function sendUsdc(
  encryptedKey: string,
  to: string,
  amountUsdc: number,
): Promise<string> {
  const wallet = getWalletFromEncrypted(encryptedKey)
  const usdc = new Contract(USDC_ADDRESS, [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
  ], wallet)

  const decimals: number = await usdc.decimals()
  const amount = BigInt(Math.round(amountUsdc * 10 ** decimals))
  const tx = await usdc.transfer(to, amount)
  const receipt = await tx.wait()
  if (!receipt) throw new Error('Transaction receipt unavailable')
  return receipt.hash
}

/**
 * Send ETH to a recipient address.
 * Returns the transaction hash.
 */
export async function sendEth(
  encryptedKey: string,
  to: string,
  amountEth: number,
): Promise<string> {
  const wallet = getWalletFromEncrypted(encryptedKey)
  const tx = await wallet.sendTransaction({
    to,
    value: BigInt(Math.round(amountEth * 1e18)),
  })
  const receipt = await tx.wait()
  if (!receipt) throw new Error('Transaction receipt unavailable')
  return receipt.hash
}

/**
 * Get a Wallet instance from encrypted key (ethers)
 */
export function getWalletFromEncrypted(encryptedKey: string): Wallet {
  const privateKey = decryptPrivateKey(encryptedKey)
  const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
  const provider = new JsonRpcProvider(rpcUrl)
  return new Wallet(privateKey, provider)
}

/**
 * Get viem WalletClient + PublicClient from encrypted key
 */
export function getViemWalletClient(encryptedKey: string) {
  const privateKey = decryptPrivateKey(encryptedKey)
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  })
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  })
  
  return { walletClient, publicClient, account }
}
