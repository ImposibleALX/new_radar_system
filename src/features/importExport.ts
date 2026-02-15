import { CONFIG } from "../core/domain/config";
import { Entity } from "../core/domain/entity";
import type {
  ExportPayload,
  RelativeOptions,
  RingVisibilityMode,
  Team,
  WeaponSlot
} from "../core/domain/types";
import { legacyShipScaleToMeters, resolveShipSizeMeters } from "../core/render/shipSize";
import { getShipProfile } from "../core/math/sensorMath";
import type { AppRuntime } from "../main";

const RING_VISIBILITY_MODES = new Set(["focused", "threat-only", "all"]);

export function exportState(runtime: AppRuntime): void {
  const payload: ExportPayload = {
    schemaVersion: 3,
    entities: runtime.state.entities.map((entity: Entity) => ({
      id: entity.id,
      x: entity.x,
      y: entity.y,
      z: entity.z,
      speed: entity.speed,
      heading: entity.heading,
      shipType: entity.shipType,
      team: entity.team,
      weapons: entity.weapons,
      ecm: entity.ecm,
      sensorPower: entity.sensorPower,
      sensorMode: entity.sensorMode,
      radarActive: entity.radarActive,
      shipSizeM: entity.shipSizeM,
      shipSizeGrowthPerSecond: entity.shipSizeGrowthPerSecond,
      shipScale: entity.shipScale,
      shipGrowthPerSecond: entity.shipGrowthPerSecond
    })),
    config: Object.keys(CONFIG).reduce<Record<string, number>>((acc, key) => {
      acc[key] = CONFIG[key].val;
      return acc;
    }, {}),
    zoom: runtime.state.zoom,
    panX: runtime.state.panX,
    panY: runtime.state.panY,
    defaultShipType: runtime.state.defaultShipType,
    defaultTeam: runtime.state.defaultTeam,
    defaultWeapon: runtime.state.defaultWeapon,
    nextSlotId: runtime.state.nextSlotId,
    telemetryEnabled:
      typeof runtime.state.telemetryEnabled === "boolean" ? runtime.state.telemetryEnabled : false,
    showRangeRings:
      typeof runtime.state.showRangeRings === "boolean" ? runtime.state.showRangeRings : true,
    showRangeLegend:
      typeof runtime.state.showRangeLegend === "boolean" ? runtime.state.showRangeLegend : true,
    ringVisibilityMode: sanitizeRingVisibilityMode(runtime.state.ringVisibilityMode, "focused"),
    relativeOptions: normalizeRelativeOptions(runtime.state.relativeOptions)
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sensor_testbed_state.json";
  link.click();
  URL.revokeObjectURL(url);
  runtime.log("State exported to JSON", "INFO", "SYS");
}

export async function importStateFromFile(runtime: AppRuntime): Promise<void> {
  const fileInput = document.getElementById("import-file-input") as HTMLInputElement | null;
  const file = fileInput?.files?.[0];
  if (!file) {
    alert("Please select a file");
    return;
  }

  const text = await file.text();
  let payload: ExportPayload;
  try {
    payload = normalizeExportPayload(JSON.parse(text));
  } catch (error) {
    alert(`Failed to parse JSON: ${(error as Error).message}`);
    return;
  }

  runtime.state.entities = [];
  runtime.resetIds();

  const warnings: string[] = [];
  (payload.entities || []).forEach((snapshot) => {
    const entity = new Entity(
      runtime.nextEntityId(),
      snapshot.x || 0,
      snapshot.y || 0,
      snapshot.shipType || "Heavy Frigate",
      (snapshot.team || "neutral") as Team
    );
    entity.z = snapshot.z || 0;
    entity.speed = snapshot.speed || 0;
    entity.heading = snapshot.heading || 0;
    entity.team = (snapshot.team || "neutral") as Team;
    entity.ecm = snapshot.ecm || 0;
    entity.sensorPower = snapshot.sensorPower || 1.0;
    entity.sensorMode = snapshot.sensorMode || "Active";
    entity.radarActive = snapshot.radarActive ?? true;
    const profile = getShipProfile(entity.shipType);
    const fallbackSizeM = resolveShipSizeMeters(profile.sizeM, profile.size);
    entity.shipSizeM = resolveShipSizeMeters(
      snapshot.shipSizeM,
      undefined,
      typeof snapshot.shipScale === "number"
        ? legacyShipScaleToMeters(snapshot.shipScale, profile.size)
        : fallbackSizeM
    );
    entity.shipSizeGrowthPerSecond =
      typeof snapshot.shipSizeGrowthPerSecond === "number"
        ? snapshot.shipSizeGrowthPerSecond
        : typeof snapshot.shipGrowthPerSecond === "number"
          ? snapshot.shipGrowthPerSecond * fallbackSizeM
          : 0;
    entity.shipScale = 1;
    entity.shipGrowthPerSecond = 0;

    const slots = Array.isArray(snapshot.weapons) ? snapshot.weapons : [];
    entity.weapons = slots.map((slot) => normalizeSlot(slot, runtime, warnings, entity.id));
    runtime.state.entities.push(entity);
  });

  Object.keys(payload.config || {}).forEach((key) => {
    if (!CONFIG[key]) return;
    CONFIG[key].val = payload.config[key];
  });

  runtime.state.zoom = payload.zoom ?? runtime.state.zoom;
  runtime.state.panX = payload.panX ?? runtime.state.panX;
  runtime.state.panY = payload.panY ?? runtime.state.panY;
  runtime.state.defaultShipType = payload.defaultShipType || runtime.state.defaultShipType;
  runtime.state.defaultTeam = (payload.defaultTeam || runtime.state.defaultTeam) as Team;
  runtime.state.defaultWeapon = payload.defaultWeapon || runtime.state.defaultWeapon;
  runtime.state.nextSlotId = payload.nextSlotId || runtime.state.nextSlotId;
  runtime.state.telemetryEnabled = normalizeTelemetryEnabled(
    payload.telemetryEnabled,
    runtime.state.telemetryEnabled
  );
  if (typeof payload.showRangeRings === "boolean") {
    runtime.state.showRangeRings = payload.showRangeRings;
  }
  if (typeof payload.showRangeLegend === "boolean") {
    runtime.state.showRangeLegend = payload.showRangeLegend;
  }
  runtime.state.ringVisibilityMode = sanitizeRingVisibilityMode(
    payload.ringVisibilityMode,
    runtime.state.ringVisibilityMode
  );
  runtime.state.relativeOptions = normalizeRelativeOptions(
    payload.relativeOptions,
    runtime.state.relativeOptions
  );

  const selected = runtime.getSelected();
  if (selected) runtime.state.selectedId = selected.id;
  if (warnings.length > 0) {
    console.warn("Import warnings:", warnings);
    runtime.log(`State imported with ${warnings.length} warnings (see console)`, "WARN", "SYS");
  } else {
    runtime.log("State imported from JSON", "INFO", "SYS");
  }

  const modal = document.getElementById("import-modal");
  if (modal) modal.style.display = "none";
  runtime.requestUiRefresh();
}

export function normalizeExportPayload(raw: unknown): ExportPayload {
  const rawRecord = (raw || {}) as Record<string, unknown>;
  const payload = (raw || {}) as Partial<ExportPayload>;
  return {
    schemaVersion: payload.schemaVersion ?? 1,
    entities: Array.isArray(payload.entities) ? payload.entities : [],
    config: payload.config || {},
    zoom: payload.zoom ?? 0.15,
    panX: payload.panX ?? 0,
    panY: payload.panY ?? 0,
    defaultShipType: payload.defaultShipType || "Heavy Frigate",
    defaultTeam: (payload.defaultTeam || "alpha") as Team,
    defaultWeapon: payload.defaultWeapon || "pulse_laser_mk1",
    nextSlotId: payload.nextSlotId || 1,
    telemetryEnabled: normalizeTelemetryEnabled(
      payload.telemetryEnabled,
      normalizeLegacyTelemetryMode(rawRecord.telemetryMode, false)
    ),
    showRangeRings: payload.showRangeRings ?? true,
    showRangeLegend: payload.showRangeLegend ?? true,
    ringVisibilityMode: sanitizeRingVisibilityMode(payload.ringVisibilityMode, "focused"),
    relativeOptions: normalizeRelativeOptions(payload.relativeOptions)
  };
}

function normalizeSlot(
  slot: WeaponSlot,
  runtime: AppRuntime,
  warnings: string[],
  entityId: number
): WeaponSlot {
  if (!runtime.isKnownWeapon(slot.weaponId)) {
    warnings.push(`Entity ${entityId}: Unknown weapon '${slot.weaponId}' - disabled`);
    return {
      weaponId: slot.weaponId,
      count: slot.count || 0,
      active: false,
      slotId: slot.slotId || runtime.nextSlotId(),
      _unknown: true
    };
  }

  return {
    weaponId: slot.weaponId,
    count: slot.count || 0,
    active: Boolean(slot.active),
    slotId: slot.slotId || runtime.nextSlotId()
  };
}

function normalizeTelemetryEnabled(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeLegacyTelemetryMode(value: unknown, fallback = false): boolean {
  if (typeof value !== "string") return fallback;
  if (value === "off") return false;
  if (value === "on" || value === "perf" || value === "full" || value === "relative-all") {
    return true;
  }
  return fallback;
}

function sanitizeRingVisibilityMode(
  mode: unknown,
  fallback: RingVisibilityMode = "focused"
): RingVisibilityMode {
  return typeof mode === "string" && RING_VISIBILITY_MODES.has(mode)
    ? (mode as RingVisibilityMode)
    : fallback;
}

function normalizeRelativeOptions(
  value: unknown,
  fallback: RelativeOptions = {
    mode: "selected",
    includeAllies: true,
    includeEnemies: true,
    maxTargets: 5
  }
): RelativeOptions {
  const source = (value || {}) as Partial<RelativeOptions>;
  return {
    mode: source.mode === "all" ? "all" : "selected",
    includeAllies:
      typeof source.includeAllies === "boolean" ? source.includeAllies : fallback.includeAllies,
    includeEnemies:
      typeof source.includeEnemies === "boolean"
        ? source.includeEnemies
        : fallback.includeEnemies,
    maxTargets: Number.isFinite(Number(source.maxTargets))
      ? Math.max(1, Math.min(50, Math.round(Number(source.maxTargets))))
      : fallback.maxTargets
  };
}
