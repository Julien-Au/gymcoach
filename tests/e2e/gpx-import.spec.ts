import { test, expect } from '@playwright/test';

// GPX cardio import (issue #204): switch the settings import section to GPX,
// upload a route file, check the dry-run preview, confirm, and find the
// imported cardio session with its heart rate in the history detail. Distance
// is derived from the trackpoints (haversine), so it is not asserted exactly.

const RUN_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="e2e" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Evening run</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522"><time>2026-05-21T18:00:00.000Z</time><extensions><gpxtpx:hr>150</gpxtpx:hr></extensions></trkpt>
      <trkpt lat="48.8576" lon="2.3532"><time>2026-05-21T18:01:00.000Z</time><extensions><gpxtpx:hr>152</gpxtpx:hr></extensions></trkpt>
      <trkpt lat="48.8586" lon="2.3542"><time>2026-05-21T18:02:00.000Z</time><extensions><gpxtpx:hr>158</gpxtpx:hr></extensions></trkpt>
      <trkpt lat="48.8596" lon="2.3552"><time>2026-05-21T18:03:00.000Z</time><extensions><gpxtpx:hr>160</gpxtpx:hr></extensions></trkpt>
    </trkseg>
  </trk>
</gpx>`;

test('a lifter can import a GPX activity as a cardio session', async ({ page }) => {
  // Fresh user via the API; a unique X-Forwarded-For keeps this spec in its own
  // register rate-limit bucket (the suite's parallel UI signups use the per-IP
  // 5/min budget).
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.4' },
    data: {
      displayName: 'GPX E2E',
      email: `e2e-gpx-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.goto('/settings');
  await expect(page.getByText('Import from Strong')).toBeVisible();

  // Switch the source to GPX: the copy flips to the cardio activity import.
  await page.getByLabel('Source app').click();
  await page.getByRole('option', { name: 'GPX file' }).click();
  await expect(page.getByText('Import a GPX activity')).toBeVisible();

  // Upload the file: the dry-run preview appears, nothing imported yet.
  await page.locator('input[type="file"][accept^=".gpx"]').setInputFiles({
    name: 'evening-run.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(RUN_GPX, 'utf-8'),
  });

  const preview = page.getByTestId('import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('1 cardio session (Running)');
  // HR averaged from 150/152/158/160 = 155; logged as Running. Distance is
  // haversine-derived so it is not asserted exactly.
  await expect(preview).toContainText('avg HR 155 bpm');
  await expect(preview).toContainText('logged as Running');

  // Confirm and find the imported session in the history.
  await page.getByRole('button', { name: /confirm import/i }).click();
  await expect(page.getByTestId('import-preview')).not.toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('May 21, 2026')).toBeVisible();
  // The history list renders the imported activity as a cardio session (name +
  // HR), not an empty "Free session - 0 kg vol" row.
  await expect(page.getByText('Running')).toBeVisible();
  await expect(page.getByText('155 bpm')).toBeVisible();
  await expect(page.getByText('Free session')).toHaveCount(0);

  // The session detail shows the cardio set with its average heart rate, plus
  // the heart-rate-over-time chart built from the trackpoints (issue #259).
  await page.getByRole('link', { name: /May 21, 2026/ }).click();
  await expect(page.getByRole('heading', { name: 'Running' })).toBeVisible();
  await expect(page.getByText('155 bpm')).toBeVisible();
  await expect(page.getByTestId('activity-track-chart')).toBeVisible();
});
