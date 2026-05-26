import { defineConfig, devices } from '@playwright/test';

// End to end tests. The full suite (auth, session logging, program generation,
// conversational coach) is wired with a seeded test database in a later batch.
// For now this config drives the smoke test against a locally running app.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3030',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
