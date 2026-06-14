import { test, expect } from '@playwright/test';

// Body-measurement tracking (issue #202): pick a site, quick-add a value on the
// progress page, see it as the latest-per-site value, then delete it. The card
// renders even with no training data, so a fresh user is enough.

test('a lifter can log and delete a body measurement on the progress page', async ({
  page,
}) => {
  // Register through the API with a unique X-Forwarded-For so this spec keeps
  // its own per-IP register rate-limit bucket (the suite's parallel signups
  // otherwise exhaust the 5/min budget), mirroring the import specs.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.7' },
    data: {
      displayName: 'Measurement E2E',
      email: `e2e-measure-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.goto('/progress');
  // Scope to the Measurements card (the page also has a Bodyweight card).
  const card = page
    .locator('div.rounded-xl', { has: page.getByRole('heading', { name: 'Measurements' }) })
    .first();
  await expect(card.getByRole('heading', { name: 'Measurements' })).toBeVisible();
  await expect(card.getByText(/no waist measurement yet/i)).toBeVisible();

  // Default site is Waist; quick-add 82.5 cm.
  await card.getByLabel(/value \(cm\)/i).fill('82.5');
  await card.getByRole('button', { name: 'Log', exact: true }).click();

  // Latest-per-site shows the value, and a deletable row appears.
  await expect(card.getByText('82.5 cm').first()).toBeVisible();
  const deleteButton = card
    .getByRole('button', { name: /delete waist measurement/i })
    .first();
  await expect(deleteButton).toBeVisible();

  // Delete it: back to the empty trend state for waist.
  await deleteButton.click();
  await expect(card.getByText(/no waist measurement yet/i)).toBeVisible();
});
