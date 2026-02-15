import type { Entity } from "../domain/entity";
import type { IncomingLock, OutgoingLock } from "../domain/types";
import { getConfig } from "../domain/config";
import {
  computeAngularVelocity,
  computeDetectionScore,
  computeLockState
} from "../math/sensorMath";

export interface LockStateContext {
  entities: Entity[];
  selected: Entity | null;
  outgoingLock: OutgoingLock;
  incomingLocks: IncomingLock[];
  dt: number;
}

export function updateLocks(
  ctx: LockStateContext,
  dist: (a: Entity, b: Entity) => number,
  log: (msg: string, type?: string, tag?: string) => void
): void {
  const selected = ctx.selected;
  if (!selected) return;

  const out = ctx.outgoingLock;
  const target = out.targetId
    ? ctx.entities.find((entity) => entity.id === out.targetId) || null
    : null;

  if (target && target.detected) {
    out.trackingTime += ctx.dt;
    const targetVel = {
      x: Math.cos(target.heading) * target.speed,
      y: Math.sin(target.heading) * target.speed,
      z: 0
    };
    const ctrlVel = { x: selected.vx, y: selected.vy, z: 0 };
    const [angVel] = computeAngularVelocity(
      { x: target.x, y: target.y, z: 0 },
      targetVel,
      { x: selected.x, y: selected.y, z: 0 },
      ctrlVel
    );
    const lock = computeLockState(
      target.detectionScore,
      angVel,
      out.trackingTime,
      getConfig("TRACKING_SPEED")
    );
    out.status = lock.state;
    out.quality = lock.quality;
  } else {
    out.trackingTime = Math.max(0, out.trackingTime - ctx.dt * 2);
    out.status = "NONE";
    out.quality = 0;
  }

  if (out.status !== out.prevStatus) {
    log(`OutgoingLock: ${out.status} [${Math.round(out.quality * 100)}%]`, "LOCK", "SYS");
    out.prevStatus = out.status;
  }

  ctx.incomingLocks.length = 0;
  ctx.entities.forEach((source) => {
    if (source === selected || source.team === selected.team) return;
    const sourceSensorMultiplier =
      source.sensorPower !== undefined ? Number(source.sensorPower) : 1.0;
    const sourceSensorPower = getConfig("SENSOR_STRENGTH") * sourceSensorMultiplier;
    const distance = dist(source, selected);
    const detectionScore = computeDetectionScore(selected.signature, sourceSensorPower, distance);
    if (detectionScore < getConfig("DETECT_THRESH")) {
      source._incomingTrackingTime = Math.max(0, source._incomingTrackingTime - ctx.dt * 2);
      if (source._incomingTrackingTime <= 0 && source._prevIncomingStatus !== "NONE") {
        log(`IncomingLockFrom: ${source.id} LOST`, "LOCK", "SYS");
        source._prevIncomingStatus = "NONE";
      }
      return;
    }

    const sourceVel = {
      x: Math.cos(source.heading) * source.speed,
      y: Math.sin(source.heading) * source.speed,
      z: 0
    };
    const ctrlVel = { x: selected.vx, y: selected.vy, z: 0 };
    const [sourceAngVel] = computeAngularVelocity(
      { x: selected.x, y: selected.y, z: 0 },
      ctrlVel,
      { x: source.x, y: source.y, z: 0 },
      sourceVel
    );
    source._incomingTrackingTime = Math.max(0, source._incomingTrackingTime + ctx.dt);
    const incoming = computeLockState(
      detectionScore,
      sourceAngVel,
      source._incomingTrackingTime,
      getConfig("TRACKING_SPEED")
    );
    ctx.incomingLocks.push({
      sourceId: source.id,
      targetId: selected.id,
      status: incoming.state,
      quality: incoming.quality,
      detectionScore
    });

    if (source._prevIncomingStatus !== incoming.state) {
      log(
        `IncomingLockFrom: ${source.id} => ${incoming.state} [${Math.round(incoming.quality * 100)}%]`,
        "LOCK",
        "SYS"
      );
      source._prevIncomingStatus = incoming.state;
    }
  });
}
