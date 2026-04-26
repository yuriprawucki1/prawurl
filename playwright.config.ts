import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "bash -lc 'if [ -s ~/.nvm/nvm.sh ]; then source ~/.nvm/nvm.sh; fi; npm run dev:mock -- --port 4175'",
    url: "http://127.0.0.1:4175/app",
    reuseExistingServer: !process.env.CI,
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
