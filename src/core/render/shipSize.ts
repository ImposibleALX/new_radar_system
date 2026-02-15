export const SHIP_SIZE_M_MIN = 250;
export const SHIP_SIZE_M_MAX = 4000;
export const SHIP_SIZE_M_DEFAULT = 1000;

const LEGACY_SIZE_TOKEN_TO_METERS: Record<string, number> = {
  xs: 250,
  s: 500,
  m: 1000,
  l: 2000,
  xl: 4000,
  frigate: 750,
  cruiser: 1500,
  capital: 3500
};

function hash32(value: number): number {
  let x = value | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function stableScaleFromId(id: number): number {
  const normalized = (hash32(id) % 1000) / 1000;
  return 0.9 + normalized * 0.2;
}

export function clampShipSizeMeters(sizeM: number, fallback = SHIP_SIZE_M_DEFAULT): number {
  const fallbackClamped = Math.max(SHIP_SIZE_M_MIN, Math.min(SHIP_SIZE_M_MAX, fallback));
  const numeric = Number(sizeM);
  if (!Number.isFinite(numeric)) return fallbackClamped;
  return Math.max(SHIP_SIZE_M_MIN, Math.min(SHIP_SIZE_M_MAX, numeric));
}

export function sizeTokenToMeters(token: string | undefined, fallback = SHIP_SIZE_M_DEFAULT): number {
  if (!token) return clampShipSizeMeters(fallback, fallback);
  const normalized = String(token).trim().toLowerCase();
  const mapped = LEGACY_SIZE_TOKEN_TO_METERS[normalized];
  if (mapped !== undefined) return clampShipSizeMeters(mapped, fallback);
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return clampShipSizeMeters(numeric, fallback);
  return clampShipSizeMeters(fallback, fallback);
}

export function resolveShipSizeMeters(
  sizeM?: number,
  legacyToken?: string,
  fallback = SHIP_SIZE_M_DEFAULT
): number {
  const numeric = Number(sizeM);
  if (Number.isFinite(numeric)) return clampShipSizeMeters(numeric, fallback);
  return sizeTokenToMeters(legacyToken, fallback);
}

export function advanceShipSizeMeters(
  currentSizeM: number,
  growthPerSecond: number,
  dt: number
): number {
  const safeSize = clampShipSizeMeters(currentSizeM);
  const safeGrowth = Number.isFinite(growthPerSecond) ? growthPerSecond : 0;
  if (!safeGrowth) return safeSize;
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
  return clampShipSizeMeters(safeSize + safeGrowth * safeDt, safeSize);
}

export function legacyShipScaleToMeters(
  shipScale: number | undefined,
  legacySizeToken?: string
): number {
  const baseMeters = sizeTokenToMeters(legacySizeToken, SHIP_SIZE_M_DEFAULT);
  const numericScale = Number(shipScale);
  if (!Number.isFinite(numericScale) || numericScale <= 0) return baseMeters;
  const clampedScale = Math.max(0.25, Math.min(6, numericScale));
  return clampShipSizeMeters(baseMeters * clampedScale, baseMeters);
}

export function computeShipRenderSizePx(shipSizeM: number, zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 0;
  return clampShipSizeMeters(shipSizeM) * safeZoom;
}

export function normalizeShipScale(id: number, shipScale?: number): number {
  const numeric = Number(shipScale);
  if (!Number.isFinite(numeric) || numeric <= 0) return stableScaleFromId(id);
  return Math.max(0.25, Math.min(6, numeric));
}

export function advanceShipScale(
  currentScale: number,
  growthPerSecond: number,
  dt: number
): number {
  const safeScale = normalizeShipScale(1, currentScale);
  const safeGrowth = Number.isFinite(growthPerSecond) ? growthPerSecond : 0;
  if (!safeGrowth) return safeScale;
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
  return Math.max(0.25, Math.min(6, safeScale + safeGrowth * safeDt));
}
