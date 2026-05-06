import { defineConfig, devices } from "@playwright/test";

// Hits the running gateway + vite dev server. Caller is responsible for
// having both up — the workflow either runs `npm run infra:up` and starts
// services in dev mode, or the CI job uses service containers.
//
// To override:
//   E2E_GATEWAY_URL=http://localhost:4000 E2E_WEB_DOCTOR_URL=http://localhost:5173 \
//     npm run test:e2e

const GATEWAY_URL = process.env["E2E_GATEWAY_URL"] ?? "http://localhost:4000";
const WEB_DOCTOR_URL = process.env["E2E_WEB_DOCTOR_URL"] ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false, // tests share the database; serialize for clarity
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? [["github"], ["list"]] : "list",
  use: {
    baseURL: WEB_DOCTOR_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // expose gateway URL to tests via the test fixtures
  metadata: {
    gatewayUrl: GATEWAY_URL,
    webDoctorUrl: WEB_DOCTOR_URL,
  },
});
