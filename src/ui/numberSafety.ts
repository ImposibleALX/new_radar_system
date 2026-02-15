export interface NumberConstraints {
  min?: number;
  max?: number;
  step?: number;
  fallback: number;
}

export interface NumberCoerceResult {
  value: number;
  changed: boolean;
  valid: boolean;
}

export interface SafeNumberInputOptions {
  emitInitial?: boolean;
}

function precisionFromStep(step?: number): number {
  if (!Number.isFinite(step) || !step || step <= 0) return 6;
  const asText = step.toString();
  if (!asText.includes(".")) return 0;
  return Math.min(6, asText.split(".")[1].length);
}

function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function normalizeLocaleNumber(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/,/g, ".").trim();
}

export function parseFiniteNumberStrict(raw: string): number | null {
  const normalized = normalizeLocaleNumber(raw);
  if (!normalized) return null;
  if (!/^-?\d*(?:\.\d*)?$/.test(normalized)) return null;
  if (normalized === "-" || normalized === "." || normalized === "-.") return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clampNumber(value: number, min?: number, max?: number): number {
  let next = value;
  if (Number.isFinite(min)) next = Math.max(min as number, next);
  if (Number.isFinite(max)) next = Math.min(max as number, next);
  return next;
}

export function snapToStep(value: number, step?: number, base = 0): number {
  if (!Number.isFinite(step) || !step || step <= 0) return value;
  const normalized = (value - base) / step;
  return base + Math.round(normalized) * step;
}

export function coerceNumberValue(raw: string, constraints: NumberConstraints): NumberCoerceResult {
  const parsed = parseFiniteNumberStrict(raw);
  const precision = precisionFromStep(constraints.step);

  if (parsed === null) {
    const fallback = clampNumber(constraints.fallback, constraints.min, constraints.max);
    const snappedFallback = snapToStep(fallback, constraints.step, constraints.min ?? 0);
    return {
      value: roundToPrecision(snappedFallback, precision),
      changed: true,
      valid: false
    };
  }

  const clamped = clampNumber(parsed, constraints.min, constraints.max);
  const snapped = snapToStep(clamped, constraints.step, constraints.min ?? 0);
  const rounded = roundToPrecision(snapped, precision);
  return {
    value: rounded,
    changed: Math.abs(rounded - parsed) > Number.EPSILON,
    valid: true
  };
}

export function formatNumber(value: number, step?: number): string {
  const precision = precisionFromStep(step);
  return roundToPrecision(value, precision).toFixed(precision);
}

export function resolveNumberAttribute(
  input: HTMLInputElement,
  name: "min" | "max" | "step"
): number | undefined {
  const raw = input.getAttribute(name);
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function attachSafeNumberInput(
  input: HTMLInputElement,
  constraints: NumberConstraints,
  onChange: (value: number) => void,
  options: SafeNumberInputOptions = {}
): () => void {
  let lastValue = constraints.fallback;
  let isCommitting = false;

  const commit = (raw: string, emit = true): void => {
    if (isCommitting) return;
    isCommitting = true;
    try {
      const result = coerceNumberValue(raw, { ...constraints, fallback: lastValue });
      const changedSinceLast = Math.abs(result.value - lastValue) > Number.EPSILON;
      lastValue = result.value;
      input.value = formatNumber(result.value, constraints.step);
      if (emit && changedSinceLast) onChange(result.value);
    } finally {
      isCommitting = false;
    }
  };

  const onInput = (): void => commit(input.value);
  const onBlur = (): void => commit(input.value);
  const onPaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") || "";
    commit(pasted);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "e" || event.key === "E" || event.key === "+") {
      event.preventDefault();
    }
  };
  const onWheel = (event: WheelEvent): void => {
    if (document.activeElement !== input) return;
    event.preventDefault();
    const step = constraints.step && constraints.step > 0 ? constraints.step : 1;
    const delta = event.deltaY > 0 ? -step : step;
    commit(String(lastValue + delta));
  };

  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);
  input.addEventListener("paste", onPaste);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("wheel", onWheel, { passive: false });

  commit(input.value, options.emitInitial === true);

  return () => {
    input.removeEventListener("input", onInput);
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("paste", onPaste);
    input.removeEventListener("keydown", onKeyDown);
    input.removeEventListener("wheel", onWheel);
  };
}
