"use strict";
/**
 * inkd init — scaffold inkd.config.json in the current directory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdInit = cmdInit;
const fs_1 = require("fs");
const path_1 = require("path");
const config_js_1 = require("../config.js");
async function cmdInit(args) {
    const path = (0, path_1.resolve)(process.cwd(), 'inkd.config.json');
    const network = args.includes('--mainnet') ? 'mainnet' : 'testnet';
    if ((0, fs_1.existsSync)(path) && !args.includes('--force')) {
        (0, config_js_1.warn)('inkd.config.json already exists. Use --force to overwrite.');
        return;
    }
    (0, config_js_1.writeConfig)({ network });
    (0, config_js_1.success)(`Created ${config_js_1.BOLD}inkd.config.json${config_js_1.RESET} (network: ${config_js_1.CYAN}${network}${config_js_1.RESET})`);
    console.log(`  Next steps:`);
    console.log(`    ${config_js_1.DIM}export INKD_PRIVATE_KEY=0x...${config_js_1.RESET}   # never store keys in config files`);
    console.log(`    ${config_js_1.DIM}inkd status${config_js_1.RESET}                       # verify connection`);
    console.log(`    ${config_js_1.DIM}inkd project create${config_js_1.RESET}               # register your first project`);
    console.log();
}
//# sourceMappingURL=init.js.map