import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "layout.spec.ts",
  outputDir: "test-results",
  fullyParallel: true,
  workers: 1,
  timeout: 90000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:4175",
    headless: false,
    permissions: ["clipboard-write"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run dev:mock -- --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175/app",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } }
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] }
    }
  ]
});
