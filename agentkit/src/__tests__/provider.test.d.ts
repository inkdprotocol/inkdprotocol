/**
 * @inkd/agentkit — InkdActionProvider test suite
 *
 * Tests all four actions:
 *   inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
 *
 * Coverage:
 *   - Happy paths (success responses)
 *   - Error paths (non-ok responses, 404s, thrown errors)
 *   - Constructor defaults vs config overrides
 *   - getActions() registration shape
 *   - buildFetch fallback (no walletProvider, no @x402/fetch)
 *   - getWalletAddress (with/without context)
 *
 * IMPORTANT: InkdActionProvider captures globalThis.fetch at constructor time
 * (this.fetch = globalThis.fetch). Each test must stub BEFORE constructing.
 */
export {};
