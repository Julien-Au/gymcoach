import { test, expect } from '@playwright/test';

// Hevy CSV import (issue #113): switch the settings import section to Hevy,
// upload an export, check the dry-run preview, confirm, and find the imported
// session in the history. Mirrors import.spec.ts (Strong), which is untouched.

// One warmup + two working sets + one broken line. The history page counts
// working sets only, so it shows "2 sets" after the confirm.
const HEVY_CSV = [
  'title,start_time,end_time,exercise_title,set_index,set_type,weight_kg,reps,distance_km,duration_seconds',
  'Push Day,2026-05-02 09:13:00,2026-05-02 10:05:00,Bench Press,0,warmup,40,8,,',
  'Push Day,2026-05-02 09:13:00,2026-05-02 10:05:00,Bench Press,1,normal,80,8,,',
  'Push Day,2026-05-02 09:13:00,2026-05-02 10:05:00,Bench Press,2,normal,80,7,,',
  'Push Day,not-a-date,2026-05-02 10:05:00,Bench Press,3,normal,80,6,,',
].join('\n');

test('a lifter can preview and confirm a Hevy CSV import', async ({ page }) => {
  // Sign up through the API (fresh user; the cookie lands in the context). A
  // unique X-Forwarded-For keeps this spec in its own register rate-limit
  // bucket - the suite's parallel UI signups use up the 5/min per-IP budget.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.2' },
    data: {
      displayName: 'Hevy E2E',
      email: `e2e-hevy-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.goto('/settings');
  await expect(page.getByText('Import from Strong')).toBeVisible();

  // Switch the source app to Hevy: the unit toggle (Strong-only) disappears.
  await page.getByLabel('Source app').click();
  await page.getByRole('option', { name: 'Hevy' }).click();
  await expect(page.getByText('Import from Hevy')).toBeVisible();
  await expect(page.getByText('Strong weight unit')).not.toBeVisible();

  // Upload the file: the dry-run preview appears, nothing imported yet.
  await page
    .locator('input[type="file"][accept=".csv,text/csv"]')
    .setInputFiles({
      name: 'hevy.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(HEVY_CSV, 'utf-8'),
    });

  const preview = page.getByTestId('import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('1 session, 3 sets to import');
  await expect(preview).toContainText('1 new exercise will be created: Bench Press');
  await expect(preview).toContainText('Line 5');

  // Confirm and find the imported session in the history with its real time.
  await page.getByRole('button', { name: /confirm import/i }).click();
  await expect(page.getByTestId('import-preview')).not.toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('May 02, 2026')).toBeVisible();
  await expect(page.getByText('2 sets')).toBeVisible();
});
