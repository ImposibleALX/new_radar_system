import { describe, expect, it } from "vitest";
import {
  SPAWN_MIN_GLOBAL_CLEARANCE_M,
  SPAWN_TARGET_SEPARATION_M,
  SPAWN_WORLD_BOUND_M,
  computeSpawnPoint,
  estimateSpawnSeparationStats
} from "../../src/core/sim/spawnPlanner";

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("spawnPlanner", () => {
  it("keeps average inter-team separation near target 50 km", () => {
    const random = createSeededRandom(1337);
    const stats = estimateSpawnSeparationStats(300, random);
    expect(stats.samples).toBe(300);
    expect(stats.avgDistanceM).toBeGreaterThan(SPAWN_TARGET_SEPARATION_M - 4000);
    expect(stats.avgDistanceM).toBeLessThan(SPAWN_TARGET_SEPARATION_M + 4000);
    expect(stats.maxDistanceM - stats.minDistanceM).toBeGreaterThan(250);
  });

  it("keeps spawned positions within world bounds", () => {
    const random = createSeededRandom(99);
    const entities: Array<{ team: "alpha" | "beta"; x: number; y: number }> = [];
    for (let i = 0; i < 200; i += 1) {
      const alpha = computeSpawnPoint(entities, "alpha", { x: 0, y: 0 }, random);
      entities.push({ team: "alpha", x: alpha.x, y: alpha.y });
      const beta = computeSpawnPoint(entities, "beta", { x: 0, y: 0 }, random);
      entities.push({ team: "beta", x: beta.x, y: beta.y });
    }

    entities.forEach((entity) => {
      expect(Math.abs(entity.x)).toBeLessThanOrEqual(SPAWN_WORLD_BOUND_M);
      expect(Math.abs(entity.y)).toBeLessThanOrEqual(SPAWN_WORLD_BOUND_M);
    });
  });

  it("avoids severe same-team overlaps under repeated spawn pressure", () => {
    const random = createSeededRandom(2026);
    const entities: Array<{ team: "alpha" | "beta"; x: number; y: number }> = [];
    for (let i = 0; i < 180; i += 1) {
      const alpha = computeSpawnPoint(entities, "alpha", { x: 0, y: 0 }, random);
      entities.push({ team: "alpha", x: alpha.x, y: alpha.y });
      const beta = computeSpawnPoint(entities, "beta", { x: 0, y: 0 }, random);
      entities.push({ team: "beta", x: beta.x, y: beta.y });
    }

    const minSameTeamDistance = (team: "alpha" | "beta"): number => {
      const points = entities.filter((entity) => entity.team === team);
      let min = Number.POSITIVE_INFINITY;
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
          if (distance < min) min = distance;
        }
      }
      return min;
    };

    expect(minSameTeamDistance("alpha")).toBeGreaterThan(SPAWN_MIN_GLOBAL_CLEARANCE_M * 0.35);
    expect(minSameTeamDistance("beta")).toBeGreaterThan(SPAWN_MIN_GLOBAL_CLEARANCE_M * 0.35);
  });
});
