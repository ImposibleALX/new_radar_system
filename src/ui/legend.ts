import type { RingColorToken } from "../core/render/ringSemantics";

export interface LegendRow {
  key: string;
  label: string;
  meaning: string;
  colorToken: RingColorToken;
  color: string;
  lineDash: number[];
}

function renderLegendRow(container: HTMLElement, row: LegendRow): void {
  const item = document.createElement("div");
  item.className = "legend-item";
  item.dataset.legendKey = row.key;
  item.dataset.colorToken = row.colorToken;
  item.id = `legend-row-${row.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const color = document.createElement("div");
  color.className = "legend-color";
  color.style.background = row.color;
  if (row.lineDash.length > 0) color.classList.add("legend-color-dashed");

  const textWrap = document.createElement("div");
  textWrap.className = "legend-text";

  const label = document.createElement("span");
  label.className = "legend-label";
  label.textContent = row.label;

  const meaning = document.createElement("span");
  meaning.className = "legend-meaning";
  meaning.textContent = row.meaning;

  textWrap.appendChild(label);
  textWrap.appendChild(meaning);
  item.appendChild(color);
  item.appendChild(textWrap);
  container.appendChild(item);
}

export function renderLegendRows(container: HTMLElement, rows: LegendRow[]): void {
  container.innerHTML = "";
  rows.forEach((row) => renderLegendRow(container, row));
}

export function renderLegendDiagnostics(container: HTMLElement, messages: string[]): void {
  container.innerHTML = "";
  messages.forEach((message, index) => {
    const row = document.createElement("div");
    row.className = "legend-diagnostic";
    row.dataset.diagIndex = String(index);
    const idMatch = message.match(/^\[([^\]]+)\]/);
    if (idMatch) {
      row.dataset.diagId = idMatch[1];
      row.id = `legend-diag-${idMatch[1].replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    }
    row.textContent = message;
    container.appendChild(row);
  });
}
