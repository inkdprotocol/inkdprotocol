# INKD Protocol QA Protocol

## Repo
`$HOME/.openclaw/workspace/builds/inkd-protocol`

## Checks

### 1. SDK Build (15 pts)
```bash
cd $REPO && npm run build:sdk
```
Pass: exits 0 with no errors.

### 2. CLI Build (10 pts)
```bash
cd $REPO && npm run build:cli
```
Pass: exits 0 with no errors.

### 3. Contract Build (15 pts)
```bash
cd $REPO/contracts && forge build
```
Pass: exits 0, "Compiler run successful" or "nothing to compile".

### 4. SDK Lint (15 pts)
```bash
cd $REPO && npm run lint
```
Pass: exits 0, 0 errors, 0 warnings (`--max-warnings 0`).

### 5. SDK TypeCheck (10 pts)
```bash
cd $REPO/sdk && npm run typecheck
```
Pass: exits 0.

### 6. CLI TypeCheck (5 pts)
```bash
cd $REPO/cli && npm run typecheck
```
Pass: exits 0.

### 7. SDK Tests (10 pts)
```bash
cd $REPO/sdk && npm test 2>&1 | tail -5
```
Pass: all tests pass (0 failed).

### 8. CLI Tests (10 pts)
```bash
cd $REPO/cli && npm test 2>&1 | tail -5
```
Pass: all tests pass (0 failed).

### 9. Contract Tests (10 pts)
```bash
cd $REPO/contracts && forge test 2>&1 | tail -5
```
Pass: all tests pass (0 failed).

### 10. Git Hygiene (5 pts)
```bash
cd $REPO && git ls-files --cached | grep -E "^(node_modules|sdk/dist|cli/dist|sdk/coverage|cli/coverage|contracts/out|contracts/cache)" | wc -l
```
Pass: 0 (no build artifacts tracked).

```bash
cd $REPO && git status --short --untracked-files=no | grep -v "^??"
```
Pass: no unexpected modified/staged source files.

### 11. No Hardcoded Secrets (bonus, no deduction if clean)
```bash
grep -rn "0x[a-fA-F0-9]\{64\}" sdk/src/ cli/src/ contracts/src/ --include="*.ts" --include="*.sol" | grep -v "test\|mock\|example\|comment" | grep -v "^Binary" | wc -l
```
Pass: 0 matches.

## Scoring Rubric

| Check | Points |
|-------|--------|
| SDK Build | 15 |
| CLI Build | 10 |
| Contract Build | 15 |
| SDK Lint | 15 |
| SDK TypeCheck | 10 |
| CLI TypeCheck | 5 |
| SDK Tests | 10 |
| CLI Tests | 10 |
| Contract Tests | 10 |
| Git Hygiene | 5 |
| **Total** | **100** |

Partial credit: -5 for each warning, -2 for each minor issue.

## Score Thresholds
- **< 70**: CRITICAL — alert Hazar immediately
- **70–84**: Issues — document clearly, fix what you can
- **85+**: All good

## Report Format

```
🔍 INKD QA REVIEW — HH:MM (Asia/Dubai)
Score: XX/100

✅ SDK Build — clean
✅ CLI Build — clean
✅ Contracts Build — clean
✅ Lint — 0 errors, 0 warnings
✅ SDK TypeCheck — clean
✅ CLI TypeCheck — clean
✅ SDK Tests — N passed
✅ CLI Tests — N passed
✅ Contract Tests — N passed
✅ Git Hygiene — no tracked artifacts

Fixed this run:
- [what was fixed]

Needs Hazar:
- [anything requiring human decision]
```
