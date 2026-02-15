import { expect, test } from "@playwright/test";

test("numeric inputs are clamped/sanitized and zoom remains smooth after Fill Grid", async ({
  page
}) => {
  await page.goto("/");

  const zoomInput = page.getByTestId("zoom-val-num");
  await page.getByTestId("btn-fit-grid").click();
  await expect(zoomInput).toHaveValue("0.01");

  await page.getByTestId("main-canvas").hover();
  const progression: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, -120);
    progression.push(Number(await zoomInput.inputValue()));
  }
  expect(progression[progression.length - 1]).toBeGreaterThanOrEqual(0.05);
  for (let i = 1; i < progression.length; i += 1) {
    expect(progression[i]).toBeGreaterThan(progression[i - 1]);
    expect(progression[i] - progression[i - 1]).toBeLessThan(0.02);
  }

  const afterZoomIn = progression[progression.length - 1];
  await page.mouse.wheel(0, 120);
  const afterZoomOut = Number(await zoomInput.inputValue());
  expect(afterZoomOut).toBeGreaterThanOrEqual(0.01);
  expect(afterZoomOut).toBeLessThan(afterZoomIn);

  await expect(page.locator("#telemetry-mode-select")).toHaveCount(0);
  const relTargets = page.locator("#relative-max-targets");
  await expect(relTargets).toBeVisible();
  await relTargets.fill("999");
  await relTargets.blur();
  await expect(relTargets).toHaveValue("50");

  const customGain = page.locator("#custom-profile-gain");
  await page.evaluate(() => {
    const input = document.getElementById("custom-profile-gain") as HTMLInputElement | null;
    if (!input) return;
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  });
  await expect(customGain).toHaveValue("1.5");
});
