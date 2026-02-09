import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["json", { outputFile: "e2e/test-results/results.json" }], ["github"]]
    : [["html", { open: "on-failure" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // Auth setup — runs once, saves auth state for dependent projects
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
    },

    // Desktop browsers
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },

    // Mobile viewports
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 15"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },

    // Tablet viewport
    {
      name: "tablet",
      use: {
        viewport: { width: 1024, height: 1366 },
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
      testMatch: /features\/(smoke|devices|applications)\.spec\.ts/,
    },

    // Visual regression
    {
      name: "visual-regression",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
      testDir: "./e2e/visual",
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
