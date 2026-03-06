"use strict";
/**
 * Inkd CLI — Config management
 * Reads inkd.config.json from cwd, or falls back to env vars.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESET = exports.DIM = exports.BOLD = exports.CYAN = exports.YELLOW = exports.GREEN = exports.RED = exports.ADDRESSES = exports.DEFAULT_CONFIG = void 0;
exports.loadConfig = loadConfig;
exports.writeConfig = writeConfig;
exports.requirePrivateKey = requirePrivateKey;
exports.error = error;
exports.success = success;
exports.info = info;
exports.warn = warn;
const fs_1 = require("fs");
const path_1 = require("path");
exports.DEFAULT_CONFIG = {
    network: 'testnet',
};
const CONFIG_FILE = 'inkd.config.json';
function loadConfig() {
    const path = (0, path_1.resolve)(process.cwd(), CONFIG_FILE);
    let file = {};
    if ((0, fs_1.existsSync)(path)) {
        try {
            file = JSON.parse((0, fs_1.readFileSync)(path, 'utf-8'));
        }
        catch {
            error(`Failed to parse ${CONFIG_FILE}. Is it valid JSON?`);
        }
    }
    // Env var overrides
    const privateKey = process.env['INKD_PRIVATE_KEY'] ?? file.privateKey;
    const rpcUrl = process.env['INKD_RPC_URL'] ?? file.rpcUrl;
    const network = (process.env['INKD_NETWORK'] ?? file.network ?? 'testnet');
    return { network, rpcUrl, privateKey };
}
function writeConfig(cfg) {
    const path = (0, path_1.resolve)(process.cwd(), CONFIG_FILE);
    // Never persist private key to file
    const { privateKey: _pk, ...safe } = cfg;
    (0, fs_1.writeFileSync)(path, JSON.stringify(safe, null, 2) + '\n', 'utf-8');
}
function requirePrivateKey(cfg) {
    const key = cfg.privateKey ?? process.env['INKD_PRIVATE_KEY'];
    if (!key) {
        error('Private key not found.\n' +
            '  Set INKD_PRIVATE_KEY env var, or add "privateKey" to inkd.config.json\n' +
            '  Example: export INKD_PRIVATE_KEY=0xabc123...');
    }
    const hex = key.startsWith('0x') ? key : `0x${key}`;
    return hex;
}
// ─── Inkd contract addresses ─────────────────────────────────────────────────
exports.ADDRESSES = {
    mainnet: {
        token: '0xa6f64A0D23e9d6eC918929af53df1C7b0D819B07', // $TEST (Clanker, Base Mainnet)
        registry: '0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d',
        treasury: '0x23012C3EF1E95aBC0792c03671B9be33C239D449',
    },
    testnet: {
        token: '', // populated post-testnet deploy
        registry: '',
        treasury: '',
    },
};
// ─── Helpers ─────────────────────────────────────────────────────────────────
function error(msg) {
    console.error(`\n  ${exports.RED}✗${exports.RESET} ${msg}\n`);
    process.exit(1);
}
function success(msg) {
    console.log(`\n  ${exports.GREEN}✓${exports.RESET} ${msg}\n`);
}
function info(msg) {
    console.log(`  ${exports.CYAN}→${exports.RESET} ${msg}`);
}
function warn(msg) {
    console.warn(`  ${exports.YELLOW}⚠${exports.RESET}  ${msg}`);
}
// ─── ANSI colours ─────────────────────────────────────────────────────────────
const noColor = process.env['NO_COLOR'] !== undefined || !process.stdout.isTTY;
exports.RED = noColor ? '' : '\x1b[31m';
exports.GREEN = noColor ? '' : '\x1b[32m';
exports.YELLOW = noColor ? '' : '\x1b[33m';
exports.CYAN = noColor ? '' : '\x1b[36m';
exports.BOLD = noColor ? '' : '\x1b[1m';
exports.DIM = noColor ? '' : '\x1b[2m';
exports.RESET = noColor ? '' : '\x1b[0m';
//# sourceMappingURL=config.js.map