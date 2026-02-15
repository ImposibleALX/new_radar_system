import type { SensorMode, Team, WeaponSlot } from "./types";
import { calculateWeaponActivity } from "./weapons";
import { computeActivityLevel, computeSignature, getShipProfile } from "../math/sensorMath";
import {
  SHIP_SIZE_M_DEFAULT,
  advanceShipSizeMeters,
  resolveShipSizeMeters
} from "../render/shipSize";

export class Entity {
  id: number;
  team: Team;
  shipType: string;
  weapons: WeaponSlot[] = [];

  x: number;
  y: number;
  z = 0;

  speed = 0;
  heading = 0;
  vx = 0;
  vy = 0;
  vz = 0;

  radarActive = true;
  sensorMode: SensorMode = "Active";
  sensorPower = 1.0;

  signature = 0;
  activityLevel = 0;
  weaponActivityLevel = 0;
  detected = false;
  detectionScore = 0;
  trackingQuality = 0;
  angularVelocity = 0;
  hitProbability = 0;
  ecm = 0;
  shipSizeM = SHIP_SIZE_M_DEFAULT;
  shipSizeGrowthPerSecond = 0;
  shipScale = 1;
  shipGrowthPerSecond = 0;

  _incomingTrackingTime = 0;
  _prevIncomingStatus = "NONE";
  _weaponDistFactor = 0;
  _weaponTrackFactor = 0;

  constructor(id: number, x: number, y: number, shipType: string, team: Team) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.shipType = shipType || "Heavy Frigate";
    this.team = team;
    const profile = getShipProfile(this.shipType);
    this.shipSizeM = resolveShipSizeMeters(profile.sizeM, profile.size, SHIP_SIZE_M_DEFAULT);
  }

  getWeaponsFiringCount(): number {
    if (!this.weapons || this.weapons.length === 0) return 0;
    return this.weapons.reduce((sum, slot) => sum + (slot.active ? slot.count || 0 : 0), 0);
  }

  weaponsFiringBool(): boolean {
    if (!this.weapons || this.weapons.length === 0) return false;
    return this.weapons.some((slot) => slot.active && (slot.count || 0) > 0);
  }

  getSizeClass(): string {
    return getShipProfile(this.shipType).size || "m";
  }

  getShipSizeMeters(): number {
    const profile = getShipProfile(this.shipType);
    const fallback = resolveShipSizeMeters(profile.sizeM, profile.size, SHIP_SIZE_M_DEFAULT);
    return resolveShipSizeMeters(this.shipSizeM, undefined, fallback);
  }

  updateVelocity(): void {
    this.vx = Math.cos(this.heading) * this.speed;
    this.vy = Math.sin(this.heading) * this.speed;
    this.vz = 0;
  }

  updateSignature(perf?: { weaponActivityComputations?: number }): void {
    const velocityRatio = this.speed / 200;
    this.weaponActivityLevel = calculateWeaponActivity(this.weapons, perf);
    this.activityLevel = computeActivityLevel(
      velocityRatio,
      this.weaponActivityLevel,
      this.radarActive
    );
    this.signature = computeSignature(this.shipType, this.activityLevel);
  }

  update(dt: number, perf?: { weaponActivityComputations?: number }): void {
    this.updateVelocity();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.shipSizeM = advanceShipSizeMeters(
      this.getShipSizeMeters(),
      this.shipSizeGrowthPerSecond,
      dt
    );
    this.updateSignature(perf);
  }
}
