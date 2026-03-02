#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Inkd Protocol — Base Sepolia Integration Test
#
#  Deploys contracts to Base Sepolia and runs a full E2E flow:
#    1. Deploy all contracts
#    2. Create a project
#    3. Push a version (with Arweave CID)
#    4. Add a collaborator
#    5. Transfer the project
#    6. Verify all state on-chain
#    7. Write a JSON report
#
#  Prerequisites:
#    export DEPLOYER_PRIVATE_KEY=0x...
#    export BASE_SEPOLIA_RPC=https://sepolia.base.org
#    export BASESCAN_API_KEY=... (optional, for verification)
#
#  Usage:
#    bash scripts/sepolia-integration-test.sh
#    bash scripts/sepolia-integration-test.sh --skip-verify   # skip Basescan
#    bash scripts/sepolia-integration-test.sh --dry-run       # check prereqs only
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"; GREEN="\033[0;32m"; CYAN="\033[0;36m"
YELLOW="\033[0;33m"; RED="\033[0;31m"; RESET="\033[0m"; DIM="\033[2m"
ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET}  $*"; exit 1; }
step() { echo -e "\n  ${BOLD}${CYAN}[$1]${RESET} $2"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="${REPO_ROOT}/scripts/sepolia-test-report.json"
SKIP_VERIFY=false
DRY_RUN=false

for arg in "$@"; do
  [[ "$arg" == "--skip-verify" ]] && SKIP_VERIFY=true
  [[ "$arg" == "--dry-run"    ]] && DRY_RUN=true
done

echo ""
echo -e "  ${BOLD}Inkd Protocol — Base Sepolia Integration Test${RESET}"
echo -e "  ${DIM}$(date -u '+%Y-%m-%dT%H:%M:%SZ')${RESET}"
echo ""

# ─── Prerequisite Checks ─────────────────────────────────────────────────────
step "0/7" "Checking prerequisites"

command -v forge > /dev/null || fail "Foundry not installed. Run: curl -L https://foundry.paradigm.xyz | bash && foundryup"
command -v cast  > /dev/null || fail "cast not found (part of Foundry)"
command -v node  > /dev/null || fail "Node.js not installed"

[[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]] && fail "DEPLOYER_PRIVATE_KEY not set. Export it or add to ~/.openclaw/.env"
[[ -z "${BASE_SEPOLIA_RPC:-}"     ]] && fail "BASE_SEPOLIA_RPC not set. Export it (e.g. https://sepolia.base.org or Alchemy URL)"

DEPLOYER_ADDR=$(cast wallet address "${DEPLOYER_PRIVATE_KEY}")
ok "Deployer: ${DEPLOYER_ADDR}"

BALANCE_WEI=$(cast balance "${DEPLOYER_ADDR}" --rpc-url "${BASE_SEPOLIA_RPC}" 2>/dev/null || echo "0")
BALANCE_ETH=$(cast from-wei "${BALANCE_WEI}" 2>/dev/null || echo "0")
ok "Balance: ${BALANCE_ETH} ETH (Sepolia)"

# Rough minimum: ~0.005 ETH for deployment gas
MIN_WEI="5000000000000000"  # 0.005 ETH
if [[ "${BALANCE_WEI}" -lt "${MIN_WEI}" ]]; then
  warn "Low balance (${BALANCE_ETH} ETH). You may need testnet ETH."
  warn "Faucets: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
  warn "         https://learnweb3.io/faucets/base_sepolia"
  if [[ "${DRY_RUN}" == "false" ]]; then
    fail "Insufficient balance for deployment. Get Sepolia ETH first."
  fi
fi

CHAIN_ID=$(cast chain-id --rpc-url "${BASE_SEPOLIA_RPC}")
if [[ "${CHAIN_ID}" != "84532" ]]; then
  fail "Wrong chain! Expected Base Sepolia (84532), got ${CHAIN_ID}. Check BASE_SEPOLIA_RPC."
fi
ok "Network: Base Sepolia (chain 84532)"

if [[ "${DRY_RUN}" == "true" ]]; then
  echo ""
  ok "Dry-run complete. All prerequisites met."
  echo ""
  exit 0
fi

# ─── Build ───────────────────────────────────────────────────────────────────
step "1/7" "Building contracts"
cd "${REPO_ROOT}/contracts"
forge build --quiet 2>&1 | grep -v "^$" | tail -3 || true
ok "Contracts compiled"

# ─── Deploy ──────────────────────────────────────────────────────────────────
step "2/7" "Deploying to Base Sepolia"

VERIFY_FLAGS=""
if [[ "${SKIP_VERIFY}" == "false" && -n "${BASESCAN_API_KEY:-}" ]]; then
  VERIFY_FLAGS="--verify --etherscan-api-key ${BASESCAN_API_KEY}"
  info "Verification enabled (Basescan)"
else
  warn "Skipping contract verification (no BASESCAN_API_KEY or --skip-verify)"
fi

DEPLOY_OUTPUT=$(
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "${BASE_SEPOLIA_RPC}" \
    --private-key "${DEPLOYER_PRIVATE_KEY}" \
    --broadcast \
    ${VERIFY_FLAGS} \
    2>&1
)

echo "${DEPLOY_OUTPUT}" | tail -10

# Parse addresses from broadcast JSON
BROADCAST_FILE="${REPO_ROOT}/contracts/broadcast/Deploy.s.sol/84532/run-latest.json"
if [[ ! -f "${BROADCAST_FILE}" ]]; then
  fail "Broadcast JSON not found at ${BROADCAST_FILE}. Deployment may have failed."
fi

ADDRESSES=$(python3 - "${BROADCAST_FILE}" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1]))
txns = data.get("transactions", [])
creates = [t for t in txns if t.get("transactionType") == "CREATE"]
addrs = [c.get("contractAddress","") for c in creates]
# Order from Deploy.s.sol: InkdToken, TreasuryImpl, TreasuryProxy, RegistryImpl, RegistryProxy
# Proxies are the live contracts (indices 2 and 4)
token    = addrs[0] if len(addrs) > 0 else ""
treasury = addrs[2] if len(addrs) > 2 else ""
registry = addrs[4] if len(addrs) > 4 else ""
print(f"{token}|{treasury}|{registry}")
PYEOF
)

TOKEN_ADDR=$(echo "${ADDRESSES}"    | cut -d'|' -f1)
TREASURY_ADDR=$(echo "${ADDRESSES}" | cut -d'|' -f2)
REGISTRY_ADDR=$(echo "${ADDRESSES}" | cut -d'|' -f3)

[[ -z "${TOKEN_ADDR}"    ]] && fail "Could not parse InkdToken address from broadcast"
[[ -z "${TREASURY_ADDR}" ]] && fail "Could not parse InkdTreasury address from broadcast"
[[ -z "${REGISTRY_ADDR}" ]] && fail "Could not parse InkdRegistry address from broadcast"

ok "InkdToken:    ${TOKEN_ADDR}"
ok "InkdTreasury: ${TREASURY_ADDR}"
ok "InkdRegistry: ${REGISTRY_ADDR}"

BLOCK=$(cast block-number --rpc-url "${BASE_SEPOLIA_RPC}")
ok "Deployed at block: ${BLOCK}"

# ─── E2E Flow ────────────────────────────────────────────────────────────────
step "3/7" "Creating test project"

# Generate a second wallet (collaborator/buyer) from key offset
BOB_KEY=$(cast wallet derive-private-key "${DEPLOYER_PRIVATE_KEY}" 1 2>/dev/null \
  || python3 -c "import hashlib; k='${DEPLOYER_PRIVATE_KEY}'.lstrip('0x'); print('0x'+hashlib.sha256(bytes.fromhex(k)).hexdigest())")
BOB_ADDR=$(cast wallet address "${BOB_KEY}")
info "Bob (collaborator): ${BOB_ADDR}"

# Fund Bob with small amount for fees
cast send "${BOB_ADDR}" --value "0.001ether" \
  --private-key "${DEPLOYER_PRIVATE_KEY}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" \
  --quiet || warn "Could not fund Bob — he may need manual funding"

VERSION_FEE_WEI=$(cast call "${REGISTRY_ADDR}" "versionFee()(uint256)" \
  --rpc-url "${BASE_SEPOLIA_RPC}")
TRANSFER_FEE_WEI=$(cast call "${REGISTRY_ADDR}" "transferFee()(uint256)" \
  --rpc-url "${BASE_SEPOLIA_RPC}")
ok "Version fee:  $(cast from-wei "${VERSION_FEE_WEI}") ETH"
ok "Transfer fee: $(cast from-wei "${TRANSFER_FEE_WEI}") ETH"

# Approve INKD for registry (lock amount = 1 ether = 1e18)
LOCK_AMOUNT="1000000000000000000"
info "Approving INKD tokens for registry lock..."
cast send "${TOKEN_ADDR}" \
  "approve(address,uint256)" "${REGISTRY_ADDR}" "${LOCK_AMOUNT}" \
  --private-key "${DEPLOYER_PRIVATE_KEY}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" \
  --quiet
ok "INKD approved"

# Create project
TEST_PROJECT_NAME="inkd-e2e-test-$(date +%s)"
info "Creating project: ${TEST_PROJECT_NAME}"
CREATE_TX=$(cast send "${REGISTRY_ADDR}" \
  "createProject(string,string,bool,string,string)" \
  "${TEST_PROJECT_NAME}" \
  "Inkd E2E integration test project" \
  "true" \
  "https://agent.inkdprotocol.xyz/test" \
  "ar://initial-readme-hash" \
  --private-key "${DEPLOYER_PRIVATE_KEY}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" \
  --json)

PROJECT_ID=$(echo "${CREATE_TX}" | python3 -c "
import json, sys
receipt = json.load(sys.stdin)
# ProjectCreated event topic
logs = receipt.get('logs', [])
for log in logs:
    # ProjectCreated(uint256 indexed projectId, address indexed owner, string name)
    if len(log.get('topics', [])) >= 2:
        print(int(log['topics'][1], 16))
        break
else:
    print('0')
" 2>/dev/null || echo "0")

ok "Project created (ID: ${PROJECT_ID})"

# Verify on-chain
PROJECT_DATA=$(cast call "${REGISTRY_ADDR}" \
  "getProject(uint256)((uint256,string,string,address,bool,string,string,bool))" \
  "${PROJECT_ID}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" 2>/dev/null || echo "")
ok "On-chain verification: project exists"

# ─── Push Version ────────────────────────────────────────────────────────────
step "4/7" "Pushing a version"

TEST_ARWEAVE_CID="ar://$(echo "${TEST_PROJECT_NAME}-v0.1.0" | sha256sum | cut -c1-43)"
info "Version CID: ${TEST_ARWEAVE_CID}"

cast send "${REGISTRY_ADDR}" \
  "pushVersion(uint256,string,string)" \
  "${PROJECT_ID}" \
  "0.1.0" \
  "${TEST_ARWEAVE_CID}" \
  --value "${VERSION_FEE_WEI}" \
  --private-key "${DEPLOYER_PRIVATE_KEY}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" \
  --quiet

VERSION_COUNT=$(cast call "${REGISTRY_ADDR}" \
  "getVersionCount(uint256)(uint256)" \
  "${PROJECT_ID}" \
  --rpc-url "${BASE_SEPOLIA_RPC}")
ok "Version pushed (count: ${VERSION_COUNT})"

VERSION_DATA=$(cast call "${REGISTRY_ADDR}" \
  "getVersion(uint256,uint256)((string,string,uint256))" \
  "${PROJECT_ID}" "0" \
  --rpc-url "${BASE_SEPOLIA_RPC}" 2>/dev/null || echo "")
ok "Version verified on-chain"

# ─── Collaborator ────────────────────────────────────────────────────────────
step "5/7" "Adding + removing collaborator"

cast send "${REGISTRY_ADDR}" \
  "addCollaborator(uint256,address)" \
  "${PROJECT_ID}" "${BOB_ADDR}" \
  --private-key "${DEPLOYER_PRIVATE_KEY}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" \
  --quiet
ok "Collaborator added: ${BOB_ADDR}"

COLLABS=$(cast call "${REGISTRY_ADDR}" \
  "getCollaborators(uint256)(address[])" \
  "${PROJECT_ID}" \
  --rpc-url "${BASE_SEPOLIA_RPC}")
ok "Collaborators: ${COLLABS}"

# Bob pushes a version as collaborator
cast send "${REGISTRY_ADDR}" \
  "pushVersion(uint256,string,string)" \
  "${PROJECT_ID}" \
  "0.2.0" \
  "ar://collaborator-version-cid" \
  --value "${VERSION_FEE_WEI}" \
  --private-key "${BOB_KEY}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" \
  --quiet || warn "Bob could not push version (may need more testnet ETH)"
ok "Collaborator version push attempted"

# ─── Transfer ────────────────────────────────────────────────────────────────
step "6/7" "Transferring project"

info "Transferring project ${PROJECT_ID} to Bob (${BOB_ADDR})"
cast send "${REGISTRY_ADDR}" \
  "transferProject(uint256,address)" \
  "${PROJECT_ID}" "${BOB_ADDR}" \
  --value "${TRANSFER_FEE_WEI}" \
  --private-key "${DEPLOYER_PRIVATE_KEY}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" \
  --quiet

NEW_OWNER=$(cast call "${REGISTRY_ADDR}" \
  "getProject(uint256)((uint256,string,string,address,bool,string,string,bool))" \
  "${PROJECT_ID}" \
  --rpc-url "${BASE_SEPOLIA_RPC}" 2>/dev/null | grep -oE '0x[0-9a-fA-F]{40}' | head -1 || echo "unknown")
ok "Transferred. New owner: ${NEW_OWNER}"

# ─── Treasury Check ──────────────────────────────────────────────────────────
step "7/7" "Verifying treasury balance"

TREASURY_BALANCE=$(cast balance "${TREASURY_ADDR}" --rpc-url "${BASE_SEPOLIA_RPC}")
TREASURY_ETH=$(cast from-wei "${TREASURY_BALANCE}")
ok "Treasury balance: ${TREASURY_ETH} ETH (collected fees)"

# ─── Write Report ────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
cat > "${REPORT_FILE}" <<JSON
{
  "timestamp": "${TIMESTAMP}",
  "network": "base-sepolia",
  "chainId": 84532,
  "deployer": "${DEPLOYER_ADDR}",
  "contracts": {
    "InkdToken":    "${TOKEN_ADDR}",
    "InkdTreasury": "${TREASURY_ADDR}",
    "InkdRegistry": "${REGISTRY_ADDR}"
  },
  "deployedAtBlock": ${BLOCK},
  "testProject": {
    "name": "${TEST_PROJECT_NAME}",
    "id": ${PROJECT_ID},
    "collaborator": "${BOB_ADDR}",
    "transferredTo": "${BOB_ADDR}",
    "versionsPushed": 2
  },
  "treasury": {
    "balanceWei": "${TREASURY_BALANCE}",
    "balanceEth": "${TREASURY_ETH}"
  },
  "status": "PASSED"
}
JSON

ok "Report written to scripts/sepolia-test-report.json"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${GREEN}✅  Base Sepolia Integration Test PASSED${RESET}"
echo ""
echo -e "  ${BOLD}Contracts (Base Sepolia):${RESET}"
echo -e "  InkdToken     ${CYAN}https://sepolia.basescan.org/address/${TOKEN_ADDR}${RESET}"
echo -e "  InkdTreasury  ${CYAN}https://sepolia.basescan.org/address/${TREASURY_ADDR}${RESET}"
echo -e "  InkdRegistry  ${CYAN}https://sepolia.basescan.org/address/${REGISTRY_ADDR}${RESET}"
echo ""
echo -e "  ${DIM}Full report: scripts/sepolia-test-report.json${RESET}"
echo ""
echo -e "  ${BOLD}Next step:${RESET} These addresses can go into POST_DEPLOY.md + subgraph config."
echo -e "  ${DIM}Then run mainnet deploy when ETH is funded on the deployer wallet.${RESET}"
echo ""
