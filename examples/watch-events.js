"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const REGISTRY_ADDRESS = process.env['INKD_REGISTRY'];
const NETWORK = process.env['INKD_NETWORK'] ?? 'testnet';
const JSON_MODE = !!process.env['INKD_JSON'];
const POLL_MS = parseInt(process.env['INKD_POLL'] ?? '4000', 10);
if (!REGISTRY_ADDRESS) {
    console.error('INKD_REGISTRY env var required');
    process.exit(1);
}
const chain = NETWORK === 'mainnet' ? chains_1.base : chains_1.baseSepolia;
const EVENTS_ABI = (0, viem_1.parseAbi)([
    'event ProjectCreated(uint256 indexed projectId, address indexed owner, string name, bool isAgent)',
    'event VersionPushed(uint256 indexed projectId, uint256 indexed versionIndex, string arweaveHash, string versionTag)',
    'event ProjectTransferred(uint256 indexed projectId, address indexed from, address indexed to)',
]);
async function main() {
    const client = (0, viem_1.createPublicClient)({ chain, transport: (0, viem_1.http)() });
    const latest = await client.getBlockNumber();
    let fromBlock = latest > 500n ? latest - 500n : 0n;
    if (!JSON_MODE) {
        console.log(`\n📡 Inkd Protocol — Live Event Stream`);
        console.log(`   Registry: ${REGISTRY_ADDRESS}`);
        console.log(`   Network:  ${chain.name}`);
        console.log(`   Polling:  every ${POLL_MS}ms`);
        console.log(`   From:     block #${fromBlock}`);
        console.log(`\n   Listening… (Ctrl+C to stop)\n`);
    }
    while (true) {
        try {
            const current = await client.getBlockNumber();
            if (current > fromBlock) {
                const logs = await client.getLogs({
                    address: REGISTRY_ADDRESS,
                    fromBlock: fromBlock + 1n,
                    toBlock: current,
                });
                for (const log of logs) {
                    handleLog(log);
                }
                fromBlock = current;
            }
        }
        catch (err) {
            if (!JSON_MODE) {
                console.error(`[poll error] ${err.message}`);
            }
        }
        await new Promise(r => setTimeout(r, POLL_MS));
    }
}
function handleLog(log) {
    try {
        const decoded = (0, viem_1.decodeEventLog)({
            abi: EVENTS_ABI,
            data: log.data,
            topics: log.topics,
        });
        const ts = new Date().toISOString();
        if (JSON_MODE) {
            const args = decoded.args;
            console.log(JSON.stringify({
                event: decoded.eventName,
                block: log.blockNumber?.toString(),
                tx: log.transactionHash,
                timestamp: ts,
                ...Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])),
            }));
            return;
        }
        switch (decoded.eventName) {
            case 'ProjectCreated': {
                const a = decoded.args;
                const badge = a.isAgent ? ' 🤖 [agent]' : '';
                console.log(`✦ ProjectCreated${badge}  block #${log.blockNumber}`);
                console.log(`  id=${a.projectId}  owner=${a.owner.slice(0, 10)}…  name="${a.name}"`);
                break;
            }
            case 'VersionPushed': {
                const a = decoded.args;
                console.log(`↑ VersionPushed  block #${log.blockNumber}`);
                console.log(`  project=#${a.projectId}  tag=${a.versionTag}  ar://${a.arweaveHash.slice(0, 12)}…`);
                break;
            }
            case 'ProjectTransferred': {
                const a = decoded.args;
                console.log(`⇄ ProjectTransferred  block #${log.blockNumber}`);
                console.log(`  project=#${a.projectId}  ${a.from.slice(0, 10)}… → ${a.to.slice(0, 10)}…`);
                break;
            }
        }
    }
    catch {
        // ignore unknown events
    }
}
main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
//# sourceMappingURL=watch-events.js.map