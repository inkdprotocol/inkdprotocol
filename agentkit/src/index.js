"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.INKD_ACTIONS = exports.InkdActionProvider = void 0;
var provider_js_1 = require("./provider.js");
Object.defineProperty(exports, "InkdActionProvider", { enumerable: true, get: function () { return provider_js_1.InkdActionProvider; } });
var actions_js_1 = require("./actions.js");
Object.defineProperty(exports, "INKD_ACTIONS", { enumerable: true, get: function () { return actions_js_1.INKD_ACTIONS; } });
//# sourceMappingURL=index.js.map