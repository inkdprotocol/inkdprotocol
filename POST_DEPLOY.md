# Inkd Protocol — Post-Deploy Checklist

> **Use this document after every deployment (testnet or mainnet).**
> Check each item. No exceptions. Ship nothing unchecked.

---

## Step 0 — Pre-Flight (Before Broadcasting)

- [ ] `.env` file populated (private key, RPC, Basescan API key)
- [ ] Deployer wallet has **≥ 0.01 ETH** on target chain
- [ ] Dry-run passes: `forge script script/DryRun.s.sol:DryRun --rpc-url base -vvvv`
- [ ] All 79 tests pass: `forge test --gas-report`
- [ ] No outstanding `TODO` or `FIXME` in contract files
- [ ] Git is clean (all changes committed): `git status`

---

## Step 1 — Deploy

```bash
# Base Sepolia (testnet first)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv

# Base Mainnet (after testnet verified)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base \
  --broadcast \
  --verify \
  -vvvv
```

- [ ] Deployment TX hash recorded
- [ ] All 5 contracts deployed (Token, TreasuryImpl, TreasuryProxy, RegistryImpl, RegistryProxy)
- [ ] All assertions in Deploy.s.sol passed
- [ ] No reverts in deployment output

---

## Step 2 — Record Addresses

Update `.env` with deployed addresses:

```
INKD_TOKEN_ADDRESS=0x...
INKD_TREASURY_IMPL=0x...
INKD_TREASURY_PROXY=0x...
INKD_REGISTRY_IMPL=0x...
INKD_REGISTRY_PROXY=0x...
DEPLOYER_ADDRESS=0x...
DEPLOY_BLOCK=...
DEPLOY_TX=0x...
```

- [ ] `.env` updated with all 5 contract addresses
- [ ] Addresses copied to `DEPLOYED.md` (public record)
- [ ] Deployment block and TX hash saved

---

## Step 3 — Basescan Verification

```bash
# Auto-generated with correct addresses
forge script script/Verify.s.sol:Verify --rpc-url base

# Or manually:
forge verify-contract $INKD_TOKEN_ADDRESS src/InkdToken.sol:InkdToken \
  --chain base --etherscan-api-key $BASESCAN_API_KEY --watch

forge verify-contract $INKD_TREASURY_IMPL src/InkdTreasury.sol:InkdTreasury \
  --chain base --etherscan-api-key $BASESCAN_API_KEY --watch

forge verify-contract $INKD_REGISTRY_IMPL src/InkdRegistry.sol:InkdRegistry \
  --chain base --etherscan-api-key $BASESCAN_API_KEY --watch
```

- [ ] InkdToken verified on Basescan ✅
- [ ] InkdTreasury implementation verified ✅
- [ ] InkdRegistry implementation verified ✅
- [ ] Proxy contracts show "Read as Proxy" option on Basescan ✅

---

## Step 4 — On-Chain Smoke Tests

Run against deployed contracts using the deployed addresses:

```bash
# Verify token supply
cast call $INKD_TOKEN_ADDRESS "totalSupply()" --rpc-url base | cast --to-unit - ether

# Verify treasury owner
cast call $INKD_TREASURY_PROXY "owner()" --rpc-url base

# Verify registry owner
cast call $INKD_REGISTRY_PROXY "owner()" --rpc-url base

# Verify registry → token link
cast call $INKD_REGISTRY_PROXY "inkdToken()" --rpc-url base

# Verify treasury → registry link
cast call $INKD_TREASURY_PROXY "registry()" --rpc-url base

# Verify lock amount (should be 1e18 = 1 INKD)
cast call $INKD_REGISTRY_PROXY "lockAmount()" --rpc-url base

# Verify version fee (should be 1e15 = 0.001 ETH)
cast call $INKD_TREASURY_PROXY "versionFee()" --rpc-url base
```

- [ ] Token supply = 1,000,000,000 INKD ✅
- [ ] Deployer holds 100% of supply ✅
- [ ] Treasury owner = deployer ✅
- [ ] Registry owner = deployer ✅
- [ ] Registry.inkdToken = InkdToken address ✅
- [ ] Treasury.registry = InkdRegistry address ✅
- [ ] lockAmount = 1 INKD (1e18) ✅
- [ ] versionFee = 0.001 ETH (1e15) ✅
- [ ] transferFee = 0.005 ETH (5e15) ✅

---

## Step 5 — Create DEPLOYED.md

```markdown
# Inkd Protocol — Deployed Contracts

**Network:** Base Mainnet (Chain ID: 8453)
**Deployed:** [DATE]
**Deployer:** [ADDRESS]

| Contract | Address | Basescan |
|----------|---------|---------|
| InkdToken | [ADDRESS] | [LINK] |
| InkdTreasury (Proxy) | [ADDRESS] | [LINK] |
| InkdTreasury (Impl) | [ADDRESS] | [LINK] |
| InkdRegistry (Proxy) | [ADDRESS] | [LINK] |
| InkdRegistry (Impl) | [ADDRESS] | [LINK] |

**Deployment TX:** [TX_HASH]
**Block:** [BLOCK_NUMBER]
```

- [ ] `DEPLOYED.md` created in repo root
- [ ] All addresses correct
- [ ] Basescan links working
- [ ] `DEPLOYED.md` committed and pushed

---

## Step 6 — SDK Update

After mainnet deploy, update the SDK with real addresses:

```typescript
// sdk/src/addresses.ts (or similar)
export const INKD_ADDRESSES = {
  mainnet: {
    token:    "0x...",
    treasury: "0x...",
    registry: "0x...",
    chainId:  8453,
  },
  testnet: {
    token:    "0x...",
    treasury: "0x...",
    registry: "0x...",
    chainId:  84532,
  },
} as const;
```

- [ ] SDK `addresses.ts` updated with mainnet addresses
- [ ] SDK README updated with contract addresses
- [ ] SDK version bumped (e.g., `0.1.0-mainnet`)
- [ ] SDK changelog updated

---

## Step 7 — Announce

- [ ] Tweet T-0 posted (from `twitter-queue.md`)
- [ ] GitHub README updated with live contract addresses
- [ ] Website (`inkdprotocol.xyz`) updated with contract addresses
- [ ] Discord/community notified (if applicable)

---

## Emergency Rollback

If something is wrong after deployment:

1. **DO NOT** panic or attempt to upgrade immediately
2. Check if the issue is in logic (upgradeable) or token (not upgradeable)
3. For upgradeable contracts: prepare patch, run on testnet first, then upgrade
4. For InkdToken: it is NOT upgradeable — if critical bug, must migrate
5. Contact deployer wallet — only deployer can upgrade contracts

---

## Notes

- InkdToken is a standard ERC-20 — **NOT upgradeable**
- InkdTreasury and InkdRegistry use UUPS (upgradeable) proxies
- Only the `owner` (deployer) can upgrade or change parameters
- Treasury fee withdrawals are owner-only
- Lock amounts are burned on project creation — irreversible

---

*Last updated: 2026-03-02*
