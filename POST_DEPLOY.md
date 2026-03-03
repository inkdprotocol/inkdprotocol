# Inkd Protocol — Post-Deploy Checklist

> **Use this document after every deployment (testnet or mainnet).**
> Check each item. No exceptions. Ship nothing unchecked.

---

## Step 0 — Pre-Flight (Before Broadcasting)

- [ ] `.env` file populated (private key, RPC, Basescan API key)
- [ ] Deployer wallet has **≥ 0.01 ETH** on target chain
- [ ] Dry-run passes: `forge script script/DryRun.s.sol:DryRun --rpc-url base -vvvv`
- [ ] All 238 contract tests pass: `forge test --gas-report`
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
- [ ] All 6 contracts deployed (Token, TreasuryImpl, TreasuryProxy, RegistryImpl, RegistryProxy, Timelock)
- [ ] All assertions in Deploy.s.sol passed
- [ ] No reverts in deployment output
- [ ] Deploy script printed "NEXT STEP: Run POST_DEPLOY.md Step 4.5..."

---

## Step 2 — Record Addresses

Update `.env` with deployed addresses:

```
INKD_TOKEN_ADDRESS=0x...
INKD_TREASURY_IMPL=0x...
INKD_TREASURY_PROXY=0x...
INKD_REGISTRY_IMPL=0x...
INKD_REGISTRY_PROXY=0x...
INKD_TIMELOCK_ADDRESS=0x...
DEPLOYER_ADDRESS=0x...
DEPLOY_BLOCK=...
DEPLOY_TX=0x...
```

- [ ] `.env` updated with all 6 contract addresses
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

forge verify-contract $INKD_TIMELOCK_ADDRESS src/InkdTimelock.sol:InkdTimelock \
  --chain base --etherscan-api-key $BASESCAN_API_KEY --watch
```

- [ ] InkdToken verified on Basescan ✅
- [ ] InkdTreasury implementation verified ✅
- [ ] InkdRegistry implementation verified ✅
- [ ] InkdTimelock verified on Basescan ✅
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

# Verify timelock admin = deployer EOA (pre-transfer)
cast call $INKD_TIMELOCK_ADDRESS "admin()" --rpc-url base

# Verify timelock delay = 172800 (48 hours in seconds)
cast call $INKD_TIMELOCK_ADDRESS "DELAY()" --rpc-url base
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
- [ ] Timelock admin = deployer EOA ✅
- [ ] Timelock DELAY = 172800 (48h) ✅

---

## Step 4.5 — Transfer Ownership to InkdTimelock ⚠️

> **Do not skip.** All admin actions post-mainnet must pass through the 48h timelock.
> Complete Step 4 smoke tests before running this.

```bash
# Transfer InkdTreasury ownership to timelock
cast send $INKD_TREASURY_PROXY "transferOwnership(address)" $INKD_TIMELOCK_ADDRESS \
  --private-key $DEPLOYER_PRIVATE_KEY --rpc-url base

# Transfer InkdRegistry ownership to timelock
cast send $INKD_REGISTRY_PROXY "transferOwnership(address)" $INKD_TIMELOCK_ADDRESS \
  --private-key $DEPLOYER_PRIVATE_KEY --rpc-url base

# Verify ownership transferred
cast call $INKD_TREASURY_PROXY "owner()" --rpc-url base
cast call $INKD_REGISTRY_PROXY "owner()" --rpc-url base
```

Both calls should return `$INKD_TIMELOCK_ADDRESS` after transfer.

- [ ] `InkdTreasury.owner()` = InkdTimelock address ✅
- [ ] `InkdRegistry.owner()` = InkdTimelock address ✅
- [ ] Future admin changes (fee updates, upgrades) must be queued through timelock ✅

> **Note:** `InkdToken` is a standard ERC-20 with no `owner`. It cannot be transferred to
> the timelock and does not need to be — supply is fixed at deploy.

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
| InkdTimelock | [ADDRESS] | [LINK] |

**Deployment TX:** [TX_HASH]
**Block:** [BLOCK_NUMBER]
```

- [ ] `DEPLOYED.md` created in repo root
- [ ] All 6 addresses correct (including InkdTimelock)
- [ ] Basescan links working
- [ ] `DEPLOYED.md` committed and pushed

---

## Step 6 — SDK Update

After mainnet deploy, update the SDK with real addresses:

```typescript
// sdk/src/addresses.ts (or similar)
export const INKD_ADDRESSES = {
  mainnet: {
    token:     "0x...",
    treasury:  "0x...",
    registry:  "0x...",
    timelock:  "0x...",
    chainId:   8453,
  },
  testnet: {
    token:     "0x...",
    treasury:  "0x...",
    registry:  "0x...",
    timelock:  "0x...",
    chainId:   84532,
  },
} as const;
```

- [ ] SDK `addresses.ts` updated with mainnet addresses (including timelock)
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
   - All upgrades must be queued through `InkdTimelock` (48h delay) — no instant upgrades
4. For InkdToken: it is NOT upgradeable — if critical bug, must migrate
5. For InkdTimelock itself: admin can be replaced via `setPendingAdmin` + `acceptAdmin`
   - If timelock is compromised, the deployer EOA (if separate) can take back ownership
   - Only possible if ownership was NOT transferred: confirm via `cast call ... "owner()"`
6. Contact deployer wallet — only the timelock `admin` (or timelock-queued calls) can change parameters

---

## Notes

- InkdToken is a standard ERC-20 — **NOT upgradeable**
- InkdTreasury and InkdRegistry use UUPS (upgradeable) proxies
- Post-mainnet, all admin actions (fee changes, contract upgrades) **must go through InkdTimelock**
- InkdTimelock enforces a **48-hour delay** on all queued transactions
- Transactions that exceed the 14-day grace period after their `eta` become unexecutable (must re-queue)
- Fee withdrawals from InkdTreasury are the only owner action NOT subject to timelock delay
  (withdrawal is value-neutral — funds move to the multisig, not changed in behavior)

---

*Last updated: 2026-03-03*
