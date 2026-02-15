import { describe, expect, it } from "vitest";
import { buildRingModel } from "../../src/core/render/ringModel";

describe("ringModel IDs", () => {
  it("uses stable IDs as canonical keys/labels/diagnostics", () => {
    const model = buildRingModel({
      entities: [
        {
          id: 1,
          shipType: "Heavy Frigate",
          team: "alpha",
          x: 0,
          y: 0,
          signature: 40,
          radarActive: true,
          sensorMode: "Active",
          sensorPower: 1,
          weapons: [{ weaponId: "pulse_laser_mk1", count: 2, active: true }]
        },
        {
          id: 2,
          shipType: "Destroyer",
          team: "beta",
          x: 4000,
          y: 0,
          signature: 55,
          radarActive: true,
          sensorMode: "Active",
          sensorPower: 1,
          weapons: []
        }
      ],
      selectedId: 1,
      hoveredId: null,
      relativeOptions: {
        mode: "all",
        includeAllies: true,
        includeEnemies: true,
        maxTargets: 5
      },
      sensorStrength: 70,
      detectThreshold: 25,
      bakedWeapons: {
        pulse_laser_mk1: { name: "Pulse Laser Mk I (PL-1)", maxRangeM: 25000 }
      },
      dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
      computeDetectionRange: () => 15000
    });

    const weaponRow = model.dynamicLegendRows.find((row) => row.key === "weapon:1:pulse_laser_mk1");
    expect(weaponRow).toBeTruthy();
    expect(weaponRow?.label).toContain("ID:1");
    expect(weaponRow?.label).toContain("WPN:pulse_laser_mk1");

    const detectRow = model.dynamicLegendRows.find((row) =>
      row.key.startsWith("detect:1:2:relativeDetection")
    );
    expect(detectRow).toBeTruthy();
    expect(detectRow?.label).toContain("ID:1 -> ID:2");

    expect(model.diagnostics.some((line) => line.includes("[weapon:1:pulse_laser_mk1]"))).toBe(
      true
    );
    expect(
      model.diagnostics.some((line) => line.includes("[detect:1:2:relativeDetectionActive]"))
    ).toBe(true);
  });
});
