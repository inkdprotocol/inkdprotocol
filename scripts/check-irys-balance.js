#!/usr/bin/env node
/**
 * Irys server wallet balance monitor.
 * Run via: cron or manually.
 * Alerts if balance drops below MIN_ETH threshold.
 */

const WALLET = '0x210bDf52ad7afE3Ea7C67323eDcCD699598983C0'
const RPC    = 'https://mainnet.base.org'
const MIN_ETH = 0.005  // Alert threshold

async function getBalance() {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_getBalance',
      params: [WALLET, 'latest']
    })
  })
  const { result } = await res.json()
  return parseInt(result, 16) / 1e18
}

getBalance().then(eth => {
  const status = eth < MIN_ETH ? 'LOW' : 'OK'
  console.log(JSON.stringify({ wallet: WALLET, eth: eth.toFixed(6), status, threshold: MIN_ETH }))
  if (status === 'LOW') {
    process.stderr.write(`⚠️ Irys wallet LOW: ${eth.toFixed(6)} ETH (threshold: ${MIN_ETH})\n`)
    process.exit(1)  // Non-zero exit triggers alert
  }
}).catch(e => { console.error(e); process.exit(1) })
