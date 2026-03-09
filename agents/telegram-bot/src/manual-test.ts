import 'dotenv/config'
import { uploadText } from './services/arweave'
import { createProject } from './services/registry'

async function main() {
  const receipt = await uploadText('telegram bot smoke test')
  console.log('Arweave:', receipt)
  const wallet = process.env.TEST_OWNER ?? process.env.TEST_OWNER_WALLET ?? ''
  if (!wallet) throw new Error('Set TEST_OWNER to the wallet that should own the project')
  const tx = await createProject(wallet, `tg-bot-${Date.now()}`, receipt.hash)
  console.log('Registry tx:', tx?.transactionHash ?? tx)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
