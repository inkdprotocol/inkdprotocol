# Contributing to INKD Protocol

Thanks for your interest. This is a real protocol with real money on it — please read this before opening a PR.

## Table of contents

- [Local dev setup](#local-dev-setup)
- [Running tests](#running-tests)
- [PR process](#pr-process)
- [Code style](#code-style)
- [Security](#security)

---

## Local dev setup

**Requirements:** Node.js ≥ 18, [Foundry](https://getfoundry.sh), Git.

```bash
# Clone
git clone https://github.com/inkdprotocol/inkdprotocol.git
cd inkdprotocol

# Install JS dependencies (workspaces: sdk, cli, agentkit, mcp)
npm install

# Install Foundry submodules
git submodule update --init --recursive
cd contracts && forge install

# Copy env
cp .env.example .env
# Fill in at minimum: BASE_RPC, BASE_SEPOLIA_RPC
```

**For API development:**
```bash
cd api
cp .env.example .env
# Fill in SERVER_WALLET_KEY, INKD_REGISTRY_ADDRESS, etc.
npm install
npm run dev
```

**For bot development:**
```bash
cd agents/telegram-bot
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, INKD_PRIVATE_KEY, etc.
npm install
npm run dev
```

---

## Running tests

```bash
# Contracts (Foundry) — 169 unit + 321 fuzz/invariant tests
npm run test:contracts
# or directly:
cd contracts && forge test -vvv

# Coverage
npm run test:coverage

# SDK — 242 tests
cd sdk && npm test

# API — 207 tests
cd api && npm test

# All JS (from root)
npm test
```

Tests must pass locally before opening a PR. CI runs the full suite on every push.

**For contract changes:** also run `forge coverage` and check that coverage doesn't regress. Include a brief note in your PR about what new test cases you added.

---

## PR process

1. **Fork** the repo and create a branch: `feature/your-thing` or `fix/the-bug`.
2. **Keep PRs focused.** One concern per PR. Don't mix contract changes with SDK changes.
3. **Contract changes require extra care.** If you're touching `contracts/`, your PR must include:
   - Updated/new Foundry tests
   - Gas diff (run `forge snapshot` before and after, include the diff)
   - An explicit note on any security assumptions
4. **Fill out the PR template.** It exists for a reason.
5. **Pass CI.** Lint, tests, build — all green.
6. A maintainer will review within a few days. For breaking changes or architecture questions, open an issue first to discuss before writing code.

---

## Code style

**TypeScript:**
- Strict mode. No `any` without a comment explaining why.
- `async/await` over raw Promises.
- Errors should be typed or wrapped — don't throw raw strings.
- No external dependencies added to `sdk` without discussion. The SDK ships to npm and bundle size matters.

**Solidity:**
- Solidity 0.8.x. Explicit visibility on all functions and state variables.
- NatSpec on all public/external functions.
- Events for all state changes.
- `forge fmt` before committing.
- No upgradeable contract changes without a corresponding test for the upgrade path.

**General:**
- Don't add abstractions for one-off cases.
- Don't add comments explaining what code does — only why it does it.
- `npm run lint` must pass.

---

## Security

Security issues should **not** be reported as GitHub issues.

Report vulnerabilities privately to **security@inkdprotocol.com**.

See [SECURITY.md](SECURITY.md) for full policy, scope, and response timelines.
