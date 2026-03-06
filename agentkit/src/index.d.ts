/**
 * @inkd/agentkit — Coinbase AgentKit Action Provider for inkd Protocol
 *
 * Gives any AgentKit-powered AI agent the ability to:
 *   - Register projects on-chain (inkd_create_project)
 *   - Push version updates (inkd_push_version)
 *   - Discover registered AI agents (inkd_list_agents)
 *   - Read project info (inkd_get_project)
 *
 * The agent's wallet IS its identity on inkd.
 * No accounts. No API keys. Just a wallet.
 *
 * Usage:
 *   import { InkdActionProvider } from '@inkd/agentkit'
 *   const agentkit = await AgentKit.from({ ... actionProviders: [new InkdActionProvider()] })
 */
export { InkdActionProvider } from './provider.js';
export { INKD_ACTIONS } from './actions.js';
export type { InkdConfig } from './types.js';
