import type { ConfigEntry } from "./types";

export const CONFIG: Record<string, ConfigEntry> = {
  SENSOR_STRENGTH: {
    name: "Sensor Power",
    val: 70,
    min: 10,
    max: 200,
    step: 10,
    cat: "sys",
    unit: "score"
  },
  DETECT_THRESH: {
    name: "Detect Threshold",
    val: 25,
    min: 5,
    max: 50,
    step: 5,
    cat: "sys",
    unit: "score"
  },
  TRACKING_SPEED: {
    name: "Tracking Speed",
    val: 0.2,
    min: 0.01,
    max: 0.5,
    step: 0.01,
    cat: "sys",
    unit: "rad/s"
  },
  ECM_SCALE: {
    name: "ECM Scale",
    val: 0.05,
    min: 0.01,
    max: 0.2,
    step: 0.01,
    cat: "sys",
    unit: "multiplier"
  },
  CLUSTER_RAD: {
    name: "Cluster Radius",
    val: 5000,
    min: 1000,
    max: 20000,
    step: 500,
    cat: "sys",
    unit: "meters"
  },
  MATH_VEL_WEIGHT: {
    name: "Velocity Weight",
    val: 1.0,
    min: 0.1,
    max: 3.0,
    step: 0.1,
    cat: "math",
    unit: "multiplier"
  },
  MATH_WEAPON_WEIGHT: {
    name: "Weapon Weight",
    val: 0.8,
    min: 0.1,
    max: 2.0,
    step: 0.1,
    cat: "math",
    unit: "multiplier"
  },
  MATH_RADAR_WEIGHT: {
    name: "Radar Weight",
    val: 0.5,
    min: 0.1,
    max: 2.0,
    step: 0.1,
    cat: "math",
    unit: "multiplier"
  },
  MATH_SENSITIVITY: {
    name: "Activity Sensitivity",
    val: 1,
    min: 0.5,
    max: 4.0,
    step: 0.1,
    cat: "math",
    unit: "multiplier"
  },
  MATH_SIG_K: {
    name: "Signature Curve (k)",
    val: 9.0,
    min: 1.0,
    max: 20.0,
    step: 0.5,
    cat: "math",
    unit: "dimensionless"
  },
  MATH_EFFECTIVE_RANGE: {
    name: "Effective Range",
    val: 40,
    min: 10,
    max: 200,
    step: 5,
    cat: "math",
    unit: "km"
  },
  MATH_PEAK_SCORE: {
    name: "Peak Score",
    val: 70,
    min: 50,
    max: 500,
    step: 10,
    cat: "math",
    unit: "score"
  },
  MATH_REF_STRENGTH: {
    name: "Reference Strength",
    val: 100,
    min: 10,
    max: 500,
    step: 10,
    cat: "math",
    unit: "score"
  },
  MATH_FULL_LOCK_DETECT: {
    name: "Full Lock Detection",
    val: 20,
    min: 30,
    max: 100,
    step: 5,
    cat: "math",
    unit: "score"
  },
  MATH_OPTIMAL_TRACK_TIME: {
    name: "Optimal Track Time",
    val: 2.0,
    min: 0.5,
    max: 10.0,
    step: 0.5,
    cat: "math",
    unit: "seconds"
  }
};

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getConfig(key: string): number {
  const cfg = CONFIG[key];
  if (!cfg) return 0;
  return clamp(cfg.val, cfg.min, cfg.max);
}

export function setConfigValue(key: string, val: number): void {
  const cfg = CONFIG[key];
  if (!cfg || Number.isNaN(val)) return;
  cfg.val = clamp(val, cfg.min, cfg.max);
}

export function eachConfigEntry(fn: (key: string, cfg: ConfigEntry) => void): void {
  Object.keys(CONFIG).forEach((key) => fn(key, CONFIG[key]));
}
