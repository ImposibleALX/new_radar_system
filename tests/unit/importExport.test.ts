import { describe, expect, it } from "vitest";
import { normalizeExportPayload } from "../../src/features/importExport";

describe("normalizeExportPayload", () => {
  it("accepts legacy payloads without schemaVersion", () => {
    const payload = normalizeExportPayload({
      entities: [],
      config: {},
      zoom: 0.2,
      panX: 10,
      panY: 20
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.defaultWeapon).toBe("pulse_laser_mk1");
    expect(payload.nextSlotId).toBe(1);
    expect(payload.telemetryEnabled).toBe(false);
  });

  it("preserves schemaVersion=2 payloads", () => {
    const payload = normalizeExportPayload({
      schemaVersion: 2,
      entities: [],
      config: {},
      zoom: 0.15,
      panX: 0,
      panY: 0,
      defaultShipType: "Heavy Frigate",
      defaultTeam: "alpha",
      defaultWeapon: "pulse_laser_mk1",
      nextSlotId: 9
    });

    expect(payload.schemaVersion).toBe(2);
    expect(payload.nextSlotId).toBe(9);
  });

  it("maps legacy telemetryMode to telemetryEnabled", () => {
    const onPayload = normalizeExportPayload({
      entities: [],
      config: {},
      telemetryMode: "full"
    });
    const offPayload = normalizeExportPayload({
      entities: [],
      config: {},
      telemetryMode: "off"
    });

    expect(onPayload.telemetryEnabled).toBe(true);
    expect(offPayload.telemetryEnabled).toBe(false);
  });
});
