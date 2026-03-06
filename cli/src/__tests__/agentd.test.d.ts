/**
 * @file agentd.test.ts
 * Unit tests for `inkd agentd` — autonomous agent daemon.
 *
 * Strategy:
 *  - Mock `fs` (existsSync, readFileSync, writeFileSync) to control state file reads/writes
 *  - Mock `../config.js` for loadConfig, ADDRESSES, requirePrivateKey, colour helpers
 *  - Mock `../client.js` for buildPublicClient + buildWalletClient
 *  - Mock `../abi.js` for REGISTRY_ABI (value not important — mocked readContract)
 *  - Use process.exit spy (throws sentinel) and process.on spy for signal handlers
 *  - For `--once` mode: run full cycle without infinite loop
 */
export {};
