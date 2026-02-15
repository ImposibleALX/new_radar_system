import { expect, test } from "@playwright/test";

type SpawnStats = {
  samples: number;
  targetSeparationM: number;
  avgDistanceM: number;
  minDistanceM: number;
  maxDistanceM: number;
};

test("spawn planner keeps inter-team average near 50 km", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("main-canvas")).toBeVisible();

  const stats = await page.evaluate<SpawnStats>(() => {
    const api = (
      window as Window & {
        __spawnDiagnostics?: { measureAverageSeparation: (pairs: number) => SpawnStats };
      }
    ).__spawnDiagnostics;
    if (!api) throw new Error("__spawnDiagnostics not available");
    return api.measureAverageSeparation(500);
  });

  expect(stats.samples).toBe(500);
  expect(stats.avgDistanceM).toBeGreaterThan(46_000);
  expect(stats.avgDistanceM).toBeLessThan(54_000);
  expect(stats.maxDistanceM).toBeGreaterThan(stats.minDistanceM);
});
