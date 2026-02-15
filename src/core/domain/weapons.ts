import { WEAPON_DB } from "../../data/weapons";
import type { BakedWeapon, WeaponConfig, WeaponSlot } from "./types";

export const BAKED_WEAPONS: Record<string, BakedWeapon> = {};

export function bakeWeaponStats(config: WeaponConfig): BakedWeapon {
  const rangeMeters = config.effectiveRange_km * 1000;
  const invRangeSq = 1.0 / rangeMeters ** 2;
  const invTracking = 1.0 / Math.max(0.0001, config.trackingSpeed);
  const trackingSensitivity = 0.5 * (config.trackingSensitivity || 2.0);
  const activityWeight = config.baseActivityWeight ?? 10;

  return {
    id: config.id,
    name: config.name,
    baseAccuracy: config.baseAccuracy,
    invRangeSq,
    invTracking,
    trackingSensitivity,
    maxRangeM: rangeMeters,
    guidance: config.guidance || "unguided",
    baseActivityWeight: activityWeight,
    weaponClass: config.weaponClass || "standard",
    originalConfig: config
  };
}

export function initializeWeaponDatabase(
  log?: (msg: string, type?: string, tag?: string) => void
): void {
  WEAPON_DB.weapons_test.forEach((w) => {
    BAKED_WEAPONS[w.id] = bakeWeaponStats(w);
  });
  if (log) log(`Baked ${Object.keys(BAKED_WEAPONS).length} weapons`, "INFO", "SYS");
}

export function computeHitProbOptimized(
  bakedWeapon: BakedWeapon,
  distSq: number,
  targetAngVel: number,
  lockQuality: number
): number {
  const distFactor = 1.0 / (1.0 + distSq * bakedWeapon.invRangeSq);

  let trackingFactor = 1.0;
  if (bakedWeapon.guidance === "guided" && lockQuality > 0.5) {
    trackingFactor = 0.95 + lockQuality * 0.05;
  } else {
    const angRatio = targetAngVel * bakedWeapon.invTracking;
    let penalty = Math.max(0, angRatio - 1.0) * bakedWeapon.trackingSensitivity;
    if (penalty > 1.0) penalty = 1.0;
    trackingFactor = 1.0 - penalty * penalty;
  }

  return bakedWeapon.baseAccuracy * distFactor * trackingFactor;
}

export function calculateWeaponActivity(
  weapons: WeaponSlot[] | undefined,
  perf?: { weaponActivityComputations?: number }
): number {
  if (perf) perf.weaponActivityComputations = (perf.weaponActivityComputations || 0) + 1;
  if (!weapons || weapons.length === 0) return 0;

  let installedCapacity = 0;
  let currentFiring = 0;

  weapons.forEach((slot) => {
    const w = BAKED_WEAPONS[slot.weaponId];
    const weight = w?.baseActivityWeight || 10;
    const qty = Math.max(0, Number(slot.count) || 0);
    installedCapacity += weight * qty;
    if (slot.active && qty > 0) currentFiring += weight * qty;
  });

  const normalized = installedCapacity > 0 ? currentFiring / installedCapacity : 0;
  return Math.max(0, Math.min(1, normalized));
}

export function getPrimaryWeapon(weapons?: WeaponSlot[]): BakedWeapon | null {
  if (!weapons || weapons.length === 0) return null;
  const activeSlot = weapons.find((slot) => slot.active && (slot.count || 0) > 0);
  if (!activeSlot) return null;
  return BAKED_WEAPONS[activeSlot.weaponId] || null;
}

export function colorFromWeaponId(weaponId: string): string {
  let charSum = 0;
  for (let i = 0; i < weaponId.length; i += 1) charSum += weaponId.charCodeAt(i);
  return `hsl(${charSum % 360}, 70%, 50%)`;
}
