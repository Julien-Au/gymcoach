import { test, expect } from '@playwright/test';

// TCX cardio import (issue #152): switch the settings import section to TCX,
// upload an activity file, check the dry-run preview, confirm, and find the
// imported cardio session with its heart rate in the history detail.

const RUN_TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-05-20T07:30:00.000Z</Id>
      <Lap StartTime="2026-05-20T07:30:00.000Z">
        <TotalTimeSeconds>1800</TotalTimeSeconds>
        <DistanceMeters>5000</DistanceMeters>
        <AverageHeartRateBpm><Value>152</Value></AverageHeartRateBpm>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

test('a lifter can import a TCX activity as a cardio session', async ({ page }) => {
  // Sign up through the API (fresh user; the cookie lands in the context). A
  // unique X-Forwarded-For keeps this spec in its own register rate-limit
  // bucket - the suite's parallel UI signups use up the 5/min per-IP budget.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.3' },
    data: {
      displayName: 'TCX E2E',
      email: `e2e-tcx-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.goto('/settings');
  await expect(page.getByText('Import from Strong')).toBeVisible();

  // Switch the source to TCX: the copy flips to the cardio activity import.
  await page.getByLabel('Source app').click();
  await page.getByRole('option', { name: 'TCX file' }).click();
  await expect(page.getByText('Import a TCX activity')).toBeVisible();

  // Upload the file: the dry-run preview appears, nothing imported yet.
  await page.locator('input[type="file"][accept^=".tcx"]').setInputFiles({
    name: 'morning-run.tcx',
    mimeType: 'application/xml',
    buffer: Buffer.from(RUN_TCX, 'utf-8'),
  });

  const preview = page.getByTestId('import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('1 cardio session (Running)');
  await expect(preview).toContainText('30:00 · 5 km · avg HR 152 bpm logged as Running');

  // Confirm and find the imported session in the history.
  await page.getByRole('button', { name: /confirm import/i }).click();
  await expect(page.getByTestId('import-preview')).not.toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('May 20, 2026')).toBeVisible();

  // The session detail shows the cardio set with its average heart rate.
  await page.getByRole('link', { name: /May 20, 2026/ }).click();
  await expect(page.getByRole('heading', { name: 'Running' })).toBeVisible();
  await expect(page.getByText('152 bpm')).toBeVisible();
});
