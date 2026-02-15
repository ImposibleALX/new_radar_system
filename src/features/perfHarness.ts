import { getConfig } from "../core/domain/config";
import { calculateWeaponActivity } from "../core/domain/weapons";
import {
  clusterTargets,
  computeActivityLevel,
  computeAngularVelocity,
  computeDetectionScore,
  computeSignature
} from "../core/math/sensorMath";
import type { AppRuntime } from "../main";

export function runPerfTests(runtime: AppRuntime): void {
  runtime.log("starting performance test harness...", "INFO", "SYS");
  runtime.resetPerfCounters();

  const syntheticEntities = [];
  for (let i = 0; i < 39; i += 1) {
    const ally = i < 19;
    syntheticEntities.push({
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
      team: ally ? "alpha" : "beta"
    });
  }

  const observer = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  const iterations = 10;
  const start = performance.now();

  for (let iter = 0; iter < iterations; iter += 1) {
    syntheticEntities.forEach((entity) => {
      const velocityRatio = entity.speed / 200;
      entity.weaponActivityLevel = calculateWeaponActivity(entity.weapons, runtime.perfCounters);
      entity.activityLevel = computeActivityLevel(
        velocityRatio,
        entity.weaponActivityLevel,
        entity.radarActive
      );
      entity.signature = computeSignature(entity.shipType, entity.activityLevel);
      const dx = entity.x - observer.x;
      const dy = entity.y - observer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      entity.detectionScore = computeDetectionScore(
        entity.signature,
        getConfig("SENSOR_STRENGTH"),
        distance
      );
      const vel = {
        x: Math.cos(entity.heading) * entity.speed,
        y: Math.sin(entity.heading) * entity.speed,
        z: 0
      };
      const pos = { x: entity.x, y: entity.y, z: entity.z };
      computeAngularVelocity(pos, vel, observer, { x: 0, y: 0, z: 0 });
    });

    clusterTargets(syntheticEntities, getConfig("CLUSTER_RAD"));
  }

  const totalMs = performance.now() - start;
  const totalCalls =
    runtime.perfCounters.activityComputations +
    runtime.perfCounters.weaponActivityComputations +
    runtime.perfCounters.signatureComputations +
    runtime.perfCounters.detectionScoreComputations +
    runtime.perfCounters.lockStateComputations +
    runtime.perfCounters.clusterOperations +
    runtime.perfCounters.distanceComputations +
    runtime.perfCounters.angularVelocityComputations;

  runtime.log(`PERF TEST COMPLETE: ${iterations} iterations, 39 entities`, "INFO", "SYS");
  runtime.log(
    `Total time: ${totalMs.toFixed(2)}ms (${(totalMs / iterations).toFixed(2)}ms per iteration)`,
    "INFO",
    "SYS"
  );
  runtime.log(`Total function calls: ${totalCalls}`, "INFO", "SYS");
  runtime.log(`sqrt calls: ${runtime.perfCounters.sqrtCalls}`, "INFO", "SYS");
  console.log("performance report", {
    totalMs,
    perIterationMs: totalMs / iterations,
    counters: runtime.perfCounters
  });
}
