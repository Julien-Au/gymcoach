import { test, expect } from '@playwright/test';

// FIT cardio import (issue #249): switch the settings import section to FIT,
// upload a binary FIT file, check the dry-run preview, confirm, and find the
// imported cardio session with its heart rate in the history detail.
//
// A real FIT file from the official Garmin SDK: running, 25 min, 5 km, HR
// 150/175, start 2026-03-15T09:00:00Z (same fixture as the unit/integration tests).
const RUN_FIT_B64 =
  'DgLYUlkAAAAuRklUmYtAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAAQKRlE0gQAAEEAABIACP0EhgIEhgUBAgcEhggEhgkEhhABAhEBAgHsLhlEECkZRAFg4xYAYOMWACChBwCWr/Jq';

test('a lifter can import a FIT activity as a cardio session', async ({ page }) => {
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.5' },
    data: {
      displayName: 'FIT E2E',
      email: `e2e-fit-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.goto('/settings');
  await expect(page.getByText('Import from Strong')).toBeVisible();

  // Switch the source to FIT: the copy flips to the cardio activity import.
  await page.getByLabel('Source app').click();
  await page.getByRole('option', { name: 'FIT file' }).click();
  await expect(page.getByText('Import a FIT activity')).toBeVisible();

  // Upload the binary file: the dry-run preview appears, nothing imported yet.
  await page.locator('input[type="file"][accept^=".fit"]').setInputFiles({
    name: 'morning-run.fit',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(RUN_FIT_B64, 'base64'),
  });

  const preview = page.getByTestId('import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('1 cardio session (Running)');
  await expect(preview).toContainText('avg HR 150 bpm');
  await expect(preview).toContainText('logged as Running');

  // Confirm and find the imported session in the history.
  await page.getByRole('button', { name: /confirm import/i }).click();
  await expect(page.getByTestId('import-preview')).not.toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('March 15, 2026')).toBeVisible();

  await page.getByRole('link', { name: /March 15, 2026/ }).click();
  await expect(page.getByRole('heading', { name: 'Running' })).toBeVisible();
  await expect(page.getByText('150 bpm')).toBeVisible();
});
