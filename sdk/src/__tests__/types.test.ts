import { describe, it, expect } from "vitest";
import { ContentType } from "../types";

// These are compile-time checks — if the file compiles, the types are correct.
// Runtime tests verify the enum values are stable.

describe("ContentType enum", () => {
  it("has correct MIME strings for common types", () => {
    expect(ContentType.JSON).toBe("application/json");
    expect(ContentType.PlainText).toBe("text/plain");
    expect(ContentType.Markdown).toBe("text/markdown");
    expect(ContentType.HTML).toBe("text/html");
    expect(ContentType.PNG).toBe("image/png");
    expect(ContentType.JPEG).toBe("image/jpeg");
    expect(ContentType.SVG).toBe("image/svg+xml");
    expect(ContentType.Binary).toBe("application/octet-stream");
    expect(ContentType.WASM).toBe("application/wasm");
  });

  it("covers all 18 expected content types", () => {
    const types = Object.values(ContentType);
    expect(types).toHaveLength(18);
  });

  it("all values are non-empty strings", () => {
    for (const value of Object.values(ContentType)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("all values follow <type>/<subtype> format", () => {
    for (const value of Object.values(ContentType)) {
      expect(value).toMatch(/^[a-z]+\/[a-z0-9.+\-]+$/u); // eslint-disable-line no-useless-escape
    }
  });
});
