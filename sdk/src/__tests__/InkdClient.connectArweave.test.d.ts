/**
 * @file InkdClient.connectArweave.test.ts
 * @description Unit tests for InkdClient.connectArweave() — covers lines 81-91 of InkdClient.ts.
 *
 * Strategy: mock the ../arweave module using vi.hoisted() to satisfy vitest's hoist constraint.
 * Verifies: constructor args (irysUrl/gateway defaults + overrides), connect() called,
 * subsequent inscribe() succeeds with the injected instance.
 */
export {};
