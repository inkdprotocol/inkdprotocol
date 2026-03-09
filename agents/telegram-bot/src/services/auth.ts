import crypto from 'node:crypto'
import { verifyMessage } from 'ethers'

export function createChallenge(telegramId: number) {
  const nonce = crypto.randomBytes(8).toString('hex')
  return `inkd bot login for ${telegramId} :: nonce ${nonce}`
}

export async function recoverWalletFromSignature(message: string, signature: string) {
  return verifyMessage(message, signature)
}
