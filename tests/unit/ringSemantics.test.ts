import { describe, expect, it } from "vitest";
import {
  getFocusVisualState,
  getStaticRingSemantics,
  RING_SEMANTICS
} from "../../src/core/render/ringSemantics";
import { buildRingModel } from "../../src/core/render/ringModel";

describe("ring semantics mapping", () => {
  it("exposes stable semantic definitions with labels, meaning, and style metadata", () => {
    const defs = getStaticRingSemantics();
    expect(defs.length).toBeGreaterThan(0);

    defs.forEach((def) => {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.meaning.length).toBeGreaterThan(0);
      expect(def.visibleWhen.length).toBeGreaterThan(0);
      expect(def.colorToken.length).toBeGreaterThan(0);
      expect(Number.isFinite(def.priority)).toBe(true);
    });
  });

  it("keeps semantic color token constant while focus state changes visual weight only", () => {
    const selected = getFocusVisualState("selected");
    const hovered = getFocusVisualState("hovered");

    expect(selected.lineWidth).toBeGreaterThan(hovered.lineWidth);
    expect(selected.opacity).toBeGreaterThan(hovered.opacity);
    expect(RING_SEMANTICS.weaponEffectiveRange.colorToken).toBe("weapon");
  });
});

describe("ring model parity", () => {
  it("generates dynamic legend rows from the same visible ring model used to render", () => {
    const entities = [
      {
        id: 1,
        shipType: "Heavy Frigate",
        team: "alpha",
        x: 0,
        y: 0,
        signature: 45,
        radarActive: true,
        sensorMode: "Active",
        sensorPower: 1,
        weapons: [{ weaponId: "pulse_laser_mk1", active: true, count: 2, slotId: 1 }]
      },
      {
        id: 2,
        shipType: "Destroyer",
        team: "beta",
        x: 4000,
        y: 5000,
        signature: 60,
        radarActive: false,
        sensorMode: "Passive",
        sensorPower: 1.1,
        weapons: []
      }
    ];

    const model = buildRingModel({
      entities,
      selectedId: 1,
      hoveredId: null,
      relativeOptions: {
        mode: "selected",
        includeAllies: true,
        includeEnemies: true,
        maxTargets: 5
      },
      sensorStrength: 70,
      detectThreshold: 25,
      bakedWeapons: {
        pulse_laser_mk1: { name: "Pulse Laser Mk I (PL-1)", maxRangeM: 25000 }
      },
      dist: (a, b) => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
      },
      computeDetectionRange: () => 15000
    });

    expect(model.rings.length).toBeGreaterThan(0);
    expect(model.dynamicLegendRows.length).toBe(model.rings.length);
    expect(model.dynamicLegendRows.every((row) => row.key.length > 0)).toBe(true);
    expect(model.digest.length).toBeGreaterThan(0);
  });
});
