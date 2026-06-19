import { test, expect } from '@playwright/test';

// FIT cardio import (issues #249, #253): switch the settings import section to
// FIT, upload MULTIPLE binary FIT files at once, check the aggregated dry-run
// preview, confirm the batch, and find both imported cardio sessions in history.
//
// Real FIT files from the official Garmin SDK (same fixtures as the unit tests):
// a run (5 km, HR 150/175, 2026-03-15) and a ride (20 km, no HR, 2025-12-01).
const RUN_FIT_B64 =
  'DgLYUlkAAAAuRklUmYtAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAAQKRlE0gQAAEEAABIACP0EhgIEhgUBAgcEhggEhgkEhhABAhEBAgHsLhlEECkZRAFg4xYAYOMWACChBwCWr/Jq';
const BIKE_FIT_B64 =
  'DgLYUkoAAAAuRklU2JJAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAD4949DCQAAAEEAABIABf0EhgIEhgUBAggEhgkEhgEIBpBD+PePQwKA7jYAgIQeAIKV';
// A run carrying record samples -> a session with an HR-over-time track (#254).
const RECORDS_FIT_B64 =
  'DgLYUqwAAAAuRklUVvBAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAADgRTtEBwAAAEEAABQABP0EhgUEhgMBAgYChAHgRTtEAAAAAIzkDAEcRjtEIE4AAJHkDAFYRjtEQJwAAJbkDAGURjtEYOoAAJvkDAHQRjtEgDgBAKDkDAEMRztEoIYBAKXkDEIAABIAB/0EhgIEhgUBAggEhgkEhhABAhEBAgJIRztE4EU7RAFAfgUAoIYBAJalo+o=';

test('a lifter can import multiple FIT activities at once', async ({ page }) => {
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

  // Upload three binary files at once: the aggregated dry-run preview appears.
  await page.locator('input[type="file"][accept^=".fit"]').setInputFiles([
    { name: 'run.fit', mimeType: 'application/octet-stream', buffer: Buffer.from(RUN_FIT_B64, 'base64') },
    { name: 'ride.fit', mimeType: 'application/octet-stream', buffer: Buffer.from(BIKE_FIT_B64, 'base64') },
    { name: 'run-hr.fit', mimeType: 'application/octet-stream', buffer: Buffer.from(RECORDS_FIT_B64, 'base64') },
  ]);

  const preview = page.getByTestId('import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('3 activities to import');
  await expect(preview).toContainText('Biking on');

  // Confirm the batch, then find the sessions in the history.
  await page.getByRole('button', { name: /import 3 sessions/i }).click();
  await expect(page.getByTestId('import-preview')).not.toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('March 15, 2026')).toBeVisible();
  await expect(page.getByText('December 01, 2025')).toBeVisible();

  // The records run (April 10) shows a heart-rate-over-time chart (#254).
  await page.getByRole('link', { name: /April 10, 2026/ }).click();
  await expect(page.getByRole('heading', { name: 'Running' })).toBeVisible();
  await expect(page.getByTestId('activity-track-chart')).toBeVisible();
});
