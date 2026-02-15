import { expect, test } from "@playwright/test";

test("app boots and can spawn/select entities", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("main-canvas")).toBeVisible();

  const selectedBeforeText = (await page.getByTestId("entity-control-id").textContent()) || "ID: 0";
  const selectedBefore = Number((selectedBeforeText.match(/\d+/) || ["0"])[0]);
  await page.getByTestId("btn-spawn").click();
  await expect
    .poll(async () => {
      const text = (await page.getByTestId("entity-control-id").textContent()) || "ID: 0";
      return Number((text.match(/\d+/) || ["0"])[0]);
    })
    .toBeGreaterThan(selectedBefore);
  await expect(page.getByTestId("entity-control-panel")).toBeVisible();
  await expect(page.getByTestId("entity-control-id")).toContainText("ID:");
});

test("import/export controls are wired", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("btn-export-state").click();
  await page.getByTestId("btn-import-state").click();
  await expect(page.getByTestId("import-modal")).toBeVisible();
  await page.getByTestId("btn-import-cancel").click();
  await expect(page.getByTestId("import-modal")).toBeHidden();
});

test("telemetry is simple off/on without mode selector", async ({ page }) => {
  await page.goto("/");

  const telemetryToggle = page.locator("#telemetry-toggle");
  const telemetryButton = page.locator("#btn-telemetry-toggle");

  await expect(page.locator("#telemetry-mode-select")).toHaveCount(0);
  await expect(telemetryToggle).not.toBeChecked();
  await expect(telemetryButton).not.toHaveClass(/mode-active/);

  await telemetryButton.click();
  await expect(telemetryToggle).toBeChecked();
  await expect(telemetryButton).toHaveClass(/mode-active/);

  await telemetryButton.click();
  await expect(telemetryToggle).not.toBeChecked();
  await expect(telemetryButton).not.toHaveClass(/mode-active/);
});
