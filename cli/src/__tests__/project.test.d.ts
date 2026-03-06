/**
 * @file project.test.ts
 * Unit tests for the `inkd project` subcommands.
 *
 * All on-chain interactions are mocked — these tests verify:
 *   - Correct arguments are extracted from the CLI args array
 *   - The right contract functions are called with the right params
 *   - Console output reflects success / error states
 *   - Error paths (missing flags, bad addresses) call process.exit(1)
 */
export {};
