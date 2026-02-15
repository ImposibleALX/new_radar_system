import {
  attachSafeNumberInput,
  coerceNumberValue,
  formatNumber,
  resolveNumberAttribute,
  type NumberConstraints
} from "./numberSafety";

export function bindDualInput(
  rangeEl: HTMLInputElement,
  numberEl: HTMLInputElement,
  onChange?: (n: number) => void
): void {
  const min = resolveNumberAttribute(numberEl, "min") ?? resolveNumberAttribute(rangeEl, "min");
  const max = resolveNumberAttribute(numberEl, "max") ?? resolveNumberAttribute(rangeEl, "max");
  const step =
    resolveNumberAttribute(numberEl, "step") ??
    resolveNumberAttribute(rangeEl, "step") ??
    undefined;

  const fallback =
    Number.parseFloat(numberEl.value) ||
    Number.parseFloat(rangeEl.value) ||
    (Number.isFinite(min) ? (min as number) : 0);

  const constraints: NumberConstraints = {
    min,
    max,
    step,
    fallback
  };

  let isSyncing = false;

  const sync = (raw: string): void => {
    if (isSyncing) return;
    const result = coerceNumberValue(raw, constraints);
    isSyncing = true;
    rangeEl.value = formatNumber(result.value, step);
    numberEl.value = formatNumber(result.value, step);
    isSyncing = false;
    onChange?.(result.value);
  };

  rangeEl.addEventListener("input", (event) => sync((event.target as HTMLInputElement).value));
  rangeEl.addEventListener("change", (event) => sync((event.target as HTMLInputElement).value));

  attachSafeNumberInput(numberEl, constraints, (value) => sync(String(value)));
  sync(numberEl.value || rangeEl.value || String(fallback));
}

export function toggleClass(element: Element | null, className: string, enabled: boolean): void {
  if (!element) return;
  element.classList.toggle(className, enabled);
}
