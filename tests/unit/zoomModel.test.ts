import { describe, expect, it } from "vitest";
import {
  ZOOM_MIN,
  applyWheelZoom,
  normalizedToZoom,
  parseZoomFromNumber,
  parseZoomFromSlider,
  zoomToNormalized
} from "../../src/ui/zoomModel";

describe("zoomModel", () => {
  it("maps zoom to normalized space and back with stable precision", () => {
    const zoom = 0.27;
    const normalized = zoomToNormalized(zoom);
    const roundTrip = normalizedToZoom(normalized);
    expect(Math.abs(roundTrip - zoom)).toBeLessThan(0.01);
  });

  it("keeps wheel progression smooth and monotonic from fill-grid baseline", () => {
    const base = ZOOM_MIN;
    const zoomIn = applyWheelZoom(base, -120);
    const zoomOut = applyWheelZoom(zoomIn, 120);

    expect(zoomIn).toBeGreaterThan(base);
    expect(zoomOut).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(zoomOut).toBeLessThan(zoomIn);
  });

  it("reaches 0.05+ from baseline without abrupt wheel jumps", () => {
    const values: number[] = [ZOOM_MIN];
    for (let i = 0; i < 12; i += 1) {
      values.push(applyWheelZoom(values[values.length - 1], -120));
    }

    expect(values[values.length - 1]).toBeGreaterThanOrEqual(0.05);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
      expect(values[i] - values[i - 1]).toBeLessThan(0.02);
    }
  });

  it("parses slider/number values with clamping and no jumpy invalid fallback", () => {
    expect(parseZoomFromNumber("0,01", 0.2)).toBeCloseTo(0.01, 2);
    expect(parseZoomFromNumber("999", 0.2)).toBeLessThanOrEqual(5);
    expect(parseZoomFromSlider("1.5", 0.2)).toBeLessThanOrEqual(5);
    expect(parseZoomFromSlider("-1", 0.2)).toBeGreaterThanOrEqual(0.01);
  });
});
