import type { Entity } from "../core/domain/entity";
import type { IncomingLock, OutgoingLock } from "../core/domain/types";
import { getPrimaryWeapon } from "../core/domain/weapons";
import type { DomCache } from "./domCache";

export interface HudInput {
  dom: DomCache;
  selectedEntity: Entity | null;
  selected: Entity | null;
  entities: Entity[];
  outgoingLock: OutgoingLock;
  incomingLocks: IncomingLock[];
  threatLocked: boolean;
  dist: (a: Entity, b: Entity) => number;
}

export function renderHud(input: HudInput): void {
  const { dom, selectedEntity, selected } = input;

  if (selectedEntity) {
    dom.hudSelectedPos.innerText = `${(selectedEntity.x / 1000).toFixed(1)}km, ${(selectedEntity.y / 1000).toFixed(1)}km`;
  }

  dom.hudContacts.innerText = String(Math.max(0, input.entities.length - 1));

  const quality = Math.round(input.outgoingLock.quality * 100);
  dom.hudLockOutgoing.innerText = `${input.outgoingLock.status} (${quality}%)`;
  dom.hudLockOutgoing.style.color =
    input.outgoingLock.status === "LOCKED" ? "var(--warning)" : "var(--accent)";

  const incoming = input.incomingLocks.filter((lock) => lock.status !== "NONE");
  if (incoming.length > 0) {
    const locked = incoming.filter((lock) => lock.status === "LOCKED").length;
    const tracking = incoming.filter(
      (lock) => lock.status === "TRACKING" || lock.status === "ACQUIRING"
    ).length;
    dom.hudLockIncoming.innerText = `${locked} LOCKED, ${tracking} TRACKING`;
    dom.hudLockIncoming.style.color = locked > 0 ? "var(--danger)" : "var(--warning)";
  } else {
    dom.hudLockIncoming.innerText = "NONE";
    dom.hudLockIncoming.style.color = "var(--success)";
  }

  if (selectedEntity) {
    const weapon = getPrimaryWeapon(selectedEntity.weapons);
    dom.hudWeaponName.innerText = weapon ? weapon.name : "NONE";
  }

  if (selectedEntity) {
    const target = input.outgoingLock.targetId
      ? input.entities.find((entity) => entity.id === input.outgoingLock.targetId) || null
      : null;
    if (target && target.detected && selectedEntity.weaponsFiringBool()) {
      dom.hudHitProb.innerText = `${(target.hitProbability * 100).toFixed(1)}%`;
      dom.hudHitProb.style.color =
        target.hitProbability > 0.5 ? "var(--success)" : "var(--warning)";
    } else {
      dom.hudHitProb.innerText = "0%";
      dom.hudHitProb.style.color = "var(--text-dim)";
    }
  }

  dom.threatWarning.classList.toggle("visible", input.threatLocked);
  dom.threatWarning.setAttribute("aria-hidden", input.threatLocked ? "false" : "true");

  if (selected && selectedEntity) {
    dom.hudSelection.innerText = `Selected: ${selected.shipType} (${(input.dist(selected, selectedEntity) / 1000).toFixed(1)}km)`;
  } else {
    dom.hudSelection.innerText = "";
  }
}
