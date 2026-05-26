import { test, expect } from '@playwright/test';

// Placeholder smoke test. Run with the app started locally:
//   npm run dev   # in one terminal
//   npm run test:e2e
// The full E2E suite (with a webServer and a seeded test DB) is added in a
// later batch; this just confirms the app boots and serves a page.
test('app serves the home page', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(500);
});
