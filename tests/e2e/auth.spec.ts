import { test, expect } from '@playwright/test';

// Auth flow does not require an LLM key, only a migrated database.
test('a new user can sign up, log out and sign back in', async ({ page }) => {
  const email = `e2e-${Date.now()}@test.dev`;
  const password = 'supersecret';

  // Sign up
  await page.goto('/signup');
  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  // Log out (the logout control lives in the app shell)
  await page.getByRole('button', { name: /log ?out|sign ?out/i }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Sign back in
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
});
