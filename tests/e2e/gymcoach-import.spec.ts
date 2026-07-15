import { test, expect } from '@playwright/test';

// GymCoach native CSV import (issue #270): switch the settings import section
// to GymCoach, upload a history-export-shaped CSV, check the dry-run preview,
// confirm, and find the imported session in the history. Mirrors
// hevy-import.spec.ts, which is untouched.

// One warmup + two working sets + one broken line. The history page counts
// working sets only, so it shows "2 sets" after the confirm.
const GYMCOACH_CSV = [
  'session_id,session_date,session_started_at,session_finished_at,workout,exercise,set_number,external_load_kg,reps,rir,is_warmup,is_drop_set,set_notes,duration_sec,distance_m,avg_hr,max_hr',
  's1,2026-05-02,2026-05-02T09:13:00.000Z,2026-05-02T10:05:00.000Z,Push Day,Bench Press,1,40,8,,true,false,,,,,',
  's1,2026-05-02,2026-05-02T09:13:00.000Z,2026-05-02T10:05:00.000Z,Push Day,Bench Press,2,80,8,2,false,false,,,,,',
  's1,2026-05-02,2026-05-02T09:13:00.000Z,2026-05-02T10:05:00.000Z,Push Day,Bench Press,3,80,7,1,false,false,,,,,',
  's1,not-a-date,2026-05-02T09:13:00.000Z,2026-05-02T10:05:00.000Z,Push Day,Bench Press,4,80,6,,false,false,,,,,',
].join('\n');

test('a lifter can preview and confirm a GymCoach CSV import', async ({ page }) => {
  // Sign up through the API (fresh user; the cookie lands in the context). A
  // unique X-Forwarded-For keeps this spec in its own register rate-limit
  // bucket - the suite's parallel UI signups use up the 5/min per-IP budget.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.6' },
    data: {
      displayName: 'GymCoach CSV E2E',
      email: `e2e-gymcoach-csv-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.goto('/settings');
  await expect(page.getByText('Import from Strong')).toBeVisible();

  // Switch the source to GymCoach CSV: the unit toggle (Strong-only) disappears.
  await page.getByLabel('Source app').click();
  await page.getByRole('option', { name: 'GymCoach CSV' }).click();
  await expect(page.getByText('Import from GymCoach')).toBeVisible();
  await expect(page.getByText('Strong weight unit')).not.toBeVisible();

  // Upload the file: the dry-run preview appears, nothing imported yet.
  await page
    .locator('input[type="file"][accept=".csv,text/csv"]')
    .setInputFiles({
      name: 'gymcoach-history.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(GYMCOACH_CSV, 'utf-8'),
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
