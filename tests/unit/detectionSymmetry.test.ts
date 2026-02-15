import { describe, expect, it } from "vitest";
import {
  computeActivityLevel,
  computeDetectionScore,
  computeSignature,
  isDetected
} from "../../src/core/math/sensorMath";

describe("detection symmetry", () => {
  it("produces symmetric bidirectional detection for mirrored startup entities", () => {
    const threshold = 25;
    const sensorStrength = 70;
    const distanceM = 15_000;

    const activityAlpha = computeActivityLevel(0, 0, true);
    const activityBeta = computeActivityLevel(0, 0, true);

    const sigAlpha = computeSignature("Heavy Frigate", activityAlpha);
    const sigBeta = computeSignature("Heavy Frigate", activityBeta);

    const alphaToBeta = computeDetectionScore(sigBeta, sensorStrength, distanceM);
    const betaToAlpha = computeDetectionScore(sigAlpha, sensorStrength, distanceM);

    expect(Math.abs(alphaToBeta - betaToAlpha)).toBeLessThan(1e-6);
    expect(isDetected(alphaToBeta, threshold)).toBe(true);
    expect(isDetected(betaToAlpha, threshold)).toBe(true);
  });
});
