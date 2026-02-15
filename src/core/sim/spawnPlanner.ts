import type { Team } from "../domain/types";

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface SpawnEntityLike {
  team: Team | string;
  x: number;
  y: number;
}

export interface SpawnSeparationStats {
  samples: number;
  avgDistanceM: number;
  minDistanceM: number;
  maxDistanceM: number;
}

export const SPAWN_TARGET_SEPARATION_M = 50000;
export const SPAWN_SEPARATION_JITTER_M = 5000;
export const SPAWN_ALLY_CLUSTER_RADIUS_M = 6000;
export const SPAWN_WORLD_BOUND_M = 250000;
export const SPAWN_CANDIDATE_ATTEMPTS = 14;
export const SPAWN_MIN_SAME_TEAM_CLEARANCE_M = 1500;
export const SPAWN_MIN_GLOBAL_CLEARANCE_M = 700;

const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampPointToWorld(point: SpawnPoint): SpawnPoint {
  return {
    x: clamp(point.x, -SPAWN_WORLD_BOUND_M, SPAWN_WORLD_BOUND_M),
    y: clamp(point.y, -SPAWN_WORLD_BOUND_M, SPAWN_WORLD_BOUND_M)
  };
}

function normalizeTeam(team: Team | string): "alpha" | "beta" {
  return String(team).toLowerCase() === "beta" ? "beta" : "alpha";
}

function sampleTargetSeparation(random: () => number): number {
  return SPAWN_TARGET_SEPARATION_M + (random() * 2 - 1) * SPAWN_SEPARATION_JITTER_M;
}

function sampleClusterOffset(random: () => number): SpawnPoint {
  const angle = random() * TAU;
  const radius = Math.sqrt(random()) * SPAWN_ALLY_CLUSTER_RADIUS_M;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function averagePoint(points: SpawnPoint[]): SpawnPoint | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), {
    x: 0,
    y: 0
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function centroidForTeam(entities: SpawnEntityLike[], team: "alpha" | "beta"): SpawnPoint | null {
  return averagePoint(
    entities.filter((entity) => normalizeTeam(entity.team) === team).map(({ x, y }) => ({ x, y }))
  );
}

function toUnitAxis(dx: number, dy: number, random: () => number): SpawnPoint {
  const norm = Math.hypot(dx, dy);
  if (norm > 1e-6) return { x: dx / norm, y: dy / norm };
  const angle = random() * TAU;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function buildAnchorsFromMidpoint(
  midpoint: SpawnPoint,
  axis: SpawnPoint,
  targetSeparation: number
): { alpha: SpawnPoint; beta: SpawnPoint } {
  const half = targetSeparation * 0.5;
  return {
    alpha: { x: midpoint.x - axis.x * half, y: midpoint.y - axis.y * half },
    beta: { x: midpoint.x + axis.x * half, y: midpoint.y + axis.y * half }
  };
}

function clampMidpointForAxis(
  midpoint: SpawnPoint,
  axis: SpawnPoint,
  targetSeparation: number
): SpawnPoint {
  const half = targetSeparation * 0.5;
  const minX = -SPAWN_WORLD_BOUND_M + Math.abs(axis.x) * half;
  const maxX = SPAWN_WORLD_BOUND_M - Math.abs(axis.x) * half;
  const minY = -SPAWN_WORLD_BOUND_M + Math.abs(axis.y) * half;
  const maxY = SPAWN_WORLD_BOUND_M - Math.abs(axis.y) * half;
  return {
    x: clamp(midpoint.x, minX, maxX),
    y: clamp(midpoint.y, minY, maxY)
  };
}

function projectAnchorsAroundMidpoint(
  alpha: SpawnPoint,
  beta: SpawnPoint,
  targetSeparation: number,
  random: () => number
): { alpha: SpawnPoint; beta: SpawnPoint } {
  const axis = toUnitAxis(beta.x - alpha.x, beta.y - alpha.y, random);
  const midX = (alpha.x + beta.x) * 0.5;
  const midY = (alpha.y + beta.y) * 0.5;
  const clampedMid = clampMidpointForAxis({ x: midX, y: midY }, axis, targetSeparation);
  return buildAnchorsFromMidpoint(clampedMid, axis, targetSeparation);
}

function chooseDirectionWithRoom(
  origin: SpawnPoint,
  preferred: SpawnPoint,
  targetSeparation: number,
  random: () => number
): SpawnPoint {
  const preferredUnit = toUnitAxis(preferred.x, preferred.y, random);
  const candidates: SpawnPoint[] = [
    preferredUnit,
    { x: -preferredUnit.x, y: -preferredUnit.y },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  for (let i = 0; i < 4; i += 1) {
    const angle = random() * TAU;
    candidates.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }

  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  candidates.forEach((axis) => {
    const target = {
      x: origin.x + axis.x * targetSeparation,
      y: origin.y + axis.y * targetSeparation
    };
    const clampedTarget = clampPointToWorld(target);
    const clampError = Math.hypot(target.x - clampedTarget.x, target.y - clampedTarget.y);
    const alignScore = axis.x * preferredUnit.x + axis.y * preferredUnit.y;
    const boundaryMargin = Math.min(
      SPAWN_WORLD_BOUND_M - Math.abs(clampedTarget.x),
      SPAWN_WORLD_BOUND_M - Math.abs(clampedTarget.y)
    );
    const score = boundaryMargin - clampError * 8 + alignScore * 1000;
    if (score > bestScore) {
      bestScore = score;
      best = axis;
    }
  });

  return best;
}

function computeSpawnAnchors(
  entities: SpawnEntityLike[],
  focus: SpawnPoint,
  random: () => number
): { alpha: SpawnPoint; beta: SpawnPoint } {
  const alphaCenter = centroidForTeam(entities, "alpha");
  const betaCenter = centroidForTeam(entities, "beta");
  const targetSeparation = sampleTargetSeparation(random);

  if (alphaCenter && betaCenter) {
    const projected = projectAnchorsAroundMidpoint(alphaCenter, betaCenter, targetSeparation, random);
    return {
      alpha: clampPointToWorld(projected.alpha),
      beta: clampPointToWorld(projected.beta)
    };
  }

  if (alphaCenter) {
    const direction = chooseDirectionWithRoom(
      alphaCenter,
      { x: focus.x - alphaCenter.x, y: focus.y - alphaCenter.y },
      targetSeparation,
      random
    );
    const betaPoint = clampPointToWorld({
      x: alphaCenter.x + direction.x * targetSeparation,
      y: alphaCenter.y + direction.y * targetSeparation
    });
    return {
      alpha: clampPointToWorld(alphaCenter),
      beta: betaPoint
    };
  }

  if (betaCenter) {
    const direction = chooseDirectionWithRoom(
      betaCenter,
      { x: betaCenter.x - focus.x, y: betaCenter.y - focus.y },
      targetSeparation,
      random
    );
    const alphaPoint = clampPointToWorld({
      x: betaCenter.x - direction.x * targetSeparation,
      y: betaCenter.y - direction.y * targetSeparation
    });
    return {
      alpha: alphaPoint,
      beta: clampPointToWorld(betaCenter)
    };
  }

  const seedAxis = toUnitAxis(1, 0, random);
  const midpoint = clampMidpointForAxis(focus, seedAxis, targetSeparation);
  const anchored = buildAnchorsFromMidpoint(midpoint, seedAxis, targetSeparation);
  return { alpha: clampPointToWorld(anchored.alpha), beta: clampPointToWorld(anchored.beta) };
}

function distanceToClosest(points: SpawnPoint[], candidate: SpawnPoint): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  let minDistance = Number.POSITIVE_INFINITY;
  points.forEach((point) => {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance < minDistance) minDistance = distance;
  });
  return minDistance;
}

function scoreSpawnCandidate(
  candidate: SpawnPoint,
  anchor: SpawnPoint,
  sameTeamPoints: SpawnPoint[],
  allPoints: SpawnPoint[]
): number {
  const closestSameTeam = distanceToClosest(sameTeamPoints, candidate);
  const closestAny = distanceToClosest(allPoints, candidate);
  const sameTeamScore =
    closestSameTeam === Number.POSITIVE_INFINITY
      ? 1
      : Math.min(1.5, closestSameTeam / SPAWN_MIN_SAME_TEAM_CLEARANCE_M);
  const anyScore =
    closestAny === Number.POSITIVE_INFINITY
      ? 1
      : Math.min(1.5, closestAny / SPAWN_MIN_GLOBAL_CLEARANCE_M);
  const anchorDistance = Math.hypot(candidate.x - anchor.x, candidate.y - anchor.y);
  const anchorPenalty = Math.min(1.25, anchorDistance / (SPAWN_ALLY_CLUSTER_RADIUS_M * 1.2));

  let hardPenalty = 0;
  if (closestAny < SPAWN_MIN_GLOBAL_CLEARANCE_M * 0.4) hardPenalty += 2;
  if (closestSameTeam < SPAWN_MIN_SAME_TEAM_CLEARANCE_M * 0.5) hardPenalty += 1.5;

  return sameTeamScore * 1.1 + anyScore * 0.8 - anchorPenalty * 0.3 - hardPenalty;
}

export function computeSpawnPoint(
  entities: SpawnEntityLike[],
  team: Team | string,
  focus: SpawnPoint,
  random: () => number = Math.random
): SpawnPoint {
  const normalizedTeam = normalizeTeam(team);
  const anchors = computeSpawnAnchors(entities, focus, random);
  const anchor = normalizedTeam === "beta" ? anchors.beta : anchors.alpha;
  const allPoints = entities.map(({ x, y }) => ({ x, y }));
  const sameTeamPoints = entities
    .filter((entity) => normalizeTeam(entity.team) === normalizedTeam)
    .map(({ x, y }) => ({ x, y }));

  const attemptCount = allPoints.length === 0 ? 1 : SPAWN_CANDIDATE_ATTEMPTS;
  let bestPoint = clampPointToWorld(anchor);
  let bestScore = scoreSpawnCandidate(bestPoint, anchor, sameTeamPoints, allPoints);

  for (let attempt = 1; attempt < attemptCount; attempt += 1) {
    const jitter = sampleClusterOffset(random);
    const candidate = clampPointToWorld({ x: anchor.x + jitter.x, y: anchor.y + jitter.y });
    const score = scoreSpawnCandidate(candidate, anchor, sameTeamPoints, allPoints);
    if (score > bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

export function estimateSpawnSeparationStats(
  pairCount = 250,
  random: () => number = Math.random
): SpawnSeparationStats {
  const focus = { x: 0, y: 0 };
  const entities: SpawnEntityLike[] = [];
  const distances: number[] = [];
  let alphaCount = 0;
  let betaCount = 0;
  let alphaSumX = 0;
  let alphaSumY = 0;
  let betaSumX = 0;
  let betaSumY = 0;

  for (let i = 0; i < pairCount; i += 1) {
    const alpha = computeSpawnPoint(entities, "alpha", focus, random);
    entities.push({ team: "alpha", x: alpha.x, y: alpha.y });
    alphaCount += 1;
    alphaSumX += alpha.x;
    alphaSumY += alpha.y;

    const beta = computeSpawnPoint(entities, "beta", focus, random);
    entities.push({ team: "beta", x: beta.x, y: beta.y });
    betaCount += 1;
    betaSumX += beta.x;
    betaSumY += beta.y;

    if (alphaCount > 0 && betaCount > 0) {
      const alphaCenter = { x: alphaSumX / alphaCount, y: alphaSumY / alphaCount };
      const betaCenter = { x: betaSumX / betaCount, y: betaSumY / betaCount };
      distances.push(Math.hypot(alphaCenter.x - betaCenter.x, alphaCenter.y - betaCenter.y));
    }
  }

  if (distances.length === 0) {
    return {
      samples: 0,
      avgDistanceM: 0,
      minDistanceM: 0,
      maxDistanceM: 0
    };
  }

  const sum = distances.reduce((acc, value) => acc + value, 0);
  return {
    samples: distances.length,
    avgDistanceM: sum / distances.length,
    minDistanceM: Math.min(...distances),
    maxDistanceM: Math.max(...distances)
  };
}
