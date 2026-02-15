import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const host = process.env.PLAYWRIGHT_HOST || "127.0.0.1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests/integration",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: isCI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  forbidOnly: isCI,
  use: {
    baseURL,
    headless: true,
    actionTimeout: 0,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block"
  },
  webServer: {
    command: isCI
      ? `npm run build && npm run preview -- --host ${host} --port ${port} --strictPort`
      : `npm run dev -- --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !isCI
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
