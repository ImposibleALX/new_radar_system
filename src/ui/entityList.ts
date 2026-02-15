import type { Team } from "../core/domain/types";

export interface EntityListItem {
  id: number;
  shipType: string;
  team: Team;
  distanceKm: string;
  selected: boolean;
}

export interface EntityListActions {
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

export function createEntityListPatcher(
  container: HTMLElement,
  actions: EntityListActions
): {
  patch: (items: EntityListItem[]) => void;
  clear: () => void;
} {
  const rows = new Map<number, HTMLDivElement>();

  const createRow = (item: EntityListItem): HTMLDivElement => {
    const div = document.createElement("div");
    div.className = "entity-item";
    div.id = `ent-${item.id}`;
    div.dataset.entityId = String(item.id);

    const infoSpan = document.createElement("span");
    infoSpan.style.flex = "1";
    infoSpan.style.cursor = "pointer";
    infoSpan.addEventListener("click", () => actions.onSelect(item.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";
    deleteBtn.className = "danger delete-btn";
    deleteBtn.title = "Delete entity";
    deleteBtn.setAttribute("aria-label", "Delete entity");
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.onDelete(item.id);
    });

    div.appendChild(infoSpan);
    div.appendChild(deleteBtn);
    return div;
  };

  const updateRow = (row: HTMLDivElement, item: EntityListItem): void => {
    row.classList.toggle("active-entity", item.selected);
    const infoSpan = row.firstElementChild as HTMLSpanElement;
    const tagCls = item.team === "alpha" ? "tag-allie" : "tag-enemy";
    const tagTxt = item.team === "alpha" ? "ALPHA" : "BETA";
    infoSpan.innerHTML = `<span class="tag ${tagCls}">${tagTxt}</span> <span>ID:${item.id}</span> <span>${item.shipType.substring(0, 12)}</span> <span>${item.distanceKm}km</span>`;
  };

  const patch = (items: EntityListItem[]): void => {
    const seen = new Set<number>();
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      seen.add(item.id);
      let row = rows.get(item.id);
      if (!row) {
        row = createRow(item);
        rows.set(item.id, row);
      }
      updateRow(row, item);
      if (!row.isConnected) fragment.appendChild(row);
    });

    if (fragment.childNodes.length > 0) container.appendChild(fragment);

    Array.from(rows.keys()).forEach((id) => {
      if (seen.has(id)) return;
      rows.get(id)?.remove();
      rows.delete(id);
    });
  };

  const clear = (): void => {
    rows.clear();
    container.innerHTML = "";
  };

  return { patch, clear };
}
