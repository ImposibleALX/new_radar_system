import { describe, expect, it } from "vitest";
import {
  SHIP_SIZE_M_MAX,
  SHIP_SIZE_M_MIN,
  advanceShipSizeMeters,
  computeShipRenderSizePx,
  legacyShipScaleToMeters,
  resolveShipSizeMeters
} from "../../src/core/render/shipSize";

describe("shipSize", () => {
  it("enforces strict 250m-4000m bounds", () => {
    expect(resolveShipSizeMeters(100)).toBe(SHIP_SIZE_M_MIN);
    expect(resolveShipSizeMeters(9999)).toBe(SHIP_SIZE_M_MAX);
    expect(resolveShipSizeMeters(1000)).toBe(1000);
  });

  it("maps legacy size tokens to key metric sizes", () => {
    expect(resolveShipSizeMeters(undefined, "xs")).toBe(250);
    expect(resolveShipSizeMeters(undefined, "s")).toBe(500);
    expect(resolveShipSizeMeters(undefined, "m")).toBe(1000);
    expect(resolveShipSizeMeters(undefined, "l")).toBe(2000);
    expect(resolveShipSizeMeters(undefined, "xl")).toBe(4000);
  });

  it("accepts numeric size tokens and clamps them to range", () => {
    expect(resolveShipSizeMeters(undefined, "2750")).toBe(2750);
    expect(resolveShipSizeMeters(undefined, "9000")).toBe(SHIP_SIZE_M_MAX);
  });

  it("projects world size to screen size using zoom", () => {
    const sizeAtLowZoom = computeShipRenderSizePx(1000, 0.1);
    const sizeAtHighZoom = computeShipRenderSizePx(1000, 0.5);
    expect(sizeAtLowZoom).toBe(100);
    expect(sizeAtHighZoom).toBe(500);
    expect(sizeAtHighZoom).toBeGreaterThan(sizeAtLowZoom);
  });

  it("converts legacy shipScale snapshots to meters", () => {
    expect(legacyShipScaleToMeters(1, "m")).toBe(1000);
    expect(legacyShipScaleToMeters(2, "s")).toBe(1000);
  });

  it("grows size only through explicit growth rules", () => {
    const initial = 1000;
    const grown = advanceShipSizeMeters(initial, 100, 2);
    expect(grown).toBeGreaterThan(initial);
    expect(advanceShipSizeMeters(initial, 0, 10)).toBe(initial);
  });
});
