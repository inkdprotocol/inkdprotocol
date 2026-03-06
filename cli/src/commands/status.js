"use strict";
/**
 * inkd status — show network info and contract fees
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdStatus = cmdStatus;
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
const abi_js_1 = require("../abi.js");
async function cmdStatus() {
    const cfg = (0, config_js_1.loadConfig)();
    const addrs = config_js_1.ADDRESSES[cfg.network];
    console.log();
    console.log(`  ${config_js_1.BOLD}Inkd Protocol Status${config_js_1.RESET}`);
    console.log(`  ${'─'.repeat(40)}`);
    (0, config_js_1.info)(`Network:   ${config_js_1.CYAN}${cfg.network}${config_js_1.RESET}`);
    (0, config_js_1.info)(`RPC URL:   ${cfg.rpcUrl ?? config_js_1.DIM + 'default (public)' + config_js_1.RESET}`);
    (0, config_js_1.info)(`Registry:  ${addrs.registry || config_js_1.DIM + 'not deployed yet' + config_js_1.RESET}`);
    (0, config_js_1.info)(`Token:     ${addrs.token || config_js_1.DIM + 'not deployed yet' + config_js_1.RESET}`);
    (0, config_js_1.info)(`Treasury:  ${addrs.treasury || config_js_1.DIM + 'not deployed yet' + config_js_1.RESET}`);
    if (!addrs.registry) {
        (0, config_js_1.warn)('Contract addresses not configured — update src/config.ts after deployment.');
        console.log();
        return;
    }
    try {
        const client = (0, client_js_1.buildPublicClient)(cfg);
        const projectCount = await client.readContract({
            address: addrs.registry, abi: abi_js_1.REGISTRY_ABI, functionName: 'projectCount'
        });
        console.log();
        (0, config_js_1.info)(`Projects:      ${config_js_1.GREEN}${projectCount.toString()}${config_js_1.RESET}`);
    }
    catch (e) {
        (0, config_js_1.warn)(`Could not read on-chain state: ${e.message}`);
    }
    console.log();
}
//# sourceMappingURL=status.js.map