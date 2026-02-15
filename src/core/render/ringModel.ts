import { getFocusVisualState, getStaticRingSemantics, RING_SEMANTICS } from "./ringSemantics";
import type {
  RingColorToken,
  RingFocusLevel,
  RingSemanticType
} from "./ringSemantics";

export interface RingWeaponSlot {
  weaponId: string;
  count: number;
  active: boolean;
}

export interface RingEntitySnapshot {
  id: number;
  shipType: string;
  team: string;
  x: number;
  y: number;
  signature: number;
  radarActive: boolean;
  sensorMode: string;
  sensorPower: number;
  weapons: RingWeaponSlot[] | undefined;
}

export interface RelativeOptions {
  mode: "selected" | "all";
  includeAllies: boolean;
  includeEnemies: boolean;
  maxTargets: number;
}

export type RingVisibilityMode = "focused" | "threat-only" | "all";

export interface RingLegendRow {
  key: string;
  semanticType: RingSemanticType;
  label: string;
  meaning: string;
  colorToken: RingColorToken;
  lineDash: number[];
}

export interface VisibleRing {
  id: string;
  semanticType: RingSemanticType;
  colorToken: RingColorToken;
  ownerId: number;
  ownerX: number;
  ownerY: number;
  radiusM: number;
  focus: RingFocusLevel;
  lineWidth: number;
  opacity: number;
  lineDash: number[];
  label: string;
  diagnostics: string;
}

export interface RingModel {
  staticLegendRows: RingLegendRow[];
  dynamicLegendRows: RingLegendRow[];
  diagnostics: string[];
  rings: VisibleRing[];
  digest: string;
}

export interface RingModelInput {
  entities: RingEntitySnapshot[];
  selectedId: number | null;
  hoveredId: number | null;
  ringVisibilityMode?: RingVisibilityMode;
  relativeOptions: RelativeOptions;
  sensorStrength: number;
  detectThreshold: number;
  bakedWeapons: Record<string, { name: string; maxRangeM: number } | undefined>;
  dist: (a: RingEntitySnapshot, b: RingEntitySnapshot) => number;
  computeDetectionRange: (
    signature: number,
    sensorPower: number,
    detectThreshold: number
  ) => number;
}

function describeEntity(entity: RingEntitySnapshot): string {
  return `ID:${entity.id}`;
}

interface RingSource {
  source: RingEntitySnapshot;
  focus: RingFocusLevel;
}

function findEntityById(
  entities: RingEntitySnapshot[],
  id: number | null
): RingEntitySnapshot | null {
  if (typeof id !== "number") return null;
  return entities.find((entity) => entity.id === id) || null;
}

function resolveRingSources(
  input: RingModelInput,
  focusById: Map<number, "selected" | "hovered">
): RingSource[] {
  const mode = input.ringVisibilityMode || "focused";
  if (mode === "all") {
    return input.entities.map((source) => ({
      source,
      focus: focusById.get(source.id) || "ambient"
    }));
  }

  if (mode === "threat-only") {
    const selected = findEntityById(input.entities, input.selectedId);
    if (!selected) return [];
    return input.entities
      .filter((source) => source.id !== selected.id && source.team !== selected.team)
      .map((source) => ({
        source,
        focus: focusById.get(source.id) || "ambient"
      }));
  }

  return input.entities
    .filter((source) => focusById.has(source.id))
    .map((source) => ({
      source,
      focus: focusById.get(source.id) || "hovered"
    }));
}

export function buildRingModel(input: RingModelInput): RingModel {
  const focusById = new Map<number, "selected" | "hovered">();
  if (typeof input.selectedId === "number") {
    focusById.set(input.selectedId, "selected");
  }
  if (typeof input.hoveredId === "number" && input.hoveredId !== input.selectedId) {
    focusById.set(input.hoveredId, "hovered");
  }

  const rings: VisibleRing[] = [];
  const selectedEntity = findEntityById(input.entities, input.selectedId);
  const visibilityMode = input.ringVisibilityMode || "focused";

  resolveRingSources(input, focusById).forEach(({ source, focus }) => {
    const focusStyle = getFocusVisualState(focus);
    const sourceLabel = describeEntity(source);
    const sourceSensorPower = input.sensorStrength * (source.sensorPower || 1);

    if (visibilityMode === "threat-only" && selectedEntity) {
      const selectedThreatRange = input.computeDetectionRange(
        selectedEntity.signature,
        sourceSensorPower,
        input.detectThreshold
      );
      if (!Number.isFinite(selectedThreatRange) || selectedThreatRange <= 0) return;
    }

    const activeWeapons = new Map<
      string,
      { name: string; maxRangeM: number; totalCount: number }
    >();
    (source.weapons || []).forEach((slot) => {
      if (!slot.active || slot.count <= 0) return;
      const weapon = input.bakedWeapons[slot.weaponId];
      if (!weapon) return;
      if (!activeWeapons.has(slot.weaponId)) {
        activeWeapons.set(slot.weaponId, {
          name: weapon.name,
          maxRangeM: weapon.maxRangeM,
          totalCount: 0
        });
      }
      activeWeapons.get(slot.weaponId)!.totalCount += slot.count;
    });

    activeWeapons.forEach((weapon, weaponId) => {
      const id = `weapon:${source.id}:${weaponId}`;
      const label = `${sourceLabel} | WPN:${weaponId} x${weapon.totalCount}`;
      rings.push({
        id,
        semanticType: "weaponEffectiveRange",
        colorToken: RING_SEMANTICS.weaponEffectiveRange.colorToken,
        ownerId: source.id,
        ownerX: source.x,
        ownerY: source.y,
        radiusM: weapon.maxRangeM,
        focus,
        lineWidth: focusStyle.lineWidth,
        opacity: focusStyle.opacity,
        lineDash: RING_SEMANTICS.weaponEffectiveRange.lineDash,
        label,
        diagnostics: `[${id}] visible: ${sourceLabel} is ${focus} with active ${weaponId} x${weapon.totalCount}.`
      });
    });

    const targets =
      visibilityMode === "threat-only" && selectedEntity
        ? [selectedEntity]
        : input.entities
            .filter((target) => target.id !== source.id)
            .filter((target) =>
              input.relativeOptions.includeAllies ? true : target.team !== source.team
            )
            .filter((target) =>
              input.relativeOptions.includeEnemies ? true : target.team === source.team
            )
            .filter((target) =>
              input.relativeOptions.mode === "selected" && input.selectedId !== null
                ? target.id === input.selectedId
                : true
            )
            .sort((a, b) => input.dist(source, a) - input.dist(source, b))
            .slice(0, input.relativeOptions.maxTargets || 5);

    targets.forEach((target) => {
      const radiusM = input.computeDetectionRange(
        target.signature,
        sourceSensorPower,
        input.detectThreshold
      );
      if (!Number.isFinite(radiusM) || radiusM <= 0) return;
      const targetPassive = !target.radarActive || target.sensorMode === "Passive";
      const semanticType: RingSemanticType = targetPassive
        ? "relativeDetectionPassive"
        : "relativeDetectionActive";
      const semantics = RING_SEMANTICS[semanticType];
      const targetLabel = describeEntity(target);
      rings.push({
        id: `detect:${source.id}:${target.id}:${semanticType}`,
        semanticType,
        colorToken: semantics.colorToken,
        ownerId: source.id,
        ownerX: source.x,
        ownerY: source.y,
        radiusM,
        focus,
        lineWidth: focusStyle.lineWidth,
        opacity: focusStyle.opacity,
        lineDash: semantics.lineDash,
        label: `${describeEntity(source)} -> ${targetLabel}`,
        diagnostics: `[detect:${source.id}:${target.id}:${semanticType}] visible: Relative-All enabled and ${targetLabel} is ${
          targetPassive ? "passive" : "active"
        }; source ${describeEntity(source)} range ${(radiusM / 1000).toFixed(2)} km.`
      });
    });
  });

  const staticLegendRows: RingLegendRow[] = getStaticRingSemantics().map((definition) => ({
    key: `static:${definition.type}`,
    semanticType: definition.type,
    label: definition.label,
    meaning: definition.visibleWhen,
    colorToken: definition.colorToken,
    lineDash: definition.lineDash
  }));

  const dynamicLegendRows: RingLegendRow[] = rings
    .slice()
    .sort((a, b) => {
      const priorityDelta =
        RING_SEMANTICS[a.semanticType].priority - RING_SEMANTICS[b.semanticType].priority;
      if (priorityDelta !== 0) return priorityDelta;
      return a.id.localeCompare(b.id);
    })
    .map((ring) => ({
      key: ring.id,
      semanticType: ring.semanticType,
      label: ring.label,
      meaning: `${(ring.radiusM / 1000).toFixed(2)} km`,
      colorToken: ring.colorToken,
      lineDash: ring.lineDash
    }));

  const diagnostics = rings.map((ring) => ring.diagnostics).slice(0, 8);
  if (rings.length === 0) {
    diagnostics.push(
      `No rings visible for layer mode '${visibilityMode}': select/hover entities or enable active weapons.`
    );
  }

  const digest = rings
    .map((ring) => `${ring.id}:${Math.round(ring.radiusM)}:${ring.focus}`)
    .join("|");

  return {
    staticLegendRows,
    dynamicLegendRows,
    diagnostics,
    rings,
    digest
  };
}
