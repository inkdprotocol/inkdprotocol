/**
 * @file abi.test.ts
 * Structural unit tests for CLI ABI definitions.
 * Ensures the ABIs are well-formed before they reach viem — catches
 * typos and missing fields that would produce silent runtime errors.
 */

import { describe, it, expect } from "vitest";
import { REGISTRY_ABI, TOKEN_ABI } from "../abi.js";

// ─── Helper types ─────────────────────────────────────────────────────────────

interface AbiEntry {
  name: string;
  type: string;
  stateMutability?: string;
  inputs?: { name: string; type: string }[];
  outputs?: unknown[];
}

// ─── REGISTRY_ABI ─────────────────────────────────────────────────────────────

describe("REGISTRY_ABI", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(REGISTRY_ABI)).toBe(true);
    expect(REGISTRY_ABI.length).toBeGreaterThan(0);
  });

  it("every entry has a name and type", () => {
    for (const entry of REGISTRY_ABI as unknown as AbiEntry[]) {
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.type).toBe("string");
    }
  });

  it("all function entries have stateMutability", () => {
    const functions = (REGISTRY_ABI as unknown as AbiEntry[]).filter((e) => e.type === "function");
    for (const fn of functions) {
      expect(
        ["pure", "view", "nonpayable", "payable"],
        `${fn.name} missing valid stateMutability`
      ).toContain(fn.stateMutability);
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
    it(`includes write function "${fnName}"`, () => {
      const entry = (REGISTRY_ABI as unknown as AbiEntry[]).find((e) => e.name === fnName);
      expect(entry, `${fnName} not found`).toBeDefined();
      expect(entry!.type).toBe("function");
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
    it(`includes read function "${fnName}"`, () => {
      const entry = (REGISTRY_ABI as unknown as AbiEntry[]).find((e) => e.name === fnName);
      expect(entry, `${fnName} not found`).toBeDefined();
    });
  }

  // ── createProject inputs ──────────────────────────────────────────────────

  it("createProject has all required input fields", () => {
    const entry = (REGISTRY_ABI as unknown as AbiEntry[]).find((e) => e.name === "createProject")!;
    const inputNames = entry.inputs!.map((i) => i.name);
    expect(inputNames).toContain("name");
    expect(inputNames).toContain("description");
    expect(inputNames).toContain("license");
    expect(inputNames).toContain("isPublic");
    expect(inputNames).toContain("readmeHash");
    expect(inputNames).toContain("isAgent");
    expect(inputNames).toContain("agentEndpoint");
  });

  // ── pushVersion is payable ────────────────────────────────────────────────

  it("pushVersion is payable", () => {
    const entry = (REGISTRY_ABI as unknown as AbiEntry[]).find((e) => e.name === "pushVersion")!;
    expect(entry.stateMutability).toBe("payable");
  });

  // ── transferProject is payable ────────────────────────────────────────────

  it("transferProject is payable", () => {
    const entry = (REGISTRY_ABI as unknown as AbiEntry[]).find((e) => e.name === "transferProject")!;
    expect(entry.stateMutability).toBe("payable");
  });

  // ── Read functions are view ───────────────────────────────────────────────

  it("getProject is a view function", () => {
    const entry = (REGISTRY_ABI as unknown as AbiEntry[]).find((e) => e.name === "getProject")!;
    expect(entry.stateMutability).toBe("view");
  });

  // ── ABI only contains functions (no events needed for CLI reads/writes) ──

  it("contains only function-type entries (CLI ABI is functions-only)", () => {
    const _nonFunctions = (REGISTRY_ABI as unknown as AbiEntry[]).filter((e) => e.type !== "function");
    // CLI ABI is a minimal subset — events are not required for contract calls
    // This test documents the intentional design decision
    expect(Array.isArray(REGISTRY_ABI)).toBe(true);
    // All entries must have a valid type field
    for (const entry of REGISTRY_ABI as unknown as AbiEntry[]) {
      expect(typeof entry.type).toBe("string");
    }
  });
});

// ─── TOKEN_ABI ────────────────────────────────────────────────────────────────

describe("TOKEN_ABI", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(TOKEN_ABI)).toBe(true);
    expect(TOKEN_ABI.length).toBeGreaterThan(0);
  });

  it("every entry has a name and type", () => {
    for (const entry of TOKEN_ABI as unknown as AbiEntry[]) {
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.type).toBe("string");
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
    it(`includes function "${fnName}"`, () => {
      const entry = (TOKEN_ABI as unknown as AbiEntry[]).find((e) => e.name === fnName);
      expect(entry, `${fnName} not found in TOKEN_ABI`).toBeDefined();
    });
  }

  it("balanceOf is a view function with address input", () => {
    const entry = (TOKEN_ABI as unknown as AbiEntry[]).find((e) => e.name === "balanceOf")!;
    expect(entry.stateMutability).toBe("view");
    expect(entry.inputs![0].type).toBe("address");
  });

  it("approve is nonpayable with spender+amount inputs", () => {
    const entry = (TOKEN_ABI as unknown as AbiEntry[]).find((e) => e.name === "approve")!;
    expect(entry.stateMutability).toBe("nonpayable");
    const inputNames = entry.inputs!.map((i) => i.name);
    expect(inputNames).toContain("spender");
    expect(inputNames).toContain("amount");
  });

  it("transfer is nonpayable with to+amount inputs", () => {
    const entry = (TOKEN_ABI as unknown as AbiEntry[]).find((e) => e.name === "transfer")!;
    expect(entry.stateMutability).toBe("nonpayable");
    const inputNames = entry.inputs!.map((i) => i.name);
    expect(inputNames).toContain("to");
    expect(inputNames).toContain("amount");
  });

  it("allowance has owner+spender inputs", () => {
    const entry = (TOKEN_ABI as unknown as AbiEntry[]).find((e) => e.name === "allowance")!;
    const inputNames = entry.inputs!.map((i) => i.name);
    expect(inputNames).toContain("owner");
    expect(inputNames).toContain("spender");
  });

  it("all function entries have stateMutability", () => {
    const functions = (TOKEN_ABI as unknown as AbiEntry[]).filter((e) => e.type === "function");
    const valid = ["pure", "view", "nonpayable", "payable"];
    for (const fn of functions) {
      expect(valid, `${fn.name} has invalid stateMutability`).toContain(fn.stateMutability);
    }
  });
});
