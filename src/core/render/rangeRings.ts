import type { Entity } from "../domain/entity";
import { getConfig } from "../domain/config";
import { BAKED_WEAPONS } from "../domain/weapons";
import { buildRingModel } from "./ringModel";
import { resolveRingPalette } from "./ringSemantics";
import { computeDetectionRange } from "../math/sensorMath";
import type { RingVisibilityMode } from "./ringModel";

export interface RangeRingsOptions {
  showLegend: boolean;
  ringVisibilityMode: RingVisibilityMode;
  selectedId: number | null;
  hoveredId: number | null;
  relativeOptions: {
    mode: "selected" | "all";
    includeAllies: boolean;
    includeEnemies: boolean;
    maxTargets: number;
  };
}

export interface RenderFrameContext {
  ctx: CanvasRenderingContext2D;
  entities: Entity[];
  viewLeft: number;
  viewTop: number;
  viewRight: number;
  viewBottom: number;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  worldToScreenRadius: (meters: number) => number;
  options: RangeRingsOptions;
  dist: (a: Entity, b: Entity) => number;
  setLegendRows: (rows: Array<{ color: string; label: string }>) => void;
}

export function drawRangeRings(frame: RenderFrameContext): void {
  const withinView = (x: number, y: number, radius: number): boolean => {
    const left = x - radius;
    const right = x + radius;
    const top = y - radius;
    const bottom = y + radius;
    return !(
      right < frame.viewLeft ||
      left > frame.viewRight ||
      bottom < frame.viewTop ||
      top > frame.viewBottom
    );
  };

  const model = buildRingModel({
    entities: frame.entities,
    selectedId: frame.options.selectedId,
    hoveredId: frame.options.hoveredId,
    ringVisibilityMode: frame.options.ringVisibilityMode,
    relativeOptions: frame.options.relativeOptions,
    sensorStrength: getConfig("SENSOR_STRENGTH"),
    detectThreshold: getConfig("DETECT_THRESH"),
    bakedWeapons: BAKED_WEAPONS,
    dist: (a, b) => frame.dist(a as Entity, b as Entity),
    computeDetectionRange
  });

  const palette = resolveRingPalette();
  model.rings.forEach((ring) => {
    if (!withinView(ring.ownerX, ring.ownerY, ring.radiusM)) return;
    const screenRadius = frame.worldToScreenRadius(ring.radiusM);
    if (screenRadius < 1) return;
    const center = frame.worldToScreen(ring.ownerX, ring.ownerY);

    frame.ctx.save();
    frame.ctx.strokeStyle = palette[ring.colorToken];
    frame.ctx.globalAlpha = ring.opacity;
    frame.ctx.lineWidth = ring.lineWidth;
    frame.ctx.setLineDash(ring.lineDash);
    frame.ctx.beginPath();
    frame.ctx.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
    frame.ctx.stroke();
    frame.ctx.restore();
  });

  if (!frame.options.showLegend) return;
  const legendRows = model.dynamicLegendRows.map((row) => ({
    color: palette[row.colorToken],
    label: `${row.label} (${row.meaning})`
  }));
  frame.setLegendRows(legendRows);
}
