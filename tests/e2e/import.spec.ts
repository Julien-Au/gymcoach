import { test, expect } from '@playwright/test';

// Strong CSV import (issue #100): upload an export in settings, check the
// dry-run preview, confirm, and find the imported session in the history.

const STRONG_CSV = [
  'Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Distance,Seconds',
  '2026-05-02 09:00:00,Push Day,Bench Press,1,80,8,0,0',
  '2026-05-02 09:00:00,Push Day,Bench Press,2,80,7,0,0',
  'broken-line,Push Day,Bench Press,3,80,6,0,0',
].join('\n');

test('a lifter can preview and confirm a Strong CSV import', async ({ page }) => {
  // Sign up (fresh user each run).
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Import E2E');
  await page.getByLabel('Email').fill(`e2e-import-${Date.now()}@test.dev`);
  await page.getByLabel('Password').fill('supersecret');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/settings');
  await expect(page.getByText('Import from Strong')).toBeVisible();

  // Upload the file: the dry-run preview appears, nothing imported yet.
  await page
    .locator('input[type="file"][accept=".csv,text/csv"]')
    .setInputFiles({
      name: 'strong.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(STRONG_CSV, 'utf-8'),
    });

  const preview = page.getByTestId('import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('1 session, 2 sets to import');
  await expect(preview).toContainText('1 new exercise will be created: Bench Press');
  await expect(preview).toContainText('Line 4');

  // Confirm and find the imported session in the history.
  await page.getByRole('button', { name: /confirm import/i }).click();
  await expect(page.getByTestId('import-preview')).not.toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('May 02, 2026')).toBeVisible();
  await expect(page.getByText('2 sets')).toBeVisible();
});
