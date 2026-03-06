#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Inkd Protocol — Local Dev Node
#
#  Spins up a local Anvil node and deploys all Inkd contracts.
#  Prints deployed addresses and auto-updates cli/src/config.ts (testnet).
#
#  Usage:
#    bash scripts/local-deploy.sh          # standard
#    ANVIL_PORT=8545 bash scripts/local-deploy.sh
#    bash scripts/local-deploy.sh --no-update  # skip config.ts update
#
#  Requirements:
#    - Foundry (forge + anvil)
#    - Node.js ≥ 18
#    - Repo built (run setup.sh first)
#
#  After running:
#    export INKD_NETWORK=local
#    export INKD_RPC_URL=http://localhost:${ANVIL_PORT}
#    inkd status
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"; GREEN="\033[0;32m"; CYAN="\033[0;36m"
YELLOW="\033[0;33m"; RED="\033[0;31m"; RESET="\033[0m"; DIM="\033[2m"
ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET}  $*"; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANVIL_PORT="${ANVIL_PORT:-8545}"
UPDATE_CONFIG=true
for arg in "$@"; do [[ "$arg" == "--no-update" ]] && UPDATE_CONFIG=false; done

# ─── Anvil test accounts (deterministic from default mnemonic) ───────────────
# Account 0 — used as deployer + initial token distributor
DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:-0xYOUR_PRIVATE_KEY}"
DEPLOYER_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# ─── Check deps ──────────────────────────────────────────────────────────────
command -v anvil &> /dev/null || fail "Foundry not installed. Run: curl -L https://foundry.paradigm.xyz | bash && foundryup"
command -v forge  &> /dev/null || fail "Foundry not installed."

echo ""
echo -e "  ${BOLD}Inkd Protocol — Local Dev Node${RESET}"
echo -e "  ${DIM}Port: ${ANVIL_PORT} | Deployer: ${DEPLOYER_ADDR}${RESET}"
echo ""

# ─── Kill existing anvil on port ─────────────────────────────────────────────
if lsof -ti :"${ANVIL_PORT}" &>/dev/null; then
  warn "Killing existing process on port ${ANVIL_PORT}..."
  lsof -ti :"${ANVIL_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ─── Start Anvil ─────────────────────────────────────────────────────────────
info "Starting Anvil on port ${ANVIL_PORT}..."
anvil \
  --port "${ANVIL_PORT}" \
  --chain-id 31337 \
  --block-time 2 \
  --accounts 10 \
  --balance 10000 \
  --gas-limit 30000000 \
  --silent &
ANVIL_PID=$!
echo "$ANVIL_PID" > /tmp/inkd-anvil.pid

# Wait for anvil to be ready
for i in {1..20}; do
  if curl -sf "http://localhost:${ANVIL_PORT}" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    > /dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 20 ]; then
    fail "Anvil failed to start on port ${ANVIL_PORT}"
  fi
  sleep 0.5
done
ok "Anvil running (PID: ${ANVIL_PID})"

# ─── Build contracts ─────────────────────────────────────────────────────────
info "Building contracts..."
cd "${REPO_ROOT}/contracts"
forge build --quiet 2>&1 | tail -2
ok "Contracts built"

# ─── Deploy ──────────────────────────────────────────────────────────────────
info "Deploying Inkd contracts to local node..."

DEPLOY_OUTPUT=$(
  forge script script/Deploy.s.sol \
    --rpc-url "http://localhost:${ANVIL_PORT}" \
    --private-key "${DEPLOYER_KEY}" \
    --broadcast \
    --silent \
    2>&1
)

# Parse addresses from output
TOKEN_ADDR=$(echo "${DEPLOY_OUTPUT}"    | grep -i "inkdtoken deployed"    | grep -oE '0x[0-9a-fA-F]{40}' | head -1 || true)
REGISTRY_ADDR=$(echo "${DEPLOY_OUTPUT}" | grep -i "inkdregistry deployed" | grep -oE '0x[0-9a-fA-F]{40}' | head -1 || true)
TREASURY_ADDR=$(echo "${DEPLOY_OUTPUT}" | grep -i "inkdtreasury deployed" | grep -oE '0x[0-9a-fA-F]{40}' | head -1 || true)

# Fallback: if Deploy.s.sol uses run() with console.log, addresses might come from broadcast json
if [ -z "${TOKEN_ADDR}" ]; then
  BROADCAST_FILE="${REPO_ROOT}/contracts/broadcast/Deploy.s.sol/31337/run-latest.json"
  if [ -f "${BROADCAST_FILE}" ]; then
    TOKEN_ADDR=$(python3 -c "
import json, sys
data = json.load(open('${BROADCAST_FILE}'))
contracts = data.get('deployedContracts', []) or [t for t in data.get('transactions', []) if t.get('transactionType') == 'CREATE']
addrs = [c.get('contractAddress') for c in contracts if c.get('contractAddress')]
print(addrs[0] if len(addrs) > 0 else '')
" 2>/dev/null || true)
    REGISTRY_ADDR=$(python3 -c "
import json
data = json.load(open('${BROADCAST_FILE}'))
contracts = [t for t in data.get('transactions', []) if t.get('transactionType') == 'CREATE']
addrs = [c.get('contractAddress') for c in contracts if c.get('contractAddress')]
print(addrs[1] if len(addrs) > 1 else '')
" 2>/dev/null || true)
    TREASURY_ADDR=$(python3 -c "
import json
data = json.load(open('${BROADCAST_FILE}'))
contracts = [t for t in data.get('transactions', []) if t.get('transactionType') == 'CREATE']
addrs = [c.get('contractAddress') for c in contracts if c.get('contractAddress')]
print(addrs[2] if len(addrs) > 2 else '')
" 2>/dev/null || true)
  fi
fi

ok "Contracts deployed"

# ─── Print summary ────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Deployed Addresses${RESET}"
echo -e "  ${'─'.repeat(50) 2>/dev/null || printf '─%.0s' {1..50}}"
echo -e "  InkdToken     ${CYAN}${TOKEN_ADDR:-<check broadcast JSON>}${RESET}"
echo -e "  InkdRegistry  ${CYAN}${REGISTRY_ADDR:-<check broadcast JSON>}${RESET}"
echo -e "  InkdTreasury  ${CYAN}${TREASURY_ADDR:-<check broadcast JSON>}${RESET}"
echo ""
echo -e "  ${BOLD}RPC${RESET}      http://localhost:${ANVIL_PORT}"
echo -e "  ${BOLD}Chain ID${RESET} 31337"
echo -e "  ${BOLD}Deployer${RESET} ${DEPLOYER_ADDR}"
echo ""

# ─── Mint test tokens ────────────────────────────────────────────────────────
if [ -n "${TOKEN_ADDR}" ]; then
  info "Minting 10,000 test $INKD to first 3 test accounts..."
  for ACCT in \
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" \
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" \
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; do
    cast send "${TOKEN_ADDR}" \
      "transfer(address,uint256)" \
      "${ACCT}" "10000000000000000000000" \
      --rpc-url "http://localhost:${ANVIL_PORT}" \
      --private-key "${DEPLOYER_KEY}" \
      --quiet 2>/dev/null || warn "Could not mint to ${ACCT}"
  done
  ok "Test tokens distributed"
fi

# ─── Optional: update CLI config.ts ──────────────────────────────────────────
if $UPDATE_CONFIG && [ -n "${TOKEN_ADDR}" ] && [ -n "${REGISTRY_ADDR}" ] && [ -n "${TREASURY_ADDR}" ]; then
  CONFIG_TS="${REPO_ROOT}/cli/src/config.ts"
  if [ -f "${CONFIG_TS}" ]; then
    info "Updating cli/src/config.ts with local addresses..."
    # Write a local override file instead of mutating config.ts
    cat > "${REPO_ROOT}/cli/src/config.local.ts" << EOF
// AUTO-GENERATED by scripts/local-deploy.sh — do not commit
// Local Anvil deployment addresses (chain 31337)
export const LOCAL_ADDRESSES = {
  token:    '${TOKEN_ADDR}' as const,
  registry: '${REGISTRY_ADDR}' as const,
  treasury: '${TREASURY_ADDR}' as const,
}
EOF
    ok "Created cli/src/config.local.ts with local addresses"
  fi
fi

# ─── Export instructions ─────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Environment:${RESET}"
echo -e "  ${DIM}Copy-paste to use with the CLI or SDK:${RESET}"
echo ""
echo -e "  export INKD_NETWORK=testnet"
echo -e "  export INKD_RPC_URL=http://localhost:${ANVIL_PORT}"
[ -n "${TOKEN_ADDR}"    ] && echo -e "  export INKD_TOKEN=${TOKEN_ADDR}"
[ -n "${REGISTRY_ADDR}" ] && echo -e "  export INKD_REGISTRY=${REGISTRY_ADDR}"
[ -n "${TREASURY_ADDR}" ] && echo -e "  export INKD_TREASURY=${TREASURY_ADDR}"
echo -e "  export PRIVATE_KEY=${DEPLOYER_KEY}"
echo ""
echo -e "  ${GREEN}${BOLD}✅  Local node ready!${RESET}  ${DIM}(Anvil PID: ${ANVIL_PID} — kill with: kill ${ANVIL_PID})${RESET}"
echo -e "  ${DIM}Logs: tail -f /tmp/inkd-anvil.log${RESET}"
echo ""

# ─── Keep alive ──────────────────────────────────────────────────────────────
# If this script is being piped or non-interactively sourced, don't block.
# Otherwise wait for the user to Ctrl-C before killing anvil.
if [ -t 0 ]; then
  echo -e "  ${DIM}Press Ctrl-C to stop the local node.${RESET}"
  echo ""
  trap "echo ''; info 'Stopping local node (PID: ${ANVIL_PID})...'; kill ${ANVIL_PID} 2>/dev/null; rm -f /tmp/inkd-anvil.pid; ok 'Local node stopped.'; echo ''" INT TERM
  wait "${ANVIL_PID}" 2>/dev/null || true
fi
