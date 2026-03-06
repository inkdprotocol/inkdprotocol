#!/usr/bin/env node
/**
 * @inkd/mcp — Model Context Protocol Server for inkd Protocol
 *
 * Gives Claude, Cursor, and any MCP-compatible LLM native inkd tools:
 *   - inkd_create_project
 *   - inkd_push_version
 *   - inkd_get_project
 *   - inkd_list_agents
 *   - inkd_get_versions
 *
 * Run as stdio MCP server:
 *   INKD_PRIVATE_KEY=0x... npx @inkd/mcp
 *
 * Add to Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "inkd": {
 *       "command": "npx",
 *       "args": ["@inkd/mcp"],
 *       "env": { "INKD_PRIVATE_KEY": "0x..." }
 *     }
 *   }
 * }
 */
export {};
