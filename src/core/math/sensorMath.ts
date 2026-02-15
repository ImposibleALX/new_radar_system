import { getConfig } from "../domain/config";
import type { PerfCounters, ShipProfile } from "../domain/types";
import { FastMath } from "./fastMath";
import { resolveShipSizeMeters } from "../render/shipSize";

let PERF: Partial<PerfCounters> | null = null;

export function bindPerfCounters(counters: Partial<PerfCounters>): void {
  PERF = counters;
}

function bump(key: keyof PerfCounters): void {
  if (!PERF) return;
  PERF[key] = (PERF[key] || 0) + 1;
}

export const SHIP_PROFILES: Record<string, ShipProfile> = {
  Interceptor: {
    baseSignature: 15,
    activityGain: 1.8,
    sizeM: 250,
    size: "frigate",
    description: "Fast, low signature craft"
  },
  Corvette: {
    baseSignature: 18,
    activityGain: 1.6,
    sizeM: 500,
    size: "frigate",
    description: "Small patrol vessel"
  },
  "Light Frigate": {
    baseSignature: 25,
    activityGain: 1.7,
    sizeM: 700,
    size: "frigate",
    description: "Basic combat vessel"
  },
  "Heavy Frigate": {
    baseSignature: 35,
    activityGain: 2.0,
    sizeM: 900,
    size: "frigate",
    description: "Reinforced multi-role frigate"
  },
  Destroyer: {
    baseSignature: 45,
    activityGain: 2.1,
    sizeM: 1300,
    size: "cruiser",
    description: "Line combat vessel"
  },
  "Light Cruiser": {
    baseSignature: 55,
    activityGain: 2.2,
    sizeM: 1800,
    size: "cruiser",
    description: "Multi-role capital ship"
  },
  Battlecruiser: {
    baseSignature: 65,
    activityGain: 2.3,
    sizeM: 2400,
    size: "cruiser",
    description: "Heavy firepower platform"
  },
  Carrier: {
    baseSignature: 90,
    activityGain: 2.5,
    sizeM: 3200,
    size: "capital",
    description: "Fighter operations, always visible"
  },
  Dreadnought: {
    baseSignature: 85,
    activityGain: 2.4,
    sizeM: 3800,
    size: "capital",
    description: "Maximum firepower, impossible to hide"
  },
  "Command Ship": {
    baseSignature: 75,
    activityGain: 2.6,
    sizeM: 3500,
    size: "capital",
    description: "C&C vessel with high sensor emissions"
  }
};

let profileLookup: Record<string, ShipProfile> | null = null;

function normalizeProfileName(value: string): string {
  return String(value)
    .replace(/[\s\-_]/g, "")
    .toLowerCase();
}

function ensureProfileLookup(): void {
  if (profileLookup) return;
  profileLookup = {};
  Object.keys(SHIP_PROFILES).forEach((key) => {
    profileLookup![normalizeProfileName(key)] = SHIP_PROFILES[key];
  });
}

function normalizeProfile(profile: Partial<ShipProfile>): ShipProfile {
  const baseSignature = Math.max(1, Number(profile.baseSignature) || 20);
  const activityGain = Math.max(0.1, Number(profile.activityGain) || 1.5);
  const sizeToken = typeof profile.size === "string" ? profile.size : undefined;
  const sizeM = resolveShipSizeMeters(profile.sizeM, sizeToken);
  const description =
    typeof profile.description === "string" && profile.description.trim().length > 0
      ? profile.description.trim()
      : "Custom profile";
  return { baseSignature, activityGain, sizeM, size: sizeToken, description };
}

export function loadCustomProfiles(): void {
  try {
    const stored = localStorage.getItem("customShipProfiles");
    if (!stored) return;
    const custom = JSON.parse(stored) as Record<string, Partial<ShipProfile>>;
    Object.keys(custom).forEach((name) => {
      SHIP_PROFILES[name] = normalizeProfile(custom[name] || {});
    });
    profileLookup = null;
  } catch (error) {
    console.error("Failed to load custom profiles:", error);
  }
}

export function saveCustomProfile(name: string, profile: ShipProfile): boolean {
  try {
    const stored = localStorage.getItem("customShipProfiles");
    const custom = stored ? (JSON.parse(stored) as Record<string, Partial<ShipProfile>>) : {};
    const normalized = normalizeProfile(profile);
    custom[name] = normalized;
    localStorage.setItem("customShipProfiles", JSON.stringify(custom));
    SHIP_PROFILES[name] = normalized;
    profileLookup = null;
    return true;
  } catch (error) {
    console.error("Failed to save custom profile:", error);
    return false;
  }
}

export function getShipProfile(shipName: string): ShipProfile {
  ensureProfileLookup();
  if (!shipName) shipName = "";
  const found = profileLookup![normalizeProfileName(shipName)];
  if (found) return found;
  if (SHIP_PROFILES[shipName]) return SHIP_PROFILES[shipName];
  return {
    baseSignature: 20,
    activityGain: 1.5,
    sizeM: resolveShipSizeMeters(undefined, "m"),
    size: "m",
    description: "Default profile"
  };
}

export function getAvailableShipTypes(): string[] {
  return Object.keys(SHIP_PROFILES);
}

export function computeActivityLevel(
  velocityRatio: number,
  weaponActivityFraction: number,
  radarActive: boolean
): number {
  bump("activityComputations");
  const velWeight = getConfig("MATH_VEL_WEIGHT");
  const weaponWeight = getConfig("MATH_WEAPON_WEIGHT");
  const radarWeight = getConfig("MATH_RADAR_WEIGHT");
  const sensitivity = getConfig("MATH_SENSITIVITY");
  let rawActivity = Math.max(0, Math.min(1, Number(velocityRatio) || 0)) * velWeight;
  rawActivity += Math.max(0, Math.min(1, Number(weaponActivityFraction) || 0)) * weaponWeight;
  if (radarActive) rawActivity += radarWeight;
  const centered = sensitivity * (rawActivity - 1.0);
  const normalized = (centered + 3) / 6;
  return FastMath.softstep(Math.max(0, Math.min(1, normalized)));
}

export function computeSignature(shipType: string, activityLevel: number): number {
  bump("signatureComputations");
  const profile = getShipProfile(shipType);
  const baseSig = Math.max(0, Number(profile.baseSignature) || 0);
  const gain = Math.max(0, Number(profile.activityGain) || 0);
  const clampedActivity = Math.max(0, Math.min(1, Number(activityLevel) || 0));
  const k = getConfig("MATH_SIG_K");
  const activityBoost = FastMath.log1pNormalized(clampedActivity, k) * gain;
  return Math.max(0, baseSig * (1 + activityBoost));
}

export function computeDetectionScore(
  signature: number,
  sensorPower: number,
  distanceM: number
): number {
  bump("detectionScoreComputations");
  const safeDistance = !Number.isFinite(distanceM) || distanceM <= 0 ? 1 : distanceM;
  if (signature <= 0 || sensorPower <= 0) return 0;
  const distanceKm = safeDistance / 1000;
  const effectiveRange = getConfig("MATH_EFFECTIVE_RANGE");
  const peakScore = getConfig("MATH_PEAK_SCORE");
  const referenceStrength = getConfig("MATH_REF_STRENGTH");
  const strength = (signature * sensorPower) / referenceStrength;
  const strengthFactor = FastMath.log1pNormalized(strength, 1.0);
  const distanceFactor = FastMath.inverseSquareFalloff(distanceKm, effectiveRange);
  return peakScore * strengthFactor * distanceFactor;
}

export function isDetected(detectionScore: number, threshold: number): boolean {
  return Number(detectionScore) >= Math.max(0, Number(threshold) || 0);
}

export function computeDetectionRange(
  signature: number,
  sensorPower: number,
  threshold: number
): number {
  signature = Math.max(0, Number(signature) || 0);
  sensorPower = Math.max(0, Number(sensorPower) || 0);
  threshold = Math.max(0, Number(threshold) || 0);
  if (threshold <= 0) return Number.POSITIVE_INFINITY;
  if (signature <= 0 || sensorPower <= 0) return 0;
  const peakScore = getConfig("MATH_PEAK_SCORE");
  const effectiveRange = getConfig("MATH_EFFECTIVE_RANGE");
  const referenceStrength = getConfig("MATH_REF_STRENGTH");
  const strength = (signature * sensorPower) / referenceStrength;
  const strengthFactor = FastMath.log1pNormalized(strength, 1.0);
  const maxScore = peakScore * strengthFactor;
  if (maxScore < threshold) return 0;
  const ratio = threshold / maxScore;
  if (ratio >= 1) return 0;
  const sqrtArg = maxScore / threshold - 1;
  if (sqrtArg < 0) return 0;
  bump("sqrtCalls");
  return Math.max(0, effectiveRange * Math.sqrt(sqrtArg) * 1000);
}

export function computeAngularVelocity(
  targetPos: { x: number; y: number; z: number },
  targetVel: { x: number; y: number; z: number },
  observerPos: { x: number; y: number; z: number },
  observerVel: { x: number; y: number; z: number }
): [number, number] {
  bump("angularVelocityComputations");
  const tx = (targetPos.x || 0) - (observerPos.x || 0);
  const ty = (targetPos.y || 0) - (observerPos.y || 0);
  const tz = (targetPos.z || 0) - (observerPos.z || 0);
  bump("sqrtCalls");
  const distance = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (!Number.isFinite(distance) || distance < 0.0001) return [0, 0];
  const dirX = tx / distance;
  const dirY = ty / distance;
  const dirZ = tz / distance;
  const rvx = (targetVel.x || 0) - (observerVel.x || 0);
  const rvy = (targetVel.y || 0) - (observerVel.y || 0);
  const rvz = (targetVel.z || 0) - (observerVel.z || 0);
  const dot = rvx * dirX + rvy * dirY + rvz * dirZ;
  const transX = rvx - dot * dirX;
  const transY = rvy - dot * dirY;
  const transZ = rvz - dot * dirZ;
  bump("sqrtCalls");
  const transversalSpeed = Math.sqrt(transX * transX + transY * transY + transZ * transZ);
  const angularVelocity = transversalSpeed / distance;
  if (!Number.isFinite(angularVelocity) || !Number.isFinite(transversalSpeed)) return [0, 0];
  return [angularVelocity, transversalSpeed];
}

export function computeLockState(
  detectionScore: number,
  angularVelocity: number,
  trackingTime: number,
  trackingSpeed: number
): { state: "NONE" | "ACQUIRING" | "TRACKING" | "LOCKED"; quality: number } {
  bump("lockStateComputations");
  const minDetection = getConfig("DETECT_THRESH");
  const fullLockDetection = getConfig("MATH_FULL_LOCK_DETECT");
  if (detectionScore < minDetection) return { state: "NONE", quality: 0 };
  let signalQuality = (detectionScore - minDetection) / (fullLockDetection - minDetection);
  signalQuality = Math.max(0, Math.min(1, signalQuality));
  const angularRatio = angularVelocity / Math.max(0.01, trackingSpeed);
  const trackingPenalty = Math.max(0, 1 - angularRatio * 0.5);
  const timeFactor = Math.min(1, trackingTime / getConfig("MATH_OPTIMAL_TRACK_TIME"));
  const lockQuality = signalQuality * trackingPenalty * (0.5 + 0.5 * timeFactor);
  if (lockQuality > 0.85) return { state: "LOCKED", quality: lockQuality };
  if (lockQuality > 0.2) return { state: "TRACKING", quality: lockQuality };
  if (lockQuality <= 0) return { state: "NONE", quality: 0 };
  return { state: "ACQUIRING", quality: lockQuality };
}

class SpatialHashGrid {
  private readonly cellSize: number;
  private readonly grid: Map<string, number[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize || 5000;
  }

  private hashKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  insert(entityIndex: number, x: number, y: number): void {
    const key = this.hashKey(x, y);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key)!.push(entityIndex);
  }

  queryRadius(x: number, y: number, radius: number): number[] {
    const results: number[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
        const cell = this.grid.get(`${cx + dx},${cy + dy}`);
        if (cell) results.push(...cell);
      }
    }
    return results;
  }
}

export function clusterTargets(
  targets: Array<{ x: number; y: number; z?: number; signature: number }>,
  clusterRadius: number
): Array<{ x: number; y: number; z: number; signature: number; count: number }> {
  bump("clusterOperations");
  const radius = Math.max(100, clusterRadius || 5000);
  if (targets.length === 0) return [];
  const grid = new SpatialHashGrid(radius);
  targets.forEach((target, idx) => grid.insert(idx, target.x || 0, target.y || 0));
  const clusters: Array<{ x: number; y: number; z: number; signature: number; count: number }> = [];
  const claimed = new Array(targets.length).fill(false);
  for (let i = 0; i < targets.length; i += 1) {
    if (claimed[i]) continue;
    const t = targets[i];
    claimed[i] = true;
    let totalSig = t.signature || 0;
    let weightedX = (t.x || 0) * (t.signature || 1);
    let weightedY = (t.y || 0) * (t.signature || 1);
    let weightedZ = (t.z || 0) * (t.signature || 1) || 0;
    let count = 1;
    const nearby = grid.queryRadius(t.x || 0, t.y || 0, radius);
    for (const j of nearby) {
      if (j === i || claimed[j]) continue;
      const other = targets[j];
      const dx = (t.x || 0) - (other.x || 0);
      const dy = (t.y || 0) - (other.y || 0);
      const dz = (t.z || 0) - (other.z || 0);
      bump("sqrtCalls");
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius) {
        claimed[j] = true;
        count += 1;
        totalSig += other.signature || 0;
        weightedX += (other.x || 0) * (other.signature || 1);
        weightedY += (other.y || 0) * (other.signature || 1);
        weightedZ += (other.z || 0) * (other.signature || 1);
      }
    }
    clusters.push({
      x: totalSig > 0 ? weightedX / totalSig : 0,
      y: totalSig > 0 ? weightedY / totalSig : 0,
      z: totalSig > 0 ? weightedZ / totalSig : 0,
      signature: totalSig * (count > 1 ? 0.85 : 1),
      count
    });
  }
  return clusters;
}
