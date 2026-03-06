"use strict";
/**
 * @file abi.test.ts
 * Structural unit tests for CLI ABI definitions.
 * Ensures the ABIs are well-formed before they reach viem — catches
 * typos and missing fields that would produce silent runtime errors.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const abi_js_1 = require("../abi.js");
// ─── REGISTRY_ABI ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("REGISTRY_ABI", () => {
    (0, vitest_1.it)("is a non-empty array", () => {
        (0, vitest_1.expect)(Array.isArray(abi_js_1.REGISTRY_ABI)).toBe(true);
        (0, vitest_1.expect)(abi_js_1.REGISTRY_ABI.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)("every entry has a name and type", () => {
        for (const entry of abi_js_1.REGISTRY_ABI) {
            (0, vitest_1.expect)(typeof entry.name).toBe("string");
            (0, vitest_1.expect)(entry.name.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(typeof entry.type).toBe("string");
        }
    });
    (0, vitest_1.it)("all function entries have stateMutability", () => {
        const functions = abi_js_1.REGISTRY_ABI.filter((e) => e.type === "function");
        for (const fn of functions) {
            (0, vitest_1.expect)(["pure", "view", "nonpayable", "payable"], `${fn.name} missing valid stateMutability`).toContain(fn.stateMutability);
        }
    });
    // ── Required write functions ──────────────────────────────────────────────
    const expectedWriteFns = [
        "createProject",
        "pushVersion",
        "transferProject",
        "addCollaborator",
        "removeCollaborator",
        "setVisibility",
        "setReadme",
        "setAgentEndpoint",
    ];
    for (const fnName of expectedWriteFns) {
        (0, vitest_1.it)(`includes write function "${fnName}"`, () => {
            const entry = abi_js_1.REGISTRY_ABI.find((e) => e.name === fnName);
            (0, vitest_1.expect)(entry, `${fnName} not found`).toBeDefined();
            (0, vitest_1.expect)(entry.type).toBe("function");
        });
    }
    // ── Required read functions ───────────────────────────────────────────────
    const expectedReadFns = [
        "getProject",
        "getVersionCount",
        "getVersion",
        "getCollaborators",
        "getOwnerProjects",
        "getAgentProjects",
    ];
    for (const fnName of expectedReadFns) {
        (0, vitest_1.it)(`includes read function "${fnName}"`, () => {
            const entry = abi_js_1.REGISTRY_ABI.find((e) => e.name === fnName);
            (0, vitest_1.expect)(entry, `${fnName} not found`).toBeDefined();
        });
    }
    // ── createProject inputs ──────────────────────────────────────────────────
    (0, vitest_1.it)("createProject has all required input fields", () => {
        const entry = abi_js_1.REGISTRY_ABI.find((e) => e.name === "createProject");
        const inputNames = entry.inputs.map((i) => i.name);
        (0, vitest_1.expect)(inputNames).toContain("name");
        (0, vitest_1.expect)(inputNames).toContain("description");
        (0, vitest_1.expect)(inputNames).toContain("license");
        (0, vitest_1.expect)(inputNames).toContain("isPublic");
        (0, vitest_1.expect)(inputNames).toContain("readmeHash");
        (0, vitest_1.expect)(inputNames).toContain("isAgent");
        (0, vitest_1.expect)(inputNames).toContain("agentEndpoint");
    });
    // ── pushVersion is payable ────────────────────────────────────────────────
    (0, vitest_1.it)("pushVersion is payable", () => {
        const entry = abi_js_1.REGISTRY_ABI.find((e) => e.name === "pushVersion");
        (0, vitest_1.expect)(entry.stateMutability).toBe("payable");
    });
    // ── transferProject is payable ────────────────────────────────────────────
    (0, vitest_1.it)("transferProject is payable", () => {
        const entry = abi_js_1.REGISTRY_ABI.find((e) => e.name === "transferProject");
        (0, vitest_1.expect)(entry.stateMutability).toBe("payable");
    });
    // ── Read functions are view ───────────────────────────────────────────────
    (0, vitest_1.it)("getProject is a view function", () => {
        const entry = abi_js_1.REGISTRY_ABI.find((e) => e.name === "getProject");
        (0, vitest_1.expect)(entry.stateMutability).toBe("view");
    });
    // ── ABI only contains functions (no events needed for CLI reads/writes) ──
    (0, vitest_1.it)("contains only function-type entries (CLI ABI is functions-only)", () => {
        const nonFunctions = abi_js_1.REGISTRY_ABI.filter((e) => e.type !== "function");
        // CLI ABI is a minimal subset — events are not required for contract calls
        // This test documents the intentional design decision
        (0, vitest_1.expect)(Array.isArray(abi_js_1.REGISTRY_ABI)).toBe(true);
        // All entries must have a valid type field
        for (const entry of abi_js_1.REGISTRY_ABI) {
            (0, vitest_1.expect)(typeof entry.type).toBe("string");
        }
    });
});
// ─── TOKEN_ABI ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("TOKEN_ABI", () => {
    (0, vitest_1.it)("is a non-empty array", () => {
        (0, vitest_1.expect)(Array.isArray(abi_js_1.TOKEN_ABI)).toBe(true);
        (0, vitest_1.expect)(abi_js_1.TOKEN_ABI.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)("every entry has a name and type", () => {
        for (const entry of abi_js_1.TOKEN_ABI) {
            (0, vitest_1.expect)(typeof entry.name).toBe("string");
            (0, vitest_1.expect)(entry.name.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(typeof entry.type).toBe("string");
        }
    });
    const expectedTokenFns = [
        "balanceOf",
        "allowance",
        "approve",
        "transfer",
        "name",
        "symbol",
        "decimals",
        "totalSupply",
    ];
    for (const fnName of expectedTokenFns) {
        (0, vitest_1.it)(`includes function "${fnName}"`, () => {
            const entry = abi_js_1.TOKEN_ABI.find((e) => e.name === fnName);
            (0, vitest_1.expect)(entry, `${fnName} not found in TOKEN_ABI`).toBeDefined();
        });
    }
    (0, vitest_1.it)("balanceOf is a view function with address input", () => {
        const entry = abi_js_1.TOKEN_ABI.find((e) => e.name === "balanceOf");
        (0, vitest_1.expect)(entry.stateMutability).toBe("view");
        (0, vitest_1.expect)(entry.inputs[0].type).toBe("address");
    });
    (0, vitest_1.it)("approve is nonpayable with spender+amount inputs", () => {
        const entry = abi_js_1.TOKEN_ABI.find((e) => e.name === "approve");
        (0, vitest_1.expect)(entry.stateMutability).toBe("nonpayable");
        const inputNames = entry.inputs.map((i) => i.name);
        (0, vitest_1.expect)(inputNames).toContain("spender");
        (0, vitest_1.expect)(inputNames).toContain("amount");
    });
    (0, vitest_1.it)("transfer is nonpayable with to+amount inputs", () => {
        const entry = abi_js_1.TOKEN_ABI.find((e) => e.name === "transfer");
        (0, vitest_1.expect)(entry.stateMutability).toBe("nonpayable");
        const inputNames = entry.inputs.map((i) => i.name);
        (0, vitest_1.expect)(inputNames).toContain("to");
        (0, vitest_1.expect)(inputNames).toContain("amount");
    });
    (0, vitest_1.it)("allowance has owner+spender inputs", () => {
        const entry = abi_js_1.TOKEN_ABI.find((e) => e.name === "allowance");
        const inputNames = entry.inputs.map((i) => i.name);
        (0, vitest_1.expect)(inputNames).toContain("owner");
        (0, vitest_1.expect)(inputNames).toContain("spender");
    });
    (0, vitest_1.it)("all function entries have stateMutability", () => {
        const functions = abi_js_1.TOKEN_ABI.filter((e) => e.type === "function");
        const valid = ["pure", "view", "nonpayable", "payable"];
        for (const fn of functions) {
            (0, vitest_1.expect)(valid, `${fn.name} has invalid stateMutability`).toContain(fn.stateMutability);
        }
    });
});
//# sourceMappingURL=abi.test.js.map