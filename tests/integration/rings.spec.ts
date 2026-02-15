import { expect, test } from "@playwright/test";

test("ring legend stays in parity with rendered ring model", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("btn-spawn").click();
  await page.getByTestId("ring-visibility-mode-select").selectOption("all");
  const firstWeaponToggle = page
    .locator("[data-testid='entity-weapons-list'] input[type='checkbox']")
    .first();
  if ((await firstWeaponToggle.count()) > 0 && !(await firstWeaponToggle.isChecked())) {
    await firstWeaponToggle.check();
  }

  await expect(page.getByTestId("range-legend")).toBeVisible();
  await expect(page.locator("[data-testid='legend-dynamic'] .legend-item").first()).toBeVisible();

  const staticRows = await page.locator("[data-testid='legend-static'] .legend-item").count();
  const diagnosticsRows = await page
    .locator("[data-testid='legend-diagnostics'] .legend-diagnostic")
    .count();
  expect(staticRows).toBeGreaterThan(0);
  expect(diagnosticsRows).toBeGreaterThan(0);

  const dynamicKeys = await page
    .locator("[data-testid='legend-dynamic'] .legend-item")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-legend-key") || ""));
  expect(dynamicKeys.some((key) => key.startsWith("weapon:") || key.startsWith("detect:"))).toBe(
    true
  );

  const diagnosticIds = await page
    .locator("[data-testid='legend-diagnostics'] .legend-diagnostic")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-diag-id") || ""));
  expect(diagnosticIds.some((id) => id.startsWith("detect:") || id.startsWith("weapon:"))).toBe(
    true
  );

  const canvasDigest = await page.locator("#main-canvas").getAttribute("data-ring-digest");
  const legendDigest = await page.getByTestId("legend-dynamic").getAttribute("data-ring-digest");
  expect(canvasDigest).toBeTruthy();
  expect(canvasDigest).toBe(legendDigest);
});

test("rings remain active with telemetry off and on", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("btn-spawn").click();
  await page.getByTestId("ring-visibility-mode-select").selectOption("all");

  const telemetry = page.locator("#telemetry-toggle");
  await expect(telemetry).toHaveJSProperty("checked", false);

  const digestOff = await page.locator("#main-canvas").getAttribute("data-ring-digest");
  expect(digestOff).toBeTruthy();

  await telemetry.check();
  const digestOn = await page.locator("#main-canvas").getAttribute("data-ring-digest");
  expect(digestOn).toBeTruthy();
  expect(digestOn).toBe(digestOff);

  await telemetry.uncheck();
  const digestOffAgain = await page.locator("#main-canvas").getAttribute("data-ring-digest");
  expect(digestOffAgain).toBe(digestOff);
});

test("range legend stays readable and within viewport bounds", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto("/");
  for (let i = 0; i < 10; i += 1) {
    await page.getByTestId("btn-spawn").click();
  }
  await page.getByTestId("ring-visibility-mode-select").selectOption("all");
  await expect(page.getByTestId("range-legend")).toBeVisible();

  const layout = await page.evaluate(() => {
    const legend = document.getElementById("range-legend");
    const viewport = document.getElementById("viewport");
    if (!legend || !viewport) throw new Error("Missing #range-legend or #viewport");

    const legendRect = legend.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const viewportArea = viewportRect.width * viewportRect.height;
    const legendArea = legendRect.width * legendRect.height;

    const insideViewport =
      legendRect.left >= viewportRect.left - 0.5 &&
      legendRect.top >= viewportRect.top - 0.5 &&
      legendRect.right <= viewportRect.right + 0.5 &&
      legendRect.bottom <= viewportRect.bottom + 0.5;

    return {
      insideViewport,
      heightRatio: viewportRect.height > 0 ? legendRect.height / viewportRect.height : 1,
      areaRatio: viewportArea > 0 ? legendArea / viewportArea : 1
    };
  });

  expect(layout.insideViewport).toBe(true);
  expect(layout.heightRatio).toBeLessThan(0.85);
  expect(layout.areaRatio).toBeLessThan(0.7);
});

test("incoming warning remains discrete and does not overlap range legend", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto("/");
  for (let i = 0; i < 10; i += 1) {
    await page.getByTestId("btn-spawn").click();
  }
  await page.getByTestId("ring-visibility-mode-select").selectOption("all");
  await expect(page.getByTestId("range-legend")).toBeVisible();

  const layout = await page.evaluate(() => {
    const legend = document.getElementById("range-legend");
    const threat = document.getElementById("threat-warning");
    if (!legend || !threat) throw new Error("Missing #range-legend or #threat-warning");

    const legendBefore = legend.getBoundingClientRect();
    threat.classList.add("visible");
    const legendAfter = legend.getBoundingClientRect();

    const threatRect = threat.getBoundingClientRect();
    const overlap = !(
      legendAfter.right <= threatRect.left ||
      legendAfter.left >= threatRect.right ||
      legendAfter.bottom <= threatRect.top ||
      legendAfter.top >= threatRect.bottom
    );

    return {
      overlap,
      legendTopShift: Math.abs(legendAfter.top - legendBefore.top),
      legendBottomShift: Math.abs(legendAfter.bottom - legendBefore.bottom),
      legendHeightShift: Math.abs(legendAfter.height - legendBefore.height),
      threatWidth: threatRect.width,
      threatHeight: threatRect.height,
      threatAreaRatio:
        window.innerWidth > 0 && window.innerHeight > 0
          ? (threatRect.width * threatRect.height) / (window.innerWidth * window.innerHeight)
          : 1
    };
  });

  expect(layout.overlap).toBe(false);
  expect(layout.legendTopShift).toBeLessThan(0.5);
  expect(layout.legendBottomShift).toBeLessThan(0.5);
  expect(layout.legendHeightShift).toBeLessThan(0.5);
  expect(layout.threatWidth).toBeLessThan(240);
  expect(layout.threatHeight).toBeLessThan(34);
  expect(layout.threatAreaRatio).toBeLessThan(0.02);
});
