import { describe, expect, it } from "vitest";
import {
  coerceNumberValue,
  normalizeLocaleNumber,
  parseFiniteNumberStrict
} from "../../src/ui/numberSafety";

describe("numberSafety", () => {
  it("normalizes locale decimals and parses finite values", () => {
    expect(normalizeLocaleNumber(" 1 234,56 ")).toBe("1234.56");
    expect(parseFiniteNumberStrict("12,5")).toBe(12.5);
    expect(parseFiniteNumberStrict("abc")).toBeNull();
  });

  it("clamps and snaps to step while rejecting invalid values", () => {
    const clamped = coerceNumberValue("99.99", {
      min: 0,
      max: 10,
      step: 0.5,
      fallback: 1
    });
    expect(clamped.value).toBe(10);

    const fallback = coerceNumberValue("not-a-number", {
      min: 0,
      max: 10,
      step: 1,
      fallback: 4
    });
    expect(fallback.valid).toBe(false);
    expect(fallback.value).toBe(4);
  });
});
