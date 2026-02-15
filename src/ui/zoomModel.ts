import { coerceNumberValue, formatNumber } from "./numberSafety";

export const ZOOM_MIN = 0.01;
export const ZOOM_MAX = 5;
const WHEEL_SENSITIVITY = 0.162;
const ZOOM_NUMBER_STEP = 0.001;
const WHEEL_DELTA_UNIT = 120;
const MAX_WHEEL_UNITS = 2.5;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function zoomToNormalized(zoom: number): number {
  const clamped = clampZoom(zoom);
  const span = Math.log(ZOOM_MAX / ZOOM_MIN);
  return Math.log(clamped / ZOOM_MIN) / span;
}

export function normalizedToZoom(normalized: number): number {
  const n = Math.min(1, Math.max(0, normalized));
  const span = Math.log(ZOOM_MAX / ZOOM_MIN);
  return clampZoom(ZOOM_MIN * Math.exp(span * n));
}

export function configureZoomControls(
  slider: HTMLInputElement,
  numberInput: HTMLInputElement
): void {
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.001";
  numberInput.min = formatNumber(ZOOM_MIN, 0.01);
  numberInput.max = formatNumber(ZOOM_MAX, 0.01);
  numberInput.step = String(ZOOM_NUMBER_STEP);
}

function formatZoomDisplay(value: number): string {
  const normalized = formatNumber(value, ZOOM_NUMBER_STEP).replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
  if (!normalized.includes(".")) return `${normalized}.00`;
  const decimals = normalized.split(".")[1].length;
  if (decimals >= 2) return normalized;
  return `${normalized}${"0".repeat(2 - decimals)}`;
}

export function syncZoomControls(
  slider: HTMLInputElement,
  numberInput: HTMLInputElement,
  zoom: number
): void {
  const clamped = clampZoom(zoom);
  slider.value = formatNumber(zoomToNormalized(clamped), 0.001);
  numberInput.value = formatZoomDisplay(clamped);
}

export function parseZoomFromSlider(raw: string, fallbackZoom: number): number {
  const coerced = coerceNumberValue(raw, {
    min: 0,
    max: 1,
    step: 0.001,
    fallback: zoomToNormalized(fallbackZoom)
  });
  return normalizedToZoom(coerced.value);
}

export function parseZoomFromNumber(raw: string, fallbackZoom: number): number {
  const coerced = coerceNumberValue(raw, {
    min: ZOOM_MIN,
    max: ZOOM_MAX,
    step: ZOOM_NUMBER_STEP,
    fallback: fallbackZoom
  });
  return clampZoom(coerced.value);
}

export function applyWheelZoom(currentZoom: number, deltaY: number): number {
  const normalizedUnits = Math.max(
    -MAX_WHEEL_UNITS,
    Math.min(MAX_WHEEL_UNITS, deltaY / WHEEL_DELTA_UNIT)
  );
  const factor = Math.exp(-normalizedUnits * WHEEL_SENSITIVITY);
  return clampZoom(currentZoom * factor);
}
