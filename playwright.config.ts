import { defineConfig, devices } from "@playwright/test";

/**
 * The tests drive a real Deephaven server with the plugin installed. The server
 * loads `tests/app.d` in application mode, so every fixture the specs use is
 * already in the Panels menu when the page loads.
 */
const PORT = Number(process.env.DH_PORT ?? 10000);

export default defineConfig({
  testDir: "./tests",
  timeout: 120 * 1000,
  expect: { timeout: 15 * 1000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}/ide/`,
    navigationTimeout: 60 * 1000,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Anonymous auth keeps the tests out of the PSK login flow.
    command: `deephaven server --no-browser --port ${PORT} --jvm-args "-Ddeephaven.application.dir=./tests/app.d -DAuthHandlers=io.deephaven.auth.AnonymousAuthenticationHandler"`,
    url: `http://localhost:${PORT}/ide/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
