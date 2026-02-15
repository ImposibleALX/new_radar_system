import { expect, test } from "@playwright/test";

type DetectionTrace = {
  selectedToTarget: { score: number; detected: boolean };
  targetToSelected: { score: number; detected: boolean };
};

test("startup detection is symmetric for selected and opposing contact", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("main-canvas")).toBeVisible();

  await expect
    .poll(async () => (await page.locator("#hud-lock-incoming").textContent()) || "")
    .not.toContain("NONE");

  const outgoing = ((await page.locator("#hud-lock-outgoing").textContent()) || "").trim();
  const incoming = ((await page.locator("#hud-lock-incoming").textContent()) || "").trim();

  expect(incoming).not.toContain("NONE");
  expect(outgoing).not.toContain("NONE");

  await expect
    .poll(async () => await page.evaluate(() => Boolean((window as any).__detectionDebug)))
    .toBe(true);
  const trace = await page.evaluate<DetectionTrace>(() => (window as any).__detectionDebug);

  expect(trace.selectedToTarget.detected).toBe(true);
  expect(trace.targetToSelected.detected).toBe(true);
  expect(Math.abs(trace.selectedToTarget.score - trace.targetToSelected.score)).toBeLessThan(1e-6);

  const recentFrames = await page.evaluate<Array<{ updateOrder: string; units: string }>>(() =>
    ((window as any).__detectionDebugFrames || []).slice(-3)
  );
  expect(recentFrames.length).toBeGreaterThan(0);
  for (const frame of recentFrames) {
    expect(frame.updateOrder).toBe("entityDetectionThenLocks");
    expect(frame.units).toBe("meters");
  }
});
