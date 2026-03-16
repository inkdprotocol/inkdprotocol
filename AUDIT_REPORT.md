# inkd Protocol — Internal Security Audit Report

**Date:** 2026-03-16  
**Auditor:** Slate (internal)  
**Scope:** InkdRegistry, InkdRegistryV2, InkdTreasury, InkdBuyback, InkdTimelock  
**Tools:** Slither 0.10.x, Forge, Manual Review  

---

## Executive Summary

**Overall Risk: LOW**

No critical or high severity findings. All previously identified issues from the external audit rounds (C-01, M-01–03, L-01–05, I-01–03) have been fixed. The codebase is in good shape for current TVL levels. A professional external audit is recommended before significant capital accumulates.

---

## Test Coverage

| Suite | Tests | Result |
|---|---|---|
| Contracts (unit) | 169 | ✅ All passing |
| Fuzz + Invariant | 321 | ✅ All passing (last run) |
| SDK | 242 | ✅ |
| API | 207 | ✅ |

---

## Findings

### LOW — block.timestamp in InkdTimelock

**Location:** `src/InkdTimelock.sol#60, #89, #90`  
**Description:** `block.timestamp` used for time comparisons. Miners can manipulate timestamp by ~15 seconds.  
**Impact:** Minimal. A 15-second manipulation window on a 48-hour timelock is negligible.  
**Status:** Accepted — standard Timelock pattern, same as Compound/Uniswap.

---

### INFORMATIONAL — Inline Assembly in InkdTreasury

**Location:** `src/InkdTreasury.sol#155`  
**Description:** Assembly used in `_split()` for gas optimization.  
**Impact:** None. Code is reviewed and intentional.  
**Status:** Accepted.

---

### INFORMATIONAL — Multiple Solidity Pragma Versions

**Description:** OZ library dependencies use various pragma versions (`>=0.6.2` etc.)  
**Impact:** None. Standard for projects using OpenZeppelin.  
**Status:** Accepted.

---

## Architecture Review

### Access Control ✅
- Registry owner = DEV_SAFE (2-of-2 multisig)
- Treasury owner = TREASURY_SAFE (2-of-2 multisig)
- Buyback owner = BUYBACK_SAFE (2-of-2 multisig)
- All upgrades go through UUPS + Timelock (48h delay)
- No EOA has upgrade power

### Reentrancy ✅
- CEI pattern enforced throughout
- `nonReentrant` guards on all state-changing external calls
- Treasury `settle()` transfers before external calls

### UUPS Upgrade Safety ✅
- `proxiableUUID` correctly implemented
- `_authorizeUpgrade` restricted to owner (Safe multisig)
- Storage gaps (`uint256[42] __gap`) in V2

### Centralization Risks
- **Acceptable:** Safe multisigs control upgrades — requires 2-of-2 approval
- **Acceptable:** Server wallet (`0x210bDf52...`) can call `settle()` — limited to settlement, cannot drain
- **Watch:** If Safe keys are compromised, contracts can be upgraded. Standard risk for UUPS pattern.

### InkdBuyback
- `inkdToken` = `0x103013...` ($INKD) ✅
- `maxSlippageBps` = 100 (1%) ✅
- Auto-buyback threshold = $50 USDC
- Currently ~$15.61 accumulated (~$34 until first buyback)

---

## Recommendations

1. **External Professional Audit** — before TVL exceeds $10k. Recommended firms: Trail of Bits, Spearbit, Code4rena contest.
2. **Monitoring** — set up on-chain alerts for large USDC flows into Treasury/Buyback.
3. **Safe Key Hygiene** — ensure 2-of-2 signers use hardware wallets.
4. **Server Wallet** — keep `0x210bDf52...` funded with ETH for gas, but minimal USDC exposure.

---

## Conclusion

The contracts are well-structured, access-controlled via multisig, and all major findings from previous audit rounds have been addressed. No new critical or high issues found. Safe to operate at current scale. Professional audit required before significant TVL.
