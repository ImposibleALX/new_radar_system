import { describe, expect, it } from "vitest";
import { buildRingModel } from "../../src/core/render/ringModel";

describe("ring visibility modes", () => {
  const entities = [
    {
      id: 1,
      shipType: "Heavy Frigate",
      team: "alpha",
      x: 0,
      y: 0,
      signature: 50,
      radarActive: true,
      sensorMode: "Active",
      sensorPower: 1,
      weapons: [{ weaponId: "pulse_laser_mk1", count: 1, active: true }]
    },
    {
      id: 2,
      shipType: "Destroyer",
      team: "beta",
      x: 6000,
      y: 0,
      signature: 65,
      radarActive: true,
      sensorMode: "Active",
      sensorPower: 1,
      weapons: [{ weaponId: "pulse_laser_mk1", count: 2, active: true }]
    },
    {
      id: 3,
      shipType: "Light Frigate",
      team: "alpha",
      x: -6000,
      y: 0,
      signature: 35,
      radarActive: false,
      sensorMode: "Passive",
      sensorPower: 1,
      weapons: [{ weaponId: "pulse_laser_mk1", count: 1, active: true }]
    }
  ];

  const baseInput = {
    entities,
    selectedId: null,
    hoveredId: null,
    relativeOptions: {
      mode: "all" as const,
      includeAllies: true,
      includeEnemies: true,
      maxTargets: 5
    },
    sensorStrength: 70,
    detectThreshold: 25,
    bakedWeapons: {
      pulse_laser_mk1: { name: "Pulse Laser Mk I (PL-1)", maxRangeM: 25000 }
    },
    dist: (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y),
    computeDetectionRange: () => 15000
  };

  it("keeps focused mode behavior (no focus => no rings)", () => {
    const model = buildRingModel({
      ...baseInput,
      ringVisibilityMode: "focused"
    });
    expect(model.rings.length).toBe(0);
  });

  it("renders rings for all entities in all mode even without selected entity", () => {
    const model = buildRingModel({
      ...baseInput,
      ringVisibilityMode: "all"
    });
    expect(model.rings.length).toBeGreaterThan(0);
    expect(model.rings.every((ring) => ring.focus === "ambient")).toBe(true);
  });

  it("limits threat-only mode to hostile sources against the selected entity", () => {
    const model = buildRingModel({
      ...baseInput,
      selectedId: 1,
      ringVisibilityMode: "threat-only"
    });

    const hasEnemySource = model.rings.some((ring) => ring.ownerId === 2);
    const hasAllySource = model.rings.some((ring) => ring.ownerId === 3);
    const hasEnemyToSelectedDetection = model.rings.some((ring) =>
      ring.id.startsWith("detect:2:1:relativeDetection")
    );

    expect(hasEnemySource).toBe(true);
    expect(hasAllySource).toBe(false);
    expect(hasEnemyToSelectedDetection).toBe(true);
  });
});
