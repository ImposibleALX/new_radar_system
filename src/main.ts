// @ts-nocheck
import { createUiScheduler } from "./ui/uiScheduler";
import { createEntityListPatcher } from "./ui/entityList";
import { renderLegendDiagnostics, renderLegendRows } from "./ui/legend";
import { registerServiceWorker } from "./sw/register";
import { bindDualInput } from "./ui/bindings";
import { attachSafeNumberInput, coerceNumberValue, formatNumber } from "./ui/numberSafety";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  applyWheelZoom,
  configureZoomControls,
  parseZoomFromNumber,
  parseZoomFromSlider,
  syncZoomControls
} from "./ui/zoomModel";
import { buildRingModel } from "./core/render/ringModel";
import { resolveRingPalette, RING_SEMANTICS } from "./core/render/ringSemantics";
import {
  SPAWN_TARGET_SEPARATION_M,
  computeSpawnPoint,
  estimateSpawnSeparationStats
} from "./core/sim/spawnPlanner";
import {
  SHIP_SIZE_M_DEFAULT,
  SHIP_SIZE_M_MAX,
  SHIP_SIZE_M_MIN,
  advanceShipSizeMeters,
  computeShipRenderSizePx,
  legacyShipScaleToMeters,
  resolveShipSizeMeters
} from "./core/render/shipSize";

export type AppRuntime = any;
// =========================================================================
// WEAPON DATABASE
// =========================================================================

const WEAPON_DB = {
  weapons_test: [
    {
      id: "pulse_laser_mk1",
      name: "Pulse Laser Mk I (PL-1)",
      baseAccuracy: 0.78,
      effectiveRange_km: 25,
      trackingSpeed: 0.18,
      trackingSensitivity: 2.4,
      guidance: "unguided",
      baseActivityWeight: 18,
      weaponClass: "standard"
    },
    {
      id: "pulse_laser_mk2",
      name: "Pulse Laser Mk II (PL-2)",
      baseAccuracy: 0.85,
      effectiveRange_km: 28,
      trackingSpeed: 0.22,
      trackingSensitivity: 2.0,
      guidance: "unguided",
      baseActivityWeight: 22,
      weaponClass: "standard"
    },
    {
      id: "beam_laser_x1",
      name: "Beam Laser X1 (BL-X1)",
      baseAccuracy: 0.92,
      effectiveRange_km: 30,
      trackingSpeed: 0.12,
      trackingSensitivity: 2.2,
      guidance: "unguided",
      baseActivityWeight: 24,
      weaponClass: "standard"
    },
    {
      id: "autocannon_20mm",
      name: "20 mm Autocannon",
      baseAccuracy: 0.65,
      effectiveRange_km: 4,
      trackingSpeed: 0.3,
      trackingSensitivity: 1.6,
      guidance: "unguided",
      baseActivityWeight: 6,
      weaponClass: "pointdefense"
    },
    {
      id: "autocannon_75mm",
      name: "75 mm Autocannon",
      baseAccuracy: 0.72,
      effectiveRange_km: 26,
      trackingSpeed: 0.14,
      trackingSensitivity: 1.9,
      guidance: "unguided",
      baseActivityWeight: 20,
      weaponClass: "standard"
    },
    {
      id: "railgun_light",
      name: "Light Railgun (RG-L)",
      baseAccuracy: 0.88,
      effectiveRange_km: 28,
      trackingSpeed: 0.06,
      trackingSensitivity: 2.8,
      guidance: "unguided",
      baseActivityWeight: 45,
      weaponClass: "heavy"
    },
    {
      id: "railgun_heavy",
      name: "Heavy Railgun (RG-H)",
      baseAccuracy: 0.92,
      effectiveRange_km: 30,
      trackingSpeed: 0.04,
      trackingSensitivity: 3.4,
      guidance: "unguided",
      baseActivityWeight: 60,
      weaponClass: "heavy"
    },
    {
      id: "plasma_cannon",
      name: "Plasma Cannon (PC-1)",
      baseAccuracy: 0.8,
      effectiveRange_km: 27,
      trackingSpeed: 0.09,
      trackingSensitivity: 2.6,
      guidance: "unguided",
      baseActivityWeight: 28,
      weaponClass: "standard"
    },
    {
      id: "pulse_beam_field",
      name: "Pulse Field Generator (PFG-1)",
      baseAccuracy: 0.7,
      effectiveRange_km: 26,
      trackingSpeed: 0.2,
      trackingSensitivity: 2.1,
      guidance: "unguided",
      baseActivityWeight: 30,
      weaponClass: "area"
    },

    {
      id: "missile_light_flare",
      name: "Light Guided Missile (LGM-1)",
      baseAccuracy: 0.9,
      effectiveRange_km: 40,
      trackingSpeed: 0.09,
      trackingSensitivity: 1.6,
      guidance: "guided",
      baseActivityWeight: 18,
      weaponClass: "missile"
    },
    {
      id: "missile_striker",
      name: "Guided Strike Missile (GSM-2)",
      baseAccuracy: 0.95,
      effectiveRange_km: 45,
      trackingSpeed: 0.08,
      trackingSensitivity: 1.5,
      guidance: "guided",
      baseActivityWeight: 26,
      weaponClass: "missile"
    },
    {
      id: "missile_heavy_torpedo",
      name: "Heavy Torpedo (HT-1)",
      baseAccuracy: 0.98,
      effectiveRange_km: 45,
      trackingSpeed: 0.045,
      trackingSensitivity: 2.0,
      guidance: "guided",
      baseActivityWeight: 70,
      weaponClass: "heavy_missile"
    }
  ]
};

// =========================================================================
// WEAPON BAKING SYSTEM
// =========================================================================

const BAKED_WEAPONS = {};

function bakeWeaponStats(config) {
  // Unit conversion: km to meters for range calculations
  const rangeKm = config.effectiveRange_km;
  const rangeMeters = rangeKm * 1000; // EXPLICIT UNIT CONVERSION: km -> m

  const invRangeSq = 1.0 / rangeMeters ** 2;
  const invTracking = 1.0 / Math.max(0.0001, config.trackingSpeed);
  const trackingSensitivity = 0.5 * (config.trackingSensitivity || 2.0);

  // ADD THIS: Ensure baseActivityWeight exists with default
  const activityWeight = config.baseActivityWeight !== undefined ? config.baseActivityWeight : 10;

  return {
    id: config.id,
    name: config.name,
    baseAccuracy: config.baseAccuracy,
    invRangeSq: invRangeSq,
    invTracking: invTracking,
    trackingSensitivity: trackingSensitivity,
    maxRangeM: rangeMeters,
    guidance: config.guidance || "unguided",
    baseActivityWeight: activityWeight, // ADD THIS
    weaponClass: config.weaponClass || "standard", // ADD THIS
    originalConfig: config
  };
}

function computeHitProbOptimized(bakedWeapon, distSq, targetAngVel, lockQuality) {
  const distFactor = 1.0 / (1.0 + distSq * bakedWeapon.invRangeSq);

  let trackingFactor = 1.0;

  if (bakedWeapon.guidance === "guided" && lockQuality !== undefined && lockQuality > 0.5) {
    trackingFactor = 0.95 + lockQuality * 0.05;
  } else {
    const angRatio = targetAngVel * bakedWeapon.invTracking;
    let penalty = Math.max(0, angRatio - 1.0) * bakedWeapon.trackingSensitivity;
    if (penalty > 1.0) penalty = 1.0;
    trackingFactor = 1.0 - penalty * penalty;
  }

  return bakedWeapon.baseAccuracy * distFactor * trackingFactor;
}

function initializeWeaponDatabase() {
  WEAPON_DB.weapons_test.forEach((w) => {
    BAKED_WEAPONS[w.id] = bakeWeaponStats(w);
  });
  log(`Baked ${Object.keys(BAKED_WEAPONS).length} weapons`, "INFO", "SYS");
}

// =========================================================================
// CANONICAL WEAPON ACTIVITY FUNCTION (PROPORTIONAL COMBAT STRESS MODEL)
// =========================================================================
function calculateWeaponActivity(entity) {
  PERF_COUNTERS.weaponActivityComputations++;

  let installedCapacity = 0;
  let currentFiring = 0;

  if (!entity.weapons || entity.weapons.length === 0) return 0;

  entity.weapons.forEach((slot) => {
    const w = BAKED_WEAPONS[slot.weaponId];
    const weight = w && w.baseActivityWeight ? w.baseActivityWeight : 10;
    const qty = Math.max(0, Number(slot.count) || 0);

    installedCapacity += weight * qty;
    if (slot.active && qty > 0) {
      currentFiring += weight * qty;
    }
  });

  const normalized = installedCapacity > 0 ? currentFiring / installedCapacity : 0;
  return Math.max(0, Math.min(1, normalized));
}

// =========================================================================
// PERFORMANCE COUNTERS
// =========================================================================

const PERF_COUNTERS = {
  activityComputations: 0,
  weaponActivityComputations: 0,
  signatureComputations: 0,
  detectionScoreComputations: 0,
  lockStateComputations: 0,
  clusterOperations: 0,
  distanceComputations: 0,
  angularVelocityComputations: 0,

  tanhCalls: 0,
  expCalls: 0,
  atanCalls: 0,
  sqrtCalls: 0,

  reset: function () {
    this.activityComputations = 0;
    this.weaponActivityComputations = 0;
    this.signatureComputations = 0;
    this.detectionScoreComputations = 0;
    this.lockStateComputations = 0;
    this.clusterOperations = 0;
    this.distanceComputations = 0;
    this.angularVelocityComputations = 0;
    this.tanhCalls = 0;
    this.expCalls = 0;
    this.atanCalls = 0;
    this.sqrtCalls = 0;
  },

  getReport: function () {
    return {
      total_function_calls:
        this.activityComputations +
        this.weaponActivityComputations +
        this.signatureComputations +
        this.detectionScoreComputations +
        this.lockStateComputations +
        this.clusterOperations +
        this.distanceComputations +
        this.angularVelocityComputations,
      expensive_ops: this.tanhCalls + this.expCalls + this.atanCalls,
      breakdown: {
        activity: this.activityComputations,
        weaponActivity: this.weaponActivityComputations,
        signature: this.signatureComputations,
        detection: this.detectionScoreComputations,
        lockState: this.lockStateComputations,
        clustering: this.clusterOperations,
        distance: this.distanceComputations,
        angularVel: this.angularVelocityComputations
      },
      expensive_breakdown: {
        tanh: this.tanhCalls,
        exp: this.expCalls,
        atan: this.atanCalls,
        sqrt: this.sqrtCalls
      }
    };
  }
};

// =========================================================================
// FAST MATH APPROXIMATIONS
// =========================================================================

const FastMath = {
  softstep: function (x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  },

  log1pNormalized: function (x, k) {
    const xk = x * k;
    return xk / (1 + xk);
  },

  inverseSquareFalloff: function (distanceKm, effectiveRange) {
    const ratio = distanceKm / effectiveRange;
    return 1 / (1 + ratio * ratio);
  },

  fastSigmoid: function (x) {
    if (x < -4) return 0;
    if (x > 4) return 1;
    const normalized = (x + 4) / 8;
    return this.softstep(normalized);
  }
};

// =========================================================================
// SPATIAL HASH GRID
// =========================================================================

class SpatialHashGrid {
  constructor(cellSize) {
    this.cellSize = cellSize || 5000;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  _hashKey(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(entity, x, y) {
    const key = this._hashKey(x, y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(entity);
  }

  queryRadius(x, y, radius) {
    const results = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }
    return results;
  }
}

// =========================================================================
// DISTANCE CACHE
// =========================================================================

const DistanceCache = {
  _cache: new Map(),
  _quantizeStep: 10,

  _quantizePos(x, y) {
    const qx = Math.floor(x / this._quantizeStep) * this._quantizeStep;
    const qy = Math.floor(y / this._quantizeStep) * this._quantizeStep;
    return `${qx},${qy}`;
  },

  get(x1, y1, x2, y2) {
    const key = `${this._quantizePos(x1, y1)}_${this._quantizePos(x2, y2)}`;
    return this._cache.get(key);
  },

  set(x1, y1, x2, y2, distance) {
    const key = `${this._quantizePos(x1, y1)}_${this._quantizePos(x2, y2)}`;
    this._cache.set(key, distance);

    if (this._cache.size > 1000) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
  },

  clear() {
    this._cache.clear();
  }
};

// =========================================================================
// IMPROVED SENSOR MATH
// =========================================================================

const ImprovedSensorMath = {
  clamp: function (val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
};

ImprovedSensorMath.SHIP_PROFILES = {
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

function normalizeShipProfile(profile) {
  const safe = profile && typeof profile === "object" ? profile : {};
  const sizeToken = typeof safe.size === "string" ? safe.size : undefined;
  const sizeM = resolveShipSizeMeters(safe.sizeM, sizeToken, SHIP_SIZE_M_DEFAULT);
  return {
    baseSignature: Math.max(1, Number(safe.baseSignature) || 20),
    activityGain: Math.max(0.1, Number(safe.activityGain) || 1.5),
    sizeM,
    size: sizeToken,
    description:
      typeof safe.description === "string" && safe.description.trim().length > 0
        ? safe.description.trim()
        : "Custom profile"
  };
}

ImprovedSensorMath.loadCustomProfiles = function () {
  try {
    const stored = localStorage.getItem("customShipProfiles");
    if (stored) {
      const custom = JSON.parse(stored);
      Object.keys(custom).forEach((name) => {
        ImprovedSensorMath.SHIP_PROFILES[name] = normalizeShipProfile(custom[name]);
      });
      ImprovedSensorMath._profileLookup = null;
    }
  } catch (e) {
    console.error("Failed to load custom profiles:", e);
  }
};

ImprovedSensorMath.saveCustomProfile = function (name, profile) {
  try {
    const stored = localStorage.getItem("customShipProfiles");
    const custom = stored ? JSON.parse(stored) : {};
    const normalizedProfile = normalizeShipProfile(profile);
    custom[name] = normalizedProfile;
    localStorage.setItem("customShipProfiles", JSON.stringify(custom));
    ImprovedSensorMath.SHIP_PROFILES[name] = normalizedProfile;
    ImprovedSensorMath._profileLookup = null;
    return true;
  } catch (e) {
    console.error("Failed to save custom profile:", e);
    return false;
  }
};

ImprovedSensorMath.getShipProfile = function (shipName) {
  if (!shipName) shipName = "";
  const normalize = (s) =>
    String(s)
      .replace(/[\s\-_]/g, "")
      .toLowerCase();
  if (!ImprovedSensorMath._profileLookup) {
    ImprovedSensorMath._profileLookup = {};
    Object.keys(ImprovedSensorMath.SHIP_PROFILES).forEach((k) => {
      ImprovedSensorMath._profileLookup[normalize(k)] = ImprovedSensorMath.SHIP_PROFILES[k];
    });
  }
  const found = ImprovedSensorMath._profileLookup[normalize(shipName)];
  if (found) return found;
  if (ImprovedSensorMath.SHIP_PROFILES[shipName]) return ImprovedSensorMath.SHIP_PROFILES[shipName];
  return {
    baseSignature: 20,
    activityGain: 1.5,
    sizeM: SHIP_SIZE_M_DEFAULT,
    size: "m",
    description: "Default profile"
  };
};

ImprovedSensorMath.getAvailableShipTypes = function () {
  return Object.keys(ImprovedSensorMath.SHIP_PROFILES);
};

ImprovedSensorMath.computeActivityLevel = function (
  velocityRatio,
  weaponActivityFraction,
  radarActive
) {
  // CHANGED: proportional weapon activity fraction
  PERF_COUNTERS.activityComputations++;

  velocityRatio = Math.max(0, Math.min(1, Number(velocityRatio) || 0));
  weaponActivityFraction = Math.max(0, Math.min(1, Number(weaponActivityFraction) || 0));
  const velWeight = CONFIG.get("MATH_VEL_WEIGHT");
  const weaponWeight = CONFIG.get("MATH_WEAPON_WEIGHT");
  const radarWeight = CONFIG.get("MATH_RADAR_WEIGHT");
  const sensitivity = CONFIG.get("MATH_SENSITIVITY");

  let rawActivity = velocityRatio * velWeight + weaponActivityFraction * weaponWeight;
  if (radarActive) rawActivity += radarWeight;

  const centered = sensitivity * (rawActivity - 1.0);
  const normalized = (centered + 3) / 6;
  return FastMath.softstep(Math.max(0, Math.min(1, normalized)));
};

ImprovedSensorMath.computeSignature = function (shipType, activityLevel) {
  PERF_COUNTERS.signatureComputations++;

  const profile = ImprovedSensorMath.getShipProfile(shipType);
  const baseSig = Math.max(0, Number(profile.baseSignature) || 0);
  const gain = Math.max(0, Number(profile.activityGain) || 0);
  activityLevel = ImprovedSensorMath.clamp(Number(activityLevel) || 0, 0.0, 1.0);
  const k = CONFIG.get("MATH_SIG_K");

  const activityBoostNormalized = FastMath.log1pNormalized(activityLevel, k);
  const activityBoost = activityBoostNormalized * gain;
  return Math.max(0, baseSig * (1 + activityBoost));
};

ImprovedSensorMath.computeDetectionScore = function (signature, sensorPower, distanceM, opts = {}) {
  PERF_COUNTERS.detectionScoreComputations++;

  signature = Math.max(0, Number(signature) || 0);
  sensorPower = Math.max(0, Number(sensorPower) || 0);
  distanceM = Number(distanceM);
  if (!isFinite(distanceM) || distanceM <= 0) distanceM = 1;
  if (signature <= 0 || sensorPower <= 0) return 0;

  const distanceKm = distanceM / 1000;
  const effectiveRange =
    "effectiveRange" in opts ? Number(opts.effectiveRange) : CONFIG.get("MATH_EFFECTIVE_RANGE");
  const peakScore = "peakScore" in opts ? Number(opts.peakScore) : CONFIG.get("MATH_PEAK_SCORE");
  const referenceStrength =
    "referenceStrength" in opts ? Number(opts.referenceStrength) : CONFIG.get("MATH_REF_STRENGTH");

  const strength = (signature * sensorPower) / referenceStrength;
  const strengthFactor = FastMath.log1pNormalized(strength, 1.0);
  const distanceFactor = FastMath.inverseSquareFalloff(distanceKm, effectiveRange);

  return peakScore * strengthFactor * distanceFactor;
};

ImprovedSensorMath.isDetected = function (detectionScore, detectionThreshold) {
  detectionScore = Number(detectionScore) || 0;
  detectionThreshold = typeof detectionThreshold === "number" ? detectionThreshold : 15;
  detectionThreshold = Math.max(0, Number(detectionThreshold) || 0);
  return detectionScore >= detectionThreshold;
};

ImprovedSensorMath.computeDetectionRange = function (signature, sensorPower, threshold, opts = {}) {
  signature = Math.max(0, Number(signature) || 0);
  sensorPower = Math.max(0, Number(sensorPower) || 0);
  threshold = Math.max(0, Number(threshold) || 0);
  if (threshold <= 0) return Infinity;
  if (signature <= 0 || sensorPower <= 0) return 0;

  const peakScore = "peakScore" in opts ? Number(opts.peakScore) : CONFIG.get("MATH_PEAK_SCORE");
  const effectiveRange =
    "effectiveRange" in opts ? Number(opts.effectiveRange) : CONFIG.get("MATH_EFFECTIVE_RANGE");
  const referenceStrength =
    "referenceStrength" in opts ? Number(opts.referenceStrength) : CONFIG.get("MATH_REF_STRENGTH");

  const strength = (signature * sensorPower) / referenceStrength;
  const strengthFactor = FastMath.log1pNormalized(strength, 1.0);

  const maxScore = peakScore * strengthFactor;
  if (maxScore < threshold) return 0;

  const ratio = threshold / maxScore;
  if (ratio >= 1) return 0;

  const sqrtArg = maxScore / threshold - 1;
  if (sqrtArg < 0) return 0;

  PERF_COUNTERS.sqrtCalls++;
  const rangeKm = effectiveRange * Math.sqrt(sqrtArg);
  return Math.max(0, rangeKm * 1000);
};

ImprovedSensorMath.computeAngularVelocity = function (
  target_pos,
  target_vel,
  observer_pos,
  observer_vel
) {
  PERF_COUNTERS.angularVelocityComputations++;

  const tx = (target_pos.x || 0) - (observer_pos.x || 0);
  const ty = (target_pos.y || 0) - (observer_pos.y || 0);
  const tz = (target_pos.z || 0) - (observer_pos.z || 0);

  PERF_COUNTERS.sqrtCalls++;
  const dist = Math.sqrt(tx * tx + ty * ty + tz * tz);
  const minDist = 0.0001;

  if (!isFinite(dist) || dist < minDist) return [0.0, 0.0];

  const dir_x = tx / dist;
  const dir_y = ty / dist;
  const dir_z = tz / dist;

  const rvx = (target_vel.x || 0) - (observer_vel.x || 0);
  const rvy = (target_vel.y || 0) - (observer_vel.y || 0);
  const rvz = (target_vel.z || 0) - (observer_vel.z || 0);

  const dot = rvx * dir_x + rvy * dir_y + rvz * dir_z;
  const lin_x = dot * dir_x;
  const lin_y = dot * dir_y;
  const lin_z = dot * dir_z;

  const trans_x = rvx - lin_x;
  const trans_y = rvy - lin_y;
  const trans_z = rvz - lin_z;

  PERF_COUNTERS.sqrtCalls++;
  const transversal_speed = Math.sqrt(trans_x * trans_x + trans_y * trans_y + trans_z * trans_z);
  const angular_velocity = transversal_speed / dist;

  if (!isFinite(angular_velocity) || !isFinite(transversal_speed)) return [0.0, 0.0];

  return [angular_velocity, transversal_speed];
};

ImprovedSensorMath.computeLockState = function (
  detectionScore,
  angularVelocity,
  trackingTime,
  trackingSpeed
) {
  PERF_COUNTERS.lockStateComputations++;

  // Obtener config
  const minDetection = CONFIG.get("DETECT_THRESH"); // El umbral duro (ej. 25)
  const fullLockDetection = CONFIG.get("MATH_FULL_LOCK_DETECT"); // Optimal threshold (e.g. 50)

  // 1. Si estamos bajo el umbral duro, retorno inmediato 0.
  if (detectionScore < minDetection) {
    return { state: "NONE", quality: 0 };
  }

  // 2. Fade logic: normalize between minimum and optimal score.
  // Esto asegura que si score == minDetection, el factor es 0.0 (0%).
  // Si score >= fullLockDetection, el factor es 1.0 (100%).
  let signalQuality = (detectionScore - minDetection) / (fullLockDetection - minDetection);
  signalQuality = Math.max(0, Math.min(1, signalQuality)); // Clamp 0-1

  // Aplicar tracking penalties (Angular, Tiempo, etc)
  const angularRatio = angularVelocity / Math.max(0.01, trackingSpeed);
  const trackingPenalty = Math.max(0, 1 - angularRatio * 0.5); // Simple linear penalty

  // El tiempo ayuda a estabilizar
  const timeFactor = Math.min(1, trackingTime / CONFIG.get("MATH_OPTIMAL_TRACK_TIME"));

  // Calidad Final
  const lockQuality = signalQuality * trackingPenalty * (0.5 + 0.5 * timeFactor);

  // Determinar estado basado en la calidad suavizada
  let state = "ACQUIRING";
  if (lockQuality > 0.85) state = "LOCKED";
  else if (lockQuality > 0.2) state = "TRACKING";
  else if (lockQuality <= 0.0) state = "NONE"; // Esto ahora coincide con el anillo

  return { state: state, quality: lockQuality };
};

ImprovedSensorMath.clusterTargets = function (targets, clusterRadius) {
  PERF_COUNTERS.clusterOperations++;

  clusterRadius = Math.max(100, clusterRadius || 5000);
  const COMPRESSION_FACTOR = 0.85;

  if (targets.length === 0) return [];

  const grid = new SpatialHashGrid(clusterRadius);
  targets.forEach((t, idx) => {
    grid.insert(idx, t.x || 0, t.y || 0);
  });

  const clusters = [];
  const claimed = new Array(targets.length).fill(false);

  for (let i = 0; i < targets.length; i++) {
    if (claimed[i]) continue;

    const t = targets[i];
    const cluster = {
      members: [i],
      total_sig: t.signature || 0,
      weighted_pos_x: (t.x || 0) * (t.signature || 1),
      weighted_pos_y: (t.y || 0) * (t.signature || 1),
      weighted_pos_z: (t.z || 0) * (t.signature || 1)
    };
    claimed[i] = true;

    const nearbyIndices = grid.queryRadius(t.x || 0, t.y || 0, clusterRadius);

    for (let j of nearbyIndices) {
      if (i === j || claimed[j]) continue;
      const other = targets[j];
      const dx = (t.x || 0) - (other.x || 0);
      const dy = (t.y || 0) - (other.y || 0);
      const dz = (t.z || 0) - (other.z || 0);

      PERF_COUNTERS.sqrtCalls++;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= clusterRadius) {
        cluster.members.push(j);
        cluster.total_sig += other.signature || 0;
        cluster.weighted_pos_x += (other.x || 0) * (other.signature || 1);
        cluster.weighted_pos_y += (other.y || 0) * (other.signature || 1);
        cluster.weighted_pos_z += (other.z || 0) * (other.signature || 1);
        claimed[j] = true;
      }
    }

    const count = cluster.members.length;
    const display_sig = cluster.total_sig * (count > 1 ? COMPRESSION_FACTOR : 1.0);
    let pos_x = 0,
      pos_y = 0,
      pos_z = 0;
    if (cluster.total_sig > 0) {
      pos_x = cluster.weighted_pos_x / cluster.total_sig;
      pos_y = cluster.weighted_pos_y / cluster.total_sig;
      pos_z = cluster.weighted_pos_z / cluster.total_sig;
    }
    clusters.push({
      x: pos_x,
      y: pos_y,
      z: pos_z,
      signature: display_sig,
      count: count,
      members: cluster.members.map((idx) => targets[idx])
    });
  }
  return clusters;
};

// =========================================================================
// STABLE ID GENERATOR
// =========================================================================
const IDGenerator = {
  _counter: 1,
  next: function () {
    return this._counter++;
  },
  reset: function () {
    this._counter = 1;
  }
};

// =========================================================================
// DOM ELEMENT CACHE
// =========================================================================
const DOM = {
  canvas: null,
  ctx: null,
  hudSelectedPos: null,
  hudContacts: null,
  hudLockOutgoing: null,
  hudLockIncoming: null,
  hudSelection: null,
  hudWeaponName: null,
  hudHitProb: null,
  threatWarning: null,
  rangeLegend: null,
  legendStatic: null,
  legendContent: null,
  legendDiagnostics: null,

  entityControlPanel: null,
  entityControlId: null,
  entityShipType: null,
  entityProfileDesc: null,
  entityTeam: null,
  entityVel: null,
  entityVelNum: null,
  entityHead: null,
  entityHeadNum: null,
  entityWeaponsList: null,
  entitySensorPower: null,
  entitySensorPowerNum: null,
  entityEcm: null,
  entityEcmNum: null,

  infoSig: null,
  infoActivity: null,
  infoDetection: null,
  infoWeaponActivity: null,

  weaponInfoPanel: null,
  weaponNameDisplay: null,
  weaponAccuracyDisplay: null,
  weaponRangeDisplay: null,
  weaponTrackingDisplay: null,
  weaponGuidanceDisplay: null,
  weaponSensitivityDisplay: null,
  weaponDistFactor: null,
  weaponTrackFactor: null,
  weaponHitProbDisplay: null,
  weaponActivityWeightDisplay: null,

  entityList: null,
  logPanel: null,
  zoomSlider: null,
  zoomValNum: null,
  telemetryToggle: null,
  showRangeRings: null,
  showRangeLegend: null,
  ringVisibilityModeSelect: null,
  relativeModeSelect: null,
  relativeIncludeAllies: null,
  relativeIncludeEnemies: null,
  relativeMaxTargets: null,

  init: function () {
    this.canvas = document.getElementById("main-canvas");
    this.ctx = this.canvas.getContext("2d");

    this.hudSelectedPos = document.getElementById("hud-selected-pos");
    this.hudContacts = document.getElementById("hud-contacts");
    this.hudLockOutgoing = document.getElementById("hud-lock-outgoing");
    this.hudLockIncoming = document.getElementById("hud-lock-incoming");
    this.hudSelection = document.getElementById("hud-selection");
    this.hudWeaponName = document.getElementById("hud-weapon-name");
    this.hudHitProb = document.getElementById("hud-hit-prob");
    this.threatWarning = document.getElementById("threat-warning");
    this.rangeLegend = document.getElementById("range-legend");
    this.legendStatic = document.getElementById("legend-static");
    this.legendContent = document.getElementById("legend-dynamic");
    this.legendDiagnostics = document.getElementById("legend-diagnostics");

    this.entityControlPanel = document.getElementById("entity-control-panel");
    this.entityControlId = document.getElementById("entity-control-id");
    this.entityShipType = document.getElementById("entity-ship-type");
    this.entityProfileDesc = document.getElementById("entity-profile-description");
    this.entityTeam = document.getElementById("entity-team");
    this.entityVel = document.getElementById("entity-vel");
    this.entityVelNum = document.getElementById("entity-vel-num");
    this.entityHead = document.getElementById("entity-head");
    this.entityHeadNum = document.getElementById("entity-head-num");
    this.entityWeaponsList = document.getElementById("entity-weapons-list");
    this.entitySensorPower = document.getElementById("entity-sensor-power");
    this.entitySensorPowerNum = document.getElementById("entity-sensor-power-num");
    this.entityEcm = document.getElementById("entity-ecm");
    this.entityEcmNum = document.getElementById("entity-ecm-num");

    this.infoSig = document.getElementById("info-sig");
    this.infoActivity = document.getElementById("info-activity");
    this.infoDetection = document.getElementById("info-detection");
    this.infoWeaponActivity = document.getElementById("info-weapon-activity");

    this.weaponInfoPanel = document.getElementById("weapon-info-panel");
    this.weaponNameDisplay = document.getElementById("weapon-name-display");
    this.weaponAccuracyDisplay = document.getElementById("weapon-accuracy-display");
    this.weaponRangeDisplay = document.getElementById("weapon-range-display");
    this.weaponTrackingDisplay = document.getElementById("weapon-tracking-display");
    this.weaponGuidanceDisplay = document.getElementById("weapon-guidance-display");
    this.weaponSensitivityDisplay = document.getElementById("weapon-sensitivity-display");
    this.weaponDistFactor = document.getElementById("weapon-dist-factor");
    this.weaponTrackFactor = document.getElementById("weapon-track-factor");
    this.weaponHitProbDisplay = document.getElementById("weapon-hit-prob-display");
    this.weaponActivityWeightDisplay = document.getElementById("weapon-activity-weight-display");

    this.entityList = document.getElementById("entity-list");
    this.logPanel = document.getElementById("log-panel");
    this.zoomSlider = document.getElementById("zoom-slider");
    this.zoomValNum = document.getElementById("zoom-val-num");
    this.telemetryToggle = document.getElementById("telemetry-toggle");
    this.showRangeRings = document.getElementById("show-range-rings");
    this.showRangeLegend = document.getElementById("show-range-legend");
    this.ringVisibilityModeSelect = document.getElementById("ring-visibility-mode-select");
    this.relativeModeSelect = document.getElementById("relative-mode-select");
    this.relativeIncludeAllies = document.getElementById("relative-include-allies");
    this.relativeIncludeEnemies = document.getElementById("relative-include-enemies");
    this.relativeMaxTargets = document.getElementById("relative-max-targets");
  }
};

// =========================================================================
// APP CONFIGURATION
// =========================================================================

const CONFIG = {
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
  },

  get: function (key) {
    const cfg = this[key];
    if (!cfg) return 0;
    return ImprovedSensorMath.clamp(cfg.val, cfg.min, cfg.max);
  }
};

// Team constants and colors (resolved from CSS vars with fallbacks)
const TEAMS = { ALPHA: "alpha", BETA: "beta", NEUTRAL: "neutral" };
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v && v.trim().length ? v.trim() : fallback;
}
const TEAM_COLORS = {
  [TEAMS.ALPHA]: {
    fill: "rgba(106, 195, 255, 0.34)",
    stroke: cssVar("--tag-allie", "#63d3ff"),
    detectionActive: "rgba(106, 195, 255, 0.34)",
    detectionPassive: "rgba(255, 211, 138, 0.45)",
    weapon: "rgba(255, 94, 146, 0.34)"
  },
  [TEAMS.BETA]: {
    fill: "rgba(255, 122, 122, 0.34)",
    stroke: cssVar("--tag-enemy", "#ff7a7a"),
    detectionActive: "rgba(255, 122, 122, 0.34)",
    detectionPassive: "rgba(255, 211, 138, 0.45)",
    weapon: "rgba(255, 94, 146, 0.34)"
  },
  [TEAMS.NEUTRAL]: {
    fill: "rgba(198, 210, 230, 0.26)",
    stroke: "#c6d2e6",
    detectionActive: "rgba(198, 210, 230, 0.26)",
    detectionPassive: "rgba(255, 211, 138, 0.4)",
    weapon: "rgba(255, 94, 146, 0.3)"
  }
};

// =========================================================================
// UNIVERSAL ENTITY CLASS
// =========================================================================

class Entity {
  constructor(id, x, y, shipType, team = TEAMS.NEUTRAL) {
    this.id = id;
    this.team = team;
    this.shipType = shipType || "Heavy Frigate";
    this.weapons = [];

    this.x = x;
    this.y = y;
    this.z = 0;

    this.speed = 0;
    this.heading = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.radarActive = true;

    this.sensorMode = "Active";
    this.sensorPower = 1.0;

    this.signature = 0;
    this.activityLevel = 0;
    this.weaponActivityLevel = 0;
    this.detected = false;
    this.detectionScore = 0;
    this.trackingQuality = 0;
    this.angularVelocity = 0;
    this.hitProbability = 0;

    this.ecm = 0;
    const profile = ImprovedSensorMath.getShipProfile(this.shipType);
    this.shipSizeM = resolveShipSizeMeters(profile.sizeM, profile.size, SHIP_SIZE_M_DEFAULT);
    this.shipSizeGrowthPerSecond = 0;
    this.shipScale = 1;
    this.shipGrowthPerSecond = 0;

    this._incomingTrackingTime = 0;
    this._prevIncomingStatus = "NONE";

    this._weaponDistFactor = 0;
    this._weaponTrackFactor = 0;
  }

  // Backward compatibility: total active weapons count
  getWeaponsFiringCount() {
    if (!this.weapons || this.weapons.length === 0) return 0;
    return this.weapons.reduce((sum, slot) => sum + (slot.active ? slot.count || 0 : 0), 0);
  }

  // Backward compatibility: any weapon slot active
  weaponsFiringBool() {
    if (!this.weapons || this.weapons.length === 0) return false;
    return this.weapons.some((slot) => slot.active && (slot.count || 0) > 0);
  }

  getSizeClass() {
    return ImprovedSensorMath.getShipProfile(this.shipType).size || "m";
  }

  getShipSizeMeters() {
    const profile = ImprovedSensorMath.getShipProfile(this.shipType);
    const fallback = resolveShipSizeMeters(profile.sizeM, profile.size, SHIP_SIZE_M_DEFAULT);
    return resolveShipSizeMeters(this.shipSizeM, undefined, fallback);
  }

  updateVelocity() {
    this.vx = Math.cos(this.heading) * this.speed;
    this.vy = Math.sin(this.heading) * this.speed;
    this.vz = 0;
  }

  updateSignature() {
    const velocityRatio = this.speed / 200;
    this.weaponActivityLevel = calculateWeaponActivity(this);

    this.activityLevel = ImprovedSensorMath.computeActivityLevel(
      velocityRatio,
      this.weaponActivityLevel,
      this.radarActive
    );
    this.signature = ImprovedSensorMath.computeSignature(this.shipType, this.activityLevel);
  }

  update(dt) {
    this.updateVelocity();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.shipSizeM = advanceShipSizeMeters(
      this.getShipSizeMeters(),
      this.shipSizeGrowthPerSecond,
      dt
    );
    this.updateSignature();
  }
}

// =========================================================================
// APP STATE
// =========================================================================

const STATE = {
  entities: [],
  outgoingLock: { targetId: null, trackingTime: 0, status: "NONE", quality: 0, prevStatus: "NONE" },
  incomingLocks: [],
  selectedId: null,
  hoveredId: null,
  playing: true,
  zoom: 0.15,
  panX: 0,
  panY: 0,
  defaultShipType: "Heavy Frigate",
  defaultTeam: TEAMS.ALPHA,
  defaultWeapon: "pulse_laser_mk1",
  telemetryEnabled: false,
  showRangeRings: true,
  showRangeLegend: true,
  ringVisibilityMode: "focused",
  _hudUpdateCounter: 0,
  _hudUpdateInterval: 3,
  _panelUpdateCounter: 0,
  _last_dt: 0.016,
  _nextSlotId: 1,
  relativeOptions: {
    mode: "selected", // 'selected' or 'all'
    includeAllies: true,
    includeEnemies: true,
    maxTargets: 5
  },

  getSelected: function () {
    if (!this.selectedId) return null;
    return this.entities.find((e) => e.id === this.selectedId) || null;
  },
  getNextSlotId: function () {
    return this._nextSlotId++;
  },
  isBeingLocked: function (id) {
    return this.incomingLocks.some(
      (l) => l.sourceId !== id && l.status === "LOCKED" && l.targetId === id
    );
  }
};

const RING_VISIBILITY_MODES = new Set(["focused", "threat-only", "all"]);

function sanitizeRingVisibilityMode(value, fallback = "focused") {
  return RING_VISIBILITY_MODES.has(value) ? value : fallback;
}

function syncOverlayControls() {
  if (DOM.telemetryToggle) DOM.telemetryToggle.checked = !!STATE.telemetryEnabled;
  const teleBtn = document.getElementById("btn-telemetry-toggle");
  if (teleBtn && DOM.telemetryToggle) {
    teleBtn.classList.toggle("mode-active", DOM.telemetryToggle.checked);
  }

  if (DOM.showRangeRings) DOM.showRangeRings.checked = !!STATE.showRangeRings;
  if (DOM.showRangeLegend) DOM.showRangeLegend.checked = !!STATE.showRangeLegend;
  if (DOM.rangeLegend) DOM.rangeLegend.classList.toggle("visible", !!STATE.showRangeLegend);

  if (DOM.ringVisibilityModeSelect) {
    DOM.ringVisibilityModeSelect.value = sanitizeRingVisibilityMode(STATE.ringVisibilityMode);
  }
  if (DOM.relativeModeSelect) DOM.relativeModeSelect.value = STATE.relativeOptions.mode;
  if (DOM.relativeIncludeAllies) DOM.relativeIncludeAllies.checked = STATE.relativeOptions.includeAllies;
  if (DOM.relativeIncludeEnemies)
    DOM.relativeIncludeEnemies.checked = STATE.relativeOptions.includeEnemies;
  if (DOM.relativeMaxTargets) DOM.relativeMaxTargets.value = String(STATE.relativeOptions.maxTargets);
}

const UI_SCHEDULER = createUiScheduler();
let ENTITY_LIST_PATCHER = null;
const LEGEND_KEY_DIRTY = "__dirty__";
let DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;
const DEBUG_LABEL_STACK = [];

// =========================================================================
// MATH HELPERS
// =========================================================================

function dist(a, b) {
  PERF_COUNTERS.distanceComputations++;

  const cached = DistanceCache.get(a.x, a.y, b.x, b.y);
  if (cached !== undefined) {
    return cached;
  }

  const dx = a.x - b.x;
  const dy = a.y - b.y;
  PERF_COUNTERS.sqrtCalls++;
  const distance = Math.sqrt(dx * dx + dy * dy);

  DistanceCache.set(a.x, a.y, b.x, b.y, distance);

  return distance;
}

function rad(deg) {
  return (deg * Math.PI) / 180;
}
function deg(rad) {
  return (rad * 180) / Math.PI;
}

const RING_PALETTE = resolveRingPalette();

// =========================================================================
// TARGETING HELPERS
// =========================================================================

function isEnemyForSelected(candidate, selected) {
  return !!candidate && candidate.id !== selected.id && candidate.team !== selected.team;
}

function pickNearestEnemyTarget(selected) {
  const enemies = STATE.entities
    .filter((entity) => isEnemyForSelected(entity, selected))
    .sort((a, b) => dist(a, selected) - dist(b, selected));
  return enemies[0] || null;
}

function ensureOutgoingTarget(selected) {
  const out = STATE.outgoingLock;
  const current = out.targetId ? STATE.entities.find((entity) => entity.id === out.targetId) : null;

  if (current && isEnemyForSelected(current, selected)) {
    return current;
  }

  const nextTarget = pickNearestEnemyTarget(selected);
  const prevTargetId = out.targetId;
  out.targetId = nextTarget ? nextTarget.id : null;
  out.trackingTime = 0;
  out.status = "NONE";
  out.quality = 0;

  if (nextTarget && prevTargetId !== nextTarget.id) {
    log(`Auto-targeting ID ${nextTarget.id}`, "INFO", "SYS");
  }

  return nextTarget;
}

let detectionTraceFrame = 0;

function writeDetectionSymmetryTrace(selected, target) {
  if (typeof window === "undefined" || !target) return;
  const distance = dist(target, selected);
  const threshold = CONFIG.get("DETECT_THRESH");
  const selectedSensorPower = CONFIG.get("SENSOR_STRENGTH") * (selected.sensorPower || 1);
  const targetSensorPower = CONFIG.get("SENSOR_STRENGTH") * (target.sensorPower || 1);
  const selectedToTargetScore = ImprovedSensorMath.computeDetectionScore(
    target.signature,
    selectedSensorPower,
    distance
  );
  const targetToSelectedScore = ImprovedSensorMath.computeDetectionScore(
    selected.signature,
    targetSensorPower,
    distance
  );
  const targetToSelectedDetected = ImprovedSensorMath.isDetected(targetToSelectedScore, threshold);

  detectionTraceFrame += 1;
  const frameSnapshot = {
    frame: detectionTraceFrame,
    selectedId: selected.id,
    targetId: target.id,
    distanceM: distance,
    threshold,
    units: "meters",
    selected: {
      signature: selected.signature,
      sensorPower: selectedSensorPower,
      radarActive: selected.radarActive,
      sensorMode: selected.sensorMode || "Active",
      team: selected.team
    },
    target: {
      signature: target.signature,
      sensorPower: targetSensorPower,
      radarActive: target.radarActive,
      sensorMode: target.sensorMode || "Active",
      team: target.team
    },
    selectedToTarget: {
      score: selectedToTargetScore,
      detected: target.detected
    },
    targetToSelected: {
      score: targetToSelectedScore,
      detected: targetToSelectedDetected
    },
    updateOrder: "entityDetectionThenLocks",
    cache: {
      distanceCacheEnabled: true
    }
  };

  window.__detectionDebug = frameSnapshot;
  if (!Array.isArray(window.__detectionDebugFrames)) {
    window.__detectionDebugFrames = [];
  }
  window.__detectionDebugFrames.push(frameSnapshot);
  if (window.__detectionDebugFrames.length > 120) {
    window.__detectionDebugFrames.shift();
  }
}

// =========================================================================
// LOCK UPDATE FUNCTION
// =========================================================================

function updateLocks() {
  const selected = STATE.getSelected();
  if (!selected) return;

  const out = STATE.outgoingLock;
  const target = ensureOutgoingTarget(selected);

  if (target && target.detected) {
    out.trackingTime += STATE._last_dt || 0.016;
    const targetVel = {
      x: Math.cos(target.heading) * target.speed,
      y: Math.sin(target.heading) * target.speed,
      z: 0
    };
    const ctrlVel = { x: selected.vx, y: selected.vy, z: 0 };
    const angRes = ImprovedSensorMath.computeAngularVelocity(
      { x: target.x, y: target.y, z: 0 },
      targetVel,
      { x: selected.x, y: selected.y, z: 0 },
      ctrlVel
    );
    const angVel = angRes[0];
    const lockResult = ImprovedSensorMath.computeLockState(
      target.detectionScore,
      angVel,
      out.trackingTime,
      CONFIG.get("TRACKING_SPEED")
    );
    out.status = lockResult.state;
    out.quality = lockResult.quality;
  } else {
    out.trackingTime = Math.max(0, out.trackingTime - (STATE._last_dt || 0.016) * 2);
    out.status = "NONE";
    out.quality = 0;
  }
  writeDetectionSymmetryTrace(selected, target);
  if (out.status !== out.prevStatus) {
    log(`OutgoingLock: ${out.status} [${Math.round(out.quality * 100)}%]`, "LOCK", "SYS");
    out.prevStatus = out.status;
  }

  STATE.incomingLocks = [];
  STATE.entities.forEach((src) => {
    if (src === selected) return;
    if (src.team === selected.team) return;

    const sourceSensorMultiplier = src.sensorPower !== undefined ? Number(src.sensorPower) : 1.0;
    const sourceSensorPower = CONFIG.get("SENSOR_STRENGTH") * sourceSensorMultiplier;
    const distance = dist(src, selected);
    const detectionScoreOnSelected = ImprovedSensorMath.computeDetectionScore(
      selected.signature,
      sourceSensorPower,
      distance
    );

    if (detectionScoreOnSelected >= CONFIG.get("DETECT_THRESH")) {
      const srcVel = {
        x: Math.cos(src.heading) * src.speed,
        y: Math.sin(src.heading) * src.speed,
        z: 0
      };
      const ctrlVel = { x: selected.vx, y: selected.vy, z: 0 };
      const angRes = ImprovedSensorMath.computeAngularVelocity(
        { x: selected.x, y: selected.y, z: 0 },
        ctrlVel,
        { x: src.x, y: src.y, z: 0 },
        srcVel
      );
      const angVelSrc = angRes[0];

      src._incomingTrackingTime = Math.max(
        0,
        (src._incomingTrackingTime || 0) + (STATE._last_dt || 0.016)
      );
      const lockOnSelected = ImprovedSensorMath.computeLockState(
        detectionScoreOnSelected,
        angVelSrc,
        src._incomingTrackingTime,
        CONFIG.get("TRACKING_SPEED")
      );

      STATE.incomingLocks.push({
        sourceId: src.id,
        targetId: selected.id,
        status: lockOnSelected.state,
        quality: lockOnSelected.quality,
        detectionScore: detectionScoreOnSelected
      });

      if (src._prevIncomingStatus !== lockOnSelected.state) {
        log(
          `IncomingLockFrom: ${src.id} => ${lockOnSelected.state} [${Math.round(lockOnSelected.quality * 100)}%]`,
          "LOCK",
          "SYS"
        );
        src._prevIncomingStatus = lockOnSelected.state;
      }
    } else {
      src._incomingTrackingTime = Math.max(
        0,
        (src._incomingTrackingTime || 0) - (STATE._last_dt || 0.016) * 2
      );
      if (src._incomingTrackingTime <= 0) {
        src._incomingTrackingTime = 0;
        if (src._prevIncomingStatus && src._prevIncomingStatus !== "NONE") {
          log(`IncomingLockFrom: ${src.id} LOST`, "LOCK", "SYS");
        }
        src._prevIncomingStatus = "NONE";
      }
    }
  });
}

// =========================================================================
// SIMULATION LOOP
// =========================================================================

let lastTime = 0;

function loop(time) {
  requestAnimationFrame(loop);

  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  if (!STATE.playing) return;

  STATE._last_dt = dt;

  const selected = STATE.getSelected();

  if (selected) {
    selected.update(dt);
  }

  STATE.entities.forEach((entity) => {
    if (selected && entity.id === selected.id) return;

    const vx = Math.cos(entity.heading) * entity.speed;
    const vy = Math.sin(entity.heading) * entity.speed;

    entity.x += vx * dt;
    entity.y += vy * dt;

    const velocityRatio = entity.speed / 200;
    entity.weaponActivityLevel = calculateWeaponActivity(entity);
    entity.activityLevel = ImprovedSensorMath.computeActivityLevel(
      velocityRatio,
      entity.weaponActivityLevel,
      entity.radarActive
    );

    entity.signature = ImprovedSensorMath.computeSignature(entity.shipType, entity.activityLevel);

    if (selected) {
      const distance = dist(entity, selected);
      const effectiveSensorPower = CONFIG.get("SENSOR_STRENGTH") * selected.sensorPower;
      entity.detectionScore = ImprovedSensorMath.computeDetectionScore(
        entity.signature,
        effectiveSensorPower,
        distance
      );
      entity.detected = ImprovedSensorMath.isDetected(
        entity.detectionScore,
        CONFIG.get("DETECT_THRESH")
      );

      if (entity.detected) {
        const targetVel = { x: vx, y: vy, z: 0 };
        const observerVel = { x: selected.vx, y: selected.vy, z: 0 };
        const observerPos = { x: selected.x, y: selected.y, z: 0 };
        const tgtPos = { x: entity.x, y: entity.y, z: 0 };

        const angRes = ImprovedSensorMath.computeAngularVelocity(
          tgtPos,
          targetVel,
          observerPos,
          observerVel
        );
        entity.angularVelocity = angRes[0];

        const angVelWithECM = entity.angularVelocity * (1 + entity.ecm * CONFIG.get("ECM_SCALE"));

        const weapon = getPrimaryWeapon(selected);
        if (weapon && selected.weaponsFiringBool()) {
          const dx = entity.x - selected.x;
          const dy = entity.y - selected.y;
          const distSq = dx * dx + dy * dy;

          const lockQuality =
            entity.id === STATE.outgoingLock.targetId ? STATE.outgoingLock.quality : 0;

          entity.hitProbability = computeHitProbOptimized(
            weapon,
            distSq,
            angVelWithECM,
            lockQuality
          );

          entity._weaponDistFactor = 1.0 / (1.0 + distSq * weapon.invRangeSq);
          const angRatio = angVelWithECM * weapon.invTracking;
          let penalty = Math.max(0, angRatio - 1.0) * weapon.trackingSensitivity;
          if (penalty > 1.0) penalty = 1.0;
          entity._weaponTrackFactor = 1.0 - penalty * penalty;
        } else {
          entity.hitProbability = 0;
          entity._weaponDistFactor = 0;
          entity._weaponTrackFactor = 0;
        }
      } else {
        entity.angularVelocity = 0;
        entity.hitProbability = 0;
        entity._weaponDistFactor = 0;
        entity._weaponTrackFactor = 0;
      }
    }
  });

  updateLocks();
  render();

  const hudInterval = STATE.telemetryEnabled ? 1 : 3;
  STATE._hudUpdateCounter++;
  if (STATE._hudUpdateCounter >= hudInterval) {
    STATE._hudUpdateCounter = 0;
    UI_SCHEDULER.mark("dirtyHUD", "dirtyEntityList");
  }

  STATE._panelUpdateCounter++;
  if (STATE._panelUpdateCounter >= 6) {
    STATE._panelUpdateCounter = 0;
    UI_SCHEDULER.mark("dirtyWeaponPanel");
  }

  UI_SCHEDULER.flush({
    dirtyHUD: () => updateHUD(),
    dirtyEntityList: () => refreshEntityList(),
    dirtyLegend: () => {
      DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;
      if (!STATE.showRangeRings && STATE.showRangeLegend) {
        renderLegendWhenRingsDisabled();
      }
    },
    dirtyWeaponPanel: () => {
      updateEntityControlInfo();
      updateWeaponInfo();
    }
  });
}

// =========================================================================
// RENDERING
// =========================================================================

// HELPER: GET PRIMARY WEAPON
function getPrimaryWeapon(entity) {
  if (!entity || !entity.weapons || entity.weapons.length === 0) return null;
  const activeSlot = entity.weapons.find((slot) => slot.active && (slot.count || 0) > 0);
  if (!activeSlot) return null;
  return BAKED_WEAPONS[activeSlot.weaponId];
}

let canvasW, canvasH;
const GRID_CELL_SIZE_M = 1000;

function getShipScreenSizePx(entity) {
  return computeShipRenderSizePx(entity.getShipSizeMeters(), STATE.zoom);
}

function getShipInteractionRadiusPx(entity) {
  return Math.max(8, getShipScreenSizePx(entity) * 1.05);
}

function resizeCanvas() {
  const parent = DOM.canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  DOM.canvas.width = parent.clientWidth * dpr;
  DOM.canvas.height = parent.clientHeight * dpr;
  DOM.canvas.style.width = parent.clientWidth + "px";
  DOM.canvas.style.height = parent.clientHeight + "px";
  canvasW = parent.clientWidth;
  canvasH = parent.clientHeight;
  DOM.ctx.scale(dpr, dpr);
  updateZoomBounds();
}

function setZoom(nextZoom, renderNow = true) {
  if (!DOM.zoomSlider || !DOM.zoomValNum) return;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
  const changed = Math.abs(clamped - STATE.zoom) > 1e-9;
  STATE.zoom = clamped;
  syncZoomControls(DOM.zoomSlider, DOM.zoomValNum, STATE.zoom);
  UI_SCHEDULER.mark("dirtyLegend");
  if (renderNow && changed) render();
}

function updateZoomBounds() {
  if (!DOM.zoomSlider || !DOM.zoomValNum || !canvasW || !canvasH) return;
  configureZoomControls(DOM.zoomSlider, DOM.zoomValNum);
  setZoom(STATE.zoom, false);
}

function render() {
  DEBUG_LABEL_STACK.length = 0;

  const ctx = DOM.ctx;
  const cameraTarget = STATE.getSelected();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const cx = canvasW / 2;
  const cy = canvasH / 2;

  ctx.save();

  const playerOffsetX = cameraTarget ? -cameraTarget.x : 0;
  const playerOffsetY = cameraTarget ? -cameraTarget.y : 0;

  ctx.translate(cx + STATE.panX, cy + STATE.panY);
  ctx.scale(STATE.zoom, STATE.zoom);
  ctx.translate(playerOffsetX, playerOffsetY);

  const lw = 1 / STATE.zoom;
  ctx.lineWidth = lw;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";

  const viewLeft = -(cx + STATE.panX) / STATE.zoom - playerOffsetX;
  const viewTop = -(cy + STATE.panY) / STATE.zoom - playerOffsetY;
  const viewRight = (canvasW - (cx + STATE.panX)) / STATE.zoom - playerOffsetX;
  const viewBottom = (canvasH - (cy + STATE.panY)) / STATE.zoom - playerOffsetY;

  // World -> Screen helpers (uses current view and player offset)
  function worldToScreen(x, y) {
    return {
      x: (x + playerOffsetX) * STATE.zoom + cx + STATE.panX,
      y: (y + playerOffsetY) * STATE.zoom + cy + STATE.panY
    };
  }
  function worldToScreenRadius(meters) {
    return meters * STATE.zoom;
  }

  const startX = Math.floor(viewLeft / GRID_CELL_SIZE_M) * GRID_CELL_SIZE_M;
  const startY = Math.floor(viewTop / GRID_CELL_SIZE_M) * GRID_CELL_SIZE_M;

  ctx.beginPath();
  for (let x = startX; x <= viewRight; x += GRID_CELL_SIZE_M) {
    ctx.moveTo(x, viewTop);
    ctx.lineTo(x, viewBottom);
  }
  for (let y = startY; y <= viewBottom; y += GRID_CELL_SIZE_M) {
    ctx.moveTo(viewLeft, y);
    ctx.lineTo(viewRight, y);
  }
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.font = `${Math.max(8, Math.floor(11 / STATE.zoom))}px monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const xLabelY = viewTop + 6 / STATE.zoom;
  for (let x = startX; x <= viewRight; x += GRID_CELL_SIZE_M) {
    ctx.fillText(`${Math.round(x / 1000)} km`, x, xLabelY);
  }
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const yLabelX = viewLeft + 8 / STATE.zoom;
  for (let y = startY; y <= viewBottom; y += GRID_CELL_SIZE_M) {
    ctx.fillText(`${Math.round(y / 1000)} km`, yLabelX, y);
  }
  ctx.restore();

  if (STATE.showRangeRings) {
    renderWeaponRings(
      ctx,
      viewLeft,
      viewTop,
      viewRight,
      viewBottom,
      worldToScreen,
      worldToScreenRadius
    );
  } else if (STATE.showRangeLegend && DYNAMIC_LEGEND_KEY !== "rings-disabled") {
    DYNAMIC_LEGEND_KEY = "rings-disabled";
    renderLegendWhenRingsDisabled();
  }

  const teamClusters = {};
  STATE.entities.forEach((e) => {
    if (!teamClusters[e.team]) teamClusters[e.team] = [];
    teamClusters[e.team].push(e);
  });

  const clusterRadius = 2000;
  const allClusters = [];

  Object.keys(teamClusters).forEach((team) => {
    const entities = teamClusters[team];
    if (entities.length < 2) return;

    const claimed = new Set();

    entities.forEach((e, i) => {
      if (claimed.has(i)) return;

      const cluster = {
        team: team,
        centerX: e.x,
        centerY: e.y,
        count: 1,
        members: [i]
      };
      claimed.add(i);

      entities.forEach((other, j) => {
        if (i === j || claimed.has(j)) return;
        const dx = e.x - other.x;
        const dy = e.y - other.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d <= clusterRadius) {
          cluster.count++;
          cluster.members.push(j);
          claimed.add(j);
          cluster.centerX = (cluster.centerX * (cluster.count - 1) + other.x) / cluster.count;
          cluster.centerY = (cluster.centerY * (cluster.count - 1) + other.y) / cluster.count;
        }
      });

      if (cluster.count > 1) {
        allClusters.push(cluster);
      }
    });
  });

  ctx.font = `${Math.floor(16 / STATE.zoom)}px monospace`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 3 / STATE.zoom;

  allClusters.forEach((cluster) => {
    const text = `[${cluster.count}]`;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 16 / STATE.zoom;

    ctx.strokeText(
      text,
      cluster.centerX - textWidth / 2,
      cluster.centerY - textHeight - 10 / STATE.zoom
    );
    ctx.fillText(
      text,
      cluster.centerX - textWidth / 2,
      cluster.centerY - textHeight - 10 / STATE.zoom
    );
  });

  if (STATE.outgoingLock.status !== "NONE" && STATE.outgoingLock.targetId) {
    const target = STATE.entities.find((e) => e.id === STATE.outgoingLock.targetId);
    const ctrl = STATE.getSelected();
    if (target && ctrl) {
      ctx.strokeStyle = RING_PALETTE.lockVector;
      ctx.globalAlpha = STATE.outgoingLock.status === "LOCKED" ? 0.9 : 0.55;
      ctx.lineWidth = 2 / STATE.zoom;
      const lockDash = RING_SEMANTICS.lockVector.lineDash;
      ctx.setLineDash(lockDash.map((value) => value / STATE.zoom));
      ctx.beginPath();
      ctx.moveTo(ctrl.x, ctrl.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();

  STATE.entities.forEach((e) => {
    const isSelected = e.id === STATE.selectedId;
    const teamColor = TEAM_COLORS[e.team] || TEAM_COLORS[TEAMS.NEUTRAL];
    const sc = worldToScreen(e.x, e.y);
    const size = getShipScreenSizePx(e);

    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.rotate(e.heading);
    const fillAlpha = e.detected ? 0.6 : 0.3;
    const fill = teamColor.fill.replace(/0\.35\)/, `${fillAlpha})`);
    ctx.fillStyle = fill;
    ctx.strokeStyle = teamColor.stroke;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, size * 0.5);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size * 0.6, -size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (STATE.telemetryEnabled && e.detected) {
      const label = buildDebugLabel(e);
      queueDebugLabel(sc.x, sc.y - (size + 15), label);
    }
  });

  renderDebugLabels(ctx);
}

function renderWeaponRings(
  ctx,
  viewLeft,
  viewTop,
  viewRight,
  viewBottom,
  worldToScreen,
  worldToScreenRadius
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const withinView = (entity, radius) => {
    const left = entity.x - radius;
    const right = entity.x + radius;
    const top = entity.y - radius;
    const bottom = entity.y + radius;
    return !(right < viewLeft || left > viewRight || bottom < viewTop || top > viewBottom);
  };

  const ringModel = buildRingModel({
    entities: STATE.entities,
    selectedId: STATE.selectedId,
    hoveredId: STATE.hoveredId,
    ringVisibilityMode: STATE.ringVisibilityMode,
    relativeOptions: STATE.relativeOptions,
    sensorStrength: CONFIG.get("SENSOR_STRENGTH"),
    detectThreshold: CONFIG.get("DETECT_THRESH"),
    bakedWeapons: BAKED_WEAPONS,
    dist: (a, b) => dist(a, b),
    computeDetectionRange: (signature, sensorPower, detectThreshold) =>
      ImprovedSensorMath.computeDetectionRange(signature, sensorPower, detectThreshold)
  });

  if (DOM.canvas) DOM.canvas.dataset.ringDigest = ringModel.digest || "no-visible-rings";
  if (DOM.legendContent)
    DOM.legendContent.dataset.ringDigest = ringModel.digest || "no-visible-rings";

  if (STATE.showRangeLegend) {
    const nextKey = ringModel.digest;
    if (nextKey !== DYNAMIC_LEGEND_KEY || UI_SCHEDULER.dirty.dirtyLegend) {
      DYNAMIC_LEGEND_KEY = nextKey;
      renderRingLegend(ringModel);
    }
  }

  ringModel.rings.forEach((ring) => {
    if (!withinView({ x: ring.ownerX, y: ring.ownerY }, ring.radiusM)) return;
    const screenRadius = worldToScreenRadius(ring.radiusM);
    if (screenRadius < 1) return;

    const sc = worldToScreen(ring.ownerX, ring.ownerY);
    ctx.save();
    ctx.strokeStyle = colorForToken(ring.colorToken);
    ctx.globalAlpha = ring.opacity;
    ctx.lineWidth = ring.lineWidth;
    ctx.setLineDash(ring.lineDash);
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, screenRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (STATE.telemetryEnabled && ring.focus === "selected") {
      const labelX = sc.x + screenRadius / Math.SQRT2;
      const labelY = sc.y - screenRadius / Math.SQRT2;
      const labelText = `${ring.label} (${(ring.radiusM / 1000).toFixed(2)} km)`;

      ctx.save();
      ctx.font = "11px monospace";
      const metrics = ctx.measureText(labelText);
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(labelX + 5, labelY - 8, metrics.width + 4, 14);
      ctx.fillStyle = colorForToken(ring.colorToken);
      ctx.fillText(labelText, labelX + 7, labelY + 3);
      ctx.restore();
    }
  });

  ctx.restore();
}

function buildDebugLabel(entity) {
  const player = STATE.getSelected();
  if (!player) return "";

  const distKm = (dist(entity, player) / 1000).toFixed(1);
  const sig = Math.round(entity.signature);
  const det = Math.round(entity.detectionScore);
  const spd = Math.round(entity.speed);
  const lock = entity.id === STATE.outgoingLock.targetId ? `[${STATE.outgoingLock.status}]` : "";
  const hitProb = (entity.hitProbability * 100).toFixed(0);
  const weapAct = ((entity.weaponActivityLevel || 0) * 100).toFixed(0);

  return `ID:${entity.id} ${entity.shipType.substring(0, 8)} | ${distKm}km | S:${sig} D:${det} V:${spd}m/s WA:${weapAct}% H:${hitProb}% ${lock}`.trim();
}

function queueDebugLabel(x, y, text) {
  DEBUG_LABEL_STACK.push({ x, y, text });
}

function renderDebugLabels(ctx) {
  if (DEBUG_LABEL_STACK.length === 0) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  ctx.font = "10px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 3;

  DEBUG_LABEL_STACK.forEach((label) => {
    ctx.strokeText(label.text, label.x, label.y);
    ctx.fillText(label.text, label.x, label.y);
  });

  ctx.restore();
}

// =========================================================================
// HUD UPDATE
// =========================================================================

function updateHUD() {
  const player = STATE.getSelected();

  if (player && DOM.hudSelectedPos) {
    const px = (player.x / 1000).toFixed(1);
    const py = (player.y / 1000).toFixed(1);
    DOM.hudSelectedPos.innerText = `${px}km, ${py}km`;
  }

  if (DOM.hudContacts) {
    DOM.hudContacts.innerText = STATE.entities.length - 1;
  }

  if (DOM.hudLockOutgoing) {
    const out = STATE.outgoingLock;
    const quality = Math.round(out.quality * 100);
    DOM.hudLockOutgoing.innerText = `${out.status} (${quality}%)`;
    DOM.hudLockOutgoing.style.color = out.status === "LOCKED" ? "var(--warning)" : "var(--accent)";
  }

  if (DOM.hudLockIncoming) {
    const incoming = STATE.incomingLocks.filter((l) => l.status !== "NONE");
    if (incoming.length > 0) {
      const locked = incoming.filter((l) => l.status === "LOCKED").length;
      const tracking = incoming.filter(
        (l) => l.status === "TRACKING" || l.status === "ACQUIRING"
      ).length;
      DOM.hudLockIncoming.innerText = `${locked} LOCKED, ${tracking} TRACKING`;
      DOM.hudLockIncoming.style.color = locked > 0 ? "var(--danger)" : "var(--warning)";
    } else {
      DOM.hudLockIncoming.innerText = "NONE";
      DOM.hudLockIncoming.style.color = "var(--success)";
    }
  }

  if (player && DOM.hudWeaponName) {
    const weapon = getPrimaryWeapon(player);
    DOM.hudWeaponName.innerText = weapon ? weapon.name : "NONE";
  }

  if (player && DOM.hudHitProb) {
    const target = STATE.outgoingLock.targetId
      ? STATE.entities.find((e) => e.id === STATE.outgoingLock.targetId)
      : null;
    if (target && target.detected && player.weaponsFiringBool()) {
      const hitProb = (target.hitProbability * 100).toFixed(1);
      DOM.hudHitProb.innerText = `${hitProb}%`;
      DOM.hudHitProb.style.color = target.hitProbability > 0.5 ? "var(--success)" : "var(--warning)";
    } else {
      DOM.hudHitProb.innerText = "0%";
      DOM.hudHitProb.style.color = "var(--text-dim)";
    }
  }

  const locked = STATE.incomingLocks.some((l) => l.status === "LOCKED");
  if (DOM.threatWarning) {
    DOM.threatWarning.classList.toggle("visible", locked);
    DOM.threatWarning.setAttribute("aria-hidden", locked ? "false" : "true");
  }

  if (DOM.hudSelection && STATE.selectedId) {
    const e = STATE.entities.find((x) => x.id === STATE.selectedId);
    if (e) {
      DOM.hudSelection.innerText = `Selected: ${e.shipType} (ID:${e.id})`;
    }
  } else if (DOM.hudSelection) {
    DOM.hudSelection.innerText = "";
  }
}

function colorForToken(token) {
  return RING_PALETTE[token] || "#ffffff";
}

function renderRingLegend(model) {
  if (!DOM.rangeLegend || !DOM.legendStatic || !DOM.legendContent || !DOM.legendDiagnostics) return;

  renderLegendRows(
    DOM.legendStatic,
    model.staticLegendRows.map((row) => ({ ...row, color: colorForToken(row.colorToken) }))
  );
  renderLegendRows(
    DOM.legendContent,
    model.dynamicLegendRows.map((row) => ({ ...row, color: colorForToken(row.colorToken) }))
  );
  renderLegendDiagnostics(DOM.legendDiagnostics, model.diagnostics);

  DOM.legendContent.dataset.ringDigest = model.digest || "no-visible-rings";
  if (DOM.canvas) DOM.canvas.dataset.ringDigest = model.digest || "no-visible-rings";
}

function renderLegendWhenRingsDisabled() {
  if (!DOM.legendStatic || !DOM.legendContent || !DOM.legendDiagnostics) return;
  const rows = Object.values(RING_SEMANTICS).map((definition) => ({
    key: `static:${definition.type}`,
    semanticType: definition.type,
    label: definition.label,
    meaning: definition.visibleWhen,
    colorToken: definition.colorToken,
    lineDash: definition.lineDash,
    color: colorForToken(definition.colorToken)
  }));
  renderLegendRows(DOM.legendStatic, rows);
  renderLegendRows(DOM.legendContent, []);
  renderLegendDiagnostics(DOM.legendDiagnostics, [
    "Range rings are hidden. Enable 'Show Range Rings' to view live ring data."
  ]);
  DOM.legendContent.dataset.ringDigest = "rings-disabled";
  if (DOM.canvas) DOM.canvas.dataset.ringDigest = "rings-disabled";
}

function updateWeaponInfo() {
  const entity = STATE.entities.find((e) => e.id === STATE.selectedId);

  if (!entity || !DOM.weaponInfoPanel) return;

  const primaryWeapon = getPrimaryWeapon(entity);

  if (primaryWeapon) {
    DOM.weaponInfoPanel.style.display = "block";
    DOM.weaponNameDisplay.textContent = primaryWeapon.name;
    DOM.weaponAccuracyDisplay.textContent = (primaryWeapon.baseAccuracy * 100).toFixed(0) + "%";
    DOM.weaponRangeDisplay.textContent = (primaryWeapon.maxRangeM / 1000).toFixed(1) + " km";
    DOM.weaponActivityWeightDisplay.textContent = primaryWeapon.baseActivityWeight;
    DOM.weaponTrackingDisplay.textContent =
      primaryWeapon.originalConfig.trackingSpeed.toFixed(3) + " rad/s";
    DOM.weaponGuidanceDisplay.textContent = primaryWeapon.guidance.toUpperCase();
    DOM.weaponSensitivityDisplay.textContent =
      primaryWeapon.originalConfig.trackingSensitivity.toFixed(1);

    const target = STATE.outgoingLock.targetId
      ? STATE.entities.find((e) => e.id === STATE.outgoingLock.targetId)
      : null;
    if (target && target.detected && entity.weaponsFiringBool()) {
      DOM.weaponDistFactor.textContent = (target._weaponDistFactor * 100).toFixed(1) + "%";
      DOM.weaponTrackFactor.textContent = (target._weaponTrackFactor * 100).toFixed(1) + "%";
      DOM.weaponHitProbDisplay.textContent = (target.hitProbability * 100).toFixed(1) + "%";
      DOM.weaponHitProbDisplay.style.color =
        target.hitProbability > 0.5 ? "var(--success)" : "var(--warning)";
    } else {
      DOM.weaponDistFactor.textContent = "0%";
      DOM.weaponTrackFactor.textContent = "0%";
      DOM.weaponHitProbDisplay.textContent = "0%";
      DOM.weaponHitProbDisplay.style.color = "var(--text-dim)";
    }
  } else {
    DOM.weaponInfoPanel.style.display = "none";
  }
}

// =========================================================================
// INPUT HANDLERS
// =========================================================================

function setupInputHandlers() {
  let isDragging = false;
  let dragStartX = 0,
    dragStartY = 0;

  DOM.canvas.addEventListener("mousedown", (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isDragging = true;
      dragStartX = e.clientX - STATE.panX;
      dragStartY = e.clientY - STATE.panY;
      e.preventDefault();
    } else if (e.button === 0) {
      const rect = DOM.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const cx = canvasW / 2;
      const cy = canvasH / 2;
      const cam = STATE.getSelected();
      const playerOffsetX = cam ? -cam.x : 0;
      const playerOffsetY = cam ? -cam.y : 0;

      let closestEntity = null;
      let closestDist = Infinity;

      STATE.entities.forEach((e) => {
        const sx = (e.x + playerOffsetX) * STATE.zoom + cx + STATE.panX;
        const sy = (e.y + playerOffsetY) * STATE.zoom + cy + STATE.panY;
        const dx = sx - mx;
        const dy = sy - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        const pickRadiusPx = getShipInteractionRadiusPx(e);
        if (d < closestDist && d < pickRadiusPx) {
          closestDist = d;
          closestEntity = e;
        }
      });

      if (closestEntity) {
        selectEntity(closestEntity.id);
      }
    }
  });

  DOM.canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
      STATE.panX = e.clientX - dragStartX;
      STATE.panY = e.clientY - dragStartY;
      UI_SCHEDULER.mark("dirtyLegend");
      return;
    }

    const rect = DOM.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const cam = STATE.getSelected();
    const playerOffsetX = cam ? -cam.x : 0;
    const playerOffsetY = cam ? -cam.y : 0;
    let hoveredId = null;
    let hoveredDist = Infinity;
    STATE.entities.forEach((ent) => {
      const sx = (ent.x + playerOffsetX) * STATE.zoom + cx + STATE.panX;
      const sy = (ent.y + playerOffsetY) * STATE.zoom + cy + STATE.panY;
      const dx = sx - mx;
      const dy = sy - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      const hoverRadiusPx = getShipInteractionRadiusPx(ent);
      if (d < hoveredDist && d < hoverRadiusPx) {
        hoveredDist = d;
        hoveredId = ent.id;
      }
    });

    if (hoveredId !== STATE.hoveredId) {
      STATE.hoveredId = hoveredId;
      UI_SCHEDULER.mark("dirtyLegend");
    }
  });

  DOM.canvas.addEventListener("mouseup", () => {
    isDragging = false;
  });

  DOM.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    setZoom(applyWheelZoom(STATE.zoom, e.deltaY));
  });

  DOM.zoomSlider.addEventListener("input", (e) => {
    setZoom(parseZoomFromSlider(e.target.value, STATE.zoom));
  });
  attachSafeNumberInput(
    DOM.zoomValNum,
    { min: ZOOM_MIN, max: ZOOM_MAX, step: 0.001, fallback: STATE.zoom },
    (value) => {
      setZoom(parseZoomFromNumber(String(value), STATE.zoom));
    }
  );

  DOM.telemetryToggle.addEventListener("change", (e) => {
    STATE.telemetryEnabled = !!e.target.checked;
    syncOverlayControls();
    UI_SCHEDULER.mark("dirtyHUD", "dirtyLegend");
    render();
  });

  if (DOM.ringVisibilityModeSelect) {
    DOM.ringVisibilityModeSelect.addEventListener("change", (e) => {
      STATE.ringVisibilityMode = sanitizeRingVisibilityMode(
        e.target.value,
        sanitizeRingVisibilityMode(STATE.ringVisibilityMode)
      );
      if (DOM.ringVisibilityModeSelect.value !== STATE.ringVisibilityMode) {
        DOM.ringVisibilityModeSelect.value = STATE.ringVisibilityMode;
      }
      UI_SCHEDULER.mark("dirtyLegend");
      render();
    });
  }

  if (DOM.relativeModeSelect) {
    DOM.relativeModeSelect.addEventListener("change", (e) => {
      STATE.relativeOptions.mode = e.target.value;
      UI_SCHEDULER.mark("dirtyLegend");
      render();
    });
  }
  if (DOM.relativeIncludeAllies) {
    DOM.relativeIncludeAllies.addEventListener("change", (e) => {
      STATE.relativeOptions.includeAllies = e.target.checked;
      UI_SCHEDULER.mark("dirtyLegend");
      render();
    });
  }
  if (DOM.relativeIncludeEnemies) {
    DOM.relativeIncludeEnemies.addEventListener("change", (e) => {
      STATE.relativeOptions.includeEnemies = e.target.checked;
      UI_SCHEDULER.mark("dirtyLegend");
      render();
    });
  }
  if (DOM.relativeMaxTargets) {
    attachSafeNumberInput(
      DOM.relativeMaxTargets,
      { min: 1, max: 50, step: 1, fallback: STATE.relativeOptions.maxTargets || 5 },
      (value) => {
        STATE.relativeOptions.maxTargets = Math.round(value);
        DOM.relativeMaxTargets.value = String(Math.round(value));
        UI_SCHEDULER.mark("dirtyLegend");
        render();
      }
    );
  }

  DOM.showRangeRings.addEventListener("change", (e) => {
    STATE.showRangeRings = e.target.checked;
    DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;
    if (!STATE.showRangeRings && STATE.showRangeLegend) {
      renderLegendWhenRingsDisabled();
    }
    UI_SCHEDULER.mark("dirtyLegend");
    render();
  });

  DOM.showRangeLegend.addEventListener("change", (e) => {
    STATE.showRangeLegend = e.target.checked;
    if (DOM.rangeLegend) {
      DOM.rangeLegend.classList.toggle("visible", e.target.checked);
      if (!e.target.checked && DOM.legendDiagnostics) {
        DOM.legendDiagnostics.innerHTML = "";
      }
    }
    if (e.target.checked) {
      DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;
      if (!STATE.showRangeRings) renderLegendWhenRingsDisabled();
    }
    UI_SCHEDULER.mark("dirtyLegend");
    render();
  });

  document.getElementById("btn-play").addEventListener("click", () => {
    STATE.playing = !STATE.playing;
    document.getElementById("btn-play").innerText = STATE.playing ? "Pause" : "Play";
  });

  document.getElementById("btn-step").addEventListener("click", () => {
    if (!STATE.playing) {
      loop(performance.now());
    }
  });

  document.getElementById("btn-reset").addEventListener("click", resetSim);
  document.getElementById("btn-spawn").addEventListener("click", spawnEntity);
  document.getElementById("btn-telemetry-toggle").addEventListener("click", () => {
    DOM.telemetryToggle.checked = !DOM.telemetryToggle.checked;
    DOM.telemetryToggle.dispatchEvent(new Event("change"));
  });

  document.getElementById("btn-test-preset").addEventListener("click", () => {
    document.getElementById("import-modal").style.display = "flex";
  });

  document.getElementById("btn-assumptions").addEventListener("click", () => {
    document.getElementById("assumptions-modal").style.display = "flex";
  });

  const assumptionsCloseBtn = document.getElementById("btn-assumptions-close");
  if (assumptionsCloseBtn) {
    assumptionsCloseBtn.addEventListener("click", () => {
      document.getElementById("assumptions-modal").style.display = "none";
    });
  }

  const importCancelBtn = document.getElementById("btn-import-cancel");
  if (importCancelBtn) {
    importCancelBtn.addEventListener("click", () => {
      document.getElementById("import-modal").style.display = "none";
    });
  }

  document.getElementById("btn-export").addEventListener("click", async () => {
    await import("./features/importExport");
    exportState();
  });
  document.getElementById("btn-run-tests").addEventListener("click", async () => {
    await import("./features/perfHarness");
    runPerfTests();
  });
  document.getElementById("btn-import-confirm").addEventListener("click", async () => {
    await import("./features/importExport");
    importState();
  });
  document.getElementById("btn-save-profile").addEventListener("click", saveCustomProfile);
  const customProfileSigInput = document.getElementById("custom-profile-sig");
  if (customProfileSigInput instanceof HTMLInputElement) {
    attachSafeNumberInput(
      customProfileSigInput,
      { min: 1, max: 200, step: 1, fallback: 20 },
      (value) => {
        customProfileSigInput.value = formatNumber(value, 1);
      }
    );
  }
  const customProfileGainInput = document.getElementById("custom-profile-gain");
  if (customProfileGainInput instanceof HTMLInputElement) {
    attachSafeNumberInput(
      customProfileGainInput,
      { min: 0.1, max: 5, step: 0.1, fallback: 1.5 },
      (value) => {
        customProfileGainInput.value = formatNumber(value, 0.1);
      }
    );
  }
  const fitBtn = document.getElementById("btn-fit-grid");
  if (fitBtn) {
    fitBtn.addEventListener("click", () => {
      setZoom(ZOOM_MIN);
    });
  }

  setupEntityControlHandlers();
}

function setupEntityControlHandlers() {
  createDualInputSync(DOM.entityVel, DOM.entityVelNum, (val) => {
    const entity = STATE.entities.find((e) => e.id === STATE.selectedId);
    if (entity) {
      entity.speed = val;
      UI_SCHEDULER.mark("dirtyHUD", "dirtyWeaponPanel");
    }
  });

  createDualInputSync(DOM.entityHead, DOM.entityHeadNum, (val) => {
    const entity = STATE.entities.find((e) => e.id === STATE.selectedId);
    if (entity) {
      entity.heading = rad(val);
      UI_SCHEDULER.mark("dirtyHUD", "dirtyWeaponPanel");
    }
  });

  const addSlotBtn = document.getElementById("btn-add-weapon-slot");
  if (addSlotBtn) {
    addSlotBtn.addEventListener("click", addWeaponSlot);
  }

  document.getElementById("btn-sensor-active").addEventListener("click", () => {
    const entity = STATE.entities.find((x) => x.id === STATE.selectedId);
    if (entity) {
      entity.sensorMode = "Active";
      updateSensorModeButtons();
    }
  });

  document.getElementById("btn-sensor-passive").addEventListener("click", () => {
    const entity = STATE.entities.find((x) => x.id === STATE.selectedId);
    if (entity) {
      entity.sensorMode = "Passive";
      updateSensorModeButtons();
    }
  });

  createDualInputSync(DOM.entitySensorPower, DOM.entitySensorPowerNum, (val) => {
    const entity = STATE.entities.find((x) => x.id === STATE.selectedId);
    if (entity) {
      entity.sensorPower = val;
      UI_SCHEDULER.mark("dirtyHUD", "dirtyLegend", "dirtyWeaponPanel");
    }
  });

  createDualInputSync(DOM.entityEcm, DOM.entityEcmNum, (val) => {
    const entity = STATE.entities.find((x) => x.id === STATE.selectedId);
    if (entity) {
      entity.ecm = val;
      UI_SCHEDULER.mark("dirtyHUD", "dirtyWeaponPanel");
    }
  });

  DOM.entityShipType.addEventListener("change", (e) => {
    const entity = STATE.entities.find((x) => x.id === STATE.selectedId);
    if (entity) {
      entity.shipType = e.target.value;
      const profile = ImprovedSensorMath.getShipProfile(e.target.value);
      entity.shipSizeM = resolveShipSizeMeters(profile.sizeM, profile.size, SHIP_SIZE_M_DEFAULT);
      DOM.entityProfileDesc.textContent = profile.description;
      const tag =
        entity.team === TEAMS.ALPHA ? "ALPHA" : entity.team === TEAMS.BETA ? "BETA" : "ENT";
      log(`Entity ${entity.id} ship type changed to ${e.target.value}`, "INFO", tag);
      UI_SCHEDULER.mark("dirtyEntityList", "dirtyWeaponPanel");
    }
  });

  DOM.entityTeam.addEventListener("change", (e) => {
    const entity = STATE.entities.find((x) => x.id === STATE.selectedId);
    if (entity) {
      entity.team = e.target.value;
      const tag =
        entity.team === TEAMS.ALPHA ? "ALPHA" : entity.team === TEAMS.BETA ? "BETA" : "ENT";
      log(`Entity ${entity.id} team changed to ${e.target.value}`, "INFO", tag);
      refreshEntityList();
      UI_SCHEDULER.mark("dirtyEntityList", "dirtyLegend", "dirtyHUD");
    }
  });

  document.getElementById("default-ship-profile").addEventListener("change", (e) => {
    STATE.defaultShipType = e.target.value;
    const profile = ImprovedSensorMath.getShipProfile(e.target.value);
    document.getElementById("profile-description").textContent = profile.description;
    UI_SCHEDULER.mark("dirtyWeaponPanel");
  });

  document.getElementById("default-team").addEventListener("change", (e) => {
    STATE.defaultTeam = e.target.value;
  });

  document.getElementById("default-weapon").addEventListener("change", (e) => {
    STATE.defaultWeapon = e.target.value;
    DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;
    UI_SCHEDULER.mark("dirtyLegend");
    render();
  });
}

function updateSensorModeButtons() {
  const entity = STATE.entities.find((x) => x.id === STATE.selectedId);
  const active = document.getElementById("btn-sensor-active");
  const passive = document.getElementById("btn-sensor-passive");

  if (entity && entity.sensorMode === "Active") {
    active.classList.add("mode-active");
    passive.classList.remove("mode-active");
  } else {
    active.classList.remove("mode-active");
    passive.classList.add("mode-active");
  }
}

function createDualInputSync(sliderElem, numberElem, callback) {
  bindDualInput(sliderElem, numberElem, callback);
}

function ensureFormControlLabels() {
  const controls = document.querySelectorAll("input, select, textarea");
  controls.forEach((control) => {
    if (!(control instanceof HTMLElement)) return;
    if (control instanceof HTMLInputElement && control.type === "hidden") return;

    const hasAriaLabel = (control.getAttribute("aria-label") || "").trim().length > 0;
    const hasAriaLabelledBy = (control.getAttribute("aria-labelledby") || "").trim().length > 0;
    const wrappedByLabel = !!control.closest("label");
    const controlId = control.id;
    const explicitLabel = controlId ? document.querySelector(`label[for="${controlId}"]`) : null;

    if (hasAriaLabel || hasAriaLabelledBy || wrappedByLabel || explicitLabel) return;

    let labelText = "";
    const controlGroup = control.closest(".control-group");
    if (controlGroup) {
      const groupLabel = controlGroup.querySelector("label");
      if (groupLabel) {
        labelText = (groupLabel.textContent || "").replace(/\s+/g, " ").trim();
      }
    }

    if (!labelText && controlId) {
      labelText = controlId.replace(/[-_]/g, " ").trim();
    }

    if (labelText) {
      control.setAttribute("aria-label", labelText);
    }
  });
}

function saveCustomProfile() {
  const name = document.getElementById("custom-profile-name").value.trim();
  const sigInput = document.getElementById("custom-profile-sig");
  const gainInput = document.getElementById("custom-profile-gain");
  const sig = coerceNumberValue(sigInput.value, {
    min: 1,
    max: 200,
    step: 1,
    fallback: 20
  }).value;
  const gain = coerceNumberValue(gainInput.value, {
    min: 0.1,
    max: 5,
    step: 0.1,
    fallback: 1.5
  }).value;
  const sizeInput = document.getElementById("custom-profile-size");
  const sizeM = coerceNumberValue(sizeInput.value, {
    min: SHIP_SIZE_M_MIN,
    max: SHIP_SIZE_M_MAX,
    step: 250,
    fallback: SHIP_SIZE_M_DEFAULT
  }).value;
  const desc = document.getElementById("custom-profile-desc").value.trim();

  if (!name) {
    alert("Please enter a profile name");
    return;
  }

  sigInput.value = formatNumber(sig, 1);
  gainInput.value = formatNumber(gain, 0.1);
  sizeInput.value = formatNumber(sizeM, 250);

  const profile = {
    baseSignature: sig,
    activityGain: gain,
    sizeM,
    description: desc || "Custom profile"
  };

  if (ImprovedSensorMath.saveCustomProfile(name, profile)) {
    log(`Custom profile "${name}" saved`, "INFO", "SYS");
    populateShipSelects();
    document.getElementById("custom-profile-name").value = "";
    document.getElementById("custom-profile-sig").value = "20";
    document.getElementById("custom-profile-gain").value = "1.5";
    document.getElementById("custom-profile-size").value = "1000";
    document.getElementById("custom-profile-desc").value = "";
  } else {
    alert("Failed to save profile");
  }
}

// =========================================================================
// UI INITIALIZATION
// =========================================================================

function populateConfigControls() {
  const containers = {
    sys: document.getElementById("params-detection-container"),
    math: document.getElementById("params-math-container")
  };

  const trackingContainer = document.getElementById("params-tracking-container");
  const weaponContainer = document.getElementById("params-weapon-container");

  Object.keys(CONFIG).forEach((key) => {
    if (key === "get") return;

    const cfg = CONFIG[key];
    let container;

    if (key.includes("TRACKING") || key.includes("LOCK") || key.includes("ECM")) {
      container = trackingContainer;
    } else if (key.includes("WEAPON") || key.includes("ACCURACY")) {
      container = weaponContainer;
    } else if (cfg.cat === "sys" && !key.includes("CLUSTER")) {
      container = containers["sys"];
    } else {
      container = containers["math"];
    }

    if (!container) return;

    const group = document.createElement("div");
    group.className = "control-group";

    const label = document.createElement("label");
    const unitText = cfg.unit ? ` (${cfg.unit})` : "";
    label.innerHTML = `<span class="tag tag-sys">SYS</span>${cfg.name}${unitText}`;

    const dualInputGroup = document.createElement("div");
    dualInputGroup.className = "dual-input-group";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = cfg.min;
    slider.max = cfg.max;
    slider.step = cfg.step;
    slider.value = cfg.val;

    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.min = cfg.min;
    numInput.max = cfg.max;
    numInput.step = cfg.step;
    numInput.value = cfg.val;
    bindDualInput(slider, numInput, (value) => {
      cfg.val = value;
    });

    dualInputGroup.appendChild(slider);
    dualInputGroup.appendChild(numInput);

    group.appendChild(label);
    group.appendChild(dualInputGroup);
    container.appendChild(group);
  });
}

function populateShipSelects() {
  const shipTypes = ImprovedSensorMath.getAvailableShipTypes();
  const selects = [DOM.entityShipType, document.getElementById("default-ship-profile")];

  selects.forEach((select) => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = "";
    shipTypes.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    });
    if (currentValue && shipTypes.includes(currentValue)) {
      select.value = currentValue;
    }
  });

  if (DOM.entityShipType && !DOM.entityShipType.value) {
    DOM.entityShipType.value = "Heavy Frigate";
    const profile = ImprovedSensorMath.getShipProfile("Heavy Frigate");
    if (DOM.entityProfileDesc) DOM.entityProfileDesc.textContent = profile.description;
  }

  const defaultSelect = document.getElementById("default-ship-profile");
  if (defaultSelect && !defaultSelect.value) {
    defaultSelect.value = STATE.defaultShipType;
  }
  const defaultProfile = ImprovedSensorMath.getShipProfile(STATE.defaultShipType);
  document.getElementById("profile-description").textContent = defaultProfile.description;
}

function populateWeaponSelects() {
  const select = document.getElementById("default-weapon");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = "";

  WEAPON_DB.weapons_test.forEach((w) => {
    const option = document.createElement("option");
    option.value = w.id;
    option.textContent = w.name;
    select.appendChild(option);
  });

  if (currentValue && BAKED_WEAPONS[currentValue]) {
    select.value = currentValue;
  } else {
    select.value = STATE.defaultWeapon;
  }
}

function initUI() {
  DOM.init();
  ENTITY_LIST_PATCHER = createEntityListPatcher(DOM.entityList, {
    onSelect: (id) => selectEntity(id),
    onDelete: (id) => deleteEntity(id)
  });

  initializeWeaponDatabase();
  ImprovedSensorMath.loadCustomProfiles();

  populateConfigControls();
  populateShipSelects();
  populateWeaponSelects();
  ensureFormControlLabels();

  setupInputHandlers();
  DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;
  if (!STATE.showRangeRings && STATE.showRangeLegend) {
    renderLegendWhenRingsDisabled();
  }
  syncOverlayControls();

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  registerServiceWorker();

  resetSim();

  updateSensorModeButtons();
  updateEntityControlUI();

  log("Enhanced sensor testbed initialized with weapon system!", "INFO", "ALPHA");

  loop(0);
}

function updateEntityControlUI() {
  const entity = STATE.entities.find((e) => e.id === STATE.selectedId);
  if (!entity) {
    DOM.entityControlPanel.style.display = "none";
    return;
  }

  DOM.entityControlPanel.style.display = "block";
  const teamLabel = entity.team ? entity.team.toUpperCase() : "TEAM";
  DOM.entityControlId.innerText = `ID: ${entity.id} [${teamLabel}]`;

  DOM.entityShipType.value = entity.shipType;
  DOM.entityTeam.value = entity.team;

  DOM.entityVel.value = Math.round(entity.speed);
  DOM.entityVelNum.value = Math.round(entity.speed);
  DOM.entityHead.value = Math.round(deg(entity.heading));
  DOM.entityHeadNum.value = Math.round(deg(entity.heading));

  DOM.entitySensorPower.value = entity.sensorPower.toFixed(1);
  DOM.entitySensorPowerNum.value = entity.sensorPower.toFixed(1);
  DOM.entityEcm.value = entity.ecm.toFixed(1);
  DOM.entityEcmNum.value = entity.ecm.toFixed(1);

  const profile = ImprovedSensorMath.getShipProfile(entity.shipType);
  DOM.entityProfileDesc.textContent = profile.description;

  updateSensorModeButtons();
  renderWeaponSlots();
}

function updateEntityControlInfo() {
  const entity = STATE.entities.find((e) => e.id === STATE.selectedId);
  if (entity && DOM.infoSig) {
    DOM.infoSig.textContent = entity.signature.toFixed(1);
    DOM.infoActivity.textContent = (entity.activityLevel * 100).toFixed(0) + "%";
    if (DOM.infoWeaponActivity) {
      DOM.infoWeaponActivity.textContent = (entity.weaponActivityLevel * 100).toFixed(0) + "%";
    }

    DOM.infoDetection.textContent = entity.detectionScore.toFixed(1);
    DOM.infoDetection.style.color = entity.detectionScore < 50 ? "var(--warning)" : "var(--accent)";
  }
}

// =========================================================================
// WEAPON SLOTS UI
// =========================================================================
function renderWeaponSlots() {
  const entity = STATE.entities.find((e) => e.id === STATE.selectedId);
  if (!entity || !DOM.entityWeaponsList) return;

  DOM.entityWeaponsList.innerHTML = "";

  if (!entity.weapons || entity.weapons.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.style.color = "var(--text-dim)";
    emptyMsg.style.fontSize = "10px";
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.padding = "10px";
    emptyMsg.textContent = "No weapons installed";
    DOM.entityWeaponsList.appendChild(emptyMsg);
    return;
  }

  entity.weapons.forEach((slot, index) => {
    const slotDiv = document.createElement("div");
    slotDiv.className = "weapon-slot";
    slotDiv.dataset.entityId = String(entity.id);
    slotDiv.dataset.slotId = String(slot.slotId);
    slotDiv.dataset.weaponId = String(slot.weaponId);

    const header = document.createElement("div");
    header.className = "weapon-slot-header";
    header.innerHTML = `<span style=\"color: var(--accent); font-weight: bold;\">ID:${entity.id} / SLOT:${slot.slotId}</span>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "weapon-slot-delete danger";
    deleteBtn.textContent = "X";
    deleteBtn.title = "Remove weapon slot";
    deleteBtn.setAttribute("aria-label", "Remove weapon slot");
    deleteBtn.onclick = () => deleteWeaponSlot(entity.id, index);
    header.appendChild(deleteBtn);

    slotDiv.appendChild(header);

    const controls = document.createElement("div");
    controls.className = "weapon-slot-controls";

    const weaponSelect = document.createElement("select");
    weaponSelect.id = `weapon-slot-${slot.slotId}-weapon`;
    weaponSelect.setAttribute("aria-label", `Weapon slot ${index + 1} type`);
    Object.keys(BAKED_WEAPONS).forEach((weaponId) => {
      const weapon = BAKED_WEAPONS[weaponId];
      const option = document.createElement("option");
      option.value = weaponId;
      option.textContent = weapon.name;
      weaponSelect.appendChild(option);
    });
    weaponSelect.value = slot.weaponId;
    weaponSelect.onchange = (e) => updateWeaponSlot(entity.id, index, { weaponId: e.target.value });

    const countLabel = document.createElement("label");
    countLabel.textContent = "Qty:";
    countLabel.style.flex = "0";
    countLabel.style.marginRight = "4px";
    countLabel.style.fontSize = "10px";

    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.id = `weapon-slot-${slot.slotId}-count`;
    countInput.min = "0";
    countInput.max = "999";
    countInput.step = "1";
    countInput.setAttribute("aria-label", `Weapon slot ${index + 1} quantity`);
    countInput.value = String(slot.count || 0);
    attachSafeNumberInput(
      countInput,
      { min: 0, max: 999, step: 1, fallback: Number(slot.count) || 0 },
      (value) => {
        updateWeaponSlot(entity.id, index, { count: Math.round(value) });
      }
    );

    const activeLabel = document.createElement("label");
    activeLabel.style.flex = "0";
    activeLabel.style.marginRight = "4px";
    activeLabel.style.fontSize = "10px";
    activeLabel.innerHTML =
      '<input type=\"checkbox\" id=\"weapon-slot-' + slot.slotId + '-active\"> Active';
    const activeCheckbox = activeLabel.querySelector("input");
    activeCheckbox.checked = slot.active;
    activeCheckbox.onchange = (e) =>
      updateWeaponSlot(entity.id, index, { active: e.target.checked });

    controls.appendChild(weaponSelect);
    controls.appendChild(countLabel);
    controls.appendChild(countInput);
    controls.appendChild(activeLabel);

    slotDiv.appendChild(controls);

    const weapon = BAKED_WEAPONS[slot.weaponId];
    if (weapon && slot.count > 0) {
      const info = document.createElement("div");
      info.style.fontSize = "9px";
      info.style.color = "var(--text-dim)";
      info.style.marginTop = "4px";
      info.textContent = `Range: ${(weapon.maxRangeM / 1000).toFixed(1)}km | Weight: ${weapon.baseActivityWeight}`;
      slotDiv.appendChild(info);
    }

    DOM.entityWeaponsList.appendChild(slotDiv);
  });

  ensureFormControlLabels();
}

function addWeaponSlot() {
  const entity = STATE.entities.find((e) => e.id === STATE.selectedId);
  if (!entity) return;

  if (!entity.weapons) entity.weapons = [];

  entity.weapons.push({
    weaponId: "pulse_laser_mk1",
    count: 1,
    active: false,
    slotId: STATE.getNextSlotId()
  });

  renderWeaponSlots();
  entity.updateSignature();
  updateEntityControlInfo();
  updateWeaponInfo();
  UI_SCHEDULER.mark("dirtyHUD", "dirtyEntityList", "dirtyLegend", "dirtyWeaponPanel");
}

function updateWeaponSlot(entityId, slotIndex, updates) {
  const entity = STATE.entities.find((e) => e.id === entityId);
  if (!entity || !entity.weapons || slotIndex >= entity.weapons.length) return;

  if (updates && Object.prototype.hasOwnProperty.call(updates, "count")) {
    updates.count = Math.round(
      coerceNumberValue(String(updates.count), {
        min: 0,
        max: 999,
        step: 1,
        fallback: entity.weapons[slotIndex].count || 0
      }).value
    );
  }

  Object.assign(entity.weapons[slotIndex], updates);
  renderWeaponSlots();
  entity.updateSignature();
  updateEntityControlInfo();
  updateWeaponInfo();
  UI_SCHEDULER.mark("dirtyHUD", "dirtyEntityList", "dirtyLegend", "dirtyWeaponPanel");
}

function deleteWeaponSlot(entityId, slotIndex) {
  const entity = STATE.entities.find((e) => e.id === entityId);
  if (!entity || !entity.weapons || slotIndex >= entity.weapons.length) return;

  entity.weapons.splice(slotIndex, 1);
  renderWeaponSlots();
  entity.updateSignature();
  updateEntityControlInfo();
  updateWeaponInfo();
  UI_SCHEDULER.mark("dirtyHUD", "dirtyEntityList", "dirtyLegend", "dirtyWeaponPanel");
}

function spawnEntity() {
  const id = IDGenerator.next();
  const player = STATE.getSelected();
  const focus = player ? { x: player.x, y: player.y } : { x: 0, y: 0 };
  const spawnPoint = computeSpawnPoint(STATE.entities, STATE.defaultTeam, focus);

  const entity = new Entity(
    id,
    spawnPoint.x,
    spawnPoint.y,
    STATE.defaultShipType,
    STATE.defaultTeam
  );
  entity.speed = 50 + Math.random() * 50;
  entity.weapons = [
    { weaponId: STATE.defaultWeapon, count: 1, active: false, slotId: STATE.getNextSlotId() }
  ];

  if (STATE.defaultTeam === TEAMS.ALPHA) {
    entity.heading = 0;
  } else {
    entity.heading = Math.PI;
  }

  entity.team = STATE.defaultTeam;
  entity.updateSignature();
  STATE.entities.push(entity);
  selectEntity(id);
  refreshEntityList();
  updateHUD();
  render();
  log(
    `Spawned ${entity.shipType} (ID: ${id}, Team: ${entity.team})`,
    "INFO",
    entity.team === TEAMS.ALPHA ? "ALPHA" : "BETA"
  );
  UI_SCHEDULER.mark("dirtyHUD", "dirtyEntityList", "dirtyLegend", "dirtyWeaponPanel");
}

function resetSim() {
  STATE._nextSlotId = 1;
  STATE.entities = [];
  IDGenerator.reset();

  const focus = { x: 0, y: 0 };
  const alphaSpawn = computeSpawnPoint([], TEAMS.ALPHA, focus);
  const alpha = new Entity(
    IDGenerator.next(),
    alphaSpawn.x,
    alphaSpawn.y,
    "Heavy Frigate",
    TEAMS.ALPHA
  );
  alpha.weapons = [
    { weaponId: STATE.defaultWeapon, count: 2, active: false, slotId: STATE.getNextSlotId() }
  ];
  const betaSpawn = computeSpawnPoint([{ team: TEAMS.ALPHA, x: alpha.x, y: alpha.y }], TEAMS.BETA, focus);
  const beta = new Entity(IDGenerator.next(), betaSpawn.x, betaSpawn.y, "Heavy Frigate", TEAMS.BETA);
  beta.weapons = [
    { weaponId: STATE.defaultWeapon, count: 2, active: false, slotId: STATE.getNextSlotId() }
  ];
  beta.heading = Math.PI;
  alpha.updateSignature();
  beta.updateSignature();

  STATE.entities.push(alpha, beta);
  STATE.selectedId = alpha.id;
  updateEntityControlUI();

  STATE.outgoingLock = {
    targetId: null,
    trackingTime: 0,
    status: "NONE",
    quality: 0,
    prevStatus: "NONE"
  };
  STATE.incomingLocks = [];
  DistanceCache.clear();
  refreshEntityList();
  updateHUD();
  render();

  log("Simulation reset", "WARN", "SYS");
  UI_SCHEDULER.reset();
}

function selectEntity(id) {
  STATE.selectedId = id;
  DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;

  if (STATE.outgoingLock.targetId !== id) {
    STATE.outgoingLock.targetId = id;
    STATE.outgoingLock.trackingTime = 0;
    log(`Targeting ID ${id}`, "INFO", "SYS");
  }

  updateEntityControlUI();
  updateEntityControlInfo();

  document.querySelectorAll(".entity-item").forEach((el) => el.classList.remove("active-entity"));
  const item = document.getElementById(`ent-${id}`);
  if (item) item.classList.add("active-entity");
  UI_SCHEDULER.mark("dirtyHUD", "dirtyEntityList", "dirtyLegend", "dirtyWeaponPanel");
}

function deleteEntity(id) {
  const entity = STATE.entities.find((e) => e.id === id);
  if (!entity) return;

  STATE.entities = STATE.entities.filter((e) => e.id !== id);
  STATE.incomingLocks = STATE.incomingLocks.filter((l) => l.sourceId !== id);
  if (STATE.outgoingLock.targetId === id) {
    STATE.outgoingLock = {
      targetId: null,
      trackingTime: 0,
      status: "NONE",
      quality: 0,
      prevStatus: "NONE"
    };
  }
  DistanceCache.clear();

  if (STATE.selectedId === id) {
    const fallback = STATE.entities[0] || null;
    STATE.selectedId = fallback ? fallback.id : null;
    updateEntityControlUI();
  }

  if (STATE.outgoingLock.targetId === id) {
    STATE.outgoingLock.targetId = null;
    STATE.outgoingLock.trackingTime = 0;
    STATE.outgoingLock.status = "NONE";
  }

  refreshEntityList();
  render();
  log(`Deleted entity ${id}`, "INFO", "SYS");
  UI_SCHEDULER.mark("dirtyHUD", "dirtyEntityList", "dirtyLegend", "dirtyWeaponPanel");
}

function refreshEntityList() {
  if (!DOM.entityList) return;

  const selected = STATE.getSelected();

  if (!ENTITY_LIST_PATCHER) {
    ENTITY_LIST_PATCHER = createEntityListPatcher(DOM.entityList, {
      onSelect: (id) => selectEntity(id),
      onDelete: (id) => deleteEntity(id)
    });
  }

  ENTITY_LIST_PATCHER.patch(
    STATE.entities.map((e) => ({
      id: e.id,
      shipType: e.shipType,
      team: e.team,
      distanceKm: selected ? (dist(e, selected) / 1000).toFixed(1) : "?",
      selected: e.id === STATE.selectedId
    }))
  );
}

function exportState() {
  const exportData = {
    schemaVersion: 3,
    entities: STATE.entities.map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      speed: e.speed,
      heading: e.heading,
      shipType: e.shipType,
      team: e.team,
      weapons: e.weapons,
      ecm: e.ecm,
      sensorPower: e.sensorPower,
      sensorMode: e.sensorMode,
      radarActive: e.radarActive,
      shipSizeM: e.shipSizeM,
      shipSizeGrowthPerSecond: e.shipSizeGrowthPerSecond,
      shipScale: e.shipScale,
      shipGrowthPerSecond: e.shipGrowthPerSecond
    })),
    config: Object.keys(CONFIG)
      .filter((k) => k !== "get")
      .reduce((acc, k) => {
        acc[k] = CONFIG[k].val;
        return acc;
      }, {}),
    zoom: STATE.zoom,
    panX: STATE.panX,
    panY: STATE.panY,
    defaultShipType: STATE.defaultShipType,
    defaultTeam: STATE.defaultTeam,
    defaultWeapon: STATE.defaultWeapon,
    nextSlotId: STATE._nextSlotId,
    telemetryEnabled: !!STATE.telemetryEnabled,
    showRangeRings: STATE.showRangeRings,
    showRangeLegend: STATE.showRangeLegend,
    ringVisibilityMode: sanitizeRingVisibilityMode(STATE.ringVisibilityMode),
    relativeOptions: {
      mode: STATE.relativeOptions.mode,
      includeAllies: STATE.relativeOptions.includeAllies,
      includeEnemies: STATE.relativeOptions.includeEnemies,
      maxTargets: STATE.relativeOptions.maxTargets
    }
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sensor_testbed_state.json";
  a.click();
  URL.revokeObjectURL(url);

  log("State exported to JSON", "INFO", "SYS");
}

function importState() {
  const fileInput = document.getElementById("import-file-input");
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select a file");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      STATE.entities = [];
      IDGenerator.reset();
      STATE._nextSlotId = 1;

      if (data.entities && Array.isArray(data.entities)) {
        const validationReport = [];
        data.entities.forEach((eData) => {
          const entity = new Entity(
            IDGenerator.next(),
            eData.x || 0,
            eData.y || 0,
            eData.shipType || "Heavy Frigate",
            eData.team || TEAMS.NEUTRAL
          );
          entity.speed = eData.speed || 0;
          entity.heading = eData.heading || 0;
          entity.team = eData.team || TEAMS.NEUTRAL;
          entity.ecm = eData.ecm || 0;
          entity.sensorPower = eData.sensorPower || 1.0;
          entity.sensorMode = eData.sensorMode || "Active";
          entity.radarActive = eData.radarActive ?? true;
          const profile = ImprovedSensorMath.getShipProfile(entity.shipType);
          const fallbackSizeM = resolveShipSizeMeters(profile.sizeM, profile.size, SHIP_SIZE_M_DEFAULT);
          const legacySizeM =
            typeof eData.shipScale === "number" && Number.isFinite(eData.shipScale)
              ? legacyShipScaleToMeters(eData.shipScale, profile.size)
              : fallbackSizeM;
          entity.shipSizeM = resolveShipSizeMeters(eData.shipSizeM, undefined, legacySizeM);
          entity.shipScale = 1;
          if (
            typeof eData.shipSizeGrowthPerSecond === "number" &&
            Number.isFinite(eData.shipSizeGrowthPerSecond)
          ) {
            entity.shipSizeGrowthPerSecond = eData.shipSizeGrowthPerSecond;
          } else if (
            typeof eData.shipGrowthPerSecond === "number" &&
            Number.isFinite(eData.shipGrowthPerSecond)
          ) {
            entity.shipSizeGrowthPerSecond = eData.shipGrowthPerSecond * fallbackSizeM;
          }
          entity.shipGrowthPerSecond = 0;

          if (eData.weapons && Array.isArray(eData.weapons)) {
            entity.weapons = eData.weapons.map((slot) => {
              if (!BAKED_WEAPONS[slot.weaponId]) {
                validationReport.push(
                  `Entity ${entity.id}: Unknown weapon '${slot.weaponId}' - disabled`
                );
                return {
                  weaponId: slot.weaponId,
                  count: slot.count || 0,
                  active: false,
                  slotId: slot.slotId || STATE.getNextSlotId(),
                  _unknown: true
                };
              }
              return {
                weaponId: slot.weaponId,
                count: slot.count || 0,
                active: slot.active || false,
                slotId: slot.slotId || STATE.getNextSlotId()
              };
            });
          } else if (eData.weaponId) {
            entity.weapons = [
              {
                weaponId: eData.weaponId,
                count: 1,
                active: eData.weaponsFiring || false,
                slotId: STATE.getNextSlotId()
              }
            ];
          }

          STATE.entities.push(entity);
        });

        if (validationReport.length > 0) {
          console.warn("Import validation warnings:", validationReport);
          log(
            `State imported with ${validationReport.length} warnings (see console)`,
            "WARN",
            "SYS"
          );
        } else {
          log("State imported from JSON", "INFO", "SYS");
        }
      }

      if (data.config) {
        Object.keys(data.config).forEach((k) => {
          if (CONFIG[k]) {
            CONFIG[k].val = data.config[k];
          }
        });
      }

      if (data.zoom !== undefined) {
        setZoom(parseZoomFromNumber(String(data.zoom), STATE.zoom), false);
      }
      if (data.panX !== undefined) STATE.panX = data.panX;
      if (data.panY !== undefined) STATE.panY = data.panY;
      if (data.defaultShipType) STATE.defaultShipType = data.defaultShipType;
      if (data.defaultTeam) STATE.defaultTeam = data.defaultTeam;
      if (data.defaultWeapon) STATE.defaultWeapon = data.defaultWeapon;
      if (data.nextSlotId) STATE._nextSlotId = data.nextSlotId;
      if (typeof data.telemetryEnabled === "boolean") {
        STATE.telemetryEnabled = data.telemetryEnabled;
      } else if (typeof data.telemetryMode === "string") {
        STATE.telemetryEnabled = data.telemetryMode !== "off";
      }
      if (typeof data.showRangeRings === "boolean") {
        STATE.showRangeRings = data.showRangeRings;
      }
      if (typeof data.showRangeLegend === "boolean") {
        STATE.showRangeLegend = data.showRangeLegend;
      }
      if (data.relativeOptions && typeof data.relativeOptions === "object") {
        const mode = data.relativeOptions.mode;
        if (mode === "selected" || mode === "all") {
          STATE.relativeOptions.mode = mode;
        }
        if (typeof data.relativeOptions.includeAllies === "boolean") {
          STATE.relativeOptions.includeAllies = data.relativeOptions.includeAllies;
        }
        if (typeof data.relativeOptions.includeEnemies === "boolean") {
          STATE.relativeOptions.includeEnemies = data.relativeOptions.includeEnemies;
        }
        if (Number.isFinite(Number(data.relativeOptions.maxTargets))) {
          const maxTargets = Math.round(Number(data.relativeOptions.maxTargets));
          STATE.relativeOptions.maxTargets = Math.max(1, Math.min(50, maxTargets));
        }
      }
      STATE.ringVisibilityMode = sanitizeRingVisibilityMode(
        data.ringVisibilityMode,
        sanitizeRingVisibilityMode(STATE.ringVisibilityMode)
      );

      const fallback = STATE.entities[0] || null;
      STATE.selectedId = fallback ? fallback.id : null;
      updateEntityControlUI();
      syncOverlayControls();
      DYNAMIC_LEGEND_KEY = LEGEND_KEY_DIRTY;

      document.getElementById("import-modal").style.display = "none";
      UI_SCHEDULER.reset();
    } catch (err) {
      console.error("Import error:", err);
      alert("Failed to import state: " + err.message);
    }
  };

  reader.readAsText(file);
}

function log(msg, type = "INFO", tag = "") {
  if (!DOM.logPanel) return;

  const entry = document.createElement("div");
  entry.className = "log-entry";
  const time = new Date().toISOString().substr(11, 8);
  const tagHtml = tag ? `<span class="log-tag">[${tag}]</span>` : "";
  entry.innerHTML = `<span class="log-time">[${time}]</span>${tagHtml}<span class="log-type-${type}">${type}</span>: ${msg}`;
  DOM.logPanel.prepend(entry);
  if (DOM.logPanel.childNodes.length > 50) DOM.logPanel.lastChild.remove();
}

// =========================================================================
// PERFORMANCE TEST HARNESS
// =========================================================================

function runPerfTests() {
  log("Starting performance test harness...", "INFO", "SYS");

  const savedEntities = STATE.entities;

  PERF_COUNTERS.reset();

  const syntheticEntities = [];

  for (let i = 0; i < 19; i++) {
    const entity = {
      id: i,
      x: (Math.random() - 0.5) * 100000,
      y: (Math.random() - 0.5) * 100000,
      z: 0,
      speed: Math.random() * 200,
      heading: Math.random() * Math.PI * 2,
      shipType: ["Interceptor", "Corvette", "Light Frigate", "Heavy Frigate", "Destroyer"][
        Math.floor(Math.random() * 5)
      ],
      weapons: [
        {
          weaponId: "pulse_laser_mk1",
          count: Math.floor(Math.random() * 4) + 1,
          active: Math.random() > 0.5,
          slotId: 1
        }
      ],
      radarActive: true,
      signature: 0,
      activityLevel: 0,
      weaponActivityLevel: 0,
      detectionScore: 0,
      team: TEAMS.ALPHA
    };
    syntheticEntities.push(entity);
  }

  for (let i = 19; i < 39; i++) {
    const entity = {
      id: i,
      x: (Math.random() - 0.5) * 100000,
      y: (Math.random() - 0.5) * 100000,
      z: 0,
      speed: Math.random() * 200,
      heading: Math.random() * Math.PI * 2,
      shipType: ["Interceptor", "Corvette", "Light Frigate", "Heavy Frigate", "Destroyer"][
        Math.floor(Math.random() * 5)
      ],
      weapons: [
        {
          weaponId: "pulse_laser_mk1",
          count: Math.floor(Math.random() * 4) + 1,
          active: Math.random() > 0.5,
          slotId: 1
        }
      ],
      radarActive: true,
      signature: 0,
      activityLevel: 0,
      weaponActivityLevel: 0,
      detectionScore: 0,
      team: TEAMS.BETA
    };
    syntheticEntities.push(entity);
  }

  const observer = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

  const iterations = 10;
  const startTime = performance.now();

  for (let iter = 0; iter < iterations; iter++) {
    syntheticEntities.forEach((e) => {
      const velocityRatio = e.speed / 200;
      e.weaponActivityLevel = calculateWeaponActivity(e);
      e.activityLevel = ImprovedSensorMath.computeActivityLevel(
        velocityRatio,
        e.weaponActivityLevel,
        e.radarActive
      );

      e.signature = ImprovedSensorMath.computeSignature(e.shipType, e.activityLevel);

      const dx = e.x - observer.x;
      const dy = e.y - observer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      e.detectionScore = ImprovedSensorMath.computeDetectionScore(
        e.signature,
        CONFIG.get("SENSOR_STRENGTH"),
        distance
      );

      const vel = { x: Math.cos(e.heading) * e.speed, y: Math.sin(e.heading) * e.speed, z: 0 };
      const pos = { x: e.x, y: e.y, z: e.z };
      ImprovedSensorMath.computeAngularVelocity(pos, vel, observer, { x: 0, y: 0, z: 0 });
    });

    ImprovedSensorMath.clusterTargets(syntheticEntities, CONFIG.get("CLUSTER_RAD"));
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  const report = PERF_COUNTERS.getReport();

  log(
    `PERF TEST COMPLETE: ${iterations} iterations, 39 entities (19 allies + 20 enemies)`,
    "INFO",
    "SYS"
  );
  log(
    `Total time: ${totalTime.toFixed(2)}ms (${(totalTime / iterations).toFixed(2)}ms per iteration)`,
    "INFO",
    "SYS"
  );
  log(`Total function calls: ${report.total_function_calls}`, "INFO", "SYS");
  log(`Expensive ops (tanh+exp+atan): ${report.expensive_ops}`, "INFO", "SYS");
  log(`Activity computations: ${report.breakdown.activity}`, "INFO", "SYS");
  log(`Weapon activity computations: ${report.breakdown.weaponActivity}`, "INFO", "SYS");
  log(`Signature computations: ${report.breakdown.signature}`, "INFO", "SYS");
  log(`Detection score computations: ${report.breakdown.detection}`, "INFO", "SYS");
  log(`sqrt calls: ${report.expensive_breakdown.sqrt}`, "INFO", "SYS");

  console.log("=== PERFORMANCE TEST REPORT ===");
  console.log("Total time:", totalTime.toFixed(2), "ms");
  console.log("Per iteration:", (totalTime / iterations).toFixed(2), "ms");
  console.log("Per entity per iteration:", (totalTime / (iterations * 39)).toFixed(4), "ms");
  console.log("Function calls:", report);

  STATE.entities = savedEntities;

  log("performance test complete and check console", "INFORMATION", "SYSTEM INFORMATION");
}

window.__spawnDiagnostics = {
  targetSeparationM: SPAWN_TARGET_SEPARATION_M,
  measureAverageSeparation(pairCount = 300) {
    const stats = estimateSpawnSeparationStats(Math.max(1, Math.floor(Number(pairCount) || 300)));
    return {
      ...stats,
      targetSeparationM: SPAWN_TARGET_SEPARATION_M,
      avgDistanceKm: stats.avgDistanceM / 1000,
      minDistanceKm: stats.minDistanceM / 1000,
      maxDistanceKm: stats.maxDistanceM / 1000
    };
  }
};

// Start
initUI();
