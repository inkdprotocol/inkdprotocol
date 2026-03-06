"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @inkd/api — middleware/x402.ts unit tests
 *
 * Tests buildX402Middleware(), getPayerAddress(), and NETWORK_BASE_* constants.
 */
const vitest_1 = require("vitest");
// Mock @x402/express and @x402/core/http BEFORE importing the module under test
vitest_1.vi.mock('@x402/express', () => ({
    paymentMiddlewareFromConfig: vitest_1.vi.fn((_routes, _client) => {
        return (_req, _res, next) => next();
    }),
}));
vitest_1.vi.mock('@x402/core/http', () => {
    const MockHTTPFacilitatorClient = vitest_1.vi.fn(function (opts) {
        this.url = opts.url;
    });
    return { HTTPFacilitatorClient: MockHTTPFacilitatorClient };
});
const x402_js_1 = require("../middleware/x402.js");
const express_1 = require("@x402/express");
const http_1 = require("@x402/core/http");
// ─── buildX402Middleware() ────────────────────────────────────────────────────
(0, vitest_1.describe)('buildX402Middleware()', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    const baseConfig = {
        treasuryAddress: '0xABCDEF1234567890ABCDef1234567890AbCdEf01',
        facilitatorUrl: 'https://x402.org/facilitator',
        network: 'testnet',
    };
    (0, vitest_1.it)('returns a middleware function', () => {
        const mw = (0, x402_js_1.buildX402Middleware)(baseConfig);
        (0, vitest_1.expect)(typeof mw).toBe('function');
    });
    (0, vitest_1.it)('instantiates HTTPFacilitatorClient with the given facilitatorUrl', () => {
        (0, x402_js_1.buildX402Middleware)(baseConfig);
        (0, vitest_1.expect)(http_1.HTTPFacilitatorClient).toHaveBeenCalledWith({
            url: 'https://x402.org/facilitator',
        });
    });
    (0, vitest_1.it)('calls paymentMiddlewareFromConfig with routes and facilitator', () => {
        (0, x402_js_1.buildX402Middleware)(baseConfig);
        (0, vitest_1.expect)(express_1.paymentMiddlewareFromConfig).toHaveBeenCalledTimes(1);
        const [routes] = express_1.paymentMiddlewareFromConfig.mock.calls[0];
        (0, vitest_1.expect)(routes).toHaveProperty('POST /v1/projects');
        (0, vitest_1.expect)(routes).toHaveProperty('POST /v1/projects/:id/versions');
    });
    (0, vitest_1.it)('uses NETWORK_BASE_SEPOLIA for testnet', () => {
        (0, x402_js_1.buildX402Middleware)({ ...baseConfig, network: 'testnet' });
        const [routes] = express_1.paymentMiddlewareFromConfig.mock.calls[0];
        (0, vitest_1.expect)(routes['POST /v1/projects'].accepts.network).toBe(x402_js_1.NETWORK_BASE_SEPOLIA);
    });
    (0, vitest_1.it)('uses NETWORK_BASE_MAINNET for mainnet', () => {
        (0, x402_js_1.buildX402Middleware)({ ...baseConfig, network: 'mainnet' });
        const [routes] = express_1.paymentMiddlewareFromConfig.mock.calls[0];
        (0, vitest_1.expect)(routes['POST /v1/projects'].accepts.network).toBe(x402_js_1.NETWORK_BASE_MAINNET);
    });
    (0, vitest_1.it)('sets treasuryAddress in both route configs', () => {
        (0, x402_js_1.buildX402Middleware)(baseConfig);
        const [routes] = express_1.paymentMiddlewareFromConfig.mock.calls[0];
        const routeKeys = Object.keys(routes);
        (0, vitest_1.expect)(routes[routeKeys[0]].accepts.payTo).toBe(baseConfig.treasuryAddress);
        (0, vitest_1.expect)(routes[routeKeys[1]].accepts.payTo).toBe(baseConfig.treasuryAddress);
    });
    (0, vitest_1.it)('sets price to $0.001 in both route configs', () => {
        (0, x402_js_1.buildX402Middleware)(baseConfig);
        const [routes] = express_1.paymentMiddlewareFromConfig.mock.calls[0];
        (0, vitest_1.expect)(routes['POST /v1/projects'].accepts.price).toBe('$5.00'); // create project
        (0, vitest_1.expect)(routes['POST /v1/projects/:id/versions'].accepts.price).toBe('$2.00'); // push version
    });
    (0, vitest_1.it)('uses custom facilitatorUrl when provided', () => {
        (0, x402_js_1.buildX402Middleware)({ ...baseConfig, facilitatorUrl: 'https://custom.facilitator.io' });
        (0, vitest_1.expect)(http_1.HTTPFacilitatorClient).toHaveBeenCalledWith({
            url: 'https://custom.facilitator.io',
        });
    });
});
// ─── NETWORK constants ────────────────────────────────────────────────────────
(0, vitest_1.describe)('NETWORK constants', () => {
    (0, vitest_1.it)('NETWORK_BASE_MAINNET is correct CAIP-2', () => {
        (0, vitest_1.expect)(x402_js_1.NETWORK_BASE_MAINNET).toBe('eip155:8453');
    });
    (0, vitest_1.it)('NETWORK_BASE_SEPOLIA is correct CAIP-2', () => {
        (0, vitest_1.expect)(x402_js_1.NETWORK_BASE_SEPOLIA).toBe('eip155:84532');
    });
});
(0, vitest_1.describe)('getPayerAddress()', () => {
    (0, vitest_1.it)('returns payer address when x402 payment exists', () => {
        const req = {
            x402: {
                payment: {
                    payload: {
                        authorization: {
                            from: '0xABCDEF1234567890ABCDef1234567890AbCdEf01',
                        },
                    },
                },
            },
        };
        (0, vitest_1.expect)((0, x402_js_1.getPayerAddress)(req)).toBe('0xABCDEF1234567890ABCDef1234567890AbCdEf01');
    });
    (0, vitest_1.it)('returns undefined when no x402 payment', () => {
        const req = {};
        (0, vitest_1.expect)((0, x402_js_1.getPayerAddress)(req)).toBeUndefined();
    });
    (0, vitest_1.it)('returns undefined when x402 is present but payment is missing', () => {
        const req = { x402: {} };
        (0, vitest_1.expect)((0, x402_js_1.getPayerAddress)(req)).toBeUndefined();
    });
    (0, vitest_1.it)('returns undefined when authorization.from is missing', () => {
        const req = {
            x402: { payment: { payload: { authorization: {} } } },
        };
        (0, vitest_1.expect)((0, x402_js_1.getPayerAddress)(req)).toBeUndefined();
    });
});
//# sourceMappingURL=middleware.x402.test.js.map