/**
 * examples/watch-events.ts
 *
 * Real-time event monitor for the Inkd Protocol registry.
 * Prints every ProjectCreated and VersionPushed event as they land on-chain.
 *
 * Usage:
 *   npx ts-node examples/watch-events.ts
 *
 * Pipe to jq:
 *   INKD_JSON=1 npx ts-node examples/watch-events.ts | jq .
 */
export {};
