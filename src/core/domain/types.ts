export type Team = "alpha" | "beta" | "neutral";

export type SensorMode = "Active" | "Passive";

export interface WeaponConfig {
  id: string;
  name: string;
  baseAccuracy: number;
  effectiveRange_km: number;
  trackingSpeed: number;
  trackingSensitivity: number;
  guidance: "unguided" | "guided";
  baseActivityWeight?: number;
  weaponClass?: string;
}

export interface BakedWeapon {
  id: string;
  name: string;
  baseAccuracy: number;
  invRangeSq: number;
  invTracking: number;
  trackingSensitivity: number;
  maxRangeM: number;
  guidance: "unguided" | "guided";
  baseActivityWeight: number;
  weaponClass: string;
  originalConfig: WeaponConfig;
}

export interface WeaponSlot {
  weaponId: string;
  count: number;
  active: boolean;
  slotId: number;
  _unknown?: boolean;
}

export interface ShipProfile {
  baseSignature: number;
  activityGain: number;
  sizeM: number;
  size?: string;
  description: string;
}

export interface ConfigEntry {
  name: string;
  val: number;
  min: number;
  max: number;
  step: number;
  cat: "sys" | "math";
  unit: string;
}

export interface OutgoingLock {
  targetId: number | null;
  trackingTime: number;
  status: "NONE" | "ACQUIRING" | "TRACKING" | "LOCKED";
  quality: number;
  prevStatus: string;
}

export interface IncomingLock {
  sourceId: number;
  targetId: number;
  status: "NONE" | "ACQUIRING" | "TRACKING" | "LOCKED";
  quality: number;
  detectionScore: number;
}

export interface RelativeOptions {
  mode: "selected" | "all";
  includeAllies: boolean;
  includeEnemies: boolean;
  maxTargets: number;
}

export type RingVisibilityMode = "focused" | "threat-only" | "all";

export interface EntitySnapshot {
  id: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  heading: number;
  shipType: string;
  team: Team;
  weapons: WeaponSlot[];
  ecm: number;
  sensorPower: number;
  sensorMode: SensorMode;
  radarActive: boolean;
  shipSizeM?: number;
  shipSizeGrowthPerSecond?: number;
  shipScale?: number;
  shipGrowthPerSecond?: number;
}

export interface ExportPayload {
  schemaVersion?: number;
  entities: EntitySnapshot[];
  config: Record<string, number>;
  zoom: number;
  panX: number;
  panY: number;
  defaultShipType: string;
  defaultTeam: Team;
  defaultWeapon: string;
  nextSlotId: number;
  telemetryEnabled?: boolean;
  showRangeRings?: boolean;
  showRangeLegend?: boolean;
  ringVisibilityMode?: RingVisibilityMode;
  relativeOptions?: RelativeOptions;
}

export interface PerfCounters {
  activityComputations: number;
  weaponActivityComputations: number;
  signatureComputations: number;
  detectionScoreComputations: number;
  lockStateComputations: number;
  clusterOperations: number;
  distanceComputations: number;
  angularVelocityComputations: number;
  tanhCalls: number;
  expCalls: number;
  atanCalls: number;
  sqrtCalls: number;
}
