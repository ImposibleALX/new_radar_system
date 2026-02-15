import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("main view has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");

  const scan = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();

  const serious = scan.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact || "")
  );

  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
