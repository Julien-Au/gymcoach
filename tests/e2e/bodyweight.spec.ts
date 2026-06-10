import { test, expect } from '@playwright/test';

// Bodyweight tracking (issue #99): quick-add a measurement on the progress
// page, see it listed as the current value, then delete it. The card renders
// even with no training data, so a fresh user is enough.

test('a lifter can log and delete a bodyweight entry on the progress page', async ({
  page,
}) => {
  // Sign up (fresh user each run).
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Bodyweight E2E');
  await page.getByLabel('Email').fill(`e2e-bodyweight-${Date.now()}@test.dev`);
  await page.getByLabel('Password').fill('supersecret');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/progress');
  await expect(page.getByText('Bodyweight', { exact: true })).toBeVisible();
  await expect(page.getByText(/no bodyweight logged yet/i)).toBeVisible();

  // Quick-add 82.5 kg.
  await page.getByLabel(/bodyweight \(kg\)/i).fill('82.5');
  await page.getByRole('button', { name: 'Log', exact: true }).click();

  await expect(page.getByText(/current: 82.5 kg/i)).toBeVisible();
  // The entry shows in the recent list with a delete button.
  const deleteButton = page.getByRole('button', { name: /delete entry/i }).first();
  await expect(deleteButton).toBeVisible();

  // Delete it again: back to the empty state.
  await deleteButton.click();
  await expect(page.getByText(/no bodyweight logged yet/i)).toBeVisible();
});
