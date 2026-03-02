#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Inkd Protocol — Developer Setup
#
#  One-command setup for a fresh development environment.
#  Run: bash scripts/setup.sh
#
#  What this does:
#    1. Checks required tools (Node ≥ 18, Foundry, git)
#    2. Installs npm deps for root, sdk, and cli
#    3. Installs Foundry forge libs
#    4. Copies .env.example → .env (if not present)
#    5. Runs a quick sanity build to confirm everything works
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"
DIM="\033[2m"

ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET}  $*"; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e ""
echo -e "  ${BOLD}Inkd Protocol — Developer Setup${RESET}"
echo -e "  ${DIM}$(date '+%Y-%m-%d %H:%M')${RESET}"
echo -e ""

# ─── 1. Check required tools ─────────────────────────────────────────────────
echo -e "  ${BOLD}[1/5] Checking prerequisites${RESET}"

# Node.js
if ! command -v node &> /dev/null; then
  fail "Node.js not found. Install from https://nodejs.org (requires ≥ v18)"
fi
NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js v$NODE_VER detected — requires ≥ v18. Upgrade at https://nodejs.org"
fi
ok "Node.js v$NODE_VER"

# npm
if ! command -v npm &> /dev/null; then
  fail "npm not found (should ship with Node.js)"
fi
ok "npm $(npm --version)"

# git
if ! command -v git &> /dev/null; then
  fail "git not found. Install git to continue."
fi
ok "git $(git --version | awk '{print $3}')"

# Foundry (forge)
if ! command -v forge &> /dev/null; then
  warn "Foundry (forge) not found."
  echo ""
  echo -e "  Install Foundry:"
  echo -e "  ${DIM}curl -L https://foundry.paradigm.xyz | bash && foundryup${RESET}"
  echo ""
  read -rp "  Install Foundry now? [y/N] " INSTALL_FOUNDRY
  if [[ "$INSTALL_FOUNDRY" =~ ^[Yy]$ ]]; then
    info "Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    # shellcheck disable=SC1090
    source "${HOME}/.bashrc" 2>/dev/null || source "${HOME}/.zshrc" 2>/dev/null || true
    foundryup
    ok "Foundry installed"
  else
    warn "Skipping Foundry install — contract tests will be unavailable."
    SKIP_FORGE=1
  fi
else
  ok "Foundry $(forge --version | head -1)"
fi

# ─── 2. Install npm dependencies ─────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}[2/5] Installing npm dependencies${RESET}"
cd "$REPO_ROOT"

info "Root packages..."
npm install --silent
ok "Root dependencies installed"

info "SDK packages..."
cd "$REPO_ROOT/sdk" && npm install --silent
ok "SDK dependencies installed"

info "CLI packages..."
cd "$REPO_ROOT/cli" && npm install --silent
ok "CLI dependencies installed"

# ─── 3. Foundry libs ─────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}[3/5] Installing Foundry libraries${RESET}"
cd "$REPO_ROOT"

if [ "${SKIP_FORGE:-0}" = "1" ]; then
  warn "Skipping forge install (Foundry not available)"
else
  info "forge install..."
  cd "$REPO_ROOT/contracts" && forge install --quiet 2>/dev/null || true
  ok "Foundry libraries installed"
fi

# ─── 4. Environment setup ─────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}[4/5] Environment configuration${RESET}"
cd "$REPO_ROOT"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    ok ".env created from .env.example"
    warn "Edit .env and fill in your private key + RPC URLs before deploying."
  else
    warn ".env.example not found — create .env manually (see POST_DEPLOY.md)"
  fi
else
  ok ".env already exists"
fi

# ─── 5. Sanity builds ────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}[5/5] Sanity builds${RESET}"
cd "$REPO_ROOT"

if [ "${SKIP_FORGE:-0}" != "1" ]; then
  info "Building contracts..."
  cd "$REPO_ROOT/contracts" && forge build --quiet 2>&1 | tail -3
  ok "Contracts built"
fi

info "Building SDK..."
cd "$REPO_ROOT/sdk" && npm run build --silent 2>&1 | tail -3
ok "SDK built"

info "Building CLI..."
cd "$REPO_ROOT/cli" && npm run build --silent 2>&1 | tail -3
ok "CLI built"

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}${BOLD}✅  Setup complete!${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo -e "  ${DIM}1.${RESET}  Edit ${CYAN}.env${RESET} with your private key and RPC URLs"
echo -e "  ${DIM}2.${RESET}  Run ${CYAN}make test${RESET} to run all tests"
echo -e "  ${DIM}3.${RESET}  Run ${CYAN}bash scripts/local-deploy.sh${RESET} to start a local dev node"
echo -e "  ${DIM}4.${RESET}  See ${CYAN}docs/QUICKSTART.md${RESET} for a full walkthrough"
echo ""
