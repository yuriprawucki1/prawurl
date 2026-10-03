import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4180";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  reporter: "list",
  use: { baseURL, headless: false, permissions: ["clipboard-write"], trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4180 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    env: { VITE_MOCK_API: "false", VITE_API_ORIGIN: process.env.E2E_API_ORIGIN ?? "http://127.0.0.1:4910", VITE_PUBLIC_ORIGIN: baseURL, VITE_APP_ORIGIN: baseURL },
    timeout: 120000
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } } },
    { name: "mobile", use: { ...devices["Pixel 5"] } }
  ]
});
