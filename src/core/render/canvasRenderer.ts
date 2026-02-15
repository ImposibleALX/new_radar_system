import type { Entity } from "../domain/entity";
import { drawRangeRings } from "./rangeRings";
import { computeShipRenderSizePx } from "./shipSize";
import type { RingVisibilityMode } from "./ringModel";

const GRID_CELL_SIZE_M = 1000;

export interface RendererState {
  entities: Entity[];
  selectedId: number | null;
  hoveredId: number | null;
  outgoingLock: { status: string; targetId: number | null; quality: number };
  showRangeRings: boolean;
  telemetryEnabled: boolean;
  ringVisibilityMode: RingVisibilityMode;
  relativeOptions: {
    mode: "selected" | "all";
    includeAllies: boolean;
    includeEnemies: boolean;
    maxTargets: number;
  };
  panX: number;
  panY: number;
  zoom: number;
}

export interface RendererContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: RendererState;
  teamColorOf: (team: string) => {
    fill: string;
    stroke: string;
    detectionActive: string;
    detectionPassive: string;
    weapon: string;
  };
  getSelected: () => Entity | null;
  dist: (a: Entity, b: Entity) => number;
  buildDebugLabel: (entity: Entity) => string;
  setLegendRows: (rows: Array<{ color: string; label: string }>) => void;
}

export class CanvasRenderer {
  private readonly debugLabels: Array<{ x: number; y: number; text: string }> = [];
  private canvasW = 0;
  private canvasH = 0;

  resize(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): { width: number; height: number } {
    const parent = canvas.parentElement as HTMLElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    this.canvasW = parent.clientWidth;
    this.canvasH = parent.clientHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { width: this.canvasW, height: this.canvasH };
  }

  render(input: RendererContext): void {
    const { ctx, state } = input;
    const selected = input.getSelected();
    const cameraTarget = selected || null;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    const cx = this.canvasW / 2;
    const cy = this.canvasH / 2;
    const cameraOffsetX = cameraTarget ? -cameraTarget.x : 0;
    const cameraOffsetY = cameraTarget ? -cameraTarget.y : 0;

    ctx.save();
    ctx.translate(cx + state.panX, cy + state.panY);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(cameraOffsetX, cameraOffsetY);
    ctx.lineWidth = 1 / state.zoom;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";

    const viewLeft = -(cx + state.panX) / state.zoom - cameraOffsetX;
    const viewTop = -(cy + state.panY) / state.zoom - cameraOffsetY;
    const viewRight = (this.canvasW - (cx + state.panX)) / state.zoom - cameraOffsetX;
    const viewBottom = (this.canvasH - (cy + state.panY)) / state.zoom - cameraOffsetY;

    const worldToScreen = (x: number, y: number): { x: number; y: number } => ({
      x: (x + cameraOffsetX) * state.zoom + cx + state.panX,
      y: (y + cameraOffsetY) * state.zoom + cy + state.panY
    });

    const worldToScreenRadius = (meters: number): number => meters * state.zoom;

    const startX = Math.floor(viewLeft / GRID_CELL_SIZE_M) * GRID_CELL_SIZE_M;
    const startY = Math.floor(viewTop / GRID_CELL_SIZE_M) * GRID_CELL_SIZE_M;

    ctx.beginPath();
    for (let x = startX; x <= viewRight; x += GRID_CELL_SIZE_M) {
      ctx.moveTo(x, viewTop);
      ctx.lineTo(x, viewBottom);
    }
    for (let y = startY; y <= viewBottom; y += GRID_CELL_SIZE_M) {
      ctx.moveTo(viewLeft, y);
      ctx.lineTo(viewRight, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
    ctx.font = `${Math.max(8, Math.floor(11 / state.zoom))}px monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    const xLabelY = viewTop + 6 / state.zoom;
    for (let x = startX; x <= viewRight; x += GRID_CELL_SIZE_M) {
      ctx.fillText(`${Math.round(x / 1000)} km`, x, xLabelY);
    }
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const yLabelX = viewLeft + 8 / state.zoom;
    for (let y = startY; y <= viewBottom; y += GRID_CELL_SIZE_M) {
      ctx.fillText(`${Math.round(y / 1000)} km`, yLabelX, y);
    }
    ctx.restore();

    if (state.showRangeRings) {
      drawRangeRings({
        ctx,
        entities: state.entities,
        viewLeft,
        viewTop,
        viewRight,
        viewBottom,
        worldToScreen,
        worldToScreenRadius,
        options: {
          showLegend: true,
          ringVisibilityMode: state.ringVisibilityMode,
          selectedId: state.selectedId,
          hoveredId: state.hoveredId,
          relativeOptions: state.relativeOptions
        },
        dist: input.dist,
        setLegendRows: input.setLegendRows
      });
    }

    if (state.outgoingLock.status !== "NONE" && state.outgoingLock.targetId && selected) {
      const target =
        state.entities.find((entity) => entity.id === state.outgoingLock.targetId) || null;
      if (target) {
        ctx.strokeStyle =
          state.outgoingLock.status === "LOCKED" ? "#d29922" : "rgba(210, 153, 34, 0.5)";
        ctx.lineWidth = 2 / state.zoom;
        ctx.setLineDash([10 / state.zoom, 10 / state.zoom]);
        ctx.beginPath();
        ctx.moveTo(selected.x, selected.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();

    state.entities.forEach((entity) => {
      const screen = worldToScreen(entity.x, entity.y);
      const isSelected = entity.id === state.selectedId;
      const teamColor = input.teamColorOf(entity.team);
      const size = computeShipRenderSizePx(entity.getShipSizeMeters(), state.zoom);

      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(entity.heading);
      const fill = teamColor.fill.replace(/0\.35\)/, `${entity.detected ? 0.6 : 0.3})`);
      ctx.fillStyle = fill;
      ctx.strokeStyle = teamColor.stroke;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.6, size * 0.5);
      ctx.lineTo(-size * 0.4, 0);
      ctx.lineTo(-size * 0.6, -size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (state.telemetryEnabled && entity.detected) {
        this.debugLabels.push({
          x: screen.x,
          y: screen.y - (size + 15),
          text: input.buildDebugLabel(entity)
        });
      }
    });

    this.renderDebugLabels(ctx);
  }

  private renderDebugLabels(ctx: CanvasRenderingContext2D): void {
    if (this.debugLabels.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 3;
    this.debugLabels.forEach((label) => {
      ctx.strokeText(label.text, label.x, label.y);
      ctx.fillText(label.text, label.x, label.y);
    });
    this.debugLabels.length = 0;
    ctx.restore();
  }
}
