import type { Entity } from "../core/domain/entity";
import type { Team } from "../core/domain/types";
import { BAKED_WEAPONS, getPrimaryWeapon } from "../core/domain/weapons";
import { getShipProfile } from "../core/math/sensorMath";
import type { DomCache } from "./domCache";

export interface EntityPanelActions {
  onDeleteSlot: (entityId: number, slotIndex: number) => void;
  onUpdateSlot: (
    entityId: number,
    slotIndex: number,
    updates: { weaponId?: string; count?: number; active?: boolean }
  ) => void;
}

export function renderEntityPanel(dom: DomCache, entity: Entity | null): void {
  if (!entity) {
    dom.entityControlPanel.style.display = "none";
    return;
  }

  dom.entityControlPanel.style.display = "block";
  const teamLabel = (entity.team || "TEAM").toUpperCase();
  dom.entityControlId.innerText = `ID: ${entity.id} [${teamLabel}]`;
  dom.entityShipType.value = entity.shipType;
  dom.entityTeam.value = entity.team;
  dom.entityVel.value = String(Math.round(entity.speed));
  dom.entityVelNum.value = String(Math.round(entity.speed));
  dom.entityHead.value = String(Math.round((entity.heading * 180) / Math.PI));
  dom.entityHeadNum.value = String(Math.round((entity.heading * 180) / Math.PI));
  dom.entitySensorPower.value = entity.sensorPower.toFixed(1);
  dom.entitySensorPowerNum.value = entity.sensorPower.toFixed(1);
  dom.entityEcm.value = entity.ecm.toFixed(1);
  dom.entityEcmNum.value = entity.ecm.toFixed(1);
  dom.entityProfileDesc.textContent = getShipProfile(entity.shipType).description;
}

export function renderEntityInfo(dom: DomCache, entity: Entity | null): void {
  if (!entity) return;
  dom.infoSig.textContent = entity.signature.toFixed(1);
  dom.infoActivity.textContent = `${(entity.activityLevel * 100).toFixed(0)}%`;
  dom.infoWeaponActivity.textContent = `${(entity.weaponActivityLevel * 100).toFixed(0)}%`;
  dom.infoDetection.textContent = `${Math.round(entity.detectionScore)}`;
}

export function renderWeaponInfo(
  dom: DomCache,
  entity: Entity | null,
  target: Entity | null
): void {
  if (!entity) return;
  const weapon = getPrimaryWeapon(entity.weapons);
  if (!weapon) {
    dom.weaponInfoPanel.classList.add("is-hidden");
    return;
  }

  dom.weaponInfoPanel.classList.remove("is-hidden");
  dom.weaponNameDisplay.textContent = weapon.name;
  dom.weaponAccuracyDisplay.textContent = `${(weapon.baseAccuracy * 100).toFixed(0)}%`;
  dom.weaponRangeDisplay.textContent = `${(weapon.maxRangeM / 1000).toFixed(1)} km`;
  dom.weaponActivityWeightDisplay.textContent = String(weapon.baseActivityWeight);
  dom.weaponTrackingDisplay.textContent = `${weapon.originalConfig.trackingSpeed.toFixed(3)} rad/s`;
  dom.weaponGuidanceDisplay.textContent = weapon.guidance.toUpperCase();
  dom.weaponSensitivityDisplay.textContent = `${weapon.originalConfig.trackingSensitivity.toFixed(1)}`;

  if (target && target.detected && entity.weaponsFiringBool()) {
    dom.weaponDistFactor.textContent = `${(target._weaponDistFactor * 100).toFixed(1)}%`;
    dom.weaponTrackFactor.textContent = `${(target._weaponTrackFactor * 100).toFixed(1)}%`;
    dom.weaponHitProbDisplay.textContent = `${(target.hitProbability * 100).toFixed(1)}%`;
    dom.weaponHitProbDisplay.style.color =
      target.hitProbability > 0.5 ? "var(--success)" : "var(--warning)";
  } else {
    dom.weaponDistFactor.textContent = "0%";
    dom.weaponTrackFactor.textContent = "0%";
    dom.weaponHitProbDisplay.textContent = "0%";
    dom.weaponHitProbDisplay.style.color = "var(--text-dim)";
  }
}

export function renderWeaponSlots(
  dom: DomCache,
  entity: Entity | null,
  actions: EntityPanelActions
): void {
  if (!entity) return;
  dom.entityWeaponsList.innerHTML = "";
  if (!entity.weapons || entity.weapons.length === 0) {
    const empty = document.createElement("div");
    empty.className = "profile-info";
    empty.textContent = "No weapons installed";
    dom.entityWeaponsList.appendChild(empty);
    return;
  }

  entity.weapons.forEach((slot, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "weapon-slot";

    const header = document.createElement("div");
    header.className = "weapon-slot-header";
    header.innerHTML = `<span style="color: var(--accent); font-weight: bold;">Slot ${index + 1}</span>`;
    const removeBtn = document.createElement("button");
    removeBtn.className = "weapon-slot-delete danger";
    removeBtn.textContent = "X";
    removeBtn.addEventListener("click", () => actions.onDeleteSlot(entity.id, index));
    header.appendChild(removeBtn);
    wrapper.appendChild(header);

    const controls = document.createElement("div");
    controls.className = "weapon-slot-controls";
    const select = document.createElement("select");
    Object.keys(BAKED_WEAPONS).forEach((weaponId) => {
      const option = document.createElement("option");
      option.value = weaponId;
      option.textContent = BAKED_WEAPONS[weaponId].name;
      select.appendChild(option);
    });
    select.value = slot.weaponId;
    select.addEventListener("change", (event) =>
      actions.onUpdateSlot(entity.id, index, {
        weaponId: (event.target as HTMLSelectElement).value
      })
    );

    const count = document.createElement("input");
    count.type = "number";
    count.min = "0";
    count.value = String(slot.count || 0);
    count.addEventListener("change", (event) =>
      actions.onUpdateSlot(entity.id, index, {
        count: Number.parseInt((event.target as HTMLInputElement).value, 10)
      })
    );

    const active = document.createElement("input");
    active.type = "checkbox";
    active.checked = slot.active;
    active.addEventListener("change", (event) =>
      actions.onUpdateSlot(entity.id, index, { active: (event.target as HTMLInputElement).checked })
    );

    controls.appendChild(select);
    controls.appendChild(count);
    controls.appendChild(active);
    wrapper.appendChild(controls);
    dom.entityWeaponsList.appendChild(wrapper);
  });
}

export function teamTag(team: Team): "ALPHA" | "BETA" | "TEAM" {
  if (team === "alpha") return "ALPHA";
  if (team === "beta") return "BETA";
  return "TEAM";
}
