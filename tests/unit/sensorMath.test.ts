import { describe, expect, it } from "vitest";
import { computeDetectionRange, computeLockState } from "../../src/core/math/sensorMath";

describe("sensor math", () => {
  it("computes finite detection ranges", () => {
    const range = computeDetectionRange(50, 70, 25);
    expect(range).toBeGreaterThan(0);
    expect(Number.isFinite(range)).toBe(true);
  });

  it("transitions lock state based on quality", () => {
    const weak = computeLockState(10, 3, 0.1, 0.2);
    const strong = computeLockState(70, 0.02, 3, 0.2);

    expect(weak.state).toBe("NONE");
    expect(["TRACKING", "LOCKED"]).toContain(strong.state);
    expect(strong.quality).toBeGreaterThan(0.2);
  });
});
