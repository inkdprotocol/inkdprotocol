/**
 * @file watch.test.ts
 * Unit tests for `inkd watch` — real-time event streaming command.
 *
 * Key design notes:
 *  1. `cmdWatch` has an infinite `while(true)` polling loop.
 *     We break it by spying on global.setTimeout and throwing a sentinel
 *     error (`__STOP_LOOP__`) after a controlled number of setTimeout calls.
 *     The delay line `await new Promise(r => setTimeout(r, ms))` is the only
 *     setTimeout call in the module; it sits outside the loop's inner try/catch,
 *     so the sentinel always propagates and terminates the promise.
 *
 *  2. `decodeEventLog` is called TWICE per log:
 *      – once in the outer `for` loop for the filter check
 *      – once inside `renderEvent` to decode for display
 *     Persistent mocks (.mockReturnValue) are used so both calls succeed.
 *
 *  3. `getBlockNumber` is called once BEFORE the loop (to compute default
 *     fromBlock) when `--from` is NOT supplied.  `--from` is used in most
 *     render/filter tests to skip that initial call.
 */
export {};
