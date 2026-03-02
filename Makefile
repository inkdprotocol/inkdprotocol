# ─────────────────────────────────────────────────────────────
#  Inkd Protocol — Developer Makefile
#  Usage: make <target>
# ─────────────────────────────────────────────────────────────

.PHONY: help install build test test-verbose test-fuzz test-invariant \
        coverage snapshot lint typecheck clean deploy-dry \
        sdk-build sdk-test cli-build anvil fmt check

# ─── Defaults ────────────────────────────────────────────────
FORGE          := forge
NPM            := npm
NODE           := node
ANVIL_PORT     := 8545
FUZZ_RUNS      := 1000
INVARIANT_RUNS := 500

# ─────────────────────────────────────────────────────────────
help: ## Show this help message
	@echo ""
	@echo "  Inkd Protocol — Make Targets"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ─────────────────────────────────────────────────────────────
install: ## Install all dependencies (npm + forge libs)
	$(NPM) install
	cd sdk && $(NPM) install
	cd cli && $(NPM) install
	cd contracts && $(FORGE) install

# ─────────────────────────────────────────────────────────────
build: ## Build everything (contracts + SDK + CLI)
	@echo "→ Building contracts..."
	cd contracts && $(FORGE) build --force
	@echo "→ Building SDK..."
	cd sdk && $(NPM) run build
	@echo "→ Building CLI..."
	cd cli && $(NPM) run build
	@echo "✅ All builds complete"

build-contracts: ## Build Solidity contracts only
	cd contracts && $(FORGE) build

sdk-build: ## Build TypeScript SDK only
	cd sdk && $(NPM) run build

cli-build: ## Build CLI only
	cd cli && $(NPM) run build

# ─────────────────────────────────────────────────────────────
test: ## Run all tests (contracts + SDK)
	@echo "→ Running contract tests..."
	cd contracts && $(FORGE) test -vv
	@echo "→ Running SDK tests..."
	cd sdk && $(NPM) test
	@echo "✅ All tests passed"

test-verbose: ## Run contract tests with full traces
	cd contracts && $(FORGE) test -vvvv

test-fuzz: ## Run fuzz tests (FUZZ_RUNS iterations)
	cd contracts && $(FORGE) test --match-contract InkdFuzzTest \
		-vv --fuzz-runs $(FUZZ_RUNS)

test-invariant: ## Run invariant tests (INVARIANT_RUNS)
	cd contracts && $(FORGE) test --match-contract InkdInvariantTest \
		-vv --invariant-runs $(INVARIANT_RUNS)

test-integration: ## Run integration tests
	cd contracts && $(FORGE) test --match-contract InkdIntegrationTest -vvv

sdk-test: ## Run SDK unit tests
	cd sdk && $(NPM) test

sdk-coverage: ## Run SDK tests with coverage
	cd sdk && $(NPM) run coverage

# ─────────────────────────────────────────────────────────────
coverage: ## Generate Solidity coverage report
	cd contracts && $(FORGE) coverage --report lcov
	@echo "Coverage report: contracts/lcov.info"

snapshot: ## Update gas snapshot
	cd contracts && $(FORGE) snapshot

snapshot-check: ## Check gas snapshot (fails if regression > 5%)
	cd contracts && $(FORGE) snapshot --check --tolerance 5

# ─────────────────────────────────────────────────────────────
lint: ## Run ESLint on SDK + CLI
	cd sdk && $(NPM) run lint
	cd cli && $(NPM) run lint 2>/dev/null || echo "(CLI lint not configured yet)"

typecheck: ## Type-check all TypeScript packages
	cd sdk && npx tsc --noEmit
	cd cli && $(NPM) run typecheck

fmt: ## Format Solidity with forge fmt
	cd contracts && $(FORGE) fmt

fmt-check: ## Check Solidity formatting (no-write)
	cd contracts && $(FORGE) fmt --check

# ─────────────────────────────────────────────────────────────
check: fmt-check lint typecheck ## Run all static checks
	@echo "✅ All static checks passed"

# ─────────────────────────────────────────────────────────────
clean: ## Remove build artifacts
	cd contracts && rm -rf out cache lcov.info .gas-snapshot
	cd sdk && rm -rf dist node_modules/.cache
	cd cli && rm -rf dist node_modules/.cache
	@echo "✅ Clean complete"

# ─────────────────────────────────────────────────────────────
anvil: ## Start local Anvil node on port $(ANVIL_PORT)
	anvil --port $(ANVIL_PORT) --accounts 10 --balance 10000 \
		--block-time 1 --chain-id 8453

deploy-dry: ## Simulate deploy (dry-run against Anvil)
	@echo "→ Running DryRun script..."
	cd contracts && $(FORGE) script script/DryRun.s.sol \
		--rpc-url http://127.0.0.1:$(ANVIL_PORT) -vvvv

deploy-base: ## Deploy to Base mainnet (requires env vars)
	@test -n "$(PRIVATE_KEY)" || (echo "❌ PRIVATE_KEY not set" && exit 1)
	@test -n "$(BASESCAN_API_KEY)" || (echo "❌ BASESCAN_API_KEY not set" && exit 1)
	cd contracts && $(FORGE) script script/Deploy.s.sol \
		--rpc-url https://mainnet.base.org \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		--verify \
		--etherscan-api-key $(BASESCAN_API_KEY) \
		-vvvv

# ─────────────────────────────────────────────────────────────
ci: ## Run the full CI pipeline locally
	@echo "══════════════════════════════════════"
	@echo "  Inkd Protocol — Local CI Run"
	@echo "══════════════════════════════════════"
	$(MAKE) fmt-check
	$(MAKE) build
	$(MAKE) test
	$(MAKE) snapshot-check
	$(MAKE) typecheck
	@echo ""
	@echo "✅ CI passed — ready to push"
